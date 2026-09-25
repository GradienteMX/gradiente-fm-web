/**
 * INSIGNIAS — the page the pins are pressed into.
 *
 * There is no tray: the case is the page. Every earned pin sits pressed
 * into the paper, and every locked trophy is its die pressed blind — no
 * ink, no metal, the way a letterpress deboss is made. Nothing here paints
 * paper. The stage canvas sits behind the DOM and <html> paints the page,
 * so wherever this layer is transparent the page's own paper shows through:
 * the flat page and the pressed page are the same pixels by construction.
 *
 * What is baked is only what the relief *adds* to that paper, as coverage:
 * a warm dark where a slope turns away from the key, a warm white where it
 * turns toward it, occlusion in the crease, and a faint tooth that the
 * raking light finds on the slopes (never on flat paper). Every term is
 * exactly zero where the paper is flat, so each tile fades into the page
 * with no edge at all.
 *
 *   bed      an earned pin: the paper sinks around it and climbs back over
 *            a wide, soft shoulder — a cushion that holds the pin, not a pit
 *   blind    a locked trophy: the pin's outline pressed into the paper, a
 *            flat floor and soft walls
 *   shadow   the pin's footprint blurred twice (contact, ambient); the case
 *            offsets, spreads and fades them as the pin lifts
 *
 * Tiles are square, centred on the pin, in the pin's own units (so they
 * scale with it), baked once per resolution and kept for the session.
 */

import { Raster, hash, tracePoly, yieldFrame } from './art'
import { blur, edt, grow } from './field'
import { BLANK, FAMILIES, silhouettes, type Family, type Pt } from './shapes'

/** Half-size of a tile around a pin, in pin units (the pin is the unit square). */
export const TILE = 0.74

/**
 * The key — where the page and the pins are lit from: above the viewer, a
 * little left, about 50° over the page. Shadows fall down and to the right.
 */
export const KEY: readonly [number, number, number] = unit(-0.38, 0.51, 0.77)

/** How far an earned pin sinks into the page (units). */
export const BED_DEPTH = 0.036

const BED_GAP = 0 // the bed hugs the struck edge…
const BED_SHOULDER = 0.09 // …and the paper climbs back over a soft shoulder
const BED_ROUND = 0.03 // how much the bed rounds the die's notches
const CREASE = 0.012 // the fold where the paper meets the pin, rounded
const BLIND_DEPTH = 0.022 // a locked trophy: the die pressed blind…
const BLIND_WALL = 0.06 // …its walls softened by the paper's give
const OCCLUSION = 0.045 // radius over which a hollow darkens its own floor
const TOOTH = 0.09 // the paper's tooth, as slope, where the slope is full
const SLOPE_FULL = 0.5
const GAIN = { shade: 0.62, light: 3.2, occlusion: 0.6 }
const CONTACT_BLUR = 0.012
const AMBIENT_BLUR = 0.05

export interface PaperTiles {
  /** Relief tiles: res × res texels over ±TILE. */
  res: number
  /** Shadow tiles: shadowRes × shadowRes texels over ±TILE. */
  shadowRes: number
  /** Per family, RGBA rows bottom-up: bed shadow, bed light, blind shadow, blind light. */
  relief: Record<Family, Uint8Array>
  /** Per family, RGBA rows bottom-up: contact, ambient (the footprint, blurred), 0, 1. */
  shadow: Record<Family, Uint8Array>
}

