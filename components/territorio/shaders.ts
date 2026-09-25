/**
 * TERRITORIO — shaders. The land is PRINTED, not lit: flat fills, 1 px ink
 * seams, the energy band as a flat rim, halftone for what has settled into
 * the archive, ordered-dither for anything that appears or leaves. Colors
 * come from the design tokens (see palette.ts) — display space, no
 * colorspace chunks, bytes in = bytes out (like the field and the lens).
 *
 * One instanced hexagon per CELL. Each cell carries its node's exterior-edge
 * mask: interior edges clip hard at the shared line (the neighbour cell of
 * the same slab continues the image — no seam inside a slab), exterior
 * edges carry the seam. Slabs tessellate edge to edge; each paints half a
 * seam past its outline so neighbours share exactly one line.
 *
 * Modes (define MODE): 0 tile · 2 the hard ink offset under a lifted slab.
 *
 * Kindling is a print-resolve (energy block dithers in, then the art lands
 * as coarse blocks and sharpens); it settles to plain crisp content.
 */

const common = /* glsl */ `
  const float SQ3H = 0.8660254;
  const vec2 N6[6] = vec2[6](
    vec2( SQ3H,  0.5),   // SE
    vec2( 0.0,   1.0),   // S
    vec2(-SQ3H,  0.5),   // SW
    vec2(-SQ3H, -0.5),   // NW
    vec2( 0.0,  -1.0),   // N
    vec2( SQ3H, -0.5)    // NE
  );
`

export const tileVertex = /* glsl */ `
  ${common}
  uniform vec3 uCam;        // cx, cy, zoom
  uniform vec2 uView;       // viewport, CSS px
  uniform float uR;         // hex circumradius, plane px
  uniform float uPad;       // geometry expansion, plane px
  uniform float uLiftScale;
  uniform float uLiftRaise; // screen px

  attribute vec2 aCenter;   // live cell center
  attribute vec4 aLocal;    // cell center − node bbox origin; bbox size
  attribute vec4 aInfo;     // exterior mask, kind, archive, detail atlas
  attribute vec4 aState;    // lift, dim, vis, loMix
  attribute vec4 aState2;   // hiMix, kindle, ring, emphasis
  attribute vec4 aTexLo;    // atlas rect (u0 < 0: none)
  attribute vec4 aTexHi;
  attribute vec4 aEnergy;   // band min, band max, life, —

  varying vec2 vP;
  varying vec2 vUV;
  varying vec2 vWorld;
  flat varying vec4 vLocal;
  flat varying vec4 vInfo;
  flat varying vec4 vState;
  flat varying vec4 vState2;
  flat varying vec4 vTexLo;
  flat varying vec4 vTexHi;
  flat varying vec4 vEnergy;

  void main() {
    vec2 p = position.xy * (uR + uPad);
    float lift = aState.x;
    // A lifted slab grows a touch about its own center and steps toward
    // the upper left, off its offset shadow.
    vec2 ic = aLocal.zw * 0.5 - aLocal.xy;
    float s = 1.0 + lift * uLiftScale;
    vec2 w = aCenter + ic + (p - ic) * s;
    vec2 d = (w - uCam.xy) * uCam.z - vec2(lift * uLiftRaise);
    gl_Position = vec4(2.0 * d.x / uView.x, -2.0 * d.y / uView.y, 0.0, 1.0);
    vP = p;
    vUV = (aLocal.xy + p) / aLocal.zw;
    vWorld = aCenter + p;
    vLocal = aLocal;
    vInfo = aInfo;
    vState = aState;
    vState2 = aState2;
    vTexLo = aTexLo;
    vTexHi = aTexHi;
    vEnergy = aEnergy;
  }
`

