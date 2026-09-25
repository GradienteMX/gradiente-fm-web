/**
 * CALCOS — stickers pressed onto the case.
 *
 * One program for every sticker (grids of a few densities, stickerGL.ts).
 * The vertex shader places it: sticker-local → peel curl (corners roll back
 * over a cylinder as the sticker ages) → press-in lift → clockwise rotation
 * as seen → the spot on its face → WRAPPED onto the case's outer skin
 * (geometry.ts EDGE_PATH, resampled by stickerWrap.ts): past the flat it
 * follows the edge's profile from the nearest point of the outline, then
 * lies flat on the other face, moving inward — like a real sticker folded
 * over a thick slab. Round the rounded corners it wraps radially; the
 * material that has to compress there pleats (`vWrap`). The back face
 * mirrors X and Z (a sticker pressed on the dorso wraps to the front).
 *
 * Every sticker is drawn in two halves (stickerGL.ts decides which it
 * needs): `uPass` 0 keeps the fragments whose skin faces the camera (drawn
 * over everything, stacked by draw order), 1 those whose skin faces away
 * (drawn before the acrylic, depth-tested against the card: seen through
 * the slab). The fragment shader prints the art (die-cut alpha) in its
 * FINISH (lib/stickers/finish.ts — the spec):
 *   uMat   0 papel · 1 vinil · 2 holo · 3 brillo · 4 transparente · 5 metal · 6 lenticular
 *   uKind  holo family: 0 prisma · 1 galaxia · 2 hielo · 3 diamante · 4 laser · 5 aceite · 6 escamas · 7 motivo
 *   uRel   relief: 0 liso · 1 tinta · 2 gofrado · 3 hundido · 4 barniz · 5 domo
 *   uFoilA / uFoilB  the copy's seeded foil layout (foilLayout(copySeed(uid)))
 * Uniform branches only: a sticker pays for its own finish and nothing else.
 * The foils are physical-ish: reflection gratings (the grating equation per
 * light, orders 1–3, a wavelength → RGB curve) under the studio's three
 * lights, facets and shards as tilted mirrors of the studio, thin-film
 * interference for aceite and the sequins. Reliefs come from the art itself
 * (ink or die-cut at a mip level → a height field → a bent normal).
 *
 * And it ages them: the print fades toward the paper, yellows, grime creeps
 * in from the die-cut edge, the surface scuffs, foil dulls, glitter sheds,
 * varnish yellows, a dome hazes; corners curl up (the backing shows).
 * Scraping (uWear) takes the ink first (the foil shows), then the stock,
 * down to the case, with torn fibres at the edges. Seen from behind
 * (through the acrylic) a sticker shows its backing.
 *
 * `FOOTPRINT` builds the pass drawn just under each sticker: the hard
 * press-in shadow while it settles, and the adhesive residue + dirt line
 * left where a corner has lifted.
 */

import { BAYER, ENV, HASH, SPECTRAL } from './glsl'
import { PATH_N } from './stickerWrap'

export const stickerVertex = /* glsl */ `
  #define PATH_N ${PATH_N}
  uniform vec2 uCenter;
  uniform float uRot;
  uniform vec2 uSize;
  uniform float uFace;
  uniform float uLayer;
  uniform vec4 uPeelA;
  uniform vec4 uPeelB;
  uniform float uPress;
  uniform float uMargin;
  uniform vec3 uHalf;
  uniform float uCorner;
  uniform vec4 uPath[PATH_N];
  uniform vec4 uPathInfo;
  uniform vec2 uPathEnds;
  varying vec2 vUv;
  varying vec2 vLocal;
  varying vec3 vN;
  varying vec3 vNs;
  varying vec3 vTx;
  varying vec3 vBt;
  varying vec3 vP;
  varying float vCurl;
  varying vec4 vWrap;

  // Roll the part past a peel line around a cylinder (pk.xy: direction to
  // the lifting corner, pk.z: distance of the line from the centre, pk.w:
  // curl radius). Returns the curl angle.
  float peel(inout vec2 l, inout float z, inout vec3 n, vec4 pk) {
    if (pk.w <= 0.0) return 0.0;
    float s = dot(l, pk.xy) - pk.z;
    if (s <= 0.0) return 0.0;
    float th = s / pk.w;
    vec2 perp = l - pk.xy * dot(l, pk.xy);
    l = perp + pk.xy * (pk.z + pk.w * sin(th));
    z += pk.w * (1.0 - cos(th));
    n = vec3(-pk.xy * sin(th), cos(th));
    return th;
  }

  // The edge's profile at arc length t, walked from this sticker's own face:
  // x inset, y depth (its face at +z), z the tangent's angle in the
  // (outward, z) plane, w crease.
  vec4 edgeProfile(float t) {
    float tt = uFace > 0.0 ? t : uPathInfo.x - t;
    float x = clamp((tt + uPathInfo.z) / uPathInfo.y, 0.0, float(PATH_N) - 1.001);
    float i = floor(x);
    int k = int(i);
    vec4 s = mix(uPath[k], uPath[k + 1], x - i);
    if (uFace < 0.0) {
      // walked backwards and seen from behind: (−cos, sin) → π − φ
      s.y = -s.y;
      s.z = 3.14159265 - s.z;
    }
    return s;
  }

  // A corner wraps radially; past its centre it can't: the radius eases to 0.
  float cornerR(float r) {
    float m = uPathInfo.w;
    return r > m ? r : m * exp((r - m) / m);
  }

  void main() {
    vec2 a = position.xy * (1.0 + 2.0 * uMargin);
    vUv = a + 0.5;
    vec2 l = a * uSize;
    vLocal = l;
    float z = 0.0;
    vec3 n = vec3(0.0, 0.0, 1.0);
    float curl = 0.0;
    #ifndef FOOTPRINT
      curl = max(peel(l, z, n, uPeelA), peel(l, z, n, uPeelB));
      // pressed in: lifted a hair and a touch larger until it settles
      float lifted = 1.0 - uPress;
      l *= 1.0 + 0.015 * lifted;
      z += 0.018 * lifted;
    #endif
    vCurl = curl;

    float c = cos(uRot);
    float s = sin(uRot);
    vec2 f = vec2(l.x * c + l.y * s, -l.x * s + l.y * c) + uCenter;
    vec3 nf = vec3(n.x * c + n.y * s, -n.x * s + n.y * c, n.z);
    vec2 ax = vec2(c, -s);

    // ── onto the skin: the face → round the edge → the other face ──────
    vec2 hb = uHalf.xy - uCorner;
    vec2 sg = vec2(f.x < 0.0 ? -1.0 : 1.0, f.y < 0.0 ? -1.0 : 1.0);
    vec2 q = abs(f) - hb;
    bool corner = q.x > 0.0 && q.y > 0.0;
    vec2 n2;
    float d;
    float ph;
    float rho = 1.0;
    if (corner) {
      rho = max(length(q), 1e-5);
      n2 = sg * q / rho;
      d = rho - uCorner;
      ph = atan(q.y, q.x);
    } else if (q.x > q.y) {
      n2 = vec2(sg.x, 0.0);
      d = q.x - uCorner;
      ph = 0.0;
    } else {
      n2 = vec2(0.0, sg.y);
      d = q.y - uCorner;
      ph = 1.5707963;
    }
    vec2 b2 = vec2(-n2.y, n2.x);
    float ins0 = uFace > 0.0 ? uPathEnds.x : uPathEnds.y;
    float insE = uFace > 0.0 ? uPathEnds.y : uPathEnds.x;
    float L = uPathInfo.x;
    float E = uPathInfo.z;
    float t = d + ins0;
    vec3 P;
    // U: where the face's outward direction goes; N: the skin's normal.
    vec3 U;
    vec3 N;
    float k = 1.0;
    float crease = 0.0;
    float other = 0.0;
    if (t <= -E) {
      P = vec3(f, uHalf.z);
      U = vec3(n2, 0.0);
      N = vec3(0.0, 0.0, 1.0);
    } else if (t < L + E) {
      vec4 e = edgeProfile(t);
      vec2 tg = vec2(cos(e.z), sin(e.z));
      if (corner) {
        float r = cornerR(uCorner - e.x);
        P = vec3(sg * hb + n2 * r, e.y);
        k = r / rho;
      } else {
        P = vec3(f - n2 * (d + e.x), e.y);
      }
      U = vec3(n2 * tg.x, tg.y);
      N = vec3(n2 * -tg.y, tg.x);
      crease = e.w;
      other = clamp((t - L) / E, 0.0, 1.0);
    } else {
      float sIn = insE + (t - L);
      if (corner) {
        float r = cornerR(uCorner - sIn);
        P = vec3(sg * hb + n2 * r, -uHalf.z);
        k = r / rho;
      } else {
        P = vec3(f - n2 * (d + sIn), -uHalf.z);
      }
      U = vec3(-n2, 0.0);
      N = vec3(0.0, 0.0, -1.0);
      other = 1.0;
    }
    vec3 Bv = vec3(b2, 0.0);
    // The face's own vectors, carried onto the skin (the outline direction
    // shrinks by k round a corner).
    vec3 nS = normalize(U * dot(nf.xy, n2) + Bv * dot(nf.xy, b2) + N * nf.z);
    vec3 tS = U * dot(ax, n2) + Bv * (dot(ax, b2) * k);

    // Two flaps of one sticker can meet on the other face near a corner:
    // the top/bottom one lies over the side one.
    float over = other * (ph / 1.5707963) * 0.00025;
    #ifdef FOOTPRINT
      float lift = 0.0004 + uLayer * 0.00045 + over;
    #else
      float lift = 0.0007 + uLayer * 0.00045 + over + z;
    #endif
    P += N * lift;

    vec3 fl = vec3(uFace, 1.0, uFace);
    vec4 mv = modelViewMatrix * vec4(P * fl, 1.0);
    vP = mv.xyz;
    vN = normalize(normalMatrix * (nS * fl));
    vNs = normalize(normalMatrix * (N * fl));
    vTx = normalize(normalMatrix * (tS * fl + vec3(1e-6)));
    vBt = normalize(normalMatrix * (Bv * fl));
    vWrap = vec4(1.0 - k, ph, crease, t);
    gl_Position = projectionMatrix * mv;
  }
`

