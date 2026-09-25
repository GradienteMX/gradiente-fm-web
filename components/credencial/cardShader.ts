/**
 * CREDENCIAL — the printed card inside the case: a heavy cotton board in
 * its role's livery (matte, one ink — the livery's own), letterpressed, and
 * a role foil hot-stamped on the wordmark, the border, the role chip, the
 * folio (and the seal, the pins, the flags).
 *
 * One material for the whole card (front, back, edge), one draw call:
 *   · the printed face comes from the atlas (front on top, back below); the
 *     board's mottling and fibres are printed into it
 *   · the relief and the print bend the normal: R rises (the seal and the
 *     pins are blind-embossed); the ink, read from the print at its full
 *     resolution, sinks — the letterpress: every inked or stamped mark is
 *     pressed into the board (relief B: how deep), so each stroke is shaded
 *     inside (the wall facing the light lit, the other in shade)
 *   · the board is matte: a soft key light shades it as it turns, a fine
 *     cotton tooth catches that light, and at grazing angles only it takes a
 *     soft velvet sheen
 *   · the foil (relief G) replaces the ink where it's stamped. It is metal
 *     and reads against the matte stock by gloss, not hue: it mirrors the
 *     studio (dark at rest — the dim room behind you — and bright when a
 *     softbox slides across it), and each role is a different KIND of foil:
 *        0 lector    diffraction over silver, the full rainbow, holo-pattern
 *        1 curador   glitter: silver flakes, each with its own facet, twinkling
 *        2 guía      lenticular: bands sliding across brushed chrome
 *        3 insider   cracked ice: silver shards, each its own phase
 *        4 admin     ember / void: black foil, sparks, a heat shimmer
 *     The iridescence sits in the role's hue band (`hueBand`, the original
 *     glassCard.js idea), widened where the stock is the same hue — a foil
 *     never sinks into its own card. Alive while the card moves (uMotion),
 *     calm metal at rest (uRest).
 *   · the cut edge is a triplex: the coloured plies and a core in the ink
 *   · seen through the slab, the card is drawn at its apparent depth (the
 *     vertex stage compresses it toward the face you look through)
 *   · arrival is an ordered-dither dissolve (Bayer 4×4), not a fade
 * Display space throughout: no colorspace chunks, textures NoColorSpace.
 */

import { BAYER, ENV, HASH, SPECTRAL } from './glsl'

