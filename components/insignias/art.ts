/**
 * INSIGNIAS — striking the die, on canvas.
 *
 * Every pin face is built the way a die-struck enamel pin is: a height map
 * (raised polished metal lines at 1, recessed enamel below), turned into a
 * tangent-space normal map; masks say where metal and enamel are (metalness,
 * roughness); a base-colour map carries the plating's specular tint and the
 * enamels; a second, smooth normal map is the epoxy dome poured over the
 * face (the clearcoat). The backs are struck the same way: a satin,
 * sandblasted plate with a polished rim and the engraving — the month the
 * pin was earned and its story.
 *
 * Everything lands in atlases (one cell per trophy, catalog order) so the
 * whole case samples four face textures and two back textures. Faces are
 * the same for everyone and are cached per resolution; backs carry the
 * member's months and are struck per case.
 */

import { TROPHY_SIGIL } from '@/components/credencial/sigils'
import type { TrophyKey } from '@/lib/trophies'
import { FAMILY_BAND, FAMILY_METAL, METAL, fillOf } from './catalog'
import { blur, edt } from './field'
import { silhouettes, type Family, type Pt, type Silhouette } from './shapes'

export interface PinArtSpec {
  key: TrophyKey
  family: Family
  /** Trophy colour (the field enamel), sRGB hex. */
  color: string
}

export interface BackArtSpec extends PinArtSpec {
  /** «SEP 2026» — or null for a slot with no pin (nothing is struck). */
  month: string | null
  story: string
}

export interface Atlas {
  /** Cell size in px (square). */
  cell: number
  /** Px per silhouette unit inside a cell. */
  unit: number
  cols: number
  rows: number
  width: number
  height: number
}

export interface FaceMaps {
  atlas: Atlas
  color: HTMLCanvasElement
  normal: HTMLCanvasElement
  orm: HTMLCanvasElement
  /** Half resolution: the dome is smooth. */
  coat: HTMLCanvasElement
}

export interface BackMaps {
  atlas: Atlas
  normal: HTMLCanvasElement
  orm: HTMLCanvasElement
}

// ── zone layout of a face (units, measured inward from the field's edge) ───

const BORDER = 0.05 // raised metal border
const BAND = 0.125 // band enamel ends here
const LINE = 0.02 // raised inner line width
const ENAMEL = 0.3 // enamel level in the height map (metal = 1)
const RELIEF = 0.018 // relief depth, in units (≈ 0.5 mm on a 30 mm pin)
const DOME = 0.032 // epoxy dome rise, in units (≈ 1 mm on a 30 mm pin)
const MENISCUS = 0.18 // the steep climb at the die-cut edge…
const LENS = 0.42 // …and the broad curve over the whole face

/** UV transform of cell i: geometry UVs (0…1 over the unit square) → atlas. */
export function cellTransform(a: Atlas, i: number): { offset: [number, number]; repeat: [number, number] } {
  const col = i % a.cols
  const row = Math.floor(i / a.cols)
  const x0 = col * a.cell + (a.cell - a.unit) / 2
  const yBottom = row * a.cell + (a.cell + a.unit) / 2
  return { offset: [x0 / a.width, 1 - yBottom / a.height], repeat: [a.unit / a.width, a.unit / a.height] }
}

export function makeAtlas(count: number, cell: number): Atlas {
  const cols = Math.min(5, count)
  const rows = Math.ceil(count / cols)
  const c = Math.round(cell / 4) * 4
  return { cell: c, unit: Math.round(c * 0.9), cols, rows, width: cols * c, height: rows * c }
}