function unit(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l]
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
function ss(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** The footprint: the die line grown by the bevel. */
const footCache = new Map<Family, Pt[]>()
function footprint(family: Family): Pt[] {
  let f = footCache.get(family)
  if (!f) {
    f = grow(silhouettes()[family].outline, BLANK.bevelS)
    footCache.set(family, f)
  }
  return f
}

/**
 * Shade a height field (units, 0 = the page, negative = pressed in) under
 * the key, relative to flat paper, into two coverage channels at `ch`.
 */
function shadeRelief(H: Float32Array, N: number, U: number, depth: number, tooth: Float32Array, out: Uint8Array, ch: number) {
  const hollow = blur(H, N, N, OCCLUSION * U, 3)
  const [lx, ly, lz] = KEY
  const k = U / 2 // central differences span two texels
  for (let y = 0; y < N; y++) {
    const up = (y > 0 ? y - 1 : y) * N
    const dn = (y < N - 1 ? y + 1 : y) * N
    for (let x = 0; x < N; x++) {
      const i = y * N + x
      const l = x > 0 ? i - 1 : i
      const r = x < N - 1 ? i + 1 : i
      // canvas rows run down; the page's y runs up
      let hx = (H[r] - H[l]) * k
      let hy = (H[up + x] - H[dn + x]) * k
      const slope = Math.min(1, Math.hypot(hx, hy) / SLOPE_FULL)
      if (slope > 0) {
        hx += (tooth[r] - tooth[l]) * TOOTH * slope
        hy += (tooth[up + x] - tooth[dn + x]) * TOOTH * slope
      }
      // n·key against flat paper's: < 0 turns away (shade), > 0 toward (light)
      const lit = (lz - hx * lx - hy * ly) / Math.hypot(hx, hy, 1) / lz - 1
      const occ = Math.max(0, hollow[i] - H[i]) / depth
      const o = ((N - 1 - y) * N + x) * 4 + ch
      out[o] = Math.round(clamp01(Math.max(0, -lit) * GAIN.shade + occ * GAIN.occlusion) * 255)
      out[o + 1] = Math.round(clamp01(Math.max(0, lit) * GAIN.light) * 255)
    }
  }
}

function bakeRelief(family: Family, N: number, raster: Raster, tooth: Float32Array): Uint8Array {
  const U = N / (2 * TILE)
  const c = N / 2
  const cov = raster.cover((ctx) => {
    tracePoly(ctx, silhouettes()[family].outline, U, c, c)
    ctx.fill()
  })
  const outside = new Float32Array(N * N)
  for (let i = 0; i < outside.length; i++) outside[i] = 1 - cov[i]
  const dIn = edt(cov, N, N)
  const dOut = edt(outside, N, N)
  // Signed distance to the footprint (units, > 0 inside); the lattice EDT
  // steps along diagonals, a light blur makes every contour run clean.
  const raw = new Float32Array(N * N)
  for (let i = 0; i < raw.length; i++) raw[i] = (cov[i] >= 0.5 ? dIn[i] - 0.5 : 0.5 - dOut[i]) / U + BLANK.bevelS
  const sd = blur(raw, N, N, 1, 2)
  // Paper doesn't follow a rayed rim or a bubble's tail into every notch: a
  // little away from the pin the bed rounds out (the field, blurred).
  const round = blur(sd, N, N, BED_ROUND * U, 3)

  const bed = new Float32Array(N * N)
  const blind = new Float32Array(N * N)
  for (let i = 0; i < sd.length; i++) {
    // bed: flat under the pin, then a soft wall back up to the page
    bed[i] = -BED_DEPTH * (1 - ss(0, 1, (-round[i] - BED_GAP) / BED_SHOULDER))
    // blind: the die's wall straddles the footprint's edge
    blind[i] = -BLIND_DEPTH * ss(-BLIND_WALL / 2, BLIND_WALL / 2, sd[i])
  }
  const out = new Uint8Array(N * N * 4)
  shadeRelief(blur(bed, N, N, CREASE * U, 2), N, U, BED_DEPTH, tooth, out, 0)
  shadeRelief(blind, N, U, BLIND_DEPTH, tooth, out, 2)
  return out
}

function bakeShadow(family: Family, N: number, raster: Raster): Uint8Array {
  const U = N / (2 * TILE)
  const c = N / 2
  const cov = raster.cover((ctx) => {
    tracePoly(ctx, footprint(family), U, c, c)
    ctx.fill()
  })
  const contact = blur(cov, N, N, CONTACT_BLUR * U, 2)
  const ambient = blur(cov, N, N, AMBIENT_BLUR * U, 3)
  const out = new Uint8Array(N * N * 4)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x
      const o = ((N - 1 - y) * N + x) * 4
      out[o] = Math.round(clamp01(contact[i]) * 255)
      out[o + 1] = Math.round(clamp01(ambient[i]) * 255)
      out[o + 3] = 255
    }
  }
  return out
}

const cache = new Map<number, Promise<PaperTiles>>()

/**
 * The page's relief and the pins' shadows for every family, at `res` texels
 * per tile (shadows at half: they are soft). Yields between families so a
 * bake never blocks a frame; one resolution is kept per session.
 */
export function pressPaper(res: number): Promise<PaperTiles> {
  const N = Math.max(64, Math.round(res / 8) * 8)
  let p = cache.get(N)
  if (!p) {
    p = (async () => {
      const Ns = Math.max(48, Math.round(N / 2 / 8) * 8)
      const raster = new Raster(N)
      const rasterS = new Raster(Ns)
      const grain = new Float32Array(N * N)
      for (let i = 0; i < grain.length; i++) grain[i] = hash(i % N, Math.floor(i / N), 173)
      const tooth = blur(grain, N, N, 1, 1)
      const relief = {} as Record<Family, Uint8Array>
      const shadow = {} as Record<Family, Uint8Array>
      for (const f of FAMILIES) {
        relief[f] = bakeRelief(f, N, raster, tooth)
        shadow[f] = bakeShadow(f, Ns, rasterS)
        await yieldFrame()
      }
      return { res: N, shadowRes: Ns, relief, shadow }
    })()
    for (const k of cache.keys()) if (k !== N) cache.delete(k)
    cache.set(N, p)
    p.catch(() => cache.delete(N))
  }
  return p
}