export const tileFragment = /* glsl */ `
  precision highp float;
  ${common}
  uniform sampler2D uLo;
  uniform sampler2D uHi;
  uniform sampler2D uXl;
  uniform sampler2D uSpec;
  uniform vec3 uGround;      // --obs-0
  uniform vec3 uPlate;       // --obs-2
  uniform vec3 uInk;         // --ink
  uniform float uA;          // apothem
  uniform float uSeamW;      // plane px (≈ 1 screen px)
  uniform float uSeamK;      // seam strength (thins out far away)
  uniform float uRimW;       // plane px
  uniform float uDot;        // halftone cell, plane px
  uniform float uFar;        // 0..1 flat-energy regime
  uniform vec2 uRange;       // smoothed horizon band
  uniform float uFieldDim;   // reading surfaces open
  uniform vec2 uShadowOff;   // plane px

  varying vec2 vP;
  varying vec2 vUV;
  varying vec2 vWorld;
  flat varying vec4 vLocal;
  flat varying vec4 vInfo;
  flat varying vec4 vState;
  flat varying vec4 vState2;
  flat varying vec4 vTexLo;
  flat varying vec4 vTexHi;
  flat varying vec4 vEnergy;

  vec3 spectrum(float e) {
    return texture2D(uSpec, vec2(clamp(e / 10.0, 0.002, 0.998), 0.5)).rgb;
  }
  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  // 4×4 ordered dither threshold in [0, 1).
  float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  // Distance to the slab outline (positive inside) and the outward normal of
  // the nearest exterior edge; clip: beyond one of the slab's interior edges.
  float shape(vec2 p, int mask, out bool clip) {
    float ext = 1e4;
    clip = false;
    for (int i = 0; i < 6; i++) {
      float d = uA - dot(p, N6[i]);
      if (((mask >> i) & 1) == 1) ext = min(ext, d);
      else if (d < 0.0) clip = true;
    }
    return ext;
  }

  void main() {
    int mask = int(vInfo.x + 0.5);
    float kind = vInfo.y;         // 0 pieza · 1 mercado · 2 franja
    bool piece = kind < 0.5;
    float lift = vState.x;
    float vis = vState.z;
    float kin = vState2.y;
    float eMin = vEnergy.x;
    float eMax = vEnergy.y;
    float lifeN = clamp(vEnergy.z, 0.0, 1.0);
    vec2 uv = clamp(vUV, 0.0, 1.0);

    // Horizon: pieces outside the band ghost in place (the land keeps shape).
    float gapE = max(max(uRange.x - eMax, eMin - uRange.y), 0.0);
    float outE = piece ? smoothstep(0.0, 0.75, gapE) : 0.0;
    float dimT = max(vState.y, outE * 0.9);

#if MODE == 2
    bool clip;
    float ext = shape(vP - uShadowOff, mask, clip);
    if (clip) discard;
    float aa = max(fwidth(ext), 1e-3);
    float cov = clamp((ext + uSeamW * 0.5) / aa + 0.5, 0.0, 1.0);
    if (cov <= 0.0) discard;
    // The one shadow in the system: a hard 4 px ink offset under a lifted slab.
    gl_FragColor = vec4(uInk, cov * step(0.5, lift) * vis);
#else
    // Texture fetches and derivatives first (uniform control flow).
    float aspect = vLocal.z / vLocal.w;
    vec2 suv = uv;
    if (aspect > 1.0) suv.y = 0.5 + (uv.y - 0.5) / aspect;
    else suv.x = 0.5 + (uv.x - 0.5) * aspect;
    // Print-resolve while kindling: the art lands as coarse blocks and
    // sharpens to the plate (gradients from the continuous uv keep mips sane).
    float resolve = clamp(vState2.y * 2.0 - 1.0, 0.0, 1.0);
    float blocks = mix(5.0, 180.0, resolve * resolve);
    vec2 quv = resolve < 1.0 ? (floor(suv * blocks) + 0.5) / blocks : suv;
    vec2 gx = dFdx(suv);
    vec2 gy = dFdy(suv);
    vec2 loS = vTexLo.zw - vTexLo.xy;
    vec4 lo = textureGrad(uLo, vTexLo.xy + quv * loS, gx * loS, gy * loS);
    vec2 hiS2 = vTexHi.zw - vTexHi.xy;
    vec2 hiUV = vTexHi.xy + quv * hiS2;
    vec4 hiS = textureGrad(uHi, hiUV, gx * hiS2, gy * hiS2);
    vec4 hiL = textureGrad(uXl, hiUV, gx * hiS2, gy * hiS2);
    vec4 hi = vInfo.w > 0.5 ? hiL : hiS;
    vec2 hq = mat2(0.7071, -0.7071, 0.7071, 0.7071) * vWorld / uDot;
    float hd = length(fract(hq) - 0.5);
    float hw = fwidth(hd);

    bool clip;
    float ext = shape(vP, mask, clip);
    float aa = max(fwidth(ext), 1e-3);
    float cov = clamp((ext + uSeamW * 0.5) / aa + 0.5, 0.0, 1.0);
    if (clip || cov <= 0.0) discard;

    // Appear / leave as print does: an ordered dither, never a fade.
    // Kindling prints the energy block first, then the art over it.
    float th = bayer4(floor(gl_FragCoord.xy / 2.0));
    if (th >= clamp(kin * 2.0, 0.0, 1.0) || th >= vis) discard;
    float artOn = step(th, clamp((kin - 0.5) * 6.0, 0.0, 1.0));

    float mid = (eMin + eMax) * 0.5;
    vec3 block = piece ? spectrum(mid) : uPlate;
    float loMix = vState.w * step(0.0, vTexLo.x) * lo.a;
    float hiMix = vState2.x * step(0.0, vTexHi.x) * hi.a;
    vec3 art = mix(piece ? mix(uGround, block, 0.55) : uPlate, lo.rgb, loMix);
    art = mix(art, hi.rgb, hiMix);

    // Archive: re-screened as a halftone in ink on the ground, the way old
    // print survives. Coverage matches the art's own luminance.
    float gl = luma(uGround);
    float span = luma(uInk) - gl;
    span = abs(span) < 0.05 ? (span < 0.0 ? -0.05 : 0.05) : span;
    float want = clamp((luma(art) - gl) / span, 0.0, 1.0);
    float r = sqrt(want) * 0.64;
    float dotInk = 1.0 - smoothstep(r - hw, r + hw, hd);
    vec3 screened = mix(uGround, uInk, dotInk);
    art = mix(art, screened, step(0.5, vInfo.z));

    // Life is density: fresh pieces print full, cooled ones as a tint.
    if (piece) art = mix(uGround, art, 0.74 + 0.26 * lifeN);
    vec3 col = mix(block, art, artOn);

    // Far away the land reads as its energy: flat blocks, tinted by life.
    vec3 far = piece ? mix(uGround, block, 0.4 + 0.6 * lifeN) : mix(uGround, uPlate, 0.85);
    col = mix(col, far, uFar);

    // The energy band as a flat rim just inside the seam.
    float emph = vState2.w;
    float rimIn = uSeamW * 0.5 + uRimW * (1.0 + emph * 0.7 + lift * 0.5);
    float rim = 1.0 - smoothstep(rimIn - aa, rimIn + aa, ext);
    vec3 rimCol = piece ? spectrum(mix(eMin, eMax, uv.x)) : (kind > 1.5 ? uInk : mix(uInk, uGround, 0.4));
    col = mix(col, rimCol, rim * (1.0 - uFar * 0.7));

    // Keyboard cursor: a second ink line inside the rim.
    float ringIn = rimIn + uSeamW * 1.5;
    float ring = (1.0 - smoothstep(ringIn + uSeamW * 2.0 - aa, ringIn + uSeamW * 2.0 + aa, ext)) * smoothstep(ringIn - aa, ringIn + aa, ext);
    col = mix(col, uInk, ring * vState2.z);

    // One ink seam on every slab outline (half from each side).
    float seamW = uSeamW * (1.0 + lift + emph * 0.5);
    float seam = 1.0 - smoothstep(seamW * 0.5 - aa, seamW * 0.5 + aa, ext);
    col = mix(col, uInk, seam * uSeamK);

    // Recede: focus, horizon, an open reading. Ghosted toward the ground.
    col = mix(col, uGround, dimT * 0.84);
    col = mix(col, uGround, uFieldDim * 0.6);

    gl_FragColor = vec4(col, cov);
#endif
  }
`

