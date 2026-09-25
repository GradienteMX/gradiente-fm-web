/**
 * The case's outer skin, for stickers — the contract in geometry.ts
 * (EDGE_PATH + the rounded-rect outline) made usable:
 *
 *   · `buildSkin()` resamples EDGE_PATH by arc length for the vertex shader
 *     (stickerShader.ts): inset, depth, the tangent's angle and how sharply
 *     it turns there (a crease), a little past each end so the fold off the
 *     flat face is smoothed like a real bend.
 *   · `reachesEdge()` — does a sticker hang past its face's flat? (only
 *     those need the dense grid and both halves drawn).
 *   · `unwrapFar()` — the inverse of the wrap on the other face's flat, so a
 *     click there picks the sticker that came round the edge.
 *
 * The wrap itself (the shader does it per vertex): a point of the sticker at
 * signed distance d from the outline (positive outside) has travelled
 * t = d + inset₀ along the edge; t ≤ 0 lies on its face, 0 < t < L follows
 * the profile from the nearest point of the outline, t ≥ L lies flat on the
 * other face, moving inward. Round the rounded corners it wraps radially:
 * the material compresses (the shader pleats it), and past the corner's
 * centre it can't go — the radius eases toward zero instead of crossing.
 */

import * as THREE from 'three'
import type { CardFace } from '@/lib/stickers/types'
import { CASE_HX, CASE_HY, CASE_R, EDGE_PATH, edgeAt, edgeLength, outlineDistance, type EdgePoint } from './geometry'

/** Samples of the profile (keep in step with `PATH_N` in stickerShader.ts). */
export const PATH_N = 48
/** How far past each end of the edge the profile is sampled: the fold off a flat face bends over this. */
const OVERRUN = 0.004

export interface Skin {
  /** (inset, z, tangent angle in the (outward, z) plane, crease 0..1) at t = −E + i·step, front → back. */
  path: THREE.Vector4[]
  /** (L, step, E, corner floor): the edge's length, the sample step, the overrun, the smallest radius a corner wraps to. */
  info: THREE.Vector4
  /** Inset where the front flat ends, and where the back flat begins. */
  ends: THREE.Vector2
}

function extended(path: readonly EdgePoint[], t: number, L: number): EdgePoint {
  if (t < 0) return { inset: path[0].inset - t, z: path[0].z }
  if (t > L) {
    const e = path[path.length - 1]
    return { inset: e.inset + (t - L), z: e.z }
  }
  return edgeAt(t, path)
}

export function buildSkin(path: readonly EdgePoint[] = EDGE_PATH): Skin {
  const L = Math.max(1e-4, edgeLength(path))
  const E = OVERRUN
  const step = (L + 2 * E) / (PATH_N - 1)
  const pts: EdgePoint[] = []
  const ang: number[] = []
  let prev = 0
  for (let i = 0; i < PATH_N; i++) {
    const t = -E + i * step
    pts.push(extended(path, t, L))
    // central difference over a step: a sharp corner of the profile turns over two samples
    const a = extended(path, t - step, L)
    const b = extended(path, t + step, L)
    let phi = Math.atan2(b.z - a.z, -(b.inset - a.inset))
    if (i > 0) {
      while (phi - prev > Math.PI) phi -= Math.PI * 2
      while (phi - prev < -Math.PI) phi += Math.PI * 2
    }
    ang.push(phi)
    prev = phi
  }
  const out = pts.map((p, i) => {
    const turn = Math.abs(ang[Math.min(PATH_N - 1, i + 1)] - ang[Math.max(0, i - 1)])
    return new THREE.Vector4(p.inset, p.z, ang[i], Math.min(1, turn / 0.6))
  })
  let maxInset = 0
  for (const p of path) maxInset = Math.max(maxInset, p.inset)
  const floor = Math.min(CASE_R * 0.5, Math.max(0.002, 0.6 * (CASE_R - maxInset)))
  return {
    path: out,
    info: new THREE.Vector4(L, step, E, floor),
    ends: new THREE.Vector2(path[0].inset, path[path.length - 1].inset),
  }
}

interface Outline {
  /** Signed distance to the outline (positive outside). */
  d: number
  /** Outward normal. */
  nx: number
  ny: number
  corner: boolean
  /** Corner centre and the distance from it (corners only). */
  cx: number
  cy: number
  rho: number
}