export const cardVertex = /* glsl */ `
  uniform float uSide;
  uniform float uDepthK;
  uniform float uHZ;
  varying vec2 vUv;
  varying vec3 vNObj;
  varying vec3 vN;
  varying vec3 vP;
  varying vec3 vT;
  varying vec3 vB;
  varying float vPz;
  void main() {
    vUv = uv;
    vNObj = normal;
    vPz = position.z;
    vN = normalize(normalMatrix * normal);
    vT = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
    vB = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
    // Seen through the slab: at its apparent depth, nearer the face you look through.
    vec3 p = position;
    p.z = uSide * (uHZ - (uHZ - uSide * p.z) * uDepthK);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vP = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

export const cardFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D uPrint;
  uniform sampler2D uRelief;
  uniform sampler2D uHolo;
  uniform sampler2D uBrushed;
  uniform sampler2D envMap;
  uniform vec2 uReliefTexel;
  uniform vec2 uPrintTexel;
  uniform vec3 uStock;
  uniform vec3 uInkCol;
  uniform vec3 uCore;
  uniform float uHover;
  uniform float uFade;
  uniform float uBump;
  uniform float uDeboss;
  uniform float uMotion;
  uniform float uTime;
  uniform float uFoil;
  uniform float uPhase;
  uniform float uSpread;
  uniform float uRest;
  uniform float uAspect;
  uniform float uHalfDepth;
  varying vec2 vUv;
  varying vec3 vNObj;
  varying vec3 vN;
  varying vec3 vP;
  varying vec3 vT;
  varying vec3 vB;
  varying float vPz;

  ${SPECTRAL}
  ${HASH}
  ${BAYER}
  ${ENV}

  // The studio's key softbox (up-left, in front) — view space = world space
  // for this camera, which never rotates.
  const vec3 KEY = vec3(-0.451, 0.551, 0.702);

  float hb(float p) { return hueBand(p, uPhase, uSpread); }

  // Bare metal: the studio in it, dim at rest, bright under a softbox.
  vec3 silver(float envL) { return vec3(0.6, 0.62, 0.64) * (0.46 + 0.95 * envL); }

  // lector — a diffraction grating over silver: the rainbow sweeps with the
  // angle, the holo pattern breaks it up, a bright band travels across as
  // you tilt.
  vec3 foilDifraccion(vec2 uv, vec2 p, vec2 tilt, float envL, float live) {
    float pat = texture2D(uHolo, p * 1.35).r;
    float diag = uv.x * 0.72 + uv.y * 0.43;
    float phase = diag * 2.15 + tilt.x * 2.4 - tilt.y * 1.7 + (pat - 0.5) * 1.9;
    vec3 rainbow = spectral(hb(phase));
    float bands = pow(0.5 + 0.5 * sin((uv.x * 1.35 + uv.y) * 95.0 + tilt.x * 22.0), 12.0);
    float sweep = exp(-pow((diag - 0.58 - tilt.x * 2.6 + tilt.y * 1.4) * 4.5, 2.0));
    float bright = (0.2 + 0.62 * envL) * (0.55 + 0.9 * pat) + (0.75 * sweep + 0.32 * bands) * (0.22 + 0.9 * live);
    return mix(silver(envL), rainbow * bright, 0.55 + 0.25 * live);
  }

  // curador — glitter: every flake is a tiny mirror with its own tilt; the
  // ones that line up with the key light flash, a different set for every
  // angle. Silver flakes, tinted in the band.
  vec3 foilGlitter(vec2 uv, vec2 p, vec3 N, vec3 V, vec3 T, vec3 B, vec2 tilt, float envL, float live) {
    vec2 g = p * 120.0;
    vec2 id = floor(g);
    vec3 h = hash32(id);
    vec2 f = fract(g) - 0.5 - (h.xy - 0.5) * 0.3;
    float flake = smoothstep(0.46, 0.16, length(f));
    vec3 fn = normalize(N + (T * (h.x - 0.5) + B * (h.y - 0.5)) * 1.2);
    float glint = pow(max(dot(fn, normalize(V + KEY)), 0.0), 48.0);
    vec3 fc = spectral(hb(uPhase + (h.z - 0.5) * 0.8 + tilt.x * 1.5 - tilt.y));
    vec3 base = mix(silver(envL), spectral(hb(uPhase + (uv.x - uv.y) * 0.35 + tilt.x)) * (0.3 + 0.6 * envL), 0.3);
    return base * (0.8 + 0.45 * h.z * flake) + fc * flake * glint * (1.0 + 4.0 * live) + vec3(glint * glint * flake * 2.0 * (0.3 + live));
  }

  // guía — lenticular: fine lenses over brushed chrome; colour bands slide
  // across the grain as the card tilts.
  vec3 foilLenticular(vec2 uv, vec2 p, vec2 tilt, float envL, float live) {
    vec2 dir = vec2(-0.7071, 0.7071);
    float across = dot(p, dir);
    float tl = dot(tilt, dir);
    float grain = texture2D(uBrushed, p * 0.9).r;
    float g = smoothstep(0.35, 0.75, grain);
    float lens = fract(across * 46.0);
    float hue = across * 0.7 + tl * 3.2 + (lens - 0.5) * 0.3;
    vec3 c = spectral(hb(hue));
    float bands = pow(0.5 + 0.5 * cos(TAU * (across * 2.6 - tl * 5.0)), 5.0);
    vec3 chrome = silver(envL) * (0.8 + 0.4 * g);
    return mix(chrome, c * (0.35 + 0.8 * envL), 0.25) + c * bands * (0.2 + 0.95 * live) * (0.45 + 0.9 * g);
  }

  // insider — cracked ice: voronoi shards of silver, each a facet with its
  // own tilt and phase; the cracks catch the light white.
  vec3 foilHielo(vec2 uv, vec2 p, vec3 N, vec3 V, vec3 T, vec3 B, vec2 tilt, float envL, float live) {
    vec2 g = p * 15.0;
    vec2 i = floor(g);
    vec2 f = fract(g);
    float d1 = 8.0;
    float d2 = 8.0;
    vec2 cid = i;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 o = vec2(float(x), float(y));
        vec2 r = o + hash22(i + o) - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          cid = i + o;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
    float edge = sqrt(d2) - sqrt(d1);
    vec3 h = hash32(cid + 7.3);
    vec3 fn = normalize(N + (T * (h.x - 0.5) + B * (h.y - 0.5)) * 0.8);
    float facet = pow(max(dot(fn, normalize(V + KEY)), 0.0), 16.0);
    vec3 c = spectral(hb(uPhase + (h.z - 0.5) * 1.1 + dot(tilt, h.xy - 0.5) * 7.0));
    float crack = 1.0 - smoothstep(0.0, 0.07, edge);
    vec3 shard = mix(silver(envL) * (0.75 + 0.5 * h.z), c * (0.3 + 0.7 * envL), 0.35) + c * facet * (0.35 + 1.1 * live);
    return mix(shard, vec3(0.97, 0.99, 1.0), crack * (0.25 + 0.55 * live));
  }

  // admin — ember / void: black foil, a hot band that wanders with the
  // angle (and shimmers only while the card is moving), sparse sparks.
  vec3 foilBrasa(vec2 uv, vec2 p, vec3 N, vec3 V, vec3 T, vec3 B, vec2 tilt, float envL, float live) {
    float n = vnoise(p * 6.0 + vec2(0.0, uTime * 0.9)) - 0.5;
    float n2 = vnoise(p * 13.0 - vec2(uTime * 0.6, 0.0)) - 0.5;
    float shimmer = (n * 0.14 + n2 * 0.05) * uMotion;
    float diag = uv.x * 0.8 - uv.y * 0.5;
    float heat = exp(-pow((diag - 0.35 - tilt.x * 2.4 + tilt.y * 1.2 + shimmer) * 3.2, 2.0));
    vec3 ember = spectral(hb(uPhase + (heat - 0.5) * 0.5 + shimmer * 2.0));
    vec3 col = vec3(0.05, 0.038, 0.036) + vec3(0.16) * envL + ember * (0.05 + 0.18 * envL + heat * (0.2 + 0.9 * live));
    vec2 g = p * 64.0;
    vec3 h = hash32(floor(g) + 3.1);
    if (h.z > 0.84) {
      float d = length(fract(g) - 0.5 - (h.xy - 0.5) * 0.4);
      vec3 fn = normalize(N + (T * (h.x - 0.5) + B * (h.y - 0.5)) * 1.3);
      float gl = pow(max(dot(fn, normalize(V + KEY)), 0.0), 36.0);
      col += mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.93, 0.75), gl) * smoothstep(0.32, 0.06, d) * gl * (1.2 + 3.5 * live);
    }
    return col;
  }

  void main() {
    // Arrival: an ordered-dither dissolve in screen pixels.
    if (bayer4(gl_FragCoord.xy) >= uFade) discard;

    vec3 nObj = normalize(vNObj);
    bool isFront = nObj.z >= 0.0;
    float face = smoothstep(0.5, 0.93, abs(nObj.z));

    // Planar UV → atlas. The back is read from behind, so u mirrors.
    vec2 uvFace = clamp(isFront ? vUv : vec2(1.0 - vUv.x, vUv.y), 0.0, 1.0);
    float v0 = isFront ? 0.5 : 0.0;
    vec2 auv = vec2(uvFace.x, v0 + clamp(uvFace.y, 0.004, 0.996) * 0.5);

    vec3 print = texture2D(uPrint, auv).rgb;
    vec3 rel = texture2D(uRelief, auv).rgb;
    float hL = texture2D(uRelief, auv - vec2(uReliefTexel.x, 0.0)).r;
    float hR = texture2D(uRelief, auv + vec2(uReliefTexel.x, 0.0)).r;
    float hD = texture2D(uRelief, auv - vec2(0.0, uReliefTexel.y)).r;
    float hU = texture2D(uRelief, auv + vec2(0.0, uReliefTexel.y)).r;
    // Where the ink is: the print's way from the stock toward the ink (light
    // ink on a dark stock too). Read at the print's own resolution, it is
    // the letterpress: every inked or stamped mark sinks into the board, as
    // deep as the relief's B says (rules shallower than type).
    vec3 si = uInkCol - uStock;
    float siN = 1.0 / max(dot(si, si), 1e-3);
    float ink = clamp(dot(print - uStock, si) * siN, 0.0, 1.0);
    float iL = clamp(dot(texture2D(uPrint, auv - vec2(uPrintTexel.x, 0.0)).rgb - uStock, si) * siN, 0.0, 1.0);
    float iR = clamp(dot(texture2D(uPrint, auv + vec2(uPrintTexel.x, 0.0)).rgb - uStock, si) * siN, 0.0, 1.0);
    float iD = clamp(dot(texture2D(uPrint, auv - vec2(0.0, uPrintTexel.y)).rgb - uStock, si) * siN, 0.0, 1.0);
    float iU = clamp(dot(texture2D(uPrint, auv + vec2(0.0, uPrintTexel.y)).rgb - uStock, si) * siN, 0.0, 1.0);
    float press = uDeboss * (0.3 + 0.7 * rel.b);
    // Height: the embossing (R) rises, the impression sinks.
    vec2 grad = (vec2(hR - hL, hU - hD) * uBump - vec2(iR - iL, iU - iD) * press) * face;

    // The cotton's tooth: a fine grain in the board's surface (a texel of it
    // is a pixel or two; it fades before it could shimmer).
    vec2 tp = uvFace * vec2(uAspect, 1.0) * 720.0;
    float toothFade = 1.0 - smoothstep(0.7, 1.6, length(fwidth(tp)));
    vec2 tooth = (hash22(floor(tp)) - 0.5) * 0.1 * toothFade * face;

    vec3 T = normalize(vT) * (isFront ? 1.0 : -1.0);
    vec3 B = normalize(vB);
    vec3 Ng = normalize(vN);
    vec3 N = normalize(Ng - T * (grad.x + tooth.x) - B * (grad.y + tooth.y));
    vec3 V = normalize(-vP);
    float ndv = clamp(dot(Ng, V), 0.0, 1.0);

    // Matte board under one soft key light. Facing the viewer it reads as
    // printed; turning it away dims it a little; the relief — impressions,
    // embossing, the tooth — shades both ways as the light rakes across.
    vec3 L = normalize(vec3(-0.42, 0.62, 0.66));
    float lamb = max(dot(N, L), 0.0);
    float lambFlat = max(dot(Ng, L), 0.0);
    vec3 col = print * (0.9 + 0.15 * lambFlat);
    col *= 1.0 + (lamb - lambFlat) * 1.3 * face;
    // Cotton takes a soft velvet sheen at grazing angles, and only there.
    float sheen = pow(1.0 - ndv, 3.0) * 0.3 * face;
    col = mix(col, studio(toWorld(reflect(-V, Ng)), 0.65) * 1.05, sheen);

    // Where it's stamped, the foil replaces the ink; never the stock around it.
    float mask = clamp(rel.g, 0.0, 1.0) * face * ink;
    if (mask > 0.003) {
      vec3 lateral = V - N * dot(V, N);
      vec2 tilt = vec2(dot(lateral, T), dot(lateral, B));
      vec2 p = vec2(uvFace.x * uAspect, uvFace.y);
      float envL = luma(studio(toWorld(reflect(-V, N)), 0.12));
      float live = uMotion;
      vec3 foil;
      if (uFoil < 0.5) foil = foilDifraccion(uvFace, p, tilt, envL, live);
      else if (uFoil < 1.5) foil = foilGlitter(uvFace, p, N, V, T, B, tilt, envL, live);
      else if (uFoil < 2.5) foil = foilLenticular(uvFace, p, tilt, envL, live);
      else if (uFoil < 3.5) foil = foilHielo(uvFace, p, N, V, T, B, tilt, envL, live);
      else foil = foilBrasa(uvFace, p, N, V, T, B, tilt, envL, live);
      float amount = mix(uRest, 1.0, uMotion) * (0.92 + 0.08 * uHover);
      col = mix(col, foil, mask * amount);
    }

    // The cut edge: a triplex board — the coloured plies, the core in the ink.
    float edge = 1.0 - face;
    float core = 1.0 - smoothstep(0.3, 0.42, abs(vPz) / uHalfDepth);
    col = mix(col, mix(uStock, uCore, core) * (0.76 + 0.24 * lambFlat), edge);

    gl_FragColor = vec4(col, 1.0);
  }
`

/** Hard offset shadows (4 CSS px right, 4 down), dithered in with the card. */
export const shadowVertex = /* glsl */ `
  uniform vec2 uOffset;
  void main() {
    vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    pos.xy += uOffset * pos.w;
    gl_Position = pos;
  }
`

export const shadowFragment = /* glsl */ `
  precision highp float;
  uniform vec3 uInk;
  uniform float uAlpha;
  uniform float uFade;
  ${BAYER}
  void main() {
    if (bayer4(gl_FragCoord.xy) >= uFade) discard;
    gl_FragColor = vec4(uInk, uAlpha);
  }
`
