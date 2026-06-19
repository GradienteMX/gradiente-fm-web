// VibeFluid — GLSL passes for the stable-fluids sim + teletext mosaic display.
// (redesign 2026 · SHOWPIECE)
//
// Classic GPU-Gems-ch.38 stable fluids on ping-pong float targets, run at LOW
// resolution (the mosaic pass quantizes the field into character cells, so the
// sim never needs to resolve finer than a teletext subcell — that's the perf
// gift). All hues come from the 11-slot thermal ramp passed in as u_ramp; this
// file holds zero literal colors.
//
// Conventions shared by every pass:
//   - Fullscreen triangle, gl_FragCoord-based UVs; v_uv carries 0..1 sim space.
//   - Float targets are HALF_FLOAT; we never read back to CPU.
//   - "texel" uniforms are 1/simResolution so the GLSL stays resolution-agnostic.

// NOTE: the attribute is named `position` (vec2) on purpose. three.js derives a
// geometry's vertex/draw count from its `position` attribute; a RawShaderMaterial
// quad whose only attribute has a different name renders ZERO draw calls (three
// can't size the draw) — so we declare `position` ourselves here.
export const VERT = /* glsl */ `
  precision highp float;
  attribute vec2 position;
  varying vec2 v_uv;
  void main() {
    // position is a fullscreen triangle in clip space [-1..3]; map to 0..1 uv.
    v_uv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

// ── Advection — semi-Lagrangian backtrace ───────────────────────────────────
// Moves a quantity (velocity OR dye) along the velocity field. u_dissipation
// pulls the field toward zero each step so dye always settles back to dark and
// velocity bleeds energy (the signal decays without stirring).
export const ADVECT_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_velocity;
  uniform sampler2D u_source;
  uniform vec2  u_texel;        // 1 / simResolution
  uniform float u_dt;
  uniform float u_dissipation;
  void main() {
    // Backtrace: where did the parcel now at v_uv come from one dt ago?
    vec2 vel = texture2D(u_velocity, v_uv).xy;
    vec2 coord = v_uv - u_dt * vel * u_texel;
    gl_FragColor = u_dissipation * texture2D(u_source, coord);
  }
`

// ── Splat — additive Gaussian injection of force / dye ───────────────────────
// Used for both the pointer stir (velocity + dye) and the ambient carrier wave.
// u_aspect corrects the radius so splats are round on non-square viewports.
export const SPLAT_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_target;
  uniform vec3  u_value;        // amount to add (xy velocity, or x=heat)
  uniform vec2  u_point;        // splat center in 0..1
  uniform float u_radius;       // gaussian sigma in uv
  uniform float u_aspect;       // simW / simH
  void main() {
    vec2 p = v_uv - u_point;
    p.x *= u_aspect;
    float g = exp(-dot(p, p) / u_radius);
    vec3 base = texture2D(u_target, v_uv).xyz;
    gl_FragColor = vec4(base + g * u_value, 1.0);
  }
`

// ── Divergence of the velocity field ─────────────────────────────────────────
export const DIVERGENCE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_velocity;
  uniform vec2 u_texel;
  void main() {
    float l = texture2D(u_velocity, v_uv - vec2(u_texel.x, 0.0)).x;
    float r = texture2D(u_velocity, v_uv + vec2(u_texel.x, 0.0)).x;
    float b = texture2D(u_velocity, v_uv - vec2(0.0, u_texel.y)).y;
    float t = texture2D(u_velocity, v_uv + vec2(0.0, u_texel.y)).y;
    float div = 0.5 * (r - l + t - b);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`

// ── Jacobi pressure solve (one iteration) ────────────────────────────────────
export const PRESSURE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_pressure;
  uniform sampler2D u_divergence;
  uniform vec2 u_texel;
  void main() {
    float l = texture2D(u_pressure, v_uv - vec2(u_texel.x, 0.0)).x;
    float r = texture2D(u_pressure, v_uv + vec2(u_texel.x, 0.0)).x;
    float b = texture2D(u_pressure, v_uv - vec2(0.0, u_texel.y)).x;
    float t = texture2D(u_pressure, v_uv + vec2(0.0, u_texel.y)).x;
    float div = texture2D(u_divergence, v_uv).x;
    float p = (l + r + b + t - div) * 0.25;
    gl_FragColor = vec4(p, 0.0, 0.0, 1.0);
  }
`

// ── Gradient subtract — make the velocity field divergence-free ──────────────
export const GRADIENT_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_pressure;
  uniform sampler2D u_velocity;
  uniform vec2 u_texel;
  void main() {
    float l = texture2D(u_pressure, v_uv - vec2(u_texel.x, 0.0)).x;
    float r = texture2D(u_pressure, v_uv + vec2(u_texel.x, 0.0)).x;
    float b = texture2D(u_pressure, v_uv - vec2(0.0, u_texel.y)).x;
    float t = texture2D(u_pressure, v_uv + vec2(0.0, u_texel.y)).x;
    vec2 vel = texture2D(u_velocity, v_uv).xy;
    vel -= 0.5 * vec2(r - l, t - b);
    gl_FragColor = vec4(vel, 0.0, 1.0);
  }
`