const COMMON = /* glsl */ `
  precision highp float;
  uniform sampler2D uArt;
  uniform sampler2D uArtB;
  uniform sampler2D uMotif;
  uniform sampler2D uHolo;
  uniform sampler2D uRough;
  uniform sampler2D uBrushed;
  uniform sampler2D envMap;
  uniform float uArtOk;
  uniform vec2 uArtPx;
  uniform vec2 uSize;
  uniform float uAge;
  uniform float uWear;
  uniform float uSeed;
  uniform float uMat;
  uniform float uKind;
  uniform float uRel;
  uniform vec4 uMetal;
  uniform vec4 uFoilA;
  uniform vec4 uFoilB;
  uniform float uPress;
  uniform float uMark;
  uniform float uMargin;
  uniform vec4 uPeelA;
  uniform vec4 uPeelB;
  uniform float uFade;
  uniform float uMotion;
  uniform vec3 uInk;
  uniform float uPass;
  varying vec2 vUv;
  varying vec2 vLocal;
  varying vec3 vN;
  varying vec3 vNs;
  varying vec3 vTx;
  varying vec3 vBt;
  varying vec3 vP;
  varying float vCurl;
  varying vec4 vWrap;

  ${SPECTRAL}
  ${HASH}
  ${BAYER}
  ${ENV}

  const vec3 RED = vec3(0.902, 0.2, 0.161);
  // The studio's lights (view space = world space for this camera, which
  // never rotates): the key softbox up-left, the strip on the right, the rim above.
  const vec3 KEY = vec3(-0.451, 0.551, 0.702);
  const vec3 STRIP = vec3(0.63, 0.16, 0.76);
  const vec3 RIM = vec3(0.0, 0.844, 0.536);

  bool inRect(vec2 uv) { return uv.x >= 0.0 && uv.y >= 0.0 && uv.x <= 1.0 && uv.y <= 1.0; }
  vec4 art(vec2 uv) { return inRect(uv) ? texture2D(uArt, uv) : vec4(0.0); }
  float artLod(vec2 uv, float lod) { return inRect(uv) ? textureLod(uArt, uv, lod).a : 0.0; }

  // Part of the die-cut that a peel has lifted off the surface.
  float peeled(vec4 pk) {
    if (pk.w <= 0.0) return 0.0;
    return step(0.0, dot(vLocal, pk.xy) - pk.z);
  }

  // Which half this draw keeps: the skin facing the camera, or the one seen through the slab.
  bool wrongHalf() {
    float facing = dot(normalize(vNs), -vP);
    return uPass > 0.5 ? facing > 0.0 : facing <= 0.0;
  }
`