/** The case outline seen from a point of a face (face-view units; symmetric, so either face). */
function outline(x: number, y: number): Outline {
  const hx = CASE_HX - CASE_R
  const hy = CASE_HY - CASE_R
  const sx = x < 0 ? -1 : 1
  const sy = y < 0 ? -1 : 1
  const qx = Math.abs(x) - hx
  const qy = Math.abs(y) - hy
  if (qx > 0 && qy > 0) {
    const rho = Math.max(1e-6, Math.hypot(qx, qy))
    return { d: rho - CASE_R, nx: (sx * qx) / rho, ny: (sy * qy) / rho, corner: true, cx: sx * hx, cy: sy * hy, rho }
  }
  if (qx > qy) return { d: qx - CASE_R, nx: sx, ny: 0, corner: false, cx: 0, cy: 0, rho: 0 }
  return { d: qy - CASE_R, nx: 0, ny: sy, corner: false, cx: 0, cy: 0, rho: 0 }
}

/** Where this face's flat ends / where the other face's flat begins (insets). */
function insets(skin: Skin, face: CardFace): [number, number] {
  return face === 'frente' ? [skin.ends.x, skin.ends.y] : [skin.ends.y, skin.ends.x]
}

/**
 * Does a sticker hang past its face's flat? `w`, `h`: its full extent
 * (grid margin included), centre and clockwise rotation in face-view units.
 * The signed distance is convex, so the rectangle's corners decide.
 */
export function reachesEdge(cx: number, cy: number, w: number, h: number, rot: number, face: CardFace, skin: Skin): boolean {
  const [ins0] = insets(skin, face)
  const lim = -(ins0 + skin.info.z) - 0.004
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  for (let k = 0; k < 4; k++) {
    const lx = (k & 1 ? 0.5 : -0.5) * w
    const ly = (k & 2 ? 0.5 : -0.5) * h
    const x = lx * c + ly * s + cx
    const y = -lx * s + ly * c + cy
    if (outlineDistance(x, y) > lim) return true
  }
  return false
}

/** Is a point of a sticker (its face-view units) still on its own face's flat, `margin` clear of the fold? */
export function onFlat(x: number, y: number, face: CardFace, skin: Skin, margin = 0): boolean {
  const [ins0] = insets(skin, face)
  return outlineDistance(x, y) < -(ins0 + skin.info.z + margin)
}

// ── adaptive grids ───────────────────────────────────────────────────────────

/** Grid spacing (case units): where the sticker bends round the edge, where a corner curls, elsewhere. */
const FINE = 0.005
const MEDIUM = 0.012
const COARSE = 0.036
const BINS = 48
const MAX_LINES = 150

export interface GridSpec {
  /** Centre, extent (grid margin included), clockwise rotation: face-view units. */
  cx: number
  cy: number
  w: number
  h: number
  rot: number
  face: CardFace
  /** Peel lines (x, y: direction to the lifting corner, z: distance of the line, w: curl radius). */
  peels: readonly (readonly [number, number, number, number])[]
}

function dilate(a: Float32Array) {
  const b = Float32Array.from(a)
  for (let i = 0; i < a.length; i++) a[i] = Math.max(b[i], b[Math.max(0, i - 1)], b[Math.min(a.length - 1, i + 1)])
}

/** Grid lines across [−0.5, 0.5] for an axis `len` long, as dense as `need` (0 coarse … 1 fine) asks. */
function walk(need: Float32Array, len: number): number[] {
  const spacing = (k: number) => COARSE * Math.pow(FINE / COARSE, Math.min(1, k))
  let scale = 1
  for (;;) {
    const out = [-0.5]
    let p = -0.5
    while (p < 0.5 && out.length <= MAX_LINES) {
      const b = Math.min(BINS - 1, Math.max(0, Math.floor((p + 0.5) * BINS)))
      p += (spacing(need[b]) * scale) / Math.max(1e-4, len)
      out.push(Math.min(p, 0.5))
    }
    if (out.length <= MAX_LINES) return out
    scale *= 1.3
  }
}

/**
 * The grid a sticker needs where it sits: fine only where the wrap bends it
 * (and only along the axis that crosses the fold), medium over a curling
 * corner, coarse on the flat. Sampled on the CPU from the same outline the
 * shader wraps round.
 */