// ── small math ──────────────────────────────────────────────────────────────

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
function ss(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

function hex(c: string): [number, number, number] {
  const h = c.replace('#', '')
  const v =
    h.length === 3
      ? h
          .split('')
          .map((x) => x + x)
          .join('')
      : h
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

function mix3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** Deterministic 2D hash → [0, 1). */
export function hash(x: number, y: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function seedOf(key: string): number {
  let s = 7
  for (let i = 0; i < key.length; i++) s = (Math.imul(s, 31) + key.charCodeAt(i)) | 0
  return s
}

// ── rasterising ─────────────────────────────────────────────────────────────

export class Raster {
  readonly size: number
  private ctx: CanvasRenderingContext2D
  constructor(size: number) {
    this.size = size
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('2d context unavailable')
    this.ctx = ctx
  }

  /** Paint with white; returns coverage 0…1 per pixel. */
  cover(draw: (ctx: CanvasRenderingContext2D) => void, out = new Float32Array(this.size * this.size)): Float32Array {
    const { ctx, size } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = '#fff'
    ctx.save()
    draw(ctx)
    ctx.restore()
    const d = ctx.getImageData(0, 0, size, size).data
    for (let i = 0, j = 3; i < out.length; i++, j += 4) out[i] = d[j] / 255
    return out
  }
}

export function tracePoly(ctx: CanvasRenderingContext2D, p: readonly Pt[], U: number, cx: number, cy: number, mirror = false) {
  ctx.beginPath()
  for (let i = 0; i < p.length; i++) {
    const X = cx + (mirror ? -p[i][0] : p[i][0]) * U
    const Y = cy - p[i][1] * U
    if (i) ctx.lineTo(X, Y)
    else ctx.moveTo(X, Y)
  }
  ctx.closePath()
}

const pathCache = new Map<string, Path2D>()
function p2d(d: string): Path2D {
  let p = pathCache.get(d)
  if (!p) {
    p = new Path2D(d)
    pathCache.set(d, p)
  }
  return p
}

/** The trophy's sigil (the kit's 20-grid geometry), stroked as a raised line. */
function drawSigil(ctx: CanvasRenderingContext2D, key: TrophyKey, sil: Silhouette, U: number, cx: number, cy: number, lw: number) {
  const parts = TROPHY_SIGIL[key] ?? TROPHY_SIGIL.presence_logged
  const box = sil.sigil * U
  ctx.translate(cx + sil.center[0] * U - box / 2, cy - sil.center[1] * U - box / 2)
  ctx.scale(box / 20, box / 20)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = lw
  for (const part of parts) {
    const path = p2d(part.d)
    if (part.fill) ctx.fill(path)
    else ctx.stroke(path)
  }
}

// ── filters ──────────────────────────────────────────────────────────────────

/** Height (0…1) → tangent-space normal, written as RGBA bytes at `o`. */
function normalAt(h: Float32Array, w: number, x: number, y: number, k: number): [number, number, number] {
  const xl = x > 0 ? x - 1 : x
  const xr = x < w - 1 ? x + 1 : x
  const yu = y > 0 ? y - 1 : y
  const yd = y < w - 1 ? y + 1 : y
  const hx = ((h[y * w + xr] - h[y * w + xl]) / Math.max(1, xr - xl)) * k
  const hy = ((h[yd * w + x] - h[yu * w + x]) / Math.max(1, yd - yu)) * k
  // canvas y runs down; tangent-space +v runs up (textures are flipped)
  const nx = -hx
  const ny = hy
  const l = Math.hypot(nx, ny, 1)
  return [nx / l, ny / l, 1 / l]
}

function putNormal(out: Uint8ClampedArray, o: number, n: [number, number, number]) {
  out[o] = Math.round((n[0] * 0.5 + 0.5) * 255)
  out[o + 1] = Math.round((n[1] * 0.5 + 0.5) * 255)
  out[o + 2] = Math.round((n[2] * 0.5 + 0.5) * 255)
  out[o + 3] = 255
}

// ── the face of one pin ─────────────────────────────────────────────────────

interface Cell {
  color: Uint8ClampedArray
  normal: Uint8ClampedArray
  orm: Uint8ClampedArray
  coat: Uint8ClampedArray
}

function strikeFace(spec: PinArtSpec, C: number, U: number, raster: Raster, raster2: Raster): Cell {
  const sil = silhouettes()[spec.family]
  const N = C * C
  const cx = C / 2
  const cy = C / 2
  const metalSpec = METAL[FAMILY_METAL[spec.family]]
  const metalRGB = hex(metalSpec.color)
  const bandRGB = hex(FAMILY_BAND[spec.family])
  const fieldRGB = hex(spec.color)
  const fill = fillOf(spec.key)
  const seed = seedOf(spec.key)

  const cov = raster.cover((ctx) => {
    tracePoly(ctx, sil.outline, U, cx, cy)
    ctx.fill()
  })
  const body = raster.cover((ctx) => {
    tracePoly(ctx, sil.body, U, cx, cy)
    ctx.fill()
  })
  const sig = raster.cover((ctx) => drawSigil(ctx, spec.key, sil, U, cx, cy, 1.95))
  // The lattice EDT steps along diagonals; a light blur makes the zone
  // edges (and every relief built on them) run clean.
  const dB = blur(edt(body, C, C), C, C, 1, 2)

  const aa = 0.85 / U
  const M = new Float32Array(N) // metal
  const bandM = new Float32Array(N)
  const fieldM = new Float32Array(N)
  const rimM = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const d = dB[i] / U
    const inB = body[i]
    const border = 1 - ss(BORDER - aa, BORDER + aa, d)
    const band = ss(BORDER - aa, BORDER + aa, d) * (1 - ss(BAND - aa, BAND + aa, d))
    const line = ss(BAND - aa, BAND + aa, d) * (1 - ss(BAND + LINE - aa, BAND + LINE + aa, d))
    const field = ss(BAND + LINE - aa, BAND + LINE + aa, d)
    const rim = Math.max(0, cov[i] - inB)
    const outside = 1 - cov[i]
    const s = sig[i] * inB
    M[i] = clamp01(outside + rim + inB * Math.max(border, line) + s)
    bandM[i] = inB * band * (1 - s)
    fieldM[i] = inB * field * (1 - s)
    rimM[i] = rim
  }

  // Relief: the metal's profile is a soft shoulder (the die's draft), the
  // enamel sits flat below it and climbs the walls a little (meniscus).
  const Mb = blur(M, C, C, 0.0085 * U, 3)
  const H = new Float32Array(N)
  for (let i = 0; i < N; i++) H[i] = ENAMEL + (1 - ENAMEL) * ss(0, 0.56, Mb[i])
  if (sil.rays) {
    // The rayed rim: every ray is a pleat, ridged down its middle.
    const n = sil.rays.n
    for (let y = 0; y < C; y++) {
      for (let x = 0; x < C; x++) {
        const i = y * C + x
        if (rimM[i] <= 0) continue
        const a = Math.atan2(cy - y, x - cx) - Math.PI / 2
        const u = ((((a * n) / (Math.PI * 2)) % 1) + 1) % 1
        const ridge = 1 - Math.abs(2 * ((u + 0.5) % 1) - 1)
        // pleats rise out of the border instead of stepping off it
        const r = Math.hypot(x - cx, y - cy) / U
        H[i] -= 0.26 * (1 - ridge) * rimM[i] * ss(0.405, 0.44, r)
      }
    }
  }
  // Enamel darkens where it meets a wall (a baked contact shade).
  const Mw = blur(M, C, C, 0.03 * U, 2)

  const out: Cell = {
    color: new Uint8ClampedArray(N * 4),
    normal: new Uint8ClampedArray(N * 4),
    orm: new Uint8ClampedArray(N * 4),
    coat: new Uint8ClampedArray((N / 4) * 4),
  }
  const k = RELIEF * U
  const polish = metalSpec.polish
  const orange = fieldRGB
  const flakeGold = mix3(fieldRGB, [255, 214, 140], 0.5)
  const flakeSilver: [number, number, number] = [246, 241, 230]
  const nacre = mix3(fieldRGB, [244, 241, 234], 0.7)
  const flake = Math.max(3, 0.0125 * U)

  for (let y = 0; y < C; y++) {
    for (let x = 0; x < C; x++) {
      const i = y * C + x
      const o = i * 4
      const m = M[i]
      const ao = 1 - 0.5 * clamp01(Mw[i] - m)
      let n = normalAt(H, C, x, y, k)
      let rgb: [number, number, number] = metalRGB
      let rough = polish
      let metal = m
      let irid = 0
      const e = 1 - m
      if (e > 0) {
        const bandW = bandM[i]
        const fieldW = fieldM[i]
        const tot = bandW + fieldW
        let enamel: [number, number, number] = bandRGB
        let eRough = 0.42
        let eMetal = 0
        let fieldRGBHere = fieldRGB
        if (fill === 'nacar') {
          // Nacre: a pale, half-metallic pigment (platelets that mirror a
          // little) under an interference film — the film does the colour.
          const cloud = 0.5 + 0.5 * Math.sin(x * 0.045 + Math.sin(y * 0.031) * 2.2) * Math.cos(y * 0.037 - x * 0.012)
          fieldRGBHere = mix3(nacre, [255, 252, 246], cloud * 0.2)
          if (fieldW > 0.5) {
            irid = fieldW
            eRough = 0.24
            eMetal = 0.3
          }
        }
        if (fill === 'glitter' && fieldW > 0.5) {
          // Voronoi flakes: each its own tilt, metal or resin, gold or silver.
          const gx = Math.floor(x / flake)
          const gy = Math.floor(y / flake)
          let best = 1e9
          let second = 1e9
          let bx = 0
          let by = 0
          for (let j = -1; j <= 1; j++) {
            for (let l = -1; l <= 1; l++) {
              const qx = gx + l
              const qy = gy + j
              const px = (qx + 0.15 + 0.7 * hash(qx, qy, seed)) * flake
              const py = (qy + 0.15 + 0.7 * hash(qx, qy, seed + 1)) * flake
              const dd = (px - x) * (px - x) + (py - y) * (py - y)
              if (dd < best) {
                second = best
                best = dd
                bx = qx
                by = qy
              } else if (dd < second) second = dd
            }
          }
          const gap = Math.sqrt(second) - Math.sqrt(best)
          const isMetal = hash(bx, by, seed + 2) < 0.74 && gap > 0.9
          if (isMetal) {
            const tilt = 0.78 * Math.sqrt(hash(bx, by, seed + 3))
            const az = Math.PI * 2 * hash(bx, by, seed + 4)
            n = [Math.sin(tilt) * Math.cos(az), Math.sin(tilt) * Math.sin(az), Math.cos(tilt)]
            const silver = hash(bx, by, seed + 5) < 0.2
            fieldRGBHere = silver ? flakeSilver : mix3(flakeGold, orange, hash(bx, by, seed + 6) * 0.7)
            eRough = 0.17
            eMetal = 1
          } else {
            fieldRGBHere = mix3(orange, [0, 0, 0], 0.32)
            eRough = 0.34
          }
        }
        if (tot > 0) enamel = mix3(bandRGB, fieldRGBHere, fieldW / tot)
        const shade = eMetal ? 1 : ao
        const enamelRGB: [number, number, number] = [enamel[0] * shade, enamel[1] * shade, enamel[2] * shade]
        rgb = mix3(enamelRGB, metalRGB, m)
        rough = eRough * e + polish * m
        metal = Math.max(m, eMetal * e)
      }
      out.color[o] = rgb[0]
      out.color[o + 1] = rgb[1]
      out.color[o + 2] = rgb[2]
      out.color[o + 3] = 255
      putNormal(out.normal, o, n)
      out.orm[o] = Math.round(irid * 255)
      out.orm[o + 1] = Math.round(clamp01(rough) * 255)
      out.orm[o + 2] = Math.round(clamp01(metal) * 255)
      out.orm[o + 3] = 255
    }
  }

  // The epoxy dome: climbs fast from the die-cut edge (meniscus), then
  // flattens over the middle. Half resolution is plenty for a lens.
  const C2 = C / 2
  const cov2 = raster2.cover((ctx) => {
    tracePoly(ctx, sil.outline, U / 2, C2 / 2, C2 / 2)
    ctx.fill()
  })
  const dS = blur(edt(cov2, C2, C2), C2, C2, 1.5, 2)
  const Hd = new Float32Array(C2 * C2)
  for (let i = 0; i < Hd.length; i++) {
    const d = dS[i] / (U / 2)
    const men = 1 - Math.pow(1 - Math.min(1, d / MENISCUS), 3)
    const lens = 1 - Math.pow(1 - Math.min(1, d / LENS), 2)
    Hd[i] = 0.62 * men + 0.38 * lens
  }
  const Hds = blur(Hd, C2, C2, 2, 3)
  const kd = DOME * (U / 2)
  for (let y = 0; y < C2; y++) for (let x = 0; x < C2; x++) putNormal(out.coat, (y * C2 + x) * 4, normalAt(Hds, C2, x, y, kd))
  return out
}

// ── the back of one pin ─────────────────────────────────────────────────────

export interface Fonts {
  mono: string
}

/** Resolve the mono face the page actually uses (next/font names it). */
export async function engravingFonts(): Promise<Fonts> {
  let mono = 'ui-monospace, Menlo, monospace'
  try {
    const probe = document.createElement('span')
    probe.style.display = 'none'
    probe.style.fontFamily = 'var(--font-mono)'
    document.body.appendChild(probe)
    mono = getComputedStyle(probe).fontFamily || mono
    probe.remove()
    await Promise.race([
      Promise.all([document.fonts.load(`700 40px ${mono}`, 'SEP 2026'), document.fonts.load(`400 40px ${mono}`, 'Tu presencia')]),
      new Promise((r) => setTimeout(r, 1500)),
    ])
  } catch {
    /* whatever face is there */
  }
  return { mono }
}

/** Width (units) of the silhouette's field at height y, from a coverage raster. */
function rowWidth(cover: Float32Array, C: number, U: number, cy: number, y: number): number {
  const row = Math.round(cy - y * U)
  if (row < 0 || row >= C) return 0
  let x0 = -1
  let x1 = -1
  for (let x = 0; x < C; x++) {
    if (cover[row * C + x] > 0.5) {
      if (x0 < 0) x0 = x
      x1 = x
    }
  }
  return x0 < 0 ? 0 : (x1 - x0) / U
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: (line: number) => number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (let w = 0; w < words.length; w++) {
    const next = cur ? `${cur} ${words[w]}` : words[w]
    if (ctx.measureText(next).width <= width(lines.length) || !cur) cur = next
    else {
      lines.push(cur)
      cur = words[w]
      if (lines.length === max) break
    }
  }
  if (cur && lines.length < max) lines.push(cur)
  // Ran out of room: close the last line with an ellipsis rather than cut a word.
  const used = lines.join(' ').split(/\s+/).length
  if (used < words.length && lines.length) {
    let last = lines[lines.length - 1]
    while (last.length > 1 && ctx.measureText(`${last}…`).width > width(lines.length - 1)) last = last.slice(0, -1)
    lines[lines.length - 1] = `${last.trimEnd()}…`
  }
  return lines
}

function strikeBack(spec: BackArtSpec, C: number, U: number, raster: Raster, fonts: Fonts): { normal: Uint8ClampedArray; orm: Uint8ClampedArray } {
  const sil = silhouettes()[spec.family]
  const N = C * C
  const cx = C / 2
  const cy = C / 2
  const out = { normal: new Uint8ClampedArray(N * 4), orm: new Uint8ClampedArray(N * 4) }
  // Seen from behind the pin is mirrored left–right; text reads normally.
  const cov = raster.cover((ctx) => {
    tracePoly(ctx, sil.outline, U, cx, cy, true)
    ctx.fill()
  })
  const bodyCov = raster.cover((ctx) => {
    tracePoly(ctx, sil.body, U, cx, cy, true)
    ctx.fill()
  })
  const dS = edt(cov, C, C)
  const pcx = cx - sil.center[0] * U
  const pcy = cy - sil.center[1] * U
  const collar = raster.cover((ctx) => {
    ctx.beginPath()
    ctx.arc(pcx, pcy, 0.052 * U, 0, Math.PI * 2)
    ctx.fill()
  })
  const month = spec.month
  const text = raster.cover((ctx) => {
    if (!month) return
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // the month, above the clutch
    ctx.font = `700 ${Math.round(0.08 * U)}px ${fonts.mono}`
    ctx.fillText(month, pcx, pcy - 0.225 * U)
    // the story, below it, wrapped to the field's width at each line
    const size = 0.037 * U
    const lead = 0.053
    const first = 0.165
    ctx.font = `400 ${Math.round(size)}px ${fonts.mono}`
    const yAt = (l: number) => sil.center[1] - first - l * lead
    const widthAt = (l: number) => Math.max(0, (Math.min(rowWidth(bodyCov, C, U, cy, yAt(l) + 0.02), rowWidth(bodyCov, C, U, cy, yAt(l) - 0.02)) - 0.16) * U)
    const lines = wrap(ctx, spec.story.toUpperCase(), widthAt, sil.family === 'reception' ? 2 : 3)
    lines.forEach((line, l) => ctx.fillText(line, pcx, cy - yAt(l) * U))
  })
  const rim = new Float32Array(N)
  const aa = 0.8 / U
  for (let i = 0; i < N; i++) rim[i] = cov[i] < 0.5 ? 1 : 1 - ss(0.032 - aa, 0.032 + aa, dS[i] / U)
  const rimB = blur(rim, C, C, 0.006 * U, 2)
  const colB = blur(collar, C, C, 0.008 * U, 2)
  const txtB = blur(text, C, C, 0.6, 1)
  // sandblast: fine random grain, softened a touch
  const grain = new Float32Array(N)
  const seed = seedOf(spec.key) ^ 0x5bd1e995
  for (let i = 0; i < N; i++) grain[i] = hash(i % C, Math.floor(i / C), seed)
  const grainB = blur(grain, C, C, 0.8, 1)
  const Hb = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const plate = 1 - rim[i]
    Hb[i] = 0.46 + 0.42 * rimB[i] + 0.22 * colB[i] + plate * (0.11 * (grainB[i] - 0.5) - 0.24 * txtB[i])
  }
  const k = 0.012 * U
  for (let y = 0; y < C; y++) {
    for (let x = 0; x < C; x++) {
      const i = y * C + x
      const o = i * 4
      putNormal(out.normal, o, normalAt(Hb, C, x, y, k))
      const plate = 1 - rim[i]
      const t = text[i] * plate
      const rough = rim[i] * 0.2 + plate * (0.58 + 0.14 * (grainB[i] - 0.5)) * (1 - colB[i] * 0.5)
      // R: occlusion — the laser-cut grooves hold shadow (the case's light
      // is mostly the light box, i.e. indirect)
      out.orm[o] = Math.round(clamp01(1 - 0.72 * t) * 255)
      out.orm[o + 1] = Math.round(clamp01(rough * (1 - t) + 0.86 * t) * 255)
      out.orm[o + 2] = Math.round(clamp01(1 - 0.55 * t) * 255)
      out.orm[o + 3] = 255
    }
  }
  return out
}

// ── atlases ─────────────────────────────────────────────────────────────────

function toCanvas(w: number, h: number, data: Uint8ClampedArray): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (ctx) ctx.putImageData(new ImageData(data as unknown as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0)
  return c
}

function blit(dst: Uint8ClampedArray, dw: number, src: Uint8ClampedArray, sw: number, x0: number, y0: number) {
  for (let y = 0; y < sw; y++) dst.set(src.subarray(y * sw * 4, (y + 1) * sw * 4), ((y0 + y) * dw + x0) * 4)
}

export const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0))

