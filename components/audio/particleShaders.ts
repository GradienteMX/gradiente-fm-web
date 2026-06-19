// GLSL + sim helpers for ParticleField3D (redesign 2026 · SHOWPIECE).
//
// A GPU particle audio-reactive field built on GPUComputationRenderer (FBO
// ping-pong): two compute variables — texturePosition and textureVelocity —
// advected by a curl-noise flow field around a central attractor. The field is
// ALIVE AT REST (the curl flow + attractor never stop) and audio is a
// supercharge layer applied through a handful of uniforms.
//
// House pattern: bare three + raw GLSL (see CRTShader / VibeFluid).
// The compute shaders here are GLSL ES 1.00 fragment shaders consumed by
// GPUComputationRenderer (which wraps them in its own material), so they have
// NO #version / precision header of their own — the wrapper supplies it and the
// `resolution` uniform + `texturePosition`/`textureVelocity` samplers.
//
// All color comes from VIBE_SLOT_COLORS (sampled along the ramp as a uniform
// array in the render fragment shader). No off-ramp hues. Additive blend +
// UnrealBloom give the glow. Photosensitivity: energy that drives brightness /
// bloom is smoothed (EMA) and clamped on the TS side; nothing here oscillates
// full-surface luminance.

// ── Audio feature extraction ─────────────────────────────────────────────────
// Per-band (low/mid/high) mean magnitude from log-mapped FFT bins, an overall
// RMS energy, and a spectral brightness (centroid-ish) that decides color
// position along the ramp. All derived straight from the byte FFT frame — no
// RNG, honest zeros when null. (Same band split + centroid→temperature mapping
// the old useAudioFeatures hook used, folded in here.)

export interface BandEnergies {
  /** Overall RMS energy 0..1 (drives flow speed + brightness/size). */
  energy: number
  /** Low-band mean 0..1 (< ~250Hz) — drives attractor pulse + radial push. */
  low: number
  /** Mid-band mean 0..1 (~250Hz–4kHz). */
  mid: number
  /** High-band mean 0..1 (> ~4kHz) — drives fine turbulence / sparkle. */
  high: number
  /** Spectral brightness 0..1 (cool=bass-heavy, hot=bright) — color position. */
  brightness: number
}

const F_MIN = 20
const F_MAX = 20000
const LOW_MAX_HZ = 250
const MID_MAX_HZ = 4000
// Brightness anchors in log-Hz (matches useAudioFeatures temperature mapping).
const BRIGHT_COOL_HZ = 250
const BRIGHT_HOT_HZ = 6000
const LOG_COOL = Math.log(BRIGHT_COOL_HZ)
const LOG_HOT = Math.log(BRIGHT_HOT_HZ)
const SILENCE_ENERGY = 0.012

export const IDLE_BANDS: BandEnergies = {
  energy: 0,
  low: 0,
  mid: 0,
  high: 0,
  brightness: 0.18, // calm baseline color position — cool end of the ramp
}

/**
 * Extract band energies + brightness from one byte FFT frame.
 * @param data       getByteFrequencyData output, or null when nothing plays.
 * @param sampleRate AudioContext sample rate that produced `data` (bin→Hz).
 */
export function extractBands(
  data: Uint8Array | null,
  sampleRate: number,
): BandEnergies {
  if (!data || data.length === 0) return IDLE_BANDS

  const binCount = data.length
  const binHz = sampleRate / 2 / binCount

  let sumSq = 0
  let weightedHz = 0
  let magSum = 0
  let lowSum = 0
  let lowN = 0
  let midSum = 0
  let midN = 0
  let highSum = 0
  let highN = 0

  // Restrict the centroid + bands to the audible window [F_MIN, F_MAX].
  for (let b = 0; b < binCount; b++) {
    const hz = (b + 0.5) * binHz
    if (hz < F_MIN || hz > F_MAX) continue
    const v = data[b]
    const norm = v / 255
    sumSq += norm * norm
    weightedHz += hz * v
    magSum += v
    if (hz < LOW_MAX_HZ) {
      lowSum += norm
      lowN++
    } else if (hz < MID_MAX_HZ) {
      midSum += norm
      midN++
    } else {
      highSum += norm
      highN++
    }
  }

  const energy = Math.sqrt(sumSq / binCount)
  const low = lowN > 0 ? lowSum / lowN : 0
  const mid = midN > 0 ? midSum / midN : 0
  const high = highN > 0 ? highSum / highN : 0

  if (energy < SILENCE_ENERGY || magSum <= 0) {
    return { energy, low, mid, high, brightness: IDLE_BANDS.brightness }
  }

  const centroidHz = weightedHz / magSum
  const logC = Math.log(Math.max(1, centroidHz))
  const brightness = Math.max(0, Math.min(1, (logC - LOG_COOL) / (LOG_HOT - LOG_COOL)))

  return { energy, low, mid, high, brightness }
}

