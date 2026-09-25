/**
 * GLSL shared by the card, the case and the stickers. Display space
 * throughout (no colorspace chunks). No `atan` on normals.
 */

/** Ordered dither (4×4 Bayer), in [0, 1): the arrival dissolve. */
export const BAYER = /* glsl */ `
  float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
`

/** The original's cosine rainbow, compressed into the role's band. */
export const SPECTRAL = /* glsl */ `
  const float TAU = 6.28318530718;
  vec3 spectral(float p) { return 0.52 + 0.48 * cos(TAU * (p + vec3(0.0, 0.33, 0.67))); }
  // glassCard.js: the sweep oscillates smoothly inside a band around the
  // role's phase; spread 1 = the full rainbow, uncompressed.
  float hueBand(float p, float phase, float spread) {
    return spread < 0.999 ? phase + 0.5 * spread * sin(TAU * (p - phase)) : p;
  }
`

export const HASH = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }
  vec3 hash32(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 4; i++) {
      s += a * vnoise(p);
      p = p * 2.03 + vec2(17.1, 3.7);
      a *= 0.5;
    }
    return s;
  }
`

/**
 * The studio (PMREM, cube-UV). Needs the material's `defines` from
 * `Estuche.envDefines` and `uniform sampler2D envMap`. Directions are in
 * world space (the studio stays put while the card turns).
 */
export const ENV = /* glsl */ `
  #include <cube_uv_reflection_fragment>
  vec3 studio(vec3 dirWorld, float roughness) {
    return textureCubeUV(envMap, dirWorld, roughness).rgb;
  }
  vec3 toWorld(vec3 dirView) {
    return normalize((vec4(dirView, 0.0) * viewMatrix).xyz);
  }
  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
`
