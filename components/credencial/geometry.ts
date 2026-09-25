/**
 * The object's dimensions, in card heights (the printed card is
 * CARD_ASPECT × 1, ID-1 proportions).
 *
 * A collector's case, one-touch style: two thick clear shells that meet at
 * a parting plane (z = 0). Between them a recessed pocket a hair larger
 * than the card holds it; around the pocket the shells' inner faces are
 * sandblasted (the frosted band), so the window over the card reads clear.
 * Outside, flat glossy faces, generously rounded corners and a machined
 * edge — a fillet into a sanded side with the fine parting seam round it.
 *
 *   front face  ───────────────╮          z = +CASE_HZ
 *                               │ fillet  (radius CASE_FILLET)
 *   sanded side ········ seam ··│         z = 0
 *                               │ fillet
 *   back face   ───────────────╯          z = −CASE_HZ
 */

import { CARD_ASPECT } from './cardPrint'

export const CARD_W = CARD_ASPECT
export const CARD_H = 1
/** Card stock: the printed card inside (a triplex board), not a slab. */
export const CARD_DEPTH = 0.02

/** The pocket: the card's well, clear of it all round by POCKET_GAP. */
export const POCKET_GAP = 0.008
export const POCKET_HX = CARD_W / 2 + POCKET_GAP
export const POCKET_HY = CARD_H / 2 + POCKET_GAP
export const POCKET_HZ = CARD_DEPTH / 2 + 0.0025
export const POCKET_R = 0.014

export const CASE_MARGIN = 0.092
export const CASE_HX = CARD_W / 2 + CASE_MARGIN
export const CASE_HY = CARD_H / 2 + CASE_MARGIN
export const CASE_DEPTH = 0.1
export const CASE_HZ = CASE_DEPTH / 2
/** Corner radius of the outline at its widest point (generous, like a one-touch). */
export const CASE_R = 0.075
/** The rounded edge between a face and the sanded side. */
export const CASE_FILLET = 0.02
/** Where the frosted band stops short of the outline (a clear lip runs round it). */
export const FROST_INSET = CASE_FILLET + 0.013

/** Share of the slot's width the printed card occupies (the case adds its margin). */
export const CARD_FRAC = 0.8

/**
 * The GL window reaches past the slot by these fractions of the slot's
 * size on each side, so a case turned by hand is never clipped: edge-on
 * and pitched, its long side swings toward the camera and the near end
 * rises well past the slot (yaw 90°, pitch 30° needs ≈ 0.42 each way).
 * At rest the object sits inside the slot.
 */
export const GL_BLEED_X = 0.1
export const GL_BLEED_Y = 0.5
/**
 * The framing the case is designed at: the camera stands where a window of
 * this bleed would put it (lens FOV in cardGL), so its size and perspective
 * don't depend on how much room the window leaves — the extra room only
 * widens the view.
 */
export const LOOK_BLEED_X = 0.05
export const LOOK_BLEED_Y = 0.12

/**
 * THE OUTER SKIN — the contract stickers wrap on (stickerGL / stickerShader).
 *
 * The case's outer surface is a flat front face, an edge that turns round
 * the outline, and a flat back face. EDGE_PATH is that edge as a
 * cross-section, walked from where the front face's flat ends, round the
 * side, to where the back face's flat begins:
 *   inset — how far inside the outline, in the face plane (0 on the outline
 *           = the case's widest point; positive inward)
 *   z     — depth (front flat = +CASE_HZ, back flat = −CASE_HZ)
 * The outline is a rounded rectangle, half-size CASE_HX × CASE_HY, corner
 * radius CASE_R at the widest point; the section at a given inset is the
 * outline offset inward by it (half-size − inset, radius CASE_R − inset).
 * A point of a sticker on the front at signed distance d from the outline
 * (positive outside) has travelled t = d + EDGE_PATH[0].inset along the
 * path; past the path's end it lies flat on the back, moving inward.
 * Whoever changes the case's outer shape keeps EDGE_PATH true to it (as
 * many points as the profile needs) — the mesh in cardGL is swept from it.
 *
 * Now: a quarter-round fillet (CASE_FILLET) off the front face, the
 * straight sanded side (the parting seam at z = 0), a fillet onto the back.
 */
export interface EdgePoint {
  inset: number
  z: number
}

const FILLET_SEGS = 8

function edgeProfile(): EdgePoint[] {
  const rf = CASE_FILLET
  const zc = CASE_HZ - rf
  const out: EdgePoint[] = []
  // front fillet: from the face (pointing +z) round to the side (pointing out)
  for (let i = 0; i <= FILLET_SEGS; i++) {
    const a = (i / FILLET_SEGS) * (Math.PI / 2)
    out.push({ inset: rf - rf * Math.sin(a), z: zc + rf * Math.cos(a) })
  }
  // the side runs straight down to the back fillet, which mirrors the front
  for (let i = FILLET_SEGS; i >= 0; i--) {
    const a = (i / FILLET_SEGS) * (Math.PI / 2)
    out.push({ inset: rf - rf * Math.sin(a), z: -(zc + rf * Math.cos(a)) })
  }
  return out
}

export const EDGE_PATH: readonly EdgePoint[] = edgeProfile()

/** Total arc length of EDGE_PATH. */
export function edgeLength(path: readonly EdgePoint[] = EDGE_PATH): number {
  let len = 0
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].inset - path[i - 1].inset, path[i].z - path[i - 1].z)
  return len
}

/** The point at arc length t along EDGE_PATH (clamped to its ends). */
export function edgeAt(t: number, path: readonly EdgePoint[] = EDGE_PATH): EdgePoint {
  if (t <= 0) return path[0]
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const seg = Math.hypot(b.inset - a.inset, b.z - a.z)
    if (t <= seg) {
      const k = seg > 0 ? t / seg : 0
      return { inset: a.inset + (b.inset - a.inset) * k, z: a.z + (b.z - a.z) * k }
    }
    t -= seg
  }
  return path[path.length - 1]
}

/** Signed distance from (x, y) to the outline offset inward by `inset` (negative inside). */
export function outlineDistance(x: number, y: number, inset = 0): number {
  const r = Math.max(0, CASE_R - inset)
  const qx = Math.abs(x) - (CASE_HX - inset) + r
  const qy = Math.abs(y) - (CASE_HY - inset) + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

/** The nearest point to (x, y) inside the outline offset inward by `inset` (units, centred). */
export function clampToOutline(x: number, y: number, inset = 0): [number, number] {
  const r = Math.max(0, CASE_R - inset)
  const hx = CASE_HX - inset
  const hy = CASE_HY - inset
  let cx = Math.max(-hx, Math.min(hx, x))
  let cy = Math.max(-hy, Math.min(hy, y))
  // in a corner square: pull onto the arc
  const ox = Math.abs(cx) - (hx - r)
  const oy = Math.abs(cy) - (hy - r)
  if (ox > 0 && oy > 0) {
    const d = Math.hypot(ox, oy)
    if (d > r) {
      cx = Math.sign(cx) * (hx - r + (ox / d) * r)
      cy = Math.sign(cy) * (hy - r + (oy / d) * r)
    }
  }
  return [cx, cy]
}