export function gridLines(g: GridSpec, skin: Skin): { xs: number[]; ys: number[] } {
  const needU = new Float32Array(BINS)
  const needV = new Float32Array(BINS)
  const [ins0] = insets(skin, g.face)
  const L = skin.info.x
  const E = skin.info.z
  const pad = 0.012
  const c = Math.cos(g.rot)
  const s = Math.sin(g.rot)
  const S = 40
  for (let j = 0; j <= S; j++) {
    for (let i = 0; i <= S; i++) {
      const pu = i / S - 0.5
      const pv = j / S - 0.5
      const lx = pu * g.w
      const ly = pv * g.h
      const o = outline(lx * c + ly * s + g.cx, -lx * s + ly * c + g.cy)
      const t = o.d + ins0
      let nu = 0
      let nv = 0
      if (t > -E - pad) {
        if (o.corner) {
          nu = 1
          nv = 1
        } else if (t < L + E + pad) {
          // the local axes in the face: x → (c, −s), y → (s, c)
          nu = Math.abs(o.nx * c - o.ny * s)
          nv = Math.abs(o.nx * s + o.ny * c)
        }
      }
      for (const pk of g.peels) {
        if (pk[3] <= 0 || lx * pk[0] + ly * pk[1] <= pk[2] - 0.01) continue
        const k = Math.log(COARSE / MEDIUM) / Math.log(COARSE / FINE)
        nu = Math.max(nu, k * (0.35 + 0.65 * Math.abs(pk[0])))
        nv = Math.max(nv, k * (0.35 + 0.65 * Math.abs(pk[1])))
      }
      const bu = Math.min(BINS - 1, Math.floor((pu + 0.5) * BINS))
      const bv = Math.min(BINS - 1, Math.floor((pv + 0.5) * BINS))
      needU[bu] = Math.max(needU[bu], nu)
      needV[bv] = Math.max(needV[bv], nv)
    }
  }
  dilate(needU)
  dilate(needU)
  dilate(needV)
  dilate(needV)
  return { xs: walk(needU, g.w), ys: walk(needV, g.h) }
}

/** A tensor grid over [−0.5, 0.5]² with these lines (counter-clockwise from +z, like PlaneGeometry). */
export function gridGeometry(xs: readonly number[], ys: readonly number[]): THREE.BufferGeometry {
  const nu = xs.length
  const nv = ys.length
  const pos = new Float32Array(nu * nv * 3)
  let k = 0
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      pos[k++] = xs[i]
      pos[k++] = ys[j]
      pos[k++] = 0
    }
  }
  const count = (nu - 1) * (nv - 1) * 6
  const idx = nu * nv > 65535 ? new Uint32Array(count) : new Uint16Array(count)
  let m = 0
  for (let j = 0; j < nv - 1; j++) {
    for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i
      idx[m++] = a
      idx[m++] = a + 1
      idx[m++] = a + nu + 1
      idx[m++] = a
      idx[m++] = a + nu + 1
      idx[m++] = a + nu
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setIndex(new THREE.BufferAttribute(idx, 1))
  return geo
}

/**
 * A point on the flat of one face (face-view units of THAT face) that a
 * sticker from the other face covers after wrapping: where it sits on the
 * sticker's own (unwrapped) plane, in its face-view units. Null on the edge
 * band, or where a corner's material has gathered to nothing.
 */
export function unwrapFar(px: number, py: number, stickerFace: CardFace, skin: Skin): [number, number] | null {
  // The two faces see each other mirrored in x.
  const x = -px
  const y = py
  const o = outline(x, y)
  const sIn = -o.d
  const [ins0, insE] = insets(skin, stickerFace)
  const L = skin.info.x
  if (sIn < insE + skin.info.z) return null
  if (o.corner) {
    const m = skin.info.w
    let r = o.rho
    if (r < m) {
      if (r < m * 0.02) return null
      r = m + m * Math.log(r / m)
    }
    const s = CASE_R - r
    const t = L + (s - insE)
    const rho = CASE_R + (t - ins0)
    return [o.cx + o.nx * rho, o.cy + o.ny * rho]
  }
  const t = L + (sIn - insE)
  const k = sIn + (t - ins0)
  return [x + o.nx * k, y + o.ny * k]
}