export const stickerFragment = /* glsl */ `
  ${COMMON}

  // The shading frame, set once in main (sticker-local axes on the skin).
  vec3 gN;
  vec3 gV;
  vec3 gTx;
  vec3 gTy;
  vec2 gP;

  vec3 dirL(vec2 d) { return normalize(gTx * d.x + gTy * d.y); }
  vec3 envR(vec3 N, float rough) { return studio(toWorld(reflect(-gV, N)), rough); }

  // ── light ────────────────────────────────────────────────────────────────

  // A wavelength (nm) → display RGB: a smooth CIE-like curve (violet's red lobe included).
  vec3 waveRGB(float nm) {
    vec3 x = (vec3(nm) - vec3(612.0, 548.0, 458.0)) / vec3(56.0, 46.0, 34.0);
    vec3 c = exp(-x * x);
    float v = (nm - 432.0) / 20.0;
    c.r += 0.3 * exp(-v * v);
    return c;
  }

  // One light through a reflection grating (grating vector g, grooves along
  // b, period d nm): orders 1–3 reach the eye where d·|(L+V)·g| = mλ; the
  // grooves only scatter across themselves (spread: the light's size).
  vec3 gratingL(vec3 L, vec3 g, vec3 b, float d, float spread) {
    vec3 H = L + gV;
    float w = dot(H, b) / spread;
    float along = exp(-w * w);
    if (along < 0.002) return vec3(0.0);
    float nm = d * abs(dot(H, g));
    return (waveRGB(nm) + 0.55 * waveRGB(nm * 0.5) + 0.3 * waveRGB(nm * 0.33333)) * along;
  }
  vec3 grating(vec3 N, vec3 g, float d, float spread) {
    vec3 b = normalize(cross(N, g));
    return gratingL(KEY, g, b, d, spread) + 0.7 * gratingL(STRIP, g, b, d, spread * 0.75) + 0.5 * gratingL(RIM, g, b, d, spread);
  }

  // A tiny mirror catching one of the lights.
  float glint(vec3 R, float sharp) {
    return pow(max(dot(R, KEY), 0.0), sharp) + 0.7 * pow(max(dot(R, STRIP), 0.0), sharp) + 0.5 * pow(max(dot(R, RIM), 0.0), sharp);
  }

  // Thin-film interference: a film of index 1.42, th nm thick, seen at cos = c.
  vec3 thinFilm(float th, float c) {
    float s = sqrt(max(0.0, 1.0 - c * c)) / 1.42;
    float opd = 2.84 * th * sqrt(1.0 - s * s);
    return 0.5 + 0.5 * cos(6.2831853 * opd / vec3(650.0, 540.0, 450.0) + 3.14159265);
  }

  // ── holo families (lib/stickers/finish.ts) ──────────────────────────────

  // The metallized base under every foil: a satin mirror of the studio.
  vec3 foilBase(vec3 N) {
    return (envR(N, 0.32) * 0.62 + envR(N, 0.07) * 0.38) * vec3(0.82, 0.84, 0.88);
  }

  // A slowly turning field (a mastered hologram is many small gratings).
  float turnField(vec2 p) {
    return vnoise(p + uSeed * 23.0) * 0.67 + vnoise(p * 2.3 - uSeed * 11.0) * 0.33;
  }

  // prisma — a mastered grating: its direction turns across the foil (so
  // some patch always catches a light), its period drifts, a faint crossed
  // grating, and the moiré of a near-twin one.
  vec3 holoPrisma(vec3 N) {
    float a0 = uFoilA.x;
    float a = a0 + (turnField(gP * 7.0 / uFoilA.y) - 0.5) * 2.6;
    vec2 gd = vec2(cos(a), sin(a));
    vec3 g = dirL(gd);
    float pat = texture2D(uHolo, gP * 2.2 / uFoilA.y + uSeed * 3.7).r;
    float chirp = 1.0 + 0.12 * sin(dot(gP, gd) * 11.0 / uFoilA.y + uSeed * 40.0) + (pat - 0.5) * 0.28;
    float d = 880.0 * chirp;
    vec3 c = grating(N, g, d, 0.42);
    c += 0.32 * grating(N, dirL(vec2(-gd.y, gd.x)), d * 1.09, 0.42);
    vec2 b0 = vec2(cos(a0), sin(a0));
    vec2 b1 = vec2(cos(a0 + 0.07 + uFoilA.w * 0.06), sin(a0 + 0.07 + uFoilA.w * 0.06));
    float moire = 0.5 + 0.5 * cos(dot(gP, b0 - b1 * 1.012) * 1400.0 / uFoilA.y + dot(gV, g) * 9.0);
    float ln = dot(gP, b0) * 2600.0 / uFoilA.y;
    float lines = mix(0.5 + 0.5 * sin(ln), 0.5, smoothstep(0.6, 1.6, fwidth(ln)));
    return foilBase(N) * (0.5 + 0.35 * pat + 0.1 * lines) + c * (0.74 + 0.18 * moire);
  }

  // A layer of stars: one per cell at most, each a tiny mirror at its own tilt.
  vec3 starLayer(vec2 p, float cells, float dens, float size, float sharp, vec3 N) {
    vec2 g = p * cells;
    float aa = fwidth(g.x) * 0.7;
    vec2 id = floor(g);
    vec3 h = hash32(id + uSeed * 57.0);
    if (h.z > dens) return vec3(0.0);
    vec2 o = fract(g) - 0.5 - (h.xy - 0.5) * 0.6;
    float r = length(o);
    float core = smoothstep(size + aa, 0.0, r);
    vec3 fn = normalize(N + (gTx * (h.x - 0.5) + gTy * (h.y - 0.5)) * 0.9);
    float gl = glint(reflect(-gV, fn), sharp);
    vec3 tint = mix(vec3(0.72, 0.84, 1.0), vec3(1.0, 0.88, 0.72), fract(h.z * 7.31));
    return tint * core * (0.22 + 3.2 * gl);
  }

  // galaxia — deep space: a dark smoky foil, a nebula that drifts with the
  // view (it sits deeper), stars in three depths, a few four-point flares.
  vec3 holoGalaxia(vec3 N) {
    vec2 vt = vec2(dot(gV, gTx), dot(gV, gTy)) / max(dot(gV, N), 0.35);
    vec2 sp = gP * 5.0 / uFoilA.y + uSeed * 13.0;
    float smoke = fbm(sp + vec2(fbm(sp * 1.7 + 3.1), fbm(sp * 1.3 - 1.7)) * 1.2);
    vec3 col = mix(vec3(0.03, 0.026, 0.055), vec3(0.12, 0.085, 0.17), smoke);
    vec2 np = gP * 2.6 / uFoilA.y + vt * 0.05 + uSeed * 7.0;
    float neb = fbm(np + vec2(fbm(np * 2.1 + 1.3), fbm(np * 1.9 - 2.2)) * 0.9);
    float nebA = smoothstep(0.34, 0.78, neb);
    vec3 nebC = spectral(uFoilA.z + neb * 0.75 + dot(vt, vec2(0.7, -0.45)));
    col += nebC * nebA * (0.2 + 0.3 * luma(envR(N, 0.35)));
    // a faint rainbow sheen over the dark foil, at an angle
    col += grating(N, dirL(vec2(cos(uFoilA.x), sin(uFoilA.x))), 860.0, 0.4) * 0.07;
    col += starLayer(gP + vt * 0.006, 120.0, 0.55, 0.16, 90.0, N) * 0.45;
    col += starLayer(gP + vt * 0.016 + 0.37, 52.0, 0.3 + 0.25 * uFoilA.w, 0.13, 60.0, N);
    // flares: four-point stars, deepest, rare
    vec2 fg = (gP + vt * 0.035) * 13.0 + uSeed * 3.0;
    float w = fwidth(fg.x);
    vec3 h = hash32(floor(fg) + 11.0);
    if (h.z < 0.22) {
      vec2 o = fract(fg) - 0.5 - (h.xy - 0.5) * 0.5;
      float crs = smoothstep(0.018 + w, 0.0, abs(o.x)) * smoothstep(0.4, 0.0, abs(o.y)) + smoothstep(0.018 + w, 0.0, abs(o.y)) * smoothstep(0.4, 0.0, abs(o.x));
      float core = smoothstep(0.09, 0.0, length(o));
      vec3 fn = normalize(N + (gTx * (h.x - 0.5) + gTy * (h.y - 0.5)) * 0.6);
      float gl = glint(reflect(-gV, fn), 24.0);
      col += vec3(0.95, 0.97, 1.0) * (crs * 0.75 + core) * (0.35 + 2.4 * gl);
    }
    return col;
  }

  // hielo — cracked ice: seeded shards, each a flat mirror at its own tilt
  // with its own grating; thin white cracks between them.
  vec3 holoHielo(vec3 N) {
    float count = 20.0 + 40.0 * uFoilA.w;
    float cell = sqrt(uSize.x * uSize.y / count);
    vec2 g = gP / cell + uSeed * 31.0;
    vec2 i = floor(g);
    vec2 f = fract(g);
    float d1 = 8.0;
    float d2 = 8.0;
    vec2 cid = i;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 o = vec2(float(x), float(y));
        vec2 r = o + 0.05 + hash22(i + o) * 0.9 - f;
        float dd = dot(r, r);
        if (dd < d1) {
          d2 = d1;
          d1 = dd;
          cid = i + o;
        } else if (dd < d2) {
          d2 = dd;
        }
      }
    }
    float edge = sqrt(d2) - sqrt(d1);
    vec3 h = hash32(cid * 1.37 + 5.1);
    vec3 fn = normalize(N + (gTx * (h.x - 0.5) + gTy * (h.y - 0.5)) * 0.6);
    float ga = h.z * 3.14159 + uFoilA.x;
    vec2 gd = vec2(cos(ga), sin(ga));
    vec3 gc = grating(fn, dirL(gd), 760.0 + 480.0 * fract(h.x * 13.1), 0.32);
    vec3 env = envR(fn, 0.05);
    float flash = smoothstep(0.52, 0.95, luma(env));
    // every shard carries a trace of colour of its own (a film on the ice)
    vec3 film = thinFilm(240.0 + 420.0 * fract(h.y * 7.7), clamp(dot(fn, gV), 0.0, 1.0));
    vec3 col = (env * 0.7 + envR(fn, 0.3) * 0.3) * mix(vec3(0.66, 0.72, 0.8), film, 0.42) * (0.5 + 1.0 * flash) + gc * 0.9;
    // frost inside each shard, along its own grain
    float fr = vnoise(vec2(dot(gP, gd) * 160.0, dot(gP, vec2(-gd.y, gd.x)) * 18.0) + h.xy * 50.0);
    col *= 0.88 + 0.24 * fr;
    float w = fwidth(edge);
    float crack = 1.0 - smoothstep(0.0, 0.035 + w, edge);
    float hair = 1.0 - smoothstep(0.0, 0.012 + w * 0.5, edge);
    col = mix(col, vec3(0.96, 0.99, 1.0) * (0.72 + 0.5 * flash), crack * 0.85);
    return col * (1.0 - hair * 0.4);
  }

  // diamante — diamond plate: a seeded lattice of pyramids; every face a
  // mirror and a grating along its slope, flashing in an engineered order.
  vec3 holoDiamante(vec3 N) {
    float a = uFoilA.x;
    mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
    float pitch = 0.017 * uFoilA.y;
    vec2 q = rot * gP / pitch + uSeed * 17.0;
    vec2 c = fract(q) - 0.5;
    vec2 id = floor(q);
    vec2 fd = abs(c.x) > abs(c.y) ? vec2(sign(c.x), 0.0) : vec2(0.0, sign(c.y));
    vec2 fl = fd * rot;
    vec3 sl = dirL(fl);
    vec3 fn = normalize(N + sl * 0.62);
    vec3 env = envR(fn, 0.04);
    float flash = smoothstep(0.5, 0.92, luma(env));
    float jit = hash12(id * 1.7 + fd * 3.1 + uSeed * 9.0);
    vec3 gc = grating(fn, sl, 900.0 + 160.0 * jit, 0.36);
    vec3 col = (env * 0.75 + envR(fn, 0.3) * 0.25) * vec3(0.72, 0.75, 0.8) * (0.45 + 1.1 * flash) + gc * 0.85;
    float ridge = min(abs(abs(c.x) - abs(c.y)), 0.5 - max(abs(c.x), abs(c.y)));
    float w = fwidth(q.x) + fwidth(q.y);
    float line = 1.0 - smoothstep(0.0, 0.035 + w, ridge);
    return mix(col, col * 0.5 + vec3(0.1), line * 0.55);
  }

  // laser — concentric grooves round a seeded centre (often off the
  // sticker): the grating is radial, so rainbow arms swing round the centre
  // as the view moves, like a CD. Faint radial spokes over it.
  vec3 holoLaser(vec3 N) {
    vec2 cL = (uFoilB.xy - 0.5) * uSize;
    vec2 r = gP - cL;
    float rl = max(length(r), 1e-4);
    vec2 rd = r / rl;
    // the track pitch wobbles a little with the radius (bands in the arms)
    vec3 c = grating(N, dirL(rd), 860.0 * (1.0 + 0.06 * sin(rl * 60.0 / uFoilA.y)), 0.36) * 1.25;
    float spokes = pow(0.5 + 0.5 * cos(atan(r.y, r.x) * (26.0 + floor(uFoilA.w * 18.0))), 16.0);
    c += grating(N, dirL(vec2(-rd.y, rd.x)), 900.0, 0.36) * spokes * 0.45;
    float ring = rl * 1500.0 / uFoilA.y;
    float rings = mix(0.5 + 0.5 * cos(ring), 0.5, smoothstep(0.6, 1.6, fwidth(ring)));
    return foilBase(N) * (0.6 + 0.16 * rings) + c * (0.85 + 0.2 * rings);
  }

  // aceite — thin-film interference over a domain-warped thickness: oil-slick
  // swirls (magenta, green, gold, blue) that shift with the viewing angle.
  vec3 holoAceite(vec3 N) {
    vec2 q = gP * 4.2 / uFoilA.y + uSeed * 19.0;
    vec2 w1 = vec2(fbm(q + vec2(0.0, 1.3)), fbm(q + vec2(5.2, 1.7)));
    vec2 w2 = vec2(fbm(q + w1 * 2.2 + vec2(1.7, 9.2)), fbm(q + w1 * 2.2 + vec2(8.3, 2.8)));
    float th = 250.0 + 620.0 * fbm(q + w2 * 1.9);
    vec3 film = thinFilm(th, clamp(dot(N, gV), 0.0, 1.0));
    film = mix(vec3(luma(film)), film, 0.86);
    vec3 env = envR(N, 0.12);
    vec3 col = vec3(0.05, 0.05, 0.06) + film * (0.42 + 0.7 * luma(env));
    return col + env * 0.14;
  }

  // escamas — sequins on a hex grid, overlapping like scales (the lower row
  // lies over the one above); each a small tilted mirror under an
  // iridescent film, tilted by its row: they flash in rows.
  vec3 holoEscamas(vec3 N) {
    float S = 0.03 * uFoilA.y;
    float a = (uFoilA.x - 1.5707963) * 0.3;
    mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
    vec2 q = rot * gP / S + uSeed * 7.0;
    float row0 = floor((q.y - 0.62) / 0.5);
    vec2 hc = vec2(0.0);
    vec2 hid = vec2(0.0);
    float found = 0.0;
    for (int k = 0; k < 4; k++) {
      float row = row0 + float(k);
      float off = mod(row, 2.0) * 0.5;
      float cc = floor(q.x - off + 0.5);
      vec2 dq = q - vec2(cc + off, row * 0.5);
      if (found < 0.5 && dot(dq, dq) < 0.3844) {
        hc = dq;
        hid = vec2(cc, row);
        found = 1.0;
      }
    }
    vec3 h = hash32(hid + uSeed * 23.0);
    float r = length(hc) / 0.62;
    float rowTilt = sin(hid.y * 0.93 + uSeed * 6.0) * 0.4;
    vec2 tl = (h.xy - 0.5) * 0.22 + vec2(0.0, rowTilt) + hc * 0.3 + 1e-4;
    vec3 fn = normalize(N + dirL(tl * rot) * length(tl));
    vec3 env = envR(fn, 0.06);
    float flash = smoothstep(0.5, 0.94, luma(env)) + glint(reflect(-gV, fn), 40.0) * 0.6;
    // one film per row (a strip of sequins is one dye lot), a little jitter
    float th = 330.0 + 150.0 * sin(hid.y * 0.61 + uSeed * 4.0) + 50.0 * (h.z - 0.5);
    vec3 film = thinFilm(th, clamp(dot(fn, gV), 0.0, 1.0));
    vec3 col = (env * 0.62 + envR(fn, 0.3) * 0.3 + 0.04) * mix(vec3(0.85), film, 0.55) + film * flash * 0.7;
    // the rim of each sequin, and the shade under the one lying over it
    col *= 0.62 + 0.38 * smoothstep(1.0, 0.8, r);
    col *= 0.8 + 0.2 * smoothstep(-0.45, 0.1, hc.y);
    return col;
  }

  // The motif of 'motivo' (1 inside), in a cell of the lattice.
  float motifMask(vec2 q) {
    if (uFoilB.z > 1.5) {
      // the code's letters, from a small repeating texture (a 2:1 tile)
      return texture2D(uMotif, vec2(q.x * 0.5, q.y)).r;
    }
    vec2 c = fract(q) - 0.5;
    float w = fwidth(q.x) * 0.8;
    float sd;
    if (uFoilB.z < 0.5) {
      // ⊕ the registration mark
      float ring = abs(length(c) - 0.27) - 0.035;
      float bar = min(max(abs(c.x) - 0.03, abs(c.y) - 0.42), max(abs(c.y) - 0.03, abs(c.x) - 0.42));
      sd = min(ring, bar);
    } else {
      // a four-point star
      vec2 ac = abs(c);
      sd = (sqrt(ac.x) + sqrt(ac.y) - 0.6) * 0.35;
    }
    return 1.0 - smoothstep(-w, w, sd);
  }

  // motivo — a repeated motif struck into the foil: the motifs' grating
  // runs across the ground's, so they light up when the ground goes dark.
  vec3 holoMotivo(vec3 N) {
    float a = uFoilA.x;
    vec2 gd = vec2(cos(a), sin(a));
    float ra = (uFoilA.z - 0.5) * 0.5;
    mat2 rot = mat2(cos(ra), -sin(ra), sin(ra), cos(ra));
    float pitch = 0.05 * uFoilA.y;
    vec2 q = rot * gP / pitch + uSeed * 9.0;
    float m = motifMask(q);
    // the ground: a turning prismatic grating; the motifs: a bright mirror
    // struck with a grating across it
    float ta = a + (turnField(gP * 6.0 / uFoilA.y) - 0.5) * 1.6;
    vec3 ground = grating(N, dirL(vec2(cos(ta), sin(ta))), 880.0, 0.42) * 0.8 + foilBase(N) * 0.5;
    vec3 motif = grating(N, dirL(vec2(-gd.y, gd.x)), 1060.0, 0.42) + envR(N, 0.04) * vec3(0.86, 0.88, 0.92) * 0.8 + 0.08;
    vec3 c = mix(ground, motif, m);
    // the strike: a hairline where the die bit in
    float rim = m * (1.0 - m) * 4.0;
    return c + vec3(rim * 0.2);
  }

  vec3 holoFoil(vec3 N) {
    if (uKind < 0.5) return holoPrisma(N);
    if (uKind < 1.5) return holoGalaxia(N);
    if (uKind < 2.5) return holoHielo(N);
    if (uKind < 3.5) return holoDiamante(N);
    if (uKind < 4.5) return holoLaser(N);
    if (uKind < 5.5) return holoAceite(N);
    if (uKind < 6.5) return holoEscamas(N);
    return holoMotivo(N);
  }

  // A brushed highlight (Ward-like): tight along the grooves X, wide across them.
  float brushed(vec3 L, vec3 N, vec3 X, vec3 Y) {
    vec3 H = normalize(L + gV);
    float hx = dot(H, X);
    float hy = dot(H, Y);
    float hn = max(dot(H, N), 0.05);
    return exp(-(hx * hx / 0.004 + hy * hy / 0.09) / (hn * hn));
  }

  // ── metal: foil stamping, a mirror brushed at a seeded angle ────────────
  vec3 metalFoil(vec3 N, float age) {
    float a = uFoilA.x;
    vec2 bd = vec2(cos(a), sin(a));
    vec2 q = vec2(dot(gP, bd), dot(gP, vec2(-bd.y, bd.x)));
    // hairlines along the brushing: coarse streaks, and fine ones that fade below a pixel
    vec2 hq = vec2(q.x * 4.0, q.y * 220.0) + uSeed * 30.0;
    float hair = vnoise(hq) * 0.6 + vnoise(hq * vec2(1.7, 2.9) + 7.0) * 0.4;
    float fq = q.y * 900.0;
    float fine = mix(vnoise(vec2(q.x * 9.0, fq) + uSeed * 13.0), 0.5, smoothstep(0.5, 1.2, fwidth(fq)));
    vec3 X = dirL(bd);
    vec3 Y = normalize(cross(N, X));
    vec3 Nh = normalize(N + Y * ((hair - 0.5) * 0.12 + (fine - 0.5) * 0.06));
    vec3 R = reflect(-gV, Nh);
    // the grooves smear the studio across themselves
    vec3 e0 = studio(toWorld(R), 0.06);
    vec3 e1 = studio(toWorld(normalize(R + Y * 0.26)), 0.09);
    vec3 e2 = studio(toWorld(normalize(R - Y * 0.26)), 0.09);
    vec3 env = e0 * 0.5 + (e1 + e2) * 0.25;
    float ndv = clamp(dot(Nh, gV), 0.0, 1.0);
    // tarnish (uMetal.w: how much this metal takes): darker and warmer with the years
    vec3 F0 = mix(uMetal.rgb, uMetal.rgb * vec3(0.74, 0.64, 0.52), age * uMetal.w);
    vec3 Fr = F0 + (1.0 - F0) * pow(1.0 - ndv, 5.0);
    float spec = brushed(KEY, Nh, X, Y) + 0.7 * brushed(STRIP, Nh, X, Y) + 0.5 * brushed(RIM, Nh, X, Y);
    vec3 col = (env * Fr * (0.72 + 0.36 * hair) + F0 * min(spec, 1.2) * (0.5 - age * 0.2)) * (0.9 + 0.16 * fine);
    // a coloured metal never goes white under a white light: keep the hue at the top
    float top = max(col.r, max(col.g, col.b));
    return top > 1.0 ? col / top : col;
  }

  // ── glitter: flakes in the laminate, each flipping on its own ───────────
  vec3 flakes(vec3 N, float cells, float dens, float age, float sharp, out float cover) {
    vec2 g = gP * cells + uSeed * 17.0;
    float w = fwidth(g.x) * 0.6;
    vec2 id = floor(g);
    vec3 h = hash32(id + uSeed * 91.0);
    cover = 0.0;
    if (h.z > dens) return vec3(0.0);
    // shed with age
    if (fract(h.z * 17.0 + h.x * 3.0) < age * 0.45) return vec3(0.0);
    vec2 o = fract(g) - 0.5 - (h.xy - 0.5) * 0.3;
    float ang = h.x * 6.2831;
    o = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * o;
    vec2 ao = abs(o);
    float hexd = max(ao.x * 0.866 + ao.y * 0.5, ao.y);
    float fl = 1.0 - smoothstep(0.27 - w, 0.27 + w, hexd);
    cover = fl;
    vec3 fn = normalize(N + (gTx * (h.x - 0.5) + gTy * (h.y - 0.5)) * 1.3);
    vec3 R = reflect(-gV, fn);
    float gl = glint(R, sharp);
    vec3 fc = spectral(h.z * 3.1 + dot(R, vec3(1.3, 0.7, 0.4)));
    vec3 env = studio(toWorld(R), 0.1);
    return fl * (env * 0.42 * (0.6 + 0.7 * fc) + (fc * 0.7 + 0.55) * gl * (3.0 + 2.5 * uMotion));
  }

  // ── relief: a height field from the art itself ──────────────────────────
  float reliefField(vec2 uv, float lod) {
    if (!inRect(uv)) return 0.0;
    vec4 t = textureLod(uArt, uv, lod);
    if (uRel > 4.5) return 1.0 - (1.0 - t.a) * (1.0 - t.a);
    return clamp(t.a - dot(t.rgb, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
  }

  // The slope (dh/dx, dh/dy in sticker units) and the height (0..1).
  vec2 reliefSlope(vec2 uv, out float h) {
    float lod;
    float amp;
    if (uRel < 1.5) {
      lod = 0.7;
      amp = 0.0022;
    } else if (uRel < 2.5) {
      lod = 2.2;
      amp = 0.0075;
    } else if (uRel < 3.5) {
      lod = 1.8;
      amp = -0.006;
    } else if (uRel < 4.5) {
      lod = 0.9;
      amp = 0.0007;
    } else {
      lod = 4.6;
      amp = 0.016;
    }
    vec2 e = exp2(lod) / uArtPx;
    h = reliefField(uv, lod);
    float hl = reliefField(uv - vec2(e.x, 0.0), lod);
    float hr = reliefField(uv + vec2(e.x, 0.0), lod);
    float hd = reliefField(uv - vec2(0.0, e.y), lod);
    float hu = reliefField(uv + vec2(0.0, e.y), lod);
    return vec2(hr - hl, hu - hd) / (2.0 * e) / uSize * amp;
  }

  // ── lenticular: ridges over two interleaved frames ──────────────────────
  // Returns how much of frame b this spot shows; bends Nl across the ridge.
  float lenticular(vec3 N, out vec3 Nl) {
    float a = 1.5707963 + (uFoilA.x - 1.5707963) * 0.14;
    vec2 rd = vec2(cos(a), sin(a));
    vec2 ac = vec2(rd.y, -rd.x);
    float xr = dot(gP, ac) / 0.0085;
    float cell = fract(xr);
    vec3 X = dirL(ac);
    Nl = normalize(N + X * (cell * 2.0 - 1.0) * 0.7);
    // each lens maps the view angle across the ridges to a strip under it
    float va = dot(gV, X) / max(dot(gV, N), 0.25);
    // (the gain puts a case seen square on one frame; a turn of ~15° flips it)
    float jit = (hash12(vec2(floor(xr), uSeed * 40.0)) - 0.5) * 0.08;
    float sel = fract(0.25 + va * 0.95 + (uFoilB.w - 0.5) * 0.12 + jit);
    float db = abs(fract(sel - 0.25) - 0.5);
    float w = 0.05;
    return 1.0 - smoothstep(0.25 - w, 0.25 + w, db);
  }

  // Scraping: long streaks along a per-sticker direction, and blotches.
  float scrapeField() {
    float ang = uSeed * TAU;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 q = vec2(dot(vLocal, dir), dot(vLocal, vec2(-dir.y, dir.x)));
    float streak = fbm(vec2(q.x * 4.0, q.y * 70.0) + uSeed * 17.0);
    float blotch = fbm(vLocal * 11.0 + uSeed * 5.0);
    return streak * 0.62 + blotch * 0.38;
  }

  vec3 marks(vec2 uv, float alpha, out float ma) {
    ma = 0.0;
    if (uMark < 0.5) return vec3(0.0);
    // a thin ring just outside the die-cut (a slightly dilated alpha minus the cut)
    float dil = artLod(uv, 1.7);
    float ring = smoothstep(0.1, 0.32, dil) * (1.0 - smoothstep(0.3, 0.62, alpha));
    // registration corners (TRAMA's hover grammar) on the extended rect,
    // measured in case units so strokes stay even on long stickers
    vec2 e = abs(uv - 0.5) * uSize;
    vec2 lim = (0.5 + uMargin * 0.85) * uSize;
    float th = 0.0055;
    float len = min(0.04, 0.3 * min(uSize.x, uSize.y));
    float inside = step(e.x, lim.x) * step(e.y, lim.y);
    float cx = step(lim.x - th, e.x) * step(lim.y - len, e.y);
    float cy = step(lim.y - th, e.y) * step(lim.x - len, e.x);
    float corner = clamp(cx + cy, 0.0, 1.0) * inside;
    vec3 col;
    if (uMark > 1.5 && uMark < 2.5) {
      col = RED;
      ma = max(ring, corner);
    } else if (uMark > 2.5) {
      col = RED;
      ma = corner;
    } else {
      col = mix(uInk, RED, corner);
      ma = max(ring * 0.7, corner);
    }
    return col;
  }

  void main() {
    if (bayer4(gl_FragCoord.xy) >= uFade) discard;
    if (wrongHalf()) discard;
    bool far = uPass > 0.5;
    bool front = gl_FrontFacing;
    vec3 V = normalize(-vP);
    vec3 N0 = normalize(vN);
    if (!front) N0 = -N0;
    vec3 Tx = normalize(vTx - N0 * dot(vTx, N0));
    vec3 Ty = cross(N0, Tx);
    gN = N0;
    gV = V;
    gTx = Tx;
    gTy = Ty;
    gP = vLocal;

    // Relief (and the dome's resin, which magnifies the print under it).
    vec2 uv = vUv;
    float relH = 0.0;
    vec2 slope = vec2(0.0);
    if (uRel > 0.5 && front) {
      slope = reliefSlope(vUv, relH);
      if (uRel > 4.5) {
        // refraction: the rim reads the print from further in (magnified),
        // and the print sits under the resin (it slides against the view)
        vec2 vt = vec2(dot(V, Tx), dot(V, Ty));
        vec2 sc = slope / max(1.0, length(slope));
        uv += (sc * (0.004 + relH * 0.012) - vt * relH * 0.011) / uSize;
      }
    }
    // Bunched round a corner, the print folds away into the pleats: read it softer there.
    float bunch = vWrap.x > 0.25 ? -log2(max(1.0 - vWrap.x, 0.04)) * 0.8 : 0.0;
    vec4 a4 = inRect(uv) ? texture2D(uArt, uv, bunch) : vec4(0.0);
    float alpha = (uRel > 4.5 ? art(vUv).a : a4.a) * uArtOk;
    float ma;
    vec3 mcol = marks(vUv, alpha, ma);
    if (alpha < 0.01 && ma < 0.01) discard;

    float ndl0 = max(dot(N0, KEY), 0.0);
    vec3 col = a4.a > 0.004 ? a4.rgb / a4.a : vec3(1.0);
    vec3 Nl = N0;
    if (uMat > 5.5 && front) {
      float fb = lenticular(N0, Nl);
      vec4 b4 = inRect(uv) ? texture2D(uArtB, uv) : vec4(0.0);
      vec3 colB = b4.a > 0.004 ? b4.rgb / b4.a : col;
      col = mix(col, colB, fb);
    }
    vec3 col0 = col;
    float age = uAge;

    // Scraping (layers: ink, then the stock, then nothing but residue).
    float base = 1.0;
    float inkLeft = 1.0;
    float fibre = 0.0;
    float residue = 0.0;
    if (uWear > 0.001) {
      float n = scrapeField();
      // wear ≈ the share scraped: a logit over the field's spread
      float w = clamp(uWear, 0.001, 0.999);
      float thr = uWear >= 0.999 ? 2.0 : 0.47 + 0.05 * log(w / (1.0 - w));
      float paper = uMat < 0.5 ? 1.0 : 0.0;
      inkLeft = smoothstep(thr - 0.01, thr + 0.01, n);
      float thrBase = thr - (paper > 0.5 ? 0.02 : 0.045);
      base = smoothstep(thrBase - 0.008, thrBase + 0.008, n);
      // torn paper: a fibrous white fringe where the print tore away
      float fr = fbm(vLocal * vec2(180.0, 40.0) + uSeed * 9.0);
      fibre = (1.0 - inkLeft) * base * mix(0.55, 1.0, fr);
      residue = (1.0 - base) * 0.16 * (0.6 + 0.4 * fbm(vLocal * 30.0));
    }

    if (!front) {
      // The backing, seen through the acrylic (or on a curled corner): the
      // sun never reached it — whiter than the faded front, a little glue.
      // Foil stock is silver behind.
      vec3 back = mix(vec3(0.975, 0.972, 0.96), vec3(0.93, 0.9, 0.8), age * 0.5);
      if ((uMat > 1.5 && uMat < 3.5) || (uMat > 4.5 && uMat < 5.5)) back = mix(vec3(0.8, 0.81, 0.83), vec3(0.76, 0.74, 0.68), age * 0.5);
      float ba = alpha;
      if (uMat > 3.5 && uMat < 4.5) {
        // clear film: the ink from behind
        float inkB = 1.0 - smoothstep(0.8, 0.95, luma(col)) * (1.0 - smoothstep(0.08, 0.22, length(col - vec3(luma(col)))));
        back = col * 0.92;
        ba *= mix(0.1, 1.0, inkB);
      }
      back *= 0.82 + 0.2 * max(dot(N0, KEY), 0.0);
      float bo = ba * base;
      // Seen through the whole slab: tinted, softer.
      if (far) {
        back *= vec3(0.9, 0.955, 0.945);
        bo *= 0.55;
      }
      gl_FragColor = vec4(back * bo, bo);
      return;
    }

    // The surface: relief, then the pleats a corner forced into it — the
    // material it can't lose folds into a few broad facets (a fold every
    // few millimetres), fading out toward the straight edges.
    vec3 N = normalize(N0 - Tx * slope.x - Ty * slope.y);
    float comp = smoothstep(0.05, 0.7, vWrap.x) * smoothstep(0.0, 0.3, min(vWrap.y, 1.5707963 - vWrap.y));
    float ridge = 0.0;
    float valley = 0.0;
    if (comp > 0.0) {
      float p = vWrap.y / 1.5707963 * (3.0 + floor(uSeed * 2.0));
      float f = fract(p);
      float w = fwidth(p) * 1.5 + 0.05;
      float facet = (f < 0.5 ? 1.0 : -1.0) * smoothstep(0.0, w, min(f, 1.0 - f)) * smoothstep(0.0, w, abs(f - 0.5));
      N = normalize(N + normalize(vBt) * facet * comp * 0.75);
      ridge = (1.0 - smoothstep(0.0, w, abs(f - 0.5))) * comp;
      valley = (1.0 - smoothstep(0.0, w, min(f, 1.0 - f))) * comp;
    }
    // Foil is never quite flat (stamped into a stock): a slow waviness
    // sweeps its reflection across the studio.
    if ((uMat > 1.5 && uMat < 2.5) || (uMat > 4.5 && uMat < 5.5)) {
      vec2 wv = vec2(vnoise(vLocal * 9.0 + uSeed * 7.0), vnoise(vLocal * 9.0 - uSeed * 5.0 + 3.1)) - 0.5;
      N = normalize(N + (Tx * wv.x + Ty * wv.y) * (uMat > 4.5 ? 0.3 : 0.1));
    }
    gN = N;
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float ndl = max(dot(N, KEY), 0.0);
    // the relief's own shading, raked by the key (only the difference it makes)
    float relief = (0.7 + 0.6 * ndl) / (0.7 + 0.6 * ndl0);

    // Age: the sun takes the ink toward the paper (warm inks first), the
    // paper yellows, grime creeps in from the die-cut edge and settles in
    // blotches, the surface scuffs.
    float l = luma(col);
    float fadeK = uMat < 0.5 ? 1.0 : (uMat > 3.5 && uMat < 4.5 ? 0.8 : 0.72);
    vec3 sun = vec3(0.93, 0.9, 0.82);
    vec3 faded = mix(mix(col, vec3(l), 0.62), sun, 0.44);
    faded.r = mix(faded.r, sun.r, 0.12);
    col = mix(col, faded, smoothstep(0.0, 1.0, age) * fadeK);
    col *= mix(vec3(1.0), vec3(1.0, 0.945, 0.8), age * (uMat < 0.5 ? 0.95 : 0.5));
    float soft = artLod(vUv, 3.5);
    float edgeness = 1.0 - smoothstep(0.35, 0.97, soft);
    float mott = fbm(vLocal * 38.0 + uSeed * 31.0);
    float grime = clamp(edgeness * 1.7 + (mott - 0.5) * 1.2, 0.0, 1.0) * smoothstep(0.04, 0.85, age);
    grime = max(grime, smoothstep(0.58, 0.78, mott) * age * 0.55);
    float scuff = smoothstep(0.66, 0.9, texture2D(uRough, vLocal * 2.4 + uSeed * 7.0).r) * smoothstep(0.2, 1.0, age);

    // The foil window — lib/stickers/finish.ts foilWindow, its GLSL twin, so
    // a copy looks like itself in the binder too: the light, unsaturated
    // print lets the foil (holo, glitter, bare metal) through; light coloured
    // inks tint it (translucent ink over foil); dark or saturated ink stays ink.
    float l0 = luma(col0);
    float sat0 = max(col0.r, max(col0.g, col0.b)) - min(col0.r, min(col0.g, col0.b));
    float window = smoothstep(0.35, 0.9, l0) * (1.0 - 0.6 * smoothstep(0.25, 0.65, sat0));
    vec3 filt = mix(vec3(1.0), clamp(col0 / max(l0, 0.3), 0.0, 1.5), smoothstep(0.1, 0.4, sat0));
    // under the ink when it's scraped: the white stock, or the bare foil
    vec3 bare = uMat < 0.5 ? vec3(0.95, 0.94, 0.9) : (uMat > 3.5 && uMat < 4.5 ? vec3(0.9) : vec3(0.96, 0.96, 0.95));

    vec3 Rw = toWorld(reflect(-V, N));
    float F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
    float gloss = 0.0;
    float glossRough = 0.06 + age * 0.22;
    if (uMat < 0.5) {
      // papel: matte, fibres
      float fib = fbm(vLocal * vec2(260.0, 90.0) + uSeed * 3.0);
      col *= (0.93 + 0.1 * fib) * (0.9 + 0.12 * ndl) * relief;
    } else if (uMat < 1.5) {
      // vinil: a gloss film — one clean highlight that slides with the tilt
      col *= (0.92 + 0.1 * ndl) * relief;
      gloss = 1.0;
    } else if (uMat < 2.5) {
      // holo: the print over a holographic foil
      vec3 foil = holoFoil(N);
      float dull = 1.0 - 0.4 * smoothstep(0.1, 1.0, age);
      foil = mix(foil * dull, vec3(0.62, 0.63, 0.64) * (0.8 + 0.2 * ndl), scuff * 0.7);
      col = mix(col * (0.92 + 0.1 * ndl) * relief, foil * filt, window);
      bare = foil;
      gloss = 0.55;
    } else if (uMat < 3.5) {
      // brillo: a glitter stock — a bed of flakes where the print lets it
      // through, each flipping on its own; a few loose ones over the ink
      float c1;
      float c2;
      vec3 fl = flakes(N, 95.0 / uFoilA.y, 0.55 + 0.35 * uFoilA.w, age, 110.0, c1);
      vec3 fl2 = flakes(N, 210.0 / uFoilA.y, 0.62, age, 160.0, c2);
      vec3 bed = foilBase(N) * 0.55 + 0.2;
      vec3 glitter = bed * (1.0 - 0.45 * max(c1, c2)) + fl + fl2 * 0.6;
      col = mix(col * (0.9 + 0.1 * ndl) * relief, glitter * filt, window) + fl * 0.3 * (1.0 - window);
      bare = glitter;
      gloss = 0.7;
    } else if (uMat < 4.5) {
      // transparente: only the ink prints; the film is a glint
      float inkT = 1.0 - smoothstep(0.8, 0.95, l0) * (1.0 - smoothstep(0.08, 0.22, length(col0 - vec3(l0))));
      vec3 env = studio(Rw, 0.05);
      float edge = (1.0 - smoothstep(0.2, 0.9, soft)) * alpha;
      alpha *= mix(0.06 + F * 1.5 + smoothstep(0.6, 1.0, luma(env)) * 0.25, 1.0, inkT);
      col = mix(env, col * relief, inkT);
      col = mix(col, vec3(1.0), edge * 0.5);
    } else if (uMat < 5.5) {
      // metal: bare metal in the light areas, the ink on top, matte
      vec3 m = metalFoil(N, age);
      m = mix(m, uMetal.rgb * 0.55 * (0.8 + 0.2 * ndl), scuff * 0.6);
      col = mix(col * (0.88 + 0.14 * ndl) * relief, m * filt, window);
      bare = m;
    } else {
      // lenticular: the frames under a ribbed clear lens
      col *= (0.92 + 0.1 * ndl) * relief;
      vec3 envL = studio(toWorld(reflect(-V, Nl)), 0.05);
      float Fl = 0.04 + 0.96 * pow(1.0 - clamp(dot(Nl, V), 0.0, 1.0), 5.0);
      float hi = smoothstep(0.62, 1.0, luma(envL));
      col = mix(col, envL, clamp(Fl * 1.2 + hi * 0.28, 0.0, 0.6));
      col += pow(max(dot(reflect(-V, Nl), KEY), 0.0), 60.0) * 0.35;
      // a faint prisma sheen on the ridges
      col += grating(Nl, dirL(vec2(1.0, 0.0)), 950.0, 0.3) * 0.08;
    }

    // The gloss film (vinil, and the laminate over foil and glitter).
    if (gloss > 0.0) {
      vec3 env = studio(Rw, glossRough);
      float hi = smoothstep(0.6, 1.0, luma(env));
      col = mix(col, env, clamp((F * 1.6 + hi * 0.3 * (1.0 - age * 0.6)) * gloss, 0.0, 0.7));
    }

    // Reliefs over the stock.
    float sl = length(slope);
    vec3 Rv = reflect(-V, N);
    if (uRel > 0.5 && uRel < 3.5) {
      // tinta, gofrado, hundido: the shoulders catch a sheen of the key
      col += pow(max(dot(Rv, KEY), 0.0), 12.0) * 0.16 * smoothstep(0.03, 0.3, sl);
      if (uRel < 1.5) {
        // raised ink shades the stock at its foot
        float foot = clamp(reliefField(vUv, 2.4) - reliefField(vUv, 0.7), 0.0, 1.0);
        col *= 1.0 - 0.24 * foot;
      }
    } else if (uRel > 3.5 && uRel < 4.5) {
      // barniz: spot varnish — the ink under it deeper and richer, a gloss
      // that catches the studio as it tilts; the matte stock a touch hazier;
      // the varnish yellows with the years
      float inkM = 1.0 - smoothstep(0.3, 0.62, l0);
      col = mix(col, pow(col, vec3(1.22)), inkM);
      col = mix(col, vec3(0.97, 0.965, 0.95), (1.0 - inkM) * 0.05);
      col = mix(col, col * vec3(1.0, 0.93, 0.7), inkM * age * 0.55);
      vec3 env = studio(Rw, 0.04 + age * 0.12);
      float hi = smoothstep(0.5, 1.0, luma(env));
      col = mix(col, env, clamp(F * 1.8 + hi * 0.55, 0.0, 0.8) * inkM);
      col += studio(Rw, 0.28) * 0.1 * inkM + pow(max(dot(Rv, KEY), 0.0), 40.0) * 0.35 * inkM;
    } else if (uRel > 4.5) {
      // domo: clear resin over everything — a big rolling highlight, the
      // rim darker where it refracts the most, a bright meniscus at the very
      // edge; it hazes with the years
      col *= 1.0 - 0.42 * smoothstep(0.12, 0.6, sl);
      col = mix(col, vec3(0.93, 0.92, 0.88), age * 0.2 * relH);
      vec3 env = studio(Rw, 0.03 + age * 0.2);
      float Fd = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
      float hi = smoothstep(0.55, 1.0, luma(env));
      col = mix(col, env, clamp(Fd * 1.4 + hi * 0.55, 0.0, 0.8) * (0.4 + 0.6 * relH));
      col += (pow(max(dot(Rv, KEY), 0.0), 90.0) * 0.6 + pow(max(dot(Rv, KEY), 0.0), 16.0) * 0.12) * relH * (1.0 - age * 0.5);
      float men = smoothstep(0.5, 0.85, sl) * (1.0 - smoothstep(0.85, 1.3, sl));
      col = mix(col, vec3(1.0), men * 0.35 * (0.4 + 0.6 * max(dot(N, RIM), 0.0)));
    }

    col *= mix(vec3(1.0), vec3(0.44, 0.39, 0.31), grime * 0.9);
    col = mix(col, vec3(0.96, 0.95, 0.92), scuff * (uMat < 0.5 ? 0.25 : 0.4));

    // Pleats: the valleys shade, the ridges catch a line of light; where the
    // material is bunched tight it shades itself.
    col *= (1.0 - 0.3 * valley) * (1.0 - 0.28 * smoothstep(0.75, 0.97, vWrap.x));
    col = mix(col, vec3(1.0), ridge * 0.22);
    // A fold over the case's edge: a faint stress line.
    col = mix(col, vec3(1.0), vWrap.z * 0.07);

    // A curled corner: the crest of the roll catches the light, the part
    // turning away darkens (past a quarter turn it's the backing we see).
    float crest = smoothstep(0.2, 0.8, vCurl) * (1.0 - smoothstep(0.9, 1.5, vCurl));
    col *= 1.0 - 0.24 * smoothstep(0.9, 1.5, vCurl);
    col = mix(col, vec3(1.0), crest * 0.2 * (0.4 + ndl));

    // Wear layers.
    col = mix(bare, col, inkLeft);
    col = mix(col, vec3(0.99, 0.985, 0.97), fibre * (uMat < 0.5 ? 0.8 : 0.3));
    // Scraped through: the case shows, under a haze of glue.
    col = mix(vec3(0.72, 0.7, 0.64), col, base);
    float outA = alpha * max(base, residue);

    // Press-in / placing: a hair brighter while it floats.
    col *= 1.0 + 0.04 * (1.0 - uPress);

    // Marks sit on top.
    col = mix(col, mcol, ma);
    outA = max(outA, ma);
    gl_FragColor = vec4(col * outA, outA);
  }
`