const faceCache = new Map<string, Promise<FaceMaps>>()

/**
 * The faces of the whole catalog (same for everyone), struck once per
 * resolution and kept for the session; yields between pins so a long strike
 * never blocks a frame.
 */
export function strikeFaces(specs: PinArtSpec[], cell: number): Promise<FaceMaps> {
  const key = `${cell}|${specs.map((s) => `${s.key}:${s.family}:${s.color}`).join(',')}`
  let p = faceCache.get(key)
  if (!p) {
    p = (async () => {
      const atlas = makeAtlas(specs.length, cell)
      const { width: W, height: H, cell: C, unit: U } = atlas
      const color = new Uint8ClampedArray(W * H * 4)
      const normal = new Uint8ClampedArray(W * H * 4)
      const orm = new Uint8ClampedArray(W * H * 4)
      const coat = new Uint8ClampedArray((W / 2) * (H / 2) * 4)
      const raster = new Raster(C)
      const raster2 = new Raster(C / 2)
      for (let i = 0; i < specs.length; i++) {
        const cellArt = strikeFace(specs[i], C, U, raster, raster2)
        const x0 = (i % atlas.cols) * C
        const y0 = Math.floor(i / atlas.cols) * C
        blit(color, W, cellArt.color, C, x0, y0)
        blit(normal, W, cellArt.normal, C, x0, y0)
        blit(orm, W, cellArt.orm, C, x0, y0)
        blit(coat, W / 2, cellArt.coat, C / 2, x0 / 2, y0 / 2)
        await yieldFrame()
      }
      return {
        atlas,
        color: toCanvas(W, H, color),
        normal: toCanvas(W, H, normal),
        orm: toCanvas(W, H, orm),
        coat: toCanvas(W / 2, H / 2, coat),
      }
    })()
    // Keep one resolution only: a phone and a desk don't share a session.
    for (const k of faceCache.keys()) if (k !== key) faceCache.delete(k)
    faceCache.set(key, p)
    p.catch(() => faceCache.delete(key))
  }
  return p
}