// ── Compute: velocity FBO ─────────────────────────────────────────────────────
// Velocity is advected by a curl-noise flow field (divergence-free → organic,
// swirling, never converging to a point) plus a gentle pull toward a central
// attractor. Audio supercharges: low band pulses the attractor (radial push),
// energy raises flow speed, high band adds fine turbulence. All deterministic —
// the only per-frame variation is u_time + the texture state.
export const VELOCITY_FRAG = /* glsl */ `
  uniform float u_time;
  uniform float u_dt;
  uniform float u_curlScale;     // spatial frequency of the curl field
  uniform float u_flowSpeed;     // base advection speed (audio raises it)
  uniform float u_attractor;     // pull strength toward center
  uniform float u_bass;          // 0..1 low-band — sustained radial breath
  uniform float u_mid;           // 0..1 mid-band — tangential swirl/rotation
  uniform float u_high;          // 0..1 high-band — fine turbulence
  uniform float u_kick;          // 0..1 transient onset — sharp radial burst
  uniform float u_energy;        // 0..1 overall energy
  uniform float u_damping;       // velocity damping per step (<1)
  uniform float u_fieldRadius;   // soft bound of the field

  // ── Simplex-ish 3D noise (Ashima / webgl-noise, MIT). Used for curl. ───────
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  // Curl of a noise vector field → divergence-free flow (no sinks/sources).
  // Sample a 3-component noise potential at ±e along each axis and take finite
  // differences of the cross terms — the standard curl-noise construction.
  vec3 curlNoise(vec3 p){
    const float e=0.18;
    vec3 dx=vec3(e,0.0,0.0);
    vec3 dy=vec3(0.0,e,0.0);
    vec3 dz=vec3(0.0,0.0,e);
    vec3 nx0=vec3(snoise(p-dx+vec3(0.0,12.3,0.0)),snoise(p-dx+vec3(5.1,0.0,0.0)),snoise(p-dx+vec3(0.0,0.0,7.7)));
    vec3 nx1=vec3(snoise(p+dx+vec3(0.0,12.3,0.0)),snoise(p+dx+vec3(5.1,0.0,0.0)),snoise(p+dx+vec3(0.0,0.0,7.7)));
    vec3 ny0=vec3(snoise(p-dy+vec3(0.0,12.3,0.0)),snoise(p-dy+vec3(5.1,0.0,0.0)),snoise(p-dy+vec3(0.0,0.0,7.7)));
    vec3 ny1=vec3(snoise(p+dy+vec3(0.0,12.3,0.0)),snoise(p+dy+vec3(5.1,0.0,0.0)),snoise(p+dy+vec3(0.0,0.0,7.7)));
    vec3 nz0=vec3(snoise(p-dz+vec3(0.0,12.3,0.0)),snoise(p-dz+vec3(5.1,0.0,0.0)),snoise(p-dz+vec3(0.0,0.0,7.7)));
    vec3 nz1=vec3(snoise(p+dz+vec3(0.0,12.3,0.0)),snoise(p+dz+vec3(5.1,0.0,0.0)),snoise(p+dz+vec3(0.0,0.0,7.7)));
    float x=(ny1.z-ny0.z)-(nz1.y-nz0.y);
    float y=(nz1.x-nz0.x)-(nx1.z-nx0.z);
    float z=(nx1.y-nx0.y)-(ny1.x-ny0.x);
    return vec3(x,y,z)/(2.0*e);
  }

  void main(){
    vec2 uv=gl_FragCoord.xy/resolution.xy;
    vec4 posSample=texture2D(texturePosition,uv);
    vec3 pos=posSample.xyz;
    vec3 vel=texture2D(textureVelocity,uv).xyz;

    // Curl flow field — the heart of the at-rest motion. High band tightens the
    // spatial scale (finer turbulence/sparkle); energy + kick raise overall speed
    // so the whole field surges on a hit.
    float scale=u_curlScale*(1.0+u_high*1.3+u_mid*0.3);
    vec3 flow=curlNoise(pos*scale+vec3(0.0,0.0,u_time*0.05));
    float speed=u_flowSpeed*(0.6+u_energy*1.8+u_kick*1.6);
    vel+=flow*speed*u_dt;

    // Central attractor — keeps the field cohered around the origin. Bass and
    // kicks RELAX the pull so the field "breathes" open on hits, then re-coheres.
    vec3 toCenter=-pos;
    float dist=length(pos)+1e-4;
    vec3 radial=pos/dist;
    float pull=u_attractor*(1.0-u_bass*0.6-u_kick*0.7);
    vel+=normalize(toCenter)*pull*u_dt;
    // Radial push: sustained breath from bass + a sharp BURST on each kick
    // transient (the kick is onset-detected on the TS side, so this fires on the
    // attack of every kick drum — the punch the field was missing).
    vel+=radial*(u_bass*u_bass*1.7+u_kick*6.0)*u_dt;
    // Mids SPIN the cloud — a tangential push around a tilted axis. Distinct from
    // bass (radial breath) and highs (fine turbulence): mids make it rotate.
    vec3 swirlAxis=normalize(vec3(0.15,1.0,0.12));
    vel+=cross(swirlAxis,pos)*u_mid*2.4*u_dt;

    // Soft outer bound — gently steer back any particle drifting past the field
    // radius so the cloud stays framed (no hard wrap discontinuity here; the
    // position shader handles deep escapes via respawn).
    float over=max(0.0,dist-u_fieldRadius);
    vel-=(pos/dist)*over*3.0*u_dt;

    vel*=u_damping;
    gl_FragColor=vec4(vel,1.0);
  }
`