export const footprintFragment = /* glsl */ `
  ${COMMON}

  void main() {
    if (bayer4(gl_FragCoord.xy) >= uFade) discard;
    if (wrongHalf()) discard;
    // The hard shadow while it floats: the die-cut, offset down-right as
    // seen, in ink — it steps in with the press.
    float lifted = 1.0 - uPress;
    vec2 off = vec2(0.013, -0.013) / uSize * lifted;
    float sh = art(vUv - off).a * uArtOk * step(0.01, lifted);
    // Where a corner lifted: glue that caught the dirt, a dark line along
    // the old edge, and the flap's shadow right under the roll.
    float lift = max(peeled(uPeelA), peeled(uPeelB));
    float a0 = art(vUv).a * uArtOk;
    float rim = (1.0 - smoothstep(0.35, 0.95, artLod(vUv, 2.0))) * a0;
    float under = max(
      peeled(uPeelA) * (1.0 - smoothstep(0.0, 2.4 * uPeelA.w, dot(vLocal, uPeelA.xy) - uPeelA.z)),
      peeled(uPeelB) * (1.0 - smoothstep(0.0, 2.4 * uPeelB.w, dot(vLocal, uPeelB.xy) - uPeelB.z))
    );
    float residue = lift * a0 * (0.24 + 0.5 * rim + 0.4 * under) * (0.55 + 0.45 * uAge);
    if (sh < 0.01 && residue < 0.01) discard;
    vec3 grime = vec3(0.36, 0.33, 0.28);
    vec3 col = mix(grime, uInk, step(residue, sh));
    float a = max(sh * 0.9, residue);
    gl_FragColor = vec4(col * a, a);
  }
`