/** The backs, with this member's months and stories engraved. */
export async function strikeBacks(specs: BackArtSpec[], cell: number, fonts: Fonts): Promise<BackMaps> {
  const atlas = makeAtlas(specs.length, cell)
  const { width: W, height: H, cell: C, unit: U } = atlas
  const normal = new Uint8ClampedArray(W * H * 4)
  const orm = new Uint8ClampedArray(W * H * 4)
  // A flat, neutral plate where no pin was earned (never sampled).
  for (let i = 0; i < W * H; i++) {
    normal[i * 4] = 128
    normal[i * 4 + 1] = 128
    normal[i * 4 + 2] = 255
    normal[i * 4 + 3] = 255
    orm[i * 4] = 255
    orm[i * 4 + 1] = 128
    orm[i * 4 + 2] = 255
    orm[i * 4 + 3] = 255
  }
  const raster = new Raster(C)
  for (let i = 0; i < specs.length; i++) {
    if (!specs[i].month) continue
    const cellArt = strikeBack(specs[i], C, U, raster, fonts)
    const x0 = (i % atlas.cols) * C
    const y0 = Math.floor(i / atlas.cols) * C
    blit(normal, W, cellArt.normal, C, x0, y0)
    blit(orm, W, cellArt.orm, C, x0, y0)
    await yieldFrame()
  }
  return { atlas, normal: toCanvas(W, H, normal), orm: toCanvas(W, H, orm) }
}

// ── small tiles ─────────────────────────────────────────────────────────────

let nacreTile: HTMLCanvasElement | null = null

/**
 * Nacre's film thickness (green channel): growth lines — fine, wavy,
 * roughly parallel terraces, the way aragonite is laid down layer by layer.
 */
export function nacreThickness(): HTMLCanvasElement {
  if (nacreTile) return nacreTile
  const S = 256
  const data = new Uint8ClampedArray(S * S * 4)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = x / S
      const v = y / S
      const w = u * 1.1 + v * 0.75 + 0.07 * Math.sin(v * 21) + 0.045 * Math.sin(u * 29 + v * 7) + 0.03 * Math.sin((u - v) * 47)
      const t = 0.5 + 0.3 * Math.sin(w * Math.PI * 2 * 6) + 0.14 * Math.sin(w * Math.PI * 2 * 13 + 1.3) + 0.06 * Math.sin((u * 3 + v * 5) * Math.PI * 2)
      const o = (y * S + x) * 4
      data[o] = 255
      data[o + 1] = Math.round(clamp01(t) * 255)
      data[o + 2] = 0
      data[o + 3] = 255
    }
  nacreTile = toCanvas(S, S, data)
  return nacreTile
}