// ── Compute: position FBO ─────────────────────────────────────────────────────
// Integrate position by velocity. Each particle carries a deterministic seed
// (hashed from its texel index, written once at init into .w of position) and a
// lifetime; when it drifts too far or its life expires it RESPAWNS near the
// center on a seeded sphere — so the field is stable and infinite-feeling
// without ever emptying or clumping. No per-frame RNG: respawn target is a
// hash of the particle's fixed seed + a slowly advancing epoch.
export const POSITION_FRAG = /* glsl */ `
  uniform float u_dt;
  uniform float u_time;
  uniform float u_fieldRadius;
  uniform float u_respawnRadius;
  uniform float u_lifeRate;      // life consumed per second
  uniform float u_energy;        // faster cycling when energetic

  // Cheap hash → 0..1 from a float seed.
  float hash11(float p){
    p=fract(p*0.1031);
    p*=p+33.33;
    p*=p+p;
    return fract(p);
  }
  vec3 hash31(float p){
    vec3 p3=fract(vec3(p)*vec3(0.1031,0.1030,0.0973));
    p3+=dot(p3,p3.yzx+33.33);
    return fract((p3.xxy+p3.yzz)*p3.zyx);
  }

  void main(){
    vec2 uv=gl_FragCoord.xy/resolution.xy;
    vec4 posSample=texture2D(texturePosition,uv);
    vec3 pos=posSample.xyz;
    float life=posSample.w;                 // remaining life 0..1
    vec3 vel=texture2D(textureVelocity,uv).xyz;

    // Per-particle deterministic seed from its texel position (stable forever).
    float seed=uv.x*73.0+uv.y*131.0;

    pos+=vel*u_dt;

    // Consume life — slightly faster when the track is energetic so the cloud
    // refreshes more under heavy audio (reads as turnover/sparkle).
    life-=u_lifeRate*(1.0+u_energy*1.5)*u_dt;

    float dist=length(pos);
    bool escaped=dist>u_fieldRadius*1.35;
    if(life<=0.0||escaped){
      // Respawn on a seeded sphere near the center. Epoch advances slowly so a
      // given particle respawns to a fresh-but-deterministic point each cycle
      // (no Math.random, no strobe — purely a function of seed + time bucket).
      float epoch=floor(u_time*0.37);
      vec3 r=hash31(seed+epoch*17.0)*2.0-1.0;
      float rl=length(r)+1e-4;
      float rad=u_respawnRadius*(0.25+hash11(seed+epoch)*0.75);
      pos=(r/rl)*rad;
      life=0.6+hash11(seed*1.7+epoch)*0.4;   // fresh life 0.6..1.0
    }

    gl_FragColor=vec4(pos,life);
  }
`

