/**
 * ESTUCHE — the collector's case the card lives in, faked without a
 * transmission pass (a scissored window of a shared renderer is no place
 * for one). One closed skin (see geometry.ts): flat glossy faces, fillets,
 * a sanded side; drawn front faces only, transparent, and every fragment
 * works out what it would show.
 *
 * On a face, the view ray is followed straight into the slab in the same
 * compressed (apparent-depth) space the card is drawn in, and meets, in
 * order:
 *   · the pocket's ceiling — inside it, the window: over the card, nothing
 *     (the card is drawn below; only the skin's gloss lies on it); beside
 *     the card, the gap: the page through the whole slab, or a pocket wall
 *     seen from the pocket (the frost behind it, dimmer)
 *   · a pocket wall from the acrylic — total internal reflection, a bright
 *     sliver that widens on the side you lean toward
 *   · the frosted band: the shells' inner faces are sandblasted between the
 *     pocket and a clear lip inside the outline — milky, brighter toward the
 *     key light, a broad sheen sliding across it, a fine grain up close; it
 *     sits at the parting plane, so it moves against the skin as the case
 *     turns. On the front shell's lower band, the laser-engraved label
 *     (folio, handle, role): letters polished clear, a lit wall.
 *   · the clear lip: the page through the slab (or the sanded side, from
 *     inside, where the ray runs out that way)
 * Hairlines keep it crisp at any size: the recess's rim, the frost's edge.
 * Over all of it the glossy skin: Schlick Fresnel over the studio (only its
 * bright parts register, so the card reads clean at rest and a softbox
 * slides across as it turns), with scratches (case-roughness) and smudges
 * (a haze of noise) that only show at an angle and grow with the member's
 * time in the signal (uScuff).
 *
 * The fillets are thick polished acrylic: strong studio reflections that
 * catch as it tilts, the milky lip squeezed inside, a dark cut at the
 * silhouette. The side is bead-blasted: diffuse, lit by the key, a fine
 * grain, the card's colour glowing faintly through it, and the parting seam
 * — a hairline groove with a lit lip — where the two shells meet.
 *
 * Cost: every region shares two studio reads (sharp and broad — on a face
 * the frost plane is parallel to the skin, so its sheen is the broad one);
 * the noise and the engraving are read only where they show.
 *
 * Normal blending over a transparent canvas: the page behind shows through
 * wherever the case doesn't paint it itself.
 */

import { BAYER, ENV, HASH } from './glsl'