// ── ribbons: coastlines and the focus ring ───────────────────────────────────

export const ribbonVertex = /* glsl */ `
  uniform vec3 uCam;
  uniform vec2 uView;
  uniform float uHalfW;      // screen px
  uniform vec2 uOff[32];     // per-group live offsets (plane px)
  attribute vec2 aNrm;       // miter normal × miter length
  attribute float aSide;
  attribute float aS;        // arc length, plane px
  attribute float aGroup;
  varying float vS;
  varying float vSide;
  void main() {
    vec2 off = uOff[int(aGroup + 0.5)];
    vec2 w = position.xy + off + aNrm * aSide * (uHalfW / uCam.z);
    vec2 d = (w - uCam.xy) * uCam.z;
    gl_Position = vec4(2.0 * d.x / uView.x, -2.0 * d.y / uView.y, 0.0, 1.0);
    vS = aS;
    vSide = aSide;
  }
`

export const ribbonFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uCam;
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uDash;       // screen px period; 0 = solid
  varying float vS;
  varying float vSide;
  void main() {
    float a = uAlpha * (1.0 - smoothstep(0.6, 1.0, abs(vSide)));
    if (uDash > 0.0) {
      float f = abs(fract(vS * uCam.z / uDash) - 0.5);
      a *= step(0.25, f);
    }
    if (a < 0.002) discard;
    gl_FragColor = vec4(uColor, a);
  }
`