// ── Render: vertex shader for the Points cloud ───────────────────────────────
// Reads each particle's world position from the compute position texture (one
// texel per vertex, addressed by a fixed per-vertex `a_ref` uv). Point size is
// distance-attenuated and supercharged by energy; color position along the
// thermal ramp is decided by brightness + radius + a per-particle seed jitter,
// then passed to the fragment shader.
export const RENDER_VERT = /* glsl */ `
  precision highp float;
  uniform sampler2D u_posTex;
  uniform float u_pointSize;     // base point size (px at unit distance)
  uniform float u_energy;        // 0..1 — raises size + brightness
  uniform float u_kick;          // 0..1 — transient pop (size swell + warm flash)
  uniform float u_brightness;    // 0..1 — color position along ramp
  uniform float u_dpr;
  uniform float u_time;
  attribute vec2 a_ref;          // texel uv into u_posTex
  attribute float a_seed;        // per-particle 0..1 seed
  varying float v_colorPos;      // 0..1 ramp position
  varying float v_alpha;         // per-particle alpha (life + energy)

  void main(){
    vec4 ps=texture2D(u_posTex,a_ref);
    vec3 pos=ps.xyz;
    float life=ps.w;
    vec4 mv=modelViewMatrix*vec4(pos,1.0);
    gl_Position=projectionMatrix*mv;

    // Color position: overall brightness (cool↔hot) biased by the particle's
    // distance from center (outer particles read slightly warmer — the energy
    // disperses outward) plus a small stable per-particle jitter so the cloud
    // samples a band of the ramp rather than one flat slot.
    float rad=clamp(length(pos)*0.16,0.0,1.0);
    float jitter=(a_seed-0.5)*0.12;
    // Kicks nudge the cloud warmer (toward the ember end) on the attack — subtle,
    // so the punch reads as motion + a flicker of heat, not a white flash.
    v_colorPos=clamp(u_brightness*0.7+rad*0.28+jitter+u_energy*0.05+u_kick*0.10,0.0,1.0);

    // Life fades particles in/out at spawn/death so respawns don't pop. Energy
    // lifts overall opacity (brighter cloud when loud); kicks pop it a touch.
    float lifeFade=smoothstep(0.0,0.18,life)*smoothstep(0.0,0.25,1.0-abs(life-0.5));
    v_alpha=clamp((0.30+u_energy*0.32+u_kick*0.16)*(0.5+lifeFade*0.5),0.0,1.0);

    // Size: base × DPR, attenuated by view distance, supercharged by energy +
    // a swell on each kick, plus gentle per-particle breathing at rest. The kick
    // punch lives mostly in MOTION (the radial burst in the velocity shader); the
    // size/brightness pops are kept modest so the field never blinds.
    float breathe=0.85+0.15*sin(u_time*0.6+a_seed*6.2831);
    float size=u_pointSize*u_dpr*(0.7+u_energy*0.7+u_kick*0.8)*breathe;
    gl_PointSize=size*(1.0/max(0.1,-mv.z));
  }
`

// ── Render: fragment shader — procedural soft sprite + ramp color ─────────────
// No texture file: a soft radial falloff makes each point a round glow. Color
// is sampled from the 11-slot VIBE_SLOT_COLORS ramp passed as a uniform array,
// SMOOTHLY interpolated ALONG the ramp (still strictly on-ramp — every output
// hue is a blend of two adjacent ramp slots, never an off-ramp color). Additive
// blend (set on the material) sums the glows into bright cores that bloom.
export const RENDER_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 u_ramp[11];       // VIBE_SLOT_COLORS, linear
  varying float v_colorPos;
  varying float v_alpha;

  vec3 sampleRamp(float t){
    float x=clamp(t,0.0,1.0)*10.0;
    float i=floor(x);
    float f=x-i;
    int lo=int(i);
    int hi=min(lo+1,10);
    vec3 a=u_ramp[0];
    vec3 b=u_ramp[0];
    // Constant-index gather (GLSL ES 1.00 can't dynamically index a uniform
    // array on all GPUs) — unrolled selection.
    for(int k=0;k<11;k++){
      if(k==lo)a=u_ramp[k];
      if(k==hi)b=u_ramp[k];
    }
    return mix(a,b,f);
  }

  void main(){
    // gl_PointCoord is 0..1 across the sprite; build a soft circular falloff.
    vec2 d=gl_PointCoord-vec2(0.5);
    float r=length(d)*2.0;
    if(r>1.0)discard;
    // Soft core: bright center, smooth edge → glows that read as light, not
    // hard discs. Squared falloff concentrates energy in the core for bloom.
    float falloff=1.0-r;
    float glow=falloff*falloff;
    vec3 col=sampleRamp(v_colorPos);
    // Lift the core toward white-hot a touch at the very center so only bright
    // cores trip the bloom threshold (tasteful glow, not a wash).
    col+=glow*glow*0.35*col;
    gl_FragColor=vec4(col,glow*v_alpha);
  }
`