export const caseVertex = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNrm;
  varying vec3 vWPos;
  varying vec3 vWN;
  void main() {
    vPos = position;
    vNrm = normal;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWPos = wp.xyz;
    vWN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

export const caseFragment = /* glsl */ `
  precision highp float;
  uniform sampler2D envMap;
  uniform sampler2D uRough;
  uniform sampler2D uLabel;
  uniform float uLabelOk;
  uniform vec4 uLabelRect;
  uniform vec3 uGround;
  uniform vec3 uCamObj;
  uniform vec3 uFaceW;
  uniform vec3 uHalf;
  uniform float uCorner;
  uniform float uFillet;
  uniform float uFrostInset;
  uniform vec4 uPocket;
  uniform vec3 uCardHalf;
  uniform vec3 uStock;
  uniform vec3 uCore;
  uniform float uDepthK;
  uniform float uScuff;
  uniform float uFade;
  uniform float uTilt;
  varying vec3 vPos;
  varying vec3 vNrm;
  varying vec3 vWPos;
  varying vec3 vWN;

  ${HASH}
  ${BAYER}
  ${ENV}

  const vec3 TINT = vec3(0.9, 0.955, 0.945); // one pass through the slab
  const vec3 FROST = vec3(0.975, 0.975, 0.968);
  const vec3 KEY = vec3(-0.451, 0.551, 0.702); // the key softbox, world space

  float sdRoundRect(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  // An antialiased line where d crosses zero, w pixels wide (px: one pixel in case units).
  float hairline(float d, float w, float px) {
    return 1.0 - smoothstep(0.5 * w * px, (0.5 * w + 1.0) * px, abs(d));
  }

  // Smudges: a few oily prints, not a fog (three octaves are plenty at their size).
  float smudge(vec2 p) {
    float n = 0.5 * vnoise(p) + 0.25 * vnoise(p * 2.03 + vec2(17.1, 3.7)) + 0.125 * vnoise(p * 4.1 + vec2(3.7, 9.2));
    return smoothstep(0.55, 0.75, n) * (0.3 + 0.7 * uScuff);
  }

  void main() {
    if (bayer4(gl_FragCoord.xy) >= uFade) discard;

    vec3 N = normalize(vWN);
    vec3 V = normalize(cameraPosition - vWPos);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    vec3 R = reflect(-V, N);
    // One screen pixel, in case units, on this surface (derivatives first:
    // they're undefined inside the branches below).
    float px = max(max(length(dFdx(vPos)), length(dFdy(vPos))), 1e-5);

    float s = vPos.z >= 0.0 ? 1.0 : -1.0;
    float zc = uHalf.z - uFillet;
    float sdFlat = sdRoundRect(vPos.xy, uHalf.xy - uFillet, uCorner - uFillet);
    bool isFace = sdFlat <= 0.0 && abs(vPos.z) > uHalf.z - 1e-4;
    bool isSide = !isFace && abs(vPos.z) < zc;

    // ── the skin: the studio in it (sharp and broad), its scratches ───────
    vec3 env = studio(R, 0.04);
    vec3 envSoft = studio(R, 0.5);
    float F = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
    // only the lights register (the softboxes, the strip), not the paper walls
    float hi = smoothstep(0.88, 1.0, luma(env));
    // Light the imperfections can scatter toward you: only where there is some.
    float scatter = smoothstep(0.45, 0.95, luma(envSoft));
    vec2 suv = vec2(vPos.x * s, vPos.y) * 0.95 + vec2(0.37, 0.11) * s;
    float scratch = smoothstep(0.62, 0.88, texture2D(uRough, suv).r) * uScuff;
    // «Only at an angle»: nothing while the case faces you square; they
    // come up as it leans (uTilt) and at truly grazing views (turning).
    float grazing = max(uTilt * (0.45 + 2.5 * (1.0 - ndv)), smoothstep(0.12, 0.45, 1.0 - ndv));
    float sAmt = scratch * grazing * (0.15 + 1.4 * scatter);
    float grainFade = 1.0 - smoothstep(0.55, 1.4, px * 380.0);

    // ── the inside, followed straight through the compressed slab ─────────
    vec3 rd = normalize(vPos - uCamObj);
    vec2 dir = rd.xy / max(0.02, -s * rd.z);
    float k = uDepthK;
    vec2 qf = vPos.xy + dir * (uHalf.z * k); // the parting plane: the frost
    // A pixel's footprint inside (it grows as the view steepens), for the
    // hairlines in there and the engraving's reads.
    vec2 qdx = dFdx(qf);
    vec2 qdy = dFdy(qf);
    float pxq = max(max(length(qdx), length(qdy)), 1e-5);
    vec2 luv = (qf - uLabelRect.xy) / (uLabelRect.zw - uLabelRect.xy);
    vec2 lgx = qdx / (uLabelRect.zw - uLabelRect.xy);
    vec2 lgy = qdy / (uLabelRect.zw - uLabelRect.xy);

    if (isFace) {
      vec2 q1 = vPos.xy + dir * ((uHalf.z - uPocket.z) * k); // pocket ceiling
      vec2 q2 = vPos.xy + dir * ((uHalf.z - uCardHalf.z) * k); // the card's face
      vec2 q3 = vPos.xy + dir * ((uHalf.z + uPocket.z) * k); // pocket floor
      vec2 qb = vPos.xy + dir * (2.0 * uHalf.z * k); // the far face
      float sP1 = sdRoundRect(q1, uPocket.xy, uPocket.w);
      float sPf = sdRoundRect(qf, uPocket.xy, uPocket.w);
      float sP3 = sdRoundRect(q3, uPocket.xy, uPocket.w);
      float sFo = sdRoundRect(qf, uHalf.xy - uFrostInset, uCorner - uFrostInset);
      float sOut = sdRoundRect(qb, uHalf.xy - 0.5 * uFillet, uCorner - 0.5 * uFillet);
      bool overCard = abs(q2.x) < uCardHalf.x && abs(q2.y) < uCardHalf.y;

      // The frost: milky, lit by the key (a little more toward it), the broad
      // sheen of sandblasting sliding across it as it turns, a fine grain up
      // close (it fades before it could shimmer).
      float grain = (hash12(floor(qf * 380.0)) - 0.5) * (1.0 - smoothstep(0.55, 1.4, pxq * 380.0));
      float mott = vnoise(qf * 9.0 + 3.1) - 0.5;
      float toward = dot(qf / uHalf.xy, vec2(-0.55 * s, 0.45));
      float fLit = 0.83 + 0.1 * max(dot(uFaceW * s, KEY), 0.0) + 0.12 * scatter + 0.035 * toward;
      vec3 frost = FROST * fLit * (1.0 + 0.07 * grain + 0.04 * mott);
      frost = mix(frost, uGround * TINT, 0.16);

      vec3 inner = vec3(0.0);
      float innerA = 0.0;
      if (sP1 < 0.0) {
        if (overCard) {
          // the window: the card is drawn below, the skin lies on it
          innerA = 0.0;
        } else if (sP3 > 0.0) {
          // a pocket wall from the pocket: the frost behind it, through it
          inner = frost * 0.8;
          innerA = 0.78;
        } else {
          // the gap: past the card's edge, the page through the whole slab
          inner = uGround * TINT * TINT * 0.9;
          innerA = 0.24;
        }
      } else if (sPf < 0.0) {
        // a pocket wall from the acrylic: looked at shallow, total internal
        // reflection — a bright sliver; steep, it lets you through into the
        // pocket (the card's cut edge, drawn below)
        float tir = 1.0 - smoothstep(0.8, 1.4, length(dir));
        inner = mix(uGround * TINT * TINT * 0.9, min(frost * 1.07 + 0.04, vec3(1.0)), tir);
        innerA = mix(0.2, 0.95, tir);
      } else if (sFo < 0.0) {
        inner = frost;
        innerA = 0.86;
        if (uLabelOk > 0.5 && s > 0.0 && luv.x > 0.0 && luv.x < 1.0 && luv.y > 0.0 && luv.y < 1.0) {
          // The engraving: letters polished clear, the wall facing the light
          // lit, the one away from it in shade.
          vec2 lt = vec2(1.0 / 1024.0, 1.0 / 32.0);
          float lab = textureGrad(uLabel, luv, lgx, lgy).r;
          float lit = clamp(lab - textureGrad(uLabel, luv + vec2(lt.x, -lt.y), lgx, lgy).r, 0.0, 1.0);
          float shade = clamp(lab - textureGrad(uLabel, luv + vec2(-lt.x, lt.y), lgx, lgy).r, 0.0, 1.0);
          float e = smoothstep(0.3, 0.7, lab);
          inner = mix(inner, uGround * TINT * 0.86, e * 0.8);
          inner = mix(inner, vec3(1.0), lit * 0.6);
          inner *= 1.0 - 0.3 * shade;
          innerA = mix(innerA, 0.55, e);
        }
      } else if (sOut > 0.0) {
        // the clear lip, running out through the sanded side: milky
        inner = mix(frost, uGround * TINT, 0.3);
        innerA = 0.62;
      } else {
        // the clear lip: the page through the whole slab
        inner = uGround * TINT * TINT * 0.95;
        innerA = 0.16;
      }
      // Hairlines that hold at any size: the recess's rim; the frost's
      // outer edge; where the frost meets the pocket wall.
      float rim = hairline(sP1, 1.0, pxq);
      inner = mix(inner, uGround * 0.55, rim * 0.6);
      innerA = max(innerA, rim * 0.5);
      float fEdge = hairline(sFo, 0.8, pxq) * step(0.0, sPf);
      inner = mix(inner, vec3(1.0), fEdge * 0.4);
      float wEdge = hairline(sPf, 0.8, pxq) * step(0.0, sP1);
      inner = mix(inner, inner * 0.8, wEdge);

      // The skin over the inside: its gloss (the studio's bright parts) and
      // the scatter of its scratches and smudges, which only ever brightens.
      float mAmt = smudge(vPos.xy * vec2(2.6, 2.9) + s * 5.3) * grazing * 0.1 * scatter;
      float reflA = F * (0.35 + 5.5 * hi);
      float glowA = sAmt * 0.5 + mAmt;
      float a = reflA + glowA;
      vec3 spec = (env * reflA + vec3(0.99, 0.98, 0.95) * glowA) / max(a, 1e-4);
      a = clamp(a, 0.0, 0.9);
      float A = innerA + a * (1.0 - innerA);
      vec3 C = (spec * a + inner * innerA * (1.0 - a)) / max(A, 1e-4);
      gl_FragColor = vec4(C, A);
      return;
    }

    if (isSide) {
      // ── the side: bead-blasted, diffuse and milky ──────────────────────
      float lamb = max(dot(N, KEY), 0.0);
      vec3 c = FROST * (0.8 + 0.22 * lamb + 0.05 * N.y);
      c = mix(c, uGround * TINT, 0.1);
      // a broad sheen as it turns edge-on to you
      float Fs = 0.04 + 0.6 * pow(1.0 - ndv, 5.0);
      c = mix(c, envSoft, Fs * 0.5);
      float g2 = hash12(floor(vec2(vPos.x + vPos.y * 1.37, vPos.z) * 380.0)) - 0.5;
      c *= 1.0 + 0.07 * g2 * grainFade;
      // the card inside: its colour, diffused through the sanded wall
      float glow = exp(-pow(vPos.z / (zc * 0.75), 2.0));
      c = mix(c, mix(uStock, uCore, 0.25) * 0.96, glow * 0.16);
      // the parting seam: a hairline groove, a lit lip just above it
      float seam = hairline(vPos.z, 1.0, px);
      float lip = hairline(vPos.z - 1.6 * px, 0.8, px);
      c *= 1.0 - 0.45 * seam;
      c += 0.1 * lip * (0.5 + lamb);
      gl_FragColor = vec4(c, 0.94);
      return;
    }

    // ── a fillet: thick polished acrylic, rounded ────────────────────────
    float Fb = 0.06 + 0.94 * pow(1.0 - ndv, 4.0);
    float catchL = smoothstep(0.55, 1.0, luma(env));
    // through it, squeezed: the milky lip and the sanded side from inside
    vec3 through = mix(uGround * TINT * 0.86, FROST * 0.95, 0.42);
    float kk = clamp(0.16 + Fb * 1.1 + catchL * 0.6, 0.0, 0.94);
    vec3 c = mix(through, env * 1.06, kk);
    // the cut: a dark line at the silhouette
    float sd = sdRoundRect(vPos.xy, uHalf.xy, uCorner);
    float cut = smoothstep(-2.5 * px, -0.4 * px, sd);
    c = mix(c, c * 0.55, cut);
    float mAmt = smudge(vPos.xy * vec2(2.6, 2.9) + s * 5.3) * grazing * 0.1 * scatter;
    c = mix(c, vec3(1.0), sAmt * 0.8 + mAmt);
    gl_FragColor = vec4(c, 0.92);
  }
`