// ── Curl-noise-free ambient carrier ──────────────────────────────────────────
// ONE slow large-scale circulation, fully deterministic (no RNG). A single
// rotating low-frequency cell whose phase advances with u_time, so the field is
// never dead but the motion is a calm broadcast carrier, not flicker. Added to
// velocity each frame (scaled by u_dt * strength outside).
export const AMBIENT_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_velocity;
  uniform float u_time;
  uniform float u_strength;     // already includes dt
  uniform float u_aspect;
  void main() {
    // Stream function of a few standing low-frequency lobes whose centers
    // drift very slowly; curl of it gives a smooth divergence-light flow.
    vec2 p = v_uv;
    p.x *= u_aspect;
    float ph = u_time * 0.30;            // carrier phase — period ~21s for the slowest term
    float s =
        sin(p.x * 2.1 + ph)       * cos(p.y * 1.7 - ph * 0.8)
      + sin(p.x * 1.3 - ph * 0.6) * cos(p.y * 2.3 + ph * 0.5) * 0.6;
    // curl( s ) = ( d s/dy, -d s/dx ) — analytic derivatives of the above.
    float dsdy =
        sin(p.x * 2.1 + ph)       * (-sin(p.y * 1.7 - ph * 0.8)) * 1.7
      + sin(p.x * 1.3 - ph * 0.6) * (-sin(p.y * 2.3 + ph * 0.5)) * 2.3 * 0.6;
    float dsdx =
        cos(p.x * 2.1 + ph) * 2.1 * cos(p.y * 1.7 - ph * 0.8)
      + cos(p.x * 1.3 - ph * 0.6) * 1.3 * cos(p.y * 2.3 + ph * 0.5) * 0.6;
    vec2 flow = vec2(dsdy, -dsdx);
    vec2 vel = texture2D(u_velocity, v_uv).xy + flow * u_strength;
    gl_FragColor = vec4(vel, 0.0, 1.0);
  }
`

// ── Teletext mosaic display pass ─────────────────────────────────────────────
// The signature pass. Samples the dye ("heat") field and renders it as a grid
// of teletext block-mosaic character cells. Each cell is divided into the
// classic 2x3 subcell mosaic; a subcell lights only if the heat sampled at its
// center exceeds u_threshold. Lit subcells take the cell's quantized thermal
// slot color (HARD quantize — index into the 11-slot ramp, no interpolation);
// a 1px gap between subcells reads as a block-mosaic display. Cells fully below
// threshold render transparent. Output alpha is capped by u_lumaCap so the
// field never competes with content legibility.
export const DISPLAY_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 v_uv;
  uniform sampler2D u_dye;
  uniform vec2  u_resolution;   // output (canvas) pixels
  uniform vec2  u_simTexel;     // 1 / simResolution (unused sampling kept linear)
  uniform float u_cellPx;       // character-cell size in output px
  uniform float u_threshold;    // subcell ignition threshold (heat 0..1)
  uniform float u_lumaCap;      // max output alpha
  uniform float u_gapPx;        // gap between subcells in px
  uniform vec3  u_ramp[11];     // the 11-slot thermal ramp

  // HARD quantize a 0..1 heat value to one of the 11 ramp slots.
  vec3 rampColor(float h) {
    int slot = int(floor(clamp(h, 0.0, 1.0) * 10.0 + 0.5));
    // GLSL ES 1.0 forbids dynamic array indexing on some drivers — unroll.
    for (int i = 0; i < 11; i++) {
      if (i == slot) return u_ramp[i];
    }
    return u_ramp[10];
  }

  void main() {
    vec2 frag = v_uv * u_resolution;          // pixel coordinate
    vec2 cell = floor(frag / u_cellPx);       // which character cell
    vec2 cellOrigin = cell * u_cellPx;
    vec2 inCell = frag - cellOrigin;          // 0..cellPx within the cell

    // 2x3 teletext subcell grid (2 cols, 3 rows).
    vec2 sub = vec2(u_cellPx * 0.5, u_cellPx / 3.0);
    vec2 subIdx = floor(inCell / sub);        // (0..1, 0..2)
    vec2 inSub = inCell - subIdx * sub;        // position within the subcell

    // 1px gap: kill the outer rim of each subcell so the grid reads as blocks.
    bvec2 inGap = bvec2(
      inSub.x < u_gapPx || inSub.x > sub.x - u_gapPx,
      inSub.y < u_gapPx || inSub.y > sub.y - u_gapPx
    );
    if (inGap.x || inGap.y) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // Heat sampled at the SUBCELL center (so each subcell ignites on its own
    // local heat — the mosaic tracks fluid structure below cell resolution).
    vec2 subCenterPx = cellOrigin + (subIdx + 0.5) * sub;
    vec2 subUv = subCenterPx / u_resolution;
    float heat = texture2D(u_dye, subUv).x;

    if (heat < u_threshold) {
      gl_FragColor = vec4(0.0);
      return;
    }

    // Cell color is quantized from the cell-center heat (so all lit subcells in
    // a cell share one slot color — that's what makes it read as a character,
    // not a per-pixel gradient). The lowest two ramp slots are near-black cyan
    // and vanish on the #0D0D0D page, so we map a LIT cell's heat onto the
    // VISIBLE arc of the ramp (slot ~3 → 10): a quiet stir reads as a cool
    // teal block, a fast one climbs to ember. Below threshold stays unlit
    // (handled above), so the cold-but-invisible slots are simply never used.
    vec2 cellCenterUv = (cellOrigin + u_cellPx * 0.5) / u_resolution;
    float cellHeat = texture2D(u_dye, cellCenterUv).x;
    float warmed = pow(clamp(cellHeat, 0.0, 1.0), 0.7);
    vec3 col = rampColor(0.3 + warmed * 0.7);

    // Alpha: once a subcell clears the ignition threshold it should read as a
    // SOLID teletext block, not fade in from zero (a half-lit block reads as
    // mush against near-black). So we floor lit alpha at ~0.6·cap and let it
    // climb to the cap with heat. Premultiplied output (renderer blends
    // premultiplied) — multiply rgb and alpha together.
    float climb = clamp((heat - u_threshold) / (1.0 - u_threshold), 0.0, 1.0);
    float a = mix(0.6, 1.0, climb) * u_lumaCap;
    gl_FragColor = vec4(col * a, a);
  }
`
