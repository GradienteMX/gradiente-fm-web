/**
 * TRAMA shaders — one fragment program, seven printing gestures.
 *
 * Everything is block-quantized: a region of the sheet is either blank,
 * a coarse block (uCell), a finer block (uCell/2, /4 …) or crisp. A front
 * travels across the rect; each coarse cell carries a stable hash so the
 * front is ragged but never flickers (no per-frame randomness anywhere).
 *
 * Display-space: colors in and out are raw sRGB floats; output is
 * premultiplied alpha over a transparent canvas.
 */

export const tramaVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export const tramaFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  // 0 text · 1 image · 2 cross · 3 mask · 4 sweep · 5 burst
  uniform int uMode;
  uniform vec2 uRes;        // rect size, CSS px
  uniform float uP;         // progress 0..1
  uniform float uCell;      // coarsest block, CSS px
  uniform float uLevels;    // pixel levels before crisp
  uniform float uFront;     // front width, 0..1 of the travel
  uniform int uDir;         // 0 up · 1 down · 2 left · 3 right · 4 center · 5 origin · 6 random
  uniform vec2 uOrigin;     // rect px, y down
  uniform float uSeed;
  uniform float uScaleA;    // raster texels per CSS px
  uniform float uScaleB;
  uniform sampler2D uTexA;
  uniform sampler2D uTexB;
  uniform vec3 uInk;
  uniform vec3 uTint;
  uniform vec3 uPaper;
  uniform float uGrey;      // quiet grey mosaic
  uniform float uBits;      // 1-bit ordered dither
  uniform float uReverse;   // play the gesture backwards (exits)

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21) + uSeed * 0.137);
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
  float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

  float frontCoord(vec2 p) {
    vec2 q = p / uRes;
    if (uDir == 0) return 1.0 - q.y;
    if (uDir == 1) return q.y;
    if (uDir == 2) return 1.0 - q.x;
    if (uDir == 3) return q.x;
    if (uDir == 4) return length(p - uRes * 0.5) / max(1.0, length(uRes) * 0.5);
    if (uDir == 5) {
      vec2 far = max(uOrigin, uRes - uOrigin);
      return length(p - uOrigin) / max(1.0, length(far));
    }
    return hash(floor(p / uCell) + 7.0);
  }

  // 0 = the front hasn't arrived · 1 = fully past.
  float localProgress(vec2 p) {
    float j = hash(floor(p / uCell));
    float head = uP * (1.0 + uFront * 1.6);
    float l = clamp((head - frontCoord(p) - j * uFront * 0.6) / max(0.001, uFront), 0.0, 1.0);
    return uReverse > 0.5 ? 1.0 - l : l;
  }

  vec2 texUv(vec2 p) { return vec2(p.x / uRes.x, 1.0 - p.y / uRes.y); }

  vec4 blockSample(sampler2D tex, float scale, vec2 p, float b, out vec2 cell) {
    cell = floor(p / b);
    vec2 c = (cell + 0.5) * b;
    float lod = log2(max(1.0, b * scale));
    return textureLod(tex, texUv(c), lod);
  }

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  vec4 premul(vec3 c, float a) { return vec4(c * a, a); }

  void main() {
    vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uRes;

    // ── 0 · text: silhouettes → ink → type ─────────────────────────────
    if (uMode == 0) {
      float l = localProgress(p);
      float k = min(floor(l * (uLevels + 1.0)), uLevels + 1.0);
      if (k < 0.5) discard;
      if (k > uLevels + 0.5) {
        vec4 t = texture2D(uTexA, texUv(p));
        if (t.a < 0.003) discard;
        gl_FragColor = premul(t.rgb, t.a);
        return;
      }
      float b = uCell / pow(2.0, k - 1.0);
      vec2 cell;
      vec4 t = blockSample(uTexA, uScaleA, p, b, cell);
      float cov = t.a;
      if (cov < 0.02) discard;
      vec3 base = clamp(t.rgb / max(t.a, 0.001), 0.0, 1.0);
      float cool = (k - 1.0) / max(1.0, uLevels);
      if (uGrey > 0.5) {
        // A quiet grey mosaic: coverage becomes tone, no colour, no tint.
        float a = clamp(cov * 1.5, 0.0, 1.0) * mix(0.5, 0.95, cool);
        gl_FragColor = premul(base, a);
        return;
      }
      float th = uBits > 0.5 ? bayer4(cell) * 0.85 + 0.05 : mix(0.38, 0.16, cool);
      if (cov <= th) discard;
      vec3 col = uBits > 0.5 ? base : mix(uTint, base, smoothstep(0.0, 1.0, cool * 1.3));
      gl_FragColor = premul(col, 1.0);
      return;
    }

    // ── 1 · image: the print resolves out of its own coarse blocks ───────
    if (uMode == 1) {
      float l = localProgress(p);
      float k = min(floor(l * (uLevels + 1.0)), uLevels + 1.0);
      if (k < 0.5) discard;
      vec3 col;
      if (k > uLevels + 0.5) {
        col = texture2D(uTexA, texUv(p)).rgb;
      } else {
        float b = uCell / pow(2.0, k - 1.0);
        vec2 cell;
        col = blockSample(uTexA, uScaleA, p, b, cell).rgb;
        if (uBits > 0.5) {
          float y = luma(col);
          col = y > bayer4(cell) ? uPaper : uInk;
        }
      }
      if (uGrey > 0.5) {
        float y = luma(col);
        float fade = uReverse > 0.5 ? 1.0 - l : 0.0;
        col = mix(mix(col, vec3(y), 0.85), uPaper, 0.18 + fade * 0.5);
      }
      gl_FragColor = premul(col, 1.0);
      return;
    }

    // ── 2 · cross: A breaks into blocks, B assembles out of them ─────────
    if (uMode == 2) {
      float l = localProgress(p);
      vec3 col;
      vec2 cell;
      if (l < 0.5) {
        float d = l * 2.0;
        float k = min(floor(d * (uLevels + 1.0)), uLevels);
        if (k < 0.5) col = texture2D(uTexA, texUv(p)).rgb;
        else col = blockSample(uTexA, uScaleA, p, uCell / pow(2.0, uLevels - k), cell).rgb;
      } else {
        float d = (l - 0.5) * 2.0;
        float k = min(floor(d * (uLevels + 1.0)), uLevels);
        if (k > uLevels - 0.5) col = texture2D(uTexB, texUv(p)).rgb;
        else col = blockSample(uTexB, uScaleB, p, uCell / pow(2.0, k), cell).rgb;
      }
      gl_FragColor = premul(col, 1.0);
      return;
    }

    // ── 3 · mask: a sheet comes off the press, clearing from the origin ─
    if (uMode == 3) {
      float l = localProgress(p);
      if (l >= 0.999) discard;
      float k = min(floor(l * uLevels), uLevels - 1.0);
      float b = max(2.0, uCell / pow(2.0, k));
      vec2 cell = floor(p / b);
      float h = hash(cell + 3.1);
      if (l > 0.0 && h < l) discard;
      float dens = l > 0.0 ? (1.0 - l) * 0.34 * hash(cell + 11.7) : 0.0;
      vec3 ink = mix(uInk, uTint, step(0.72, hash(cell + 5.3)));
      gl_FragColor = premul(mix(uPaper, ink, dens), 1.0);
      return;
    }

    // ── 4 · sweep: a thin band of ink blocks retunes the sheet ──────────
    if (uMode == 4) {
      float y = p.y / uRes.y;
      if (uDir == 0) y = 1.0 - y;
      float center = mix(-0.15, 1.15, uP);
      float d = abs(y - center) / 0.075;
      if (d > 1.0) discard;
      vec2 cell = floor(p / uCell);
      float strength = (1.0 - d * d) * 0.32;
      if (hash(cell) > strength * 1.4) discard;
      vec3 col = mix(uInk, uTint, step(0.66, hash(cell + 3.0)));
      float a = strength * (0.55 + 0.45 * hash(cell + 9.0));
      gl_FragColor = premul(col, a);
      return;
    }

    // ── 5 · burst: one dithered ring, then nothing ───────────────────────
    vec2 c = uRes * 0.5;
    float r = length(p - c) / (uRes.x * 0.5);
    float d = abs(r - uP * 0.92) / 0.2;
    if (d > 1.0 || r > 1.0) discard;
    vec2 cell = floor(p / uCell);
    float strength = (1.0 - d) * (1.0 - uP * uP);
    if (strength < bayer4(cell) * 0.9 + 0.08) discard;
    gl_FragColor = premul(uTint, 1.0);
  }
`
