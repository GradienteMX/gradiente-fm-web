'use client'

/**
 * ACABADO — a sticker's finish, painted for the flat UIs.
 *
 * The art (arte.ts) is the print on a plain stock. Here the stock becomes a
 * material: per COPY for foils (copySeed → foilLayout + a seeded stream), so
 * no two copies of a holo, a glitter or a metal are alike, and per DESIGN
 * for what follows the print (where the foil shows, where the ink sits, the
 * relief's light). All of it is painted on a canvas ONCE — cached per
 * family × seed × size — encoded to blob: URLs, and moved by CSS with the
 * pointer (components/stickers/Calco.module.css). Never a canvas per frame.
 *
 *   acabado(def, seed, cssWidth·dpr) → Promise<Kit>
 *     win     where the foil shows (finish.ts foilWindow): white + alpha
 *     ink     where the ink sits (spot varnish rides on it)
 *     sheet   the foil as TILES side by side, each the sticker plus BLEED on
 *             every side (so CSS can slide it): tile 0 is the foil at rest,
 *             the others its moving parts (below)
 *     relief  the relief's light: tile X and tile Y, 50 % grey = flat — CSS
 *             invert() turns them toward the light — plus, for the dome, its
 *             refracting rim and the mask of its lens
 *     b       the lenticular's other frame (arte.ts frameB)
 *   glints(finish, layout, mx, my, seed) → levels of the glint groups: which
 *     shards, facets, scales, stars or flakes catch the light from here.
 *   muestra(def, seed) → a small square of the stock itself (shelf swatches).
 *
 * Tiles per family (finish.ts is the spec):
 *   prisma    0 spectral bands on micro-lines · 1 a second grating, a few
 *             degrees off — sliding it over the first sweeps moiré fringes
 *   galaxia   0 smoke, a galactic band with dust lanes, dust · 1 nebula ·
 *             2–4 stars in three glint groups · 5 four-point flares
 *   hielo     0 Voronoi shards, each its own mirror, white cracks with their
 *             shadow, fractures · 1–6 each shard's own flash (3 angles × 2
 *             tilts: moving out from the centre wakes other shards)
 *   diamante  0 the pyramid lattice · 1–4 its N / E / S / W faces lit
 *   laser     0 grooves round an off-centre point, spokes, the arms at rest
 *             · 1 the rainbow rings (CSS turns a conic mask round the centre)
 *   aceite    0 a domain-warped thin film · 1 the same film further over
 *   escamas   0 overlapping sequins · 1–4 their rows, lit
 *   motivo    0 a grating ground with the motif struck at another angle and
 *             phase · 1 the motifs alone
 *   brillo    0 flakes on a silver ground · 1–4 flakes that flip
 *   metal     0 the plate: tint, hairlines, the studio at rest · 1 hairline
 *             glints (CSS runs a band of them across)
 */

import { stickerArt, stickerArtURL } from './arte'
import { designOf, finishOf, foilLayout, foilWindow, isOneOfAKind, type Finish, type FoilLayout } from './finish'
import type { StickerDef } from './types'

/** Extra foil around the sticker on every side of a tile (fraction of its size). */
export const BLEED = 0.1
/** Where the light sits when nobody points: the studio's key, top left. */
export const REST: readonly [number, number] = [-0.45, -0.55]

export interface Kit {
  win: string | null
  ink: string | null
  sheet: string | null
  tiles: number
  relief: string | null
  reliefTiles: number
  b: string | null
}

const TAU = Math.PI * 2

// ═══ public ═════════════════════════════════════════════════════════════════

const kits = new Map<string, Promise<Kit>>()

/** The finish maps of one copy (or a shelf sample) at `w` device pixels wide. */
export function acabado(def: StickerDef, seed: number, w: number): Promise<Kit> {
  const f = finishOf(def)
  const key = `${def.id}@${w}:${isOneOfAKind(f) ? seed.toFixed(6) : '-'}`
  let p = kits.get(key)
  if (!p) {
    p = build(def, f, seed, w)
    kits.set(key, p)
  }
  return p
}

/** How many glint groups a finish has (CSS --o0…). */
export function glintCount(f: Finish): number {
  if (f.material === 'brillo') return 4
  switch (f.material === 'holo' ? f.holo : null) {
    case 'galaxia':
      return 4
    case 'hielo':
      return 6
    case 'diamante':
    case 'escamas':
      return 4
    case 'aceite':
    case 'motivo':
      return 1
    default:
      return 0
  }
}

/**
 * Levels (0..1) of the glint groups with the light at (mx, my), -1..1 over
 * the sticker. Flakes and facets FLIP (the levels step); stars twinkle;
 * the film and the motifs swing.
 */
export function glints(f: Finish, L: FoilLayout, mx: number, my: number, seed: number): number[] {
  const mag = Math.min(1, Math.hypot(mx, my))
  const phi = Math.atan2(my, mx)
  if (f.material === 'brillo') {
    const gx = Math.round(mx * 6)
    const gy = Math.round(my * 6)
    return [0, 1, 2, 3].map((g) => {
      const h = hash3(gx + 40, gy + 40, g * 7 + Math.floor(seed * 1e6))
      return h > 0.52 ? 0.35 + 0.65 * h : 0.04
    })
  }
  if (f.material !== 'holo') return []
  switch (f.holo) {
    case 'galaxia': {
      // stars never go out: they twinkle between a glow and a flash
      const k = smooth(0.04, 0.3, mag)
      const out = [0, 1, 2].map((g) => {
        const th = L.hue * TAU + (g * TAU) / 3
        return 0.38 + 0.62 * Math.pow(Math.max(0, 1 - angDist(phi, th) / 1.3), 1.5) * k
      })
      out.push(0.3 + 0.7 * Math.abs(Math.sin(phi * 2 + L.hue * 9)) * k)
      return out
    }
    case 'hielo': {
      const sector = Math.floor(((((phi - L.hue * TAU) % TAU) + TAU) % TAU) / (TAU / 3)) % 3
      const band = mag > 0.52 ? 1 : 0
      const on = sector + 3 * band
      const near = ((sector + 1) % 3) + 3 * band
      const far = sector + 3 * (1 - band)
      return [0, 1, 2, 3, 4, 5].map((g) => (mag < 0.06 ? 0.03 : g === on ? 1 : g === near ? 0.32 : g === far ? 0.14 : 0.03))
    }
    case 'diamante': {
      const ca = Math.cos(L.angle)
      const sa = Math.sin(L.angle)
      const m = mag > 1e-3 ? [mx / mag, my / mag] : [0, 0]
      const k = smooth(0.04, 0.4, mag)
      return FACE_N.map(([nx, ny]) => {
        const sx = nx * ca - ny * sa
        const sy = nx * sa + ny * ca
        const d = Math.max(0, m[0] * sx + m[1] * sy)
        return Math.round(d * d * k * 3) / 3
      })
    }
    case 'escamas': {
      const ph = (my * 0.5 + 0.5) * 6 + mx * 0.8 + L.hue * 4
      const on = ((Math.floor(ph) % 4) + 4) % 4
      return [0, 1, 2, 3].map((g) => (g === on ? 1 : g === (on + 3) % 4 ? 0.3 : 0.02))
    }
    case 'aceite':
      return [0.5 + 0.5 * Math.sin(mx * 2.4 + my * 1.6 + L.hue * TAU)]
    case 'motivo':
      return [0.25 + 0.75 * Math.abs(Math.sin(mx * 2 - my * 1.5 + L.hue * TAU))]
    default:
      return []
  }
}

const swatches = new Map<string, Promise<string>>()

/** A small square of the stock itself (a holo family, a metal, glitter), for a shelf's options. */
export function muestra(def: StickerDef, seed: number, px = 72): Promise<string> {
  const f = finishOf(def)
  const key = `${f.material}:${f.holo ?? ''}:${f.metal ?? ''}:${seed.toFixed(6)}@${px}:${f.holo === 'motivo' ? def.art.code : ''}`
  let p = swatches.get(key)
  if (!p) {
    p = queue(async () => {
      const sheet = await paintSheet(f, foilLayout(seed), seed, px, px, def.art.code, 1)
      if (!sheet) return ''
      // tile 0, without its bleed
      const c = mk(px, px)
      const b = Math.round(px * BLEED)
      ctx2d(c).drawImage(sheet.c, b, b, px, px, 0, 0, px, px)
      return encode(c)
    })
    swatches.set(key, p)
  }
  return p
}

// ═══ building a kit ═════════════════════════════════════════════════════════

async function build(def: StickerDef, f: Finish, seed: number, w: number): Promise<Kit> {
  const foil = isOneOfAKind(f)
  const needInk = f.relieve === 'barniz'
  const needRelief = f.relieve !== 'liso'
  const kit: Kit = { win: null, ink: null, sheet: null, tiles: 0, relief: null, reliefTiles: 0, b: null }
  if (!foil && !needInk && !needRelief && f.material !== 'lenticular') return kit
  const [maps, sheet, relief, b] = await Promise.all([
    foil || needInk ? mapsOf(def, w) : null,
    foil ? sheetOf(def, f, seed, w) : null,
    needRelief ? reliefOf(def, f, w) : null,
    f.material === 'lenticular' ? stickerArtURL(def, w, 'b') : null,
  ])
  if (maps) {
    kit.win = foil ? maps.win : null
    kit.ink = needInk ? maps.ink : null
  }
  if (sheet) {
    kit.sheet = sheet.url
    kit.tiles = sheet.tiles
  }
  if (relief) {
    kit.relief = relief.url
    kit.reliefTiles = relief.tiles
  }
  kit.b = b || null
  return kit
}

// ── one painting at a time, yielding between ────────────────────────────────

let chain: Promise<unknown> = Promise.resolve()

/** Paint jobs run one after another with a breath between, so a shelf never blocks a frame for long. */
function queue<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(() => new Promise<void>((r) => setTimeout(r, 0))).then(job)
  chain = run.catch(() => undefined)
  return run
}

// ── the maps that follow the print (per design × width) ────────────────────

interface Maps {
  win: string
  ink: string
}

const mapsCache = new Map<string, Promise<Maps | null>>()

function mapsOf(def: StickerDef, w: number): Promise<Maps | null> {
  const key = `${def.id}@${w}`
  let p = mapsCache.get(key)
  if (!p) {
    p = stickerArt(def, w).then((art) =>
      queue(async () => {
        const W = art.width
        const H = art.height
        if (!W || !H) return null
        const d = pixels(art)
        const win = mk(W, H)
        const ink = mk(W, H)
        const wi = ctx2d(win).createImageData(W, H)
        const ii = ctx2d(ink).createImageData(W, H)
        slice = performance.now()
        for (let i = 0; i < W * H; i++) {
          if ((i & 16383) === 16383) await breathe()
          const o = i * 4
          const a = d[o + 3] / 255
          if (a <= 0) continue
          const r = d[o] / 255
          const g = d[o + 1] / 255
          const b = d[o + 2] / 255
          wi.data[o] = wi.data[o + 1] = wi.data[o + 2] = 255
          wi.data[o + 3] = Math.round(255 * a * foilWindow(r, g, b))
          ii.data[o] = ii.data[o + 1] = ii.data[o + 2] = 255
          ii.data[o + 3] = Math.round(255 * a * inkOf(r, g, b))
        }
        ctx2d(win).putImageData(wi, 0, 0)
        ctx2d(ink).putImageData(ii, 0, 0)
        const [wu, iu] = await Promise.all([encode(win), encode(ink)])
        return { win: wu, ink: iu }
      }),
    )
    mapsCache.set(key, p)
  }
  return p
}

/** How much a printed pixel is ink: dark, or a saturated colour. */
function inkOf(r: number, g: number, b: number): number {
  const l = 0.299 * r + 0.587 * g + 0.114 * b
  const s = Math.max(r, g, b) - Math.min(r, g, b)
  return Math.max(1 - smooth(0.3, 0.72, l), smooth(0.3, 0.65, s) * 0.85)
}

// ── the relief's light (per design × width) ─────────────────────────────────

const reliefCache = new Map<string, Promise<{ url: string; tiles: number } | null>>()

function reliefOf(def: StickerDef, f: Finish, w: number): Promise<{ url: string; tiles: number } | null> {
  const key = `${designOf(def)}:${f.relieve}:${f.material}@${w}`
  let p = reliefCache.get(key)
  if (!p) {
    p = stickerArt(def, w).then((art) =>
      queue(async () => {
        const W = art.width
        const H = art.height
        if (!W || !H) return null
        const d = pixels(art)
        const n = W * H
        const u = Math.sqrt(W * H)
        const alpha = new Float32Array(n)
        const ink = new Float32Array(n)
        for (let i = 0; i < n; i++) {
          const o = i * 4
          const a = d[o + 3] / 255
          alpha[i] = a
          ink[i] = a > 0 ? a * inkOf(d[o] / 255, d[o + 1] / 255, d[o + 2] / 255) : 0
        }
        let h: Float32Array
        let strength = 1
        const dome = f.relieve === 'domo'
        // the dome: resin that climbs from the die-cut and levels off
        const soft = dome ? await blur(alpha, W, H, Math.max(2, u * 0.035), 3) : null
        if (f.relieve === 'tinta') h = await blur(ink, W, H, Math.max(1, u * 0.0045), 2)
        else if (f.relieve === 'gofrado') {
          // soft shoulders, not a glow: a modest radius, a modest slope
          h = await blur(ink, W, H, Math.max(1.5, u * 0.0085), 3)
          strength = 0.62
        } else if (f.relieve === 'hundido') {
          h = await blur(ink, W, H, Math.max(1.2, u * 0.006), 3)
          for (let i = 0; i < n; i++) h[i] = -h[i]
          strength = 0.66
        } else if (f.relieve === 'barniz') {
          h = await blur(ink, W, H, Math.max(1, u * 0.003), 2)
          strength = 0.45
        } else {
          h = new Float32Array(n)
          if (soft) for (let i = 0; i < n; i++) h[i] = Math.sqrt(Math.min(1, soft[i] * 1.25))
          strength = 1.1
        }
        // normals, scaled so the steep 1 % reads as a strong slope
        const gx = new Float32Array(n)
        const gy = new Float32Array(n)
        const mags: number[] = []
        for (let y = 1; y < H - 1; y++)
          for (let x = 1; x < W - 1; x++) {
            const i = y * W + x
            gx[i] = (h[i + 1] - h[i - 1]) * 0.5
            gy[i] = (h[i + W] - h[i - W]) * 0.5
            if (alpha[i] > 0.5 && (i & 3) === 0) mags.push(Math.hypot(gx[i], gy[i]))
          }
        mags.sort((a, b) => a - b)
        const top = mags[Math.floor(mags.length * 0.985)] ?? 0
        const k = top > 1e-5 ? (0.9 * strength) / top : 0
        const tiles = dome ? 4 : 2
        const c = mk(W * tiles, H)
        const x = ctx2d(c)
        const img = x.createImageData(W * tiles, H)
        const o = img.data
        const stride = W * tiles
        for (let y = 0; y < H; y++) {
          if ((y & 15) === 15) await breathe()
          for (let xx = 0; xx < W; xx++) {
            const i = y * W + xx
            const a = alpha[i]
            if (a <= 0) continue
            const nx = clamp(-gx[i] * k, -1, 1)
            const ny = clamp(-gy[i] * k, -1, 1)
            const A = Math.round(a * 255)
            put(o, (y * stride + xx) * 4, 0.5 + 0.5 * nx, A)
            put(o, (y * stride + W + xx) * 4, 0.5 + 0.5 * ny, A)
            if (soft) {
              const s = soft[i]
              // the rim refracts dark, a bright line rides just inside it
              const rim = 0.5 - 0.3 * (1 - smooth(0.2, 0.72, s)) + 0.26 * Math.exp(-((s - 0.8) ** 2) / 0.004)
              put(o, (y * stride + 2 * W + xx) * 4, rim, A)
              // the lens: the flat middle of the dome
              const lo = (y * stride + 3 * W + xx) * 4
              o[lo] = o[lo + 1] = o[lo + 2] = 255
              o[lo + 3] = Math.round(255 * a * smooth(0.6, 0.92, s))
            }
          }
        }
        x.putImageData(img, 0, 0)
        return { url: await encode(c), tiles }
      }),
    )
    reliefCache.set(key, p)
  }
  return p
}

function put(o: Uint8ClampedArray, i: number, grey: number, a: number) {
  const v = Math.round(clamp(grey, 0, 1) * 255)
  o[i] = o[i + 1] = o[i + 2] = v
  o[i + 3] = a
}

// ── the foil sheet (per copy) ───────────────────────────────────────────────

const sheetCache = new Map<string, Promise<{ url: string; tiles: number } | null>>()

/** Foil detail rides the sticker, not the screen: capped so a big view stays cheap. */
const SHEET_MAX = 400

function sheetOf(def: StickerDef, f: Finish, seed: number, w: number): Promise<{ url: string; tiles: number } | null> {
  const W = Math.max(48, Math.min(SHEET_MAX, w))
  const H = Math.max(24, Math.round(W / def.aspect))
  const key = `${f.material}:${f.holo ?? ''}:${f.metal ?? ''}:${seed.toFixed(6)}:${W}x${H}:${f.holo === 'motivo' ? def.art.code : ''}`
  let p = sheetCache.get(key)
  if (!p) {
    p = queue(async () => {
      const s = await paintSheet(f, foilLayout(seed), seed, W, H, def.art.code)
      if (!s) return null
      return { url: await encode(s.c), tiles: s.tiles }
    })
    sheetCache.set(key, p)
  }
  return p
}

/** The painting surface of one sheet: tile geometry, the layout, a seeded stream. */
interface Lam {
  W: number
  H: number
  TW: number
  TH: number
  T: number
  /** Sticker aspect's square root: sticker units are √A wide and 1/√A tall (area 1). */
  sa: number
  /** Pixels per sticker unit. */
  u: number
  L: FoilLayout
  R: () => number
  seed: number
  c: HTMLCanvasElement
  x: CanvasRenderingContext2D
  img: ImageData
}

async function paintSheet(
  f: Finish,
  L: FoilLayout,
  seed: number,
  W: number,
  H: number,
  code: string,
  only?: number,
): Promise<{ c: HTMLCanvasElement; tiles: number } | null> {
  const fam = f.material === 'holo' ? (f.holo ?? 'prisma') : f.material
  const T = only ?? TILES[fam] ?? 1
  const TW = Math.round(W * (1 + 2 * BLEED))
  const TH = Math.round(H * (1 + 2 * BLEED))
  const c = mk(TW * T, TH)
  const x = ctx2d(c, true)
  const l: Lam = {
    W,
    H,
    TW,
    TH,
    T,
    sa: Math.sqrt(W / H),
    u: Math.sqrt(W * H),
    L,
    R: rng(Math.floor(seed * 4294967295) ^ hashStr(fam)),
    seed,
    c,
    x,
    img: x.createImageData(TW * T, TH),
  }
  slice = performance.now()
  try {
    switch (fam) {
      case 'prisma':
        await prisma(l)
        break
      case 'galaxia':
        await galaxia(l)
        break
      case 'hielo':
        await hielo(l)
        break
      case 'diamante':
        await diamante(l)
        break
      case 'laser':
        await laser(l)
        break
      case 'aceite':
        await aceite(l)
        break
      case 'escamas':
        await escamas(l)
        break
      case 'motivo':
        await motivo(l, code)
        break
      case 'brillo':
        await brillo(l)
        break
      case 'metal':
        await metal(l, f.metal ?? 'plata')
        break
      default:
        return null
    }
  } catch {
    return null
  }
  return { c, tiles: T }
}

const TILES: Record<string, number> = { prisma: 2, galaxia: 6, hielo: 7, diamante: 5, laser: 2, aceite: 2, escamas: 5, motivo: 2, brillo: 5, metal: 2 }

/** Sticker units of a tile pixel's centre. */
function su(l: Lam, px: number, py: number): [number, number] {
  return [(px + 0.5 - BLEED * l.W) / l.u, (py + 0.5 - BLEED * l.H) / l.u]
}

let slice = 0

/**
 * Painting is cooperative: after ~12 ms of work the page gets the thread
 * back (scheduler.yield resumes us ahead of other queued work; a timeout
 * where it doesn't exist).
 */
async function breathe(): Promise<void> {
  const now = performance.now()
  if (now - slice < 12) return
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler
  await (s?.yield ? s.yield() : new Promise<void>((r) => setTimeout(r, 0)))
  slice = performance.now()
}

/** Visit every pixel of tile `t` (only while t < T): sticker units and the byte offset. */
async function each(l: Lam, t: number, fn: (X: number, Y: number, o: number, px: number, py: number) => void) {
  if (t >= l.T) return
  const stride = l.img.width
  const x0 = t * l.TW
  for (let py = 0; py < l.TH; py++) {
    const Y = (py + 0.5 - BLEED * l.H) / l.u
    for (let px = 0; px < l.TW; px++) fn((px + 0.5 - BLEED * l.W) / l.u, Y, (py * stride + x0 + px) * 4, px, py)
    if ((py & 7) === 7) await breathe()
  }
}

function set(d: Uint8ClampedArray, o: number, r: number, g: number, b: number, a = 1) {
  d[o] = clamp(r, 0, 1) * 255
  d[o + 1] = clamp(g, 0, 1) * 255
  d[o + 2] = clamp(b, 0, 1) * 255
  d[o + 3] = clamp(a, 0, 1) * 255
}

/** Paint a smooth field at a fraction of the resolution into tile t, scaled up. */
async function soft(l: Lam, t: number, k: number, fn: (X: number, Y: number, out: Float32Array) => void) {
  if (t >= l.T) return
  const w = Math.max(8, Math.round(l.TW * k))
  const h = Math.max(8, Math.round(l.TH * k))
  const c = mk(w, h)
  const x = ctx2d(c)
  const img = x.createImageData(w, h)
  const out = new Float32Array(4)
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const X = (((px + 0.5) / w) * l.TW - BLEED * l.W) / l.u
      const Y = (((py + 0.5) / h) * l.TH - BLEED * l.H) / l.u
      out[3] = 1
      fn(X, Y, out)
      set(img.data, (py * w + px) * 4, out[0], out[1], out[2], out[3])
    }
    if ((py & 7) === 7) await breathe()
  }
  x.putImageData(img, 0, 0)
  l.x.save()
  l.x.beginPath()
  l.x.rect(t * l.TW, 0, l.TW, l.TH)
  l.x.clip()
  l.x.imageSmoothingEnabled = true
  l.x.imageSmoothingQuality = 'high'
  l.x.drawImage(c, t * l.TW, 0, l.TW, l.TH)
  l.x.restore()
}

/** Draw into tile t with sticker-unit coordinates (clipped to the tile). */
function inTile(l: Lam, t: number, draw: (x: CanvasRenderingContext2D) => void) {
  if (t >= l.T) return
  const x = l.x
  x.save()
  x.beginPath()
  x.rect(t * l.TW, 0, l.TW, l.TH)
  x.clip()
  x.translate(t * l.TW + BLEED * l.W, BLEED * l.H)
  x.scale(l.u, l.u)
  draw(x)
  x.restore()
}

/** The sticker-unit rectangle a tile covers (with its bleed). */
function extent(l: Lam) {
  const [x0, y0] = su(l, -0.5, -0.5)
  const [x1, y1] = su(l, l.TW - 0.5, l.TH - 0.5)
  return { x0, y0, x1, y1, cx: l.sa / 2, cy: 0.5 / l.sa }
}

// ── prisma ──────────────────────────────────────────────────────────────────

async function prisma(l: Lam) {
  const { L, R } = l
  const d = l.img.data
  const ca = Math.cos(L.angle)
  const sn = Math.sin(L.angle)
  const off = (((2 + 4 * R()) * Math.PI) / 180) * (R() < 0.5 ? -1 : 1)
  const ca2 = Math.cos(L.angle + off)
  const sn2 = Math.sin(L.angle + off)
  const pitch = 0.0105 * L.scale
  const pitch2 = pitch * (1.01 + 0.03 * R())
  const band = 0.34 * L.scale
  const o1 = R() * 50
  const o2 = R() * 50
  const c = new Float32Array(3)
  await each(l, 0, (X, Y, o) => {
    const u = X * ca + Y * sn
    const v = -X * sn + Y * ca
    const warp = fbm(X * 1.5 + o1, Y * 1.5 + o2, 3) - 0.5
    const ph = u / band + L.hue + warp * 0.6
    spectral(ph, c)
    vivid(c, 1.35)
    // orders: strong colour, then a silvery gap, then colour again
    const ord = 0.5 + 0.5 * Math.cos(TAU * (u / band) * 0.5 + L.hue * 9 + warp)
    const amt = 0.35 + 0.6 * smooth(0.15, 0.85, ord)
    const silver = 0.8 + 0.08 * Math.sin(v * 7 + warp * 3)
    const line = 0.5 + 0.5 * Math.cos((TAU * u) / pitch)
    const crest = line ** 10
    const lum = 0.84 + 0.22 * line
    set(
      d,
      o,
      (silver + (c[0] - silver) * amt) * lum + crest * 0.14,
      (silver + (c[1] - silver) * amt) * lum + crest * 0.14,
      (silver + (c[2] - silver) * amt) * lum + crest * 0.14,
    )
  })
  await each(l, 1, (X, Y, o) => {
    const u2 = X * ca2 + Y * sn2
    const g = 0.5 + 0.44 * Math.cos((TAU * u2) / pitch2)
    set(d, o, g, g, g)
  })
  l.x.putImageData(l.img, 0, 0)
}

// ── galaxia ─────────────────────────────────────────────────────────────────

async function galaxia(l: Lam) {
  const { L, R } = l
  const e = extent(l)
  const gb = L.angle
  const bo = (R() - 0.5) * 0.45
  const bw = 0.16 + 0.16 * R()
  // two nebula inks, kept to the cold half of the spectrum: on this rainbow
  // (0 red · ⅙ magenta · ⅓ blue · ½ cyan · ⅔ green) that's rose → violet → cyan
  const h1 = 0.1 + L.hue * 0.26
  const h2 = Math.min(0.52, h1 + 0.1 + R() * 0.12)
  const o = Array.from({ length: 12 }, () => R() * 60)
  const bandAt = (X: number, Y: number) => {
    const dd = -(X - e.cx) * Math.sin(gb) + (Y - e.cy) * Math.cos(gb) - bo
    return Math.exp(-(dd * dd) / (2 * bw * bw))
  }
  const c = new Float32Array(3)
  // 0 · space: indigo smoke, the galactic band and its dark dust lanes
  await soft(l, 0, 0.5, (X, Y, out) => {
    const bi = bandAt(X, Y)
    const smoke = fbm(X * 2.4 + o[0], Y * 2.4 + o[1], 4)
    const lane = smooth(0.5, 0.66, fbm(X * 5.5 + o[2], Y * 5.5 + o[3], 3))
    const t = fbm(X * 1.1 + o[10], Y * 1.1 + o[11], 2)
    hsv(0.64 + (t - 0.5) * 0.18, 0.78, 0.55, c)
    const glow = (0.1 + 0.72 * bi) * smoke ** 1.5 * (1 - 0.8 * lane * bi)
    out[0] = 0.008 + c[0] * glow
    out[1] = 0.01 + c[1] * glow
    out[2] = 0.035 + c[2] * glow
  })
  // 1 · nebula: two-tone clouds that drift with the view
  await soft(l, 1, 0.5, (X, Y, out) => {
    const bi = bandAt(X, Y)
    const wx = fbm(X * 1.2 + o[4], Y * 1.2 + o[5], 3)
    const wy = fbm(X * 1.2 + o[6], Y * 1.2 + o[7], 3)
    const n = fbm(X * 1.9 + 2.6 * wx + o[8], Y * 1.9 + 2.6 * wy + o[9], 4)
    const m = smooth(0.44, 0.8, n) * (0.22 + 0.78 * bi)
    const t = smooth(0.35, 0.65, fbm(X * 0.9 + o[10], Y * 0.9 + o[11], 2))
    spectral(h1 + (h2 - h1) * t + (n - 0.5) * 0.1, c)
    vivid(c, 1.7)
    const core = smooth(0.7, 0.9, n) * 0.35
    out[0] = c[0] + core
    out[1] = c[1] + core
    out[2] = c[2] + core
    out[3] = m * 0.85
  })
  const sample = () => {
    // stars crowd the band
    for (let k = 0; k < 8; k++) {
      const X = e.x0 + R() * (e.x1 - e.x0)
      const Y = e.y0 + R() * (e.y1 - e.y0)
      if (R() < 0.25 + 0.75 * bandAt(X, Y)) return [X, Y]
    }
    return [e.x0 + R() * (e.x1 - e.x0), e.y0 + R() * (e.y1 - e.y0)]
  }
  // dust, on the ground: a few inks × a few strengths, one fill each
  const dust = Math.round((1600 + 2200 * L.density) * 1.44)
  const px = 1 / l.u
  const DUST = ['#ffffff', '#b9c8ff', '#ffd0ee']
  const grains = DUST.map(() => [0, 1, 2, 3].map(() => new Path2D()))
  for (let i = 0; i < dust; i++) {
    const [X, Y] = sample()
    const ink = R() < 0.72 ? 0 : R() < 0.5 ? 1 : 2
    const lvl = Math.min(3, Math.floor(R() ** 2 * 4))
    const s = px * (R() < 0.8 ? 1 : 1.7)
    grains[ink][lvl].rect(X, Y, s, s)
  }
  inTile(l, 0, (x) => {
    grains.forEach((byLvl, ink) =>
      byLvl.forEach((path, lvl) => {
        x.globalAlpha = 0.3 + lvl * 0.2
        x.fillStyle = DUST[ink]
        x.fill(path)
      }),
    )
  })
  await breathe()
  // 2–4 · stars, three glint groups: a soft glow and a hard core, stamped from a few sprites
  const stars = Math.round((80 + 170 * L.density) * 1.44)
  const tints = ['#ffffff', '#ffffff', '#ffffff', '#dfe8ff', '#fff1d6', '#cfe0ff', '#ffd6f4', hex(spectral(h1, c)), hex(spectral(h2, c))]
  const sprites = tints.map(starSprite)
  type Star = { X: number; Y: number; b: number; r: number; t: number; cross: boolean }
  const byGroup: Star[][] = [[], [], []]
  for (let i = 0; i < stars; i++) {
    const g = Math.floor(R() * 3)
    const [X, Y] = sample()
    const b = 0.6 + 0.4 * R() ** 2
    const r = Math.max(1.1 * px, (0.0028 + 0.0075 * R() ** 3) * Math.max(1, 1.3 / (l.u * 0.004)))
    const t = R() < 0.2 ? 7 + Math.floor(R() * 2) : Math.floor(R() * 7)
    byGroup[g].push({ X, Y, b, r, t, cross: R() < 0.34 })
  }
  byGroup.forEach((list, g) =>
    inTile(l, 2 + g, (x) => {
      for (const s of list) {
        const R3 = s.r * 3.4
        x.globalAlpha = s.b
        x.drawImage(sprites[s.t], s.X - R3, s.Y - R3, 2 * R3, 2 * R3)
        if (s.cross) {
          x.globalAlpha = 0.7 * s.b
          x.fillStyle = tints[s.t]
          x.fillRect(s.X - s.r * 5, s.Y - px * 0.35, s.r * 10, px * 0.7)
          x.fillRect(s.X - px * 0.35, s.Y - s.r * 5, px * 0.7, s.r * 10)
        }
      }
    }),
  )
  await breathe()
  // 5 · a few four-point flares
  const flares = 2 + Math.round(4 * L.density)
  for (let i = 0; i < flares; i++) {
    const [X, Y] = sample()
    const S = 0.035 + 0.05 * R()
    const rot = L.angle + (R() < 0.5 ? 0 : Math.PI / 4)
    const col = hex(spectral(L.hue + R() * 0.6, c))
    inTile(l, 5, (x) => {
      x.translate(X, Y)
      x.rotate(rot)
      const halo = x.createRadialGradient(0, 0, 0, 0, 0, S * 0.42)
      halo.addColorStop(0, 'rgba(255,255,255,0.95)')
      halo.addColorStop(0.3, rgba(col, 0.45))
      halo.addColorStop(1, rgba(col, 0))
      x.fillStyle = halo
      x.beginPath()
      x.arc(0, 0, S * 0.42, 0, TAU)
      x.fill()
      const spike = (len: number, wid: number) => {
        const g = x.createLinearGradient(0, 0, len, 0)
        g.addColorStop(0, 'rgba(255,255,255,1)')
        g.addColorStop(0.35, rgba(col, 0.9))
        g.addColorStop(1, rgba(col, 0))
        x.fillStyle = g
        x.beginPath()
        x.moveTo(0, -wid)
        x.lineTo(len, 0)
        x.lineTo(0, wid)
        x.closePath()
        x.fill()
      }
      for (let k = 0; k < 4; k++) {
        spike(S, S * 0.05)
        x.rotate(Math.PI / 4)
        spike(S * 0.38, S * 0.03)
        x.rotate(Math.PI / 4)
      }
    })
  }
}

const spriteCache = new Map<string, HTMLCanvasElement>()

/** A star to stamp: a white core, a glow in its tint (drawn once per tint). */
function starSprite(tint: string): HTMLCanvasElement {
  let c = spriteCache.get(tint)
  if (!c) {
    const S = 48
    c = mk(S, S)
    const x = ctx2d(c)
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.2, 'rgba(255,255,255,1)')
    g.addColorStop(0.27, rgba(tint, 0.7))
    g.addColorStop(0.5, rgba(tint, 0.2))
    g.addColorStop(1, rgba(tint, 0))
    x.fillStyle = g
    x.fillRect(0, 0, S, S)
    spriteCache.set(tint, c)
  }
  return c
}

// ── hielo ───────────────────────────────────────────────────────────────────

async function hielo(l: Lam) {
  const { L, R } = l
  const e = extent(l)
  const d = l.img.data
  const n = 4 + L.density * 4
  const cs = 1 / n
  const gx0 = Math.floor(e.x0 / cs) - 1
  const gy0 = Math.floor(e.y0 / cs) - 1
  const gw = Math.ceil(e.x1 / cs) + 2 - gx0
  const gh = Math.ceil(e.y1 / cs) + 2 - gy0
  const cells = gw * gh
  const sx = new Float32Array(cells)
  const sy = new Float32Array(cells)
  const tint = new Float32Array(cells)
  const sat = new Float32Array(cells)
  const bright = new Float32Array(cells)
  const dirX = new Float32Array(cells)
  const dirY = new Float32Array(cells)
  const group = new Uint8Array(cells)
  const flash = new Float32Array(cells)
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const k = j * gw + i
      sx[k] = (gx0 + i + 0.5 + (R() - 0.5) * 0.92) * cs
      sy[k] = (gy0 + j + 0.5 + (R() - 0.5) * 0.92) * cs
      tint[k] = L.hue + (R() - 0.5) * 0.6
      sat[k] = 0.16 + 0.44 * R() ** 1.5
      // most shards catch the room; one in eight faces away and holds the dark
      bright[k] = R() < 0.12 ? 0.36 + 0.14 * R() : 0.64 + 0.4 * R()
      const a = R() * TAU
      dirX[k] = Math.cos(a)
      dirY[k] = Math.sin(a)
      group[k] = Math.floor(R() * 6)
      flash[k] = L.hue + R()
    }
  const cw = 0.0032 * Math.max(1, 1 / (l.u * 0.0032))
  const c = new Float32Array(3)
  const stride = l.img.width
  const fo = R() * 50
  for (let py = 0; py < l.TH; py++) {
    for (let px = 0; px < l.TW; px++) {
      const [X, Y] = su(l, px, py)
      const ci = Math.floor(X / cs) - gx0
      const cj = Math.floor(Y / cs) - gy0
      let b1 = -1
      let b2 = -1
      let d1 = Infinity
      let d2 = Infinity
      for (let jj = cj - 1; jj <= cj + 1; jj++) {
        if (jj < 0 || jj >= gh) continue
        for (let ii = ci - 1; ii <= ci + 1; ii++) {
          if (ii < 0 || ii >= gw) continue
          const k = jj * gw + ii
          const dx = X - sx[k]
          const dy = Y - sy[k]
          const dd = dx * dx + dy * dy
          if (dd < d1) {
            d2 = d1
            b2 = b1
            d1 = dd
            b1 = k
          } else if (dd < d2) {
            d2 = dd
            b2 = k
          }
        }
      }
      if (b1 < 0) continue
      let edge = 1
      if (b2 >= 0) {
        const len = Math.hypot(sx[b2] - sx[b1], sy[b2] - sy[b1]) || 1
        edge = (d2 - d1) / (2 * len)
      }
      const kk = edge / cw
      const crack = 1 - smooth(0, 1, kk)
      const shoulder = 1 - smooth(1, 3.2, kk)
      const local = ((X - sx[b1]) * dirX[b1] + (Y - sy[b1]) * dirY[b1]) / cs
      spectral(tint[b1], c)
      const s = sat[b1]
      // a flat mirror: one gradient across it, a bevel where it broke (lit one side, dark the other)
      const bevel = shoulder * (local > 0 ? 0.2 : -0.24)
      const frost = (vnoise(X * 40 + fo, Y * 40) - 0.5) * 0.08
      const base = bright[b1] + 0.16 * local + bevel + frost
      const glint = hash3(px, py, 91) > 0.992 - shoulder * 0.02 ? 0.35 : 0
      const r0 = (0.86 + (c[0] - 0.86) * s) * base + glint
      const g0 = (0.9 + (c[1] - 0.9) * s) * base + glint
      const bl0 = (0.96 + (c[2] - 0.96) * s) * base + glint
      const o = (py * stride + px) * 4
      set(d, o, r0 + (1 - r0) * crack * 0.92, g0 + (1 - g0) * crack * 0.92, bl0 + (1 - bl0) * crack * 0.92)
      // the flash of this shard, in its group's tile
      const t = 1 + group[b1]
      if (t < l.T) {
        spectral(flash[b1] + local * 0.22, c)
        vivid(c, 1.55)
        const hot = 0.5 + 0.5 * smooth(-1, 1, local)
        const white = 0.4 * smooth(0.35, 1, local)
        set(d, (py * stride + t * l.TW + px) * 4, c[0] * hot + white, c[1] * hot + white, c[2] * hot + white, 1 - crack)
      }
    }
    if ((py & 7) === 7) await breathe()
  }
  l.x.putImageData(l.img, 0, 0)
  // fractures: thin white lines running into some shards
  inTile(l, 0, (x) => {
    x.strokeStyle = 'rgba(255,255,255,0.6)'
    x.lineWidth = 0.7 / l.u
    x.lineCap = 'round'
    for (let k = 0; k < cells; k++) {
      if (R() > 0.42) continue
      const a = R() * TAU
      const len = cs * (0.25 + 0.45 * R())
      x.beginPath()
      x.moveTo(sx[k] + Math.cos(a) * cs * 0.15, sy[k] + Math.sin(a) * cs * 0.15)
      const bend = a + (R() - 0.5) * 0.6
      x.lineTo(sx[k] + Math.cos(bend) * len, sy[k] + Math.sin(bend) * len)
      x.stroke()
    }
  })
}

// ── diamante ────────────────────────────────────────────────────────────────

/** Face normals in the lattice's own frame: N, E, S, W. */
const FACE_N: ReadonlyArray<[number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

async function diamante(l: Lam) {
  const { L } = l
  const d = l.img.data
  const ca = Math.cos(L.angle)
  const sn = Math.sin(L.angle)
  const P = 0.078 * L.scale
  const light = [-0.55, -0.83]
  const lit = FACE_N.map(([nx, ny]) => {
    const x = nx * ca - ny * sn
    const y = nx * sn + ny * ca
    return 0.74 + 0.3 * (x * light[0] + y * light[1])
  })
  const c = new Float32Array(3)
  const stride = l.img.width
  const line = Math.max(0.03, 1.1 / (P * l.u))
  for (let py = 0; py < l.TH; py++) {
    if ((py & 7) === 7) await breathe()
    for (let px = 0; px < l.TW; px++) {
      const [X, Y] = su(l, px, py)
      const xr = (X * ca + Y * sn) / P
      const yr = (-X * sn + Y * ca) / P
      const ix = Math.floor(xr)
      const iy = Math.floor(yr)
      const fx = xr - ix - 0.5
      const fy = yr - iy - 0.5
      const ax = Math.abs(fx)
      const ay = Math.abs(fy)
      const face = ax > ay ? (fx > 0 ? 1 : 3) : fy > 0 ? 2 : 0
      const dr = Math.abs(ax - ay)
      const db = 0.5 - Math.max(ax, ay)
      const hue = L.hue + 0.2 * (X * 0.8 + Y * 0.6) + 0.07 * face + 0.04 * hash3(ix, iy, 5)
      spectral(hue, c)
      vivid(c, 1.35)
      const s = lit[face] * (0.88 + 0.28 * db)
      const ridge = (1 - smooth(0, line, dr)) * 0.3
      const groove = 0.62 + 0.38 * smooth(0, line * 0.9, db)
      // a point of light on some apexes (the lattice's own sparkle)
      const apex = Math.max(ax, ay) < line * 1.4 ? (hash3(ix, iy, 17) < 0.3 ? 0.55 : 0.2) : 0
      const mixAmt = 0.5
      const o = (py * stride + px) * 4
      set(
        d,
        o,
        ((0.86 + (c[0] - 0.86) * mixAmt) * s + ridge + apex) * groove,
        ((0.87 + (c[1] - 0.87) * mixAmt) * s + ridge + apex) * groove,
        ((0.9 + (c[2] - 0.9) * mixAmt) * s + ridge + apex) * groove,
      )
      const t = 1 + face
      if (t < l.T) {
        spectral(hue + 0.12 + 0.35 * (1 - db * 2), c)
        vivid(c, 1.45)
        const w = 0.55 * smooth(0.25, 0.5, db)
        const a = smooth(line * 0.4, line * 1.1, dr) * smooth(line * 0.3, line, db)
        set(d, (py * stride + t * l.TW + px) * 4, c[0] + w, c[1] + w, c[2] + w, a)
      }
    }
  }
  l.x.putImageData(l.img, 0, 0)
}

// ── láser ───────────────────────────────────────────────────────────────────

async function laser(l: Lam) {
  const { L, R } = l
  const d = l.img.data
  const Cx = L.cx * l.sa
  const Cy = L.cy / l.sa
  const pitch = 0.0095 * L.scale
  const spokes = 40 + Math.floor(R() * 40)
  const rest = Math.atan2(REST[1], REST[0])
  const c = new Float32Array(3)
  await each(l, 0, (X, Y, o) => {
    const dx = X - Cx
    const dy = Y - Cy
    const r = Math.hypot(dx, dy)
    const th = Math.atan2(dy, dx)
    const ring = 0.5 + 0.5 * Math.cos((TAU * r) / pitch)
    const spk = 0.5 + 0.5 * Math.cos(th * spokes)
    const arm = Math.abs(Math.cos(th - rest)) ** 5
    spectral(L.hue + r * 1.4 + (th / Math.PI) * 0.08, c)
    vivid(c, 1.45)
    const silver = 0.78 + 0.1 * ring - 0.06 * spk
    const k = Math.min(1, arm * 1.05)
    const lum = 0.85 + 0.35 * ring
    set(d, o, silver + (c[0] * lum - silver) * k, silver + (c[1] * lum - silver) * k, silver + (c[2] * lum - silver) * k)
  })
  await each(l, 1, (X, Y, o) => {
    const dx = X - Cx
    const dy = Y - Cy
    const r = Math.hypot(dx, dy)
    const th = Math.atan2(dy, dx)
    const ring = 0.5 + 0.5 * Math.cos((TAU * r) / pitch)
    spectral(L.hue + r * 1.4 + (th / Math.PI) * 0.08, c)
    vivid(c, 1.45)
    const k = 0.5 + 0.7 * ring * ring
    const w = 0.25 * ring ** 8
    set(d, o, c[0] * k + w, c[1] * k + w, c[2] * k + w)
  })
  l.x.putImageData(l.img, 0, 0)
}

// ── aceite ──────────────────────────────────────────────────────────────────

async function aceite(l: Lam) {
  const { L, R } = l
  const o = Array.from({ length: 8 }, () => R() * 60)
  const c = new Float32Array(3)
  const field = (X: number, Y: number) => {
    const qx = fbm(X * 1.3 + o[0], Y * 1.3 + o[1], 3)
    const qy = fbm(X * 1.3 + o[2], Y * 1.3 + o[3], 3)
    const rx = fbm(X * 1.7 + 3.2 * qx + o[4], Y * 1.7 + 3.2 * qy + o[5], 3)
    const ry = fbm(X * 1.7 + 3.2 * qx + o[6], Y * 1.7 + 3.2 * qy + o[7], 3)
    return fbm(X * 2 + 2.8 * rx, Y * 2 + 2.8 * ry, 4)
  }
  const paint = (t: number, shift: number) =>
    soft(l, t, 0.5, (X, Y, out) => {
      const th = 0.16 + 1.05 * field(X, Y) + L.hue * 0.4 + shift
      film(th, c)
      out[0] = c[0]
      out[1] = c[1]
      out[2] = c[2]
    })
  await paint(0, 0)
  await paint(1, 0.15)
}

/** Thin-film interference: reflected colour of an oil film `d` µm thick (optical). */
function film(d: number, out: Float32Array) {
  const r = 0.5 - 0.5 * Math.cos((TAU * 2 * d) / 0.65)
  const g = 0.5 - 0.5 * Math.cos((TAU * 2 * d) / 0.53)
  const b = 0.5 - 0.5 * Math.cos((TAU * 2 * d) / 0.45)
  const m = (r + g + b) / 3
  // thin films fade toward bronze-dark; thick ones wash toward white
  const k = 1.5
  const fade = smooth(0.1, 0.35, d)
  out[0] = 0.08 + 0.92 * (m + (r - m) * k) * fade + (1 - fade) * 0.25
  out[1] = 0.06 + 0.92 * (m + (g - m) * k) * fade + (1 - fade) * 0.18
  out[2] = 0.08 + 0.92 * (m + (b - m) * k) * fade + (1 - fade) * 0.12
}

// ── escamas ─────────────────────────────────────────────────────────────────

async function escamas(l: Lam) {
  const { L, R } = l
  const e = extent(l)
  const r = 0.05 * L.scale
  const sx = r * 1.55
  const sy = r * 0.8
  const c = new Float32Array(3)
  type Scale = { x: number; y: number; hue: number; g: number }
  const scales: Scale[] = []
  let j = 0
  for (let y = e.y0 - r; y < e.y1 + r; y += sy, j++) {
    const off = (j % 2) * sx * 0.5
    for (let x = e.x0 - r + off; x < e.x1 + r; x += sx) {
      const jit = R() < 0.18 ? (R() < 0.5 ? -1 : 1) : 0
      scales.push({ x: x + (R() - 0.5) * r * 0.12, y: y + (R() - 0.5) * r * 0.12, hue: L.hue + j * 0.045 + (R() - 0.5) * 0.06, g: (((j + jit) % 4) + 4) % 4 })
    }
  }
  // 0 · every scale, rows on top of the rows above
  inTile(l, 0, (x) => {
    x.fillStyle = '#6d7480'
    x.fillRect(e.x0, e.y0, e.x1 - e.x0, e.y1 - e.y0)
    for (const s of scales) {
      spectral(s.hue, c)
      vivid(c, 1.2)
      const g = x.createRadialGradient(s.x - r * 0.25, s.y - r * 0.45, r * 0.05, s.x, s.y, r * 1.25)
      g.addColorStop(0, `rgb(${mixByte(c, 1, 0.55)})`)
      g.addColorStop(0.55, `rgb(${mixByte(c, 0.82, 0.3)})`)
      g.addColorStop(1, `rgb(${mixByte(c, 0.3, 0)})`)
      x.fillStyle = g
      x.beginPath()
      x.arc(s.x, s.y, r, 0, TAU)
      x.fill()
      x.strokeStyle = 'rgba(0,0,0,0.3)'
      x.lineWidth = r * 0.09
      x.beginPath()
      x.arc(s.x, s.y, r * 0.95, 0.15 * Math.PI, 0.85 * Math.PI)
      x.stroke()
      x.fillStyle = 'rgba(255,255,255,0.5)'
      x.beginPath()
      x.ellipse(s.x - r * 0.3, s.y - r * 0.5, r * 0.28, r * 0.12, -0.4, 0, TAU)
      x.fill()
    }
  })
  // 1–4 · the rows of each group, lit (the rest occlude them where they overlap)
  for (let g = 0; g < 4; g++) {
    await breathe()
    inTile(l, 1 + g, (x) => {
      for (const s of scales) {
        x.beginPath()
        x.arc(s.x, s.y, r, 0, TAU)
        if (s.g !== g) {
          x.globalCompositeOperation = 'destination-out'
          x.fillStyle = '#000'
          x.fill()
          x.globalCompositeOperation = 'source-over'
          continue
        }
        spectral(s.hue + 0.18, c)
        vivid(c, 1.6)
        const gr = x.createRadialGradient(s.x - r * 0.2, s.y - r * 0.35, 0, s.x, s.y, r)
        gr.addColorStop(0, 'rgba(255,255,255,1)')
        gr.addColorStop(0.35, `rgb(${mixByte(c, 1, 0.25)})`)
        gr.addColorStop(1, `rgb(${mixByte(c, 0.75, 0)})`)
        x.fillStyle = gr
        x.fill()
      }
    })
  }
}

// ── motivo ──────────────────────────────────────────────────────────────────

async function motivo(l: Lam, code: string) {
  const { L } = l
  const d = l.img.data
  // the motifs, struck on their own mask
  const mc = mk(l.TW, l.TH)
  const mx = ctx2d(mc, true)
  const e = extent(l)
  // in pixels (text at a real size): sticker units → tile pixels
  const P = (X: number) => X * l.u + BLEED * l.W
  const Q = (Y: number) => Y * l.u + BLEED * l.H
  const pm = (L.motif === 2 ? 0.26 : 0.19) * (0.8 + 0.2 * L.scale)
  const k = pm * l.u
  mx.fillStyle = '#fff'
  mx.strokeStyle = '#fff'
  const mono = L.motif === 2 ? await monoFamily() : ''
  if (mono) {
    mx.font = `700 ${Math.max(6, k * 0.2).toFixed(2)}px ${mono}`
    mx.textAlign = 'center'
    mx.textBaseline = 'middle'
  }
  let row = 0
  for (let y = e.y0 - pm; y < e.y1 + pm; y += pm * (L.motif === 2 ? 0.34 : 0.87), row++) {
    const off = (row % 2) * pm * 0.5
    for (let x = e.x0 - pm + off; x < e.x1 + pm; x += pm) {
      const cx = P(x)
      const cy = Q(y)
      if (L.motif === 0) {
        mx.lineWidth = Math.max(1, k * 0.07)
        mx.beginPath()
        mx.arc(cx, cy, k * 0.24, 0, TAU)
        mx.moveTo(cx - k * 0.38, cy)
        mx.lineTo(cx + k * 0.38, cy)
        mx.moveTo(cx, cy - k * 0.38)
        mx.lineTo(cx, cy + k * 0.38)
        mx.stroke()
      } else if (L.motif === 1) {
        mx.beginPath()
        for (let s = 0; s < 8; s++) {
          const a = (s / 8) * TAU - Math.PI / 2
          const rr = s % 2 ? k * 0.08 : k * 0.34
          if (s === 0) mx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a))
          else mx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a))
        }
        mx.closePath()
        mx.fill()
      } else mx.fillText(code, cx, cy, k * 0.92)
    }
  }
  const m = mx.getImageData(0, 0, l.TW, l.TH).data
  const ca = Math.cos(L.angle)
  const sn = Math.sin(L.angle)
  const pitch = 0.0095 * L.scale
  const band = 0.3 * L.scale
  const c = new Float32Array(3)
  const c2 = new Float32Array(3)
  await each(l, 0, (X, Y, o, px, py) => {
    const a = m[(py * l.TW + px) * 4 + 3] / 255
    const u = X * ca + Y * sn
    const v = -X * sn + Y * ca
    const g1 = 0.5 + 0.5 * Math.cos((TAU * u) / pitch)
    const g2 = 0.5 + 0.5 * Math.cos((TAU * v) / pitch)
    spectral(u / band + L.hue, c)
    vivid(c, 1.2)
    spectral(v / band + L.hue + 0.5, c2)
    vivid(c2, 1.4)
    const gl = 0.86 + 0.18 * g1
    const ml = 0.92 + 0.2 * g2
    const edge = a * (1 - a) * 4
    const k = 1 - 0.3 * edge
    set(
      d,
      o,
      ((0.8 + (c[0] - 0.8) * 0.5) * gl * (1 - a) + (0.9 + (c2[0] - 0.9) * 0.72) * ml * a) * k,
      ((0.8 + (c[1] - 0.8) * 0.5) * gl * (1 - a) + (0.9 + (c2[1] - 0.9) * 0.72) * ml * a) * k,
      ((0.82 + (c[2] - 0.82) * 0.5) * gl * (1 - a) + (0.92 + (c2[2] - 0.92) * 0.72) * ml * a) * k,
    )
  })
  await each(l, 1, (X, Y, o, px, py) => {
    const a = m[(py * l.TW + px) * 4 + 3] / 255
    const v = -X * sn + Y * ca
    spectral(v / band + L.hue + 0.75, c)
    vivid(c, 1.6)
    set(d, o, c[0] + 0.15, c[1] + 0.15, c[2] + 0.15, a)
  })
  l.x.putImageData(l.img, 0, 0)
}

let monoP: Promise<string> | null = null

function monoFamily(): Promise<string> {
  if (!monoP)
    monoP = (async () => {
      let fam = 'ui-monospace, monospace'
      try {
        const probe = document.createElement('span')
        probe.style.display = 'none'
        probe.style.fontFamily = 'var(--font-mono)'
        document.body.appendChild(probe)
        fam = getComputedStyle(probe).fontFamily || fam
        probe.remove()
        await document.fonts.load(`700 20px ${fam}`, 'FR·0123')
      } catch {
        /* the fallback face */
      }
      return fam
    })()
  return monoP
}

// ── brillo ──────────────────────────────────────────────────────────────────

async function brillo(l: Lam) {
  const { L, R } = l
  const e = extent(l)
  const c = new Float32Array(3)
  const n = Math.round((5600 + 5200 * L.density) * 1.44)
  // the inks glitter comes in (bright and dark silver, pastel and pure colour), and the colours flakes flash
  const inks: string[] = []
  for (let i = 0; i < 6; i++) {
    const v = 175 + i * 16
    inks.push(`rgb(${v},${Math.min(255, v + 3)},${Math.min(255, v + 8)})`)
  }
  for (let i = 0; i < 4; i++) {
    const v = 95 + i * 18
    inks.push(`rgb(${v},${v + 4},${v + 10})`)
  }
  for (let i = 0; i < 8; i++) inks.push(`rgb(${mixByte(spectral(L.hue + (i / 8) * 0.7, c), 0.95, 0.35)})`)
  for (let i = 0; i < 6; i++) inks.push(`rgb(${mixByte(vividC(spectral(L.hue + i / 6, c), 1.6), 0.9, 0)})`)
  const lit: string[] = []
  for (let i = 0; i < 8; i++) lit.push(`rgb(${mixByte(vividC(spectral(L.hue + (i / 8) * 0.8, c), 1.5), 1, 0.6)})`)
  // every flake goes into its ink's path: a few dozen fills instead of thousands
  const base = inks.map(() => new Path2D())
  const groups = [0, 1, 2, 3].map(() => lit.map(() => new Path2D()))
  const crosses = [0, 1, 2, 3].map(() => new Path2D())
  const min = 0.8 / l.u
  const poly = (p: Path2D, x: number, y: number, s: number, a: number, hexa: boolean) => {
    const sides = hexa ? 6 : 4
    const r = hexa ? s : s * Math.SQRT2
    for (let i = 0; i < sides; i++) {
      const t = a + (i / sides) * TAU + (hexa ? 0 : Math.PI / 4)
      if (i === 0) p.moveTo(x + Math.cos(t) * r, y + Math.sin(t) * r)
      else p.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r)
    }
    p.closePath()
  }
  for (let i = 0; i < n; i++) {
    const s = Math.max(min, (0.0021 + 0.0052 * R() ** 2.4) * L.scale)
    // mostly silver: colour is the sparkle, not the ground
    const kind = R()
    const ink = kind < 0.5 ? Math.floor(R() * 6) : kind < 0.8 ? 6 + Math.floor(R() * 4) : kind < 0.96 ? 10 + Math.floor(R() * 8) : 18 + Math.floor(R() * 6)
    const x = e.x0 + R() * (e.x1 - e.x0)
    const y = e.y0 + R() * (e.y1 - e.y0)
    const a = R() * Math.PI
    const hexa = R() < 0.6
    poly(base[ink], x, y, s, a, hexa)
    const g = R() < 0.62 ? Math.floor(R() * 4) : -1
    if (g < 0) continue
    poly(groups[g][Math.floor(R() * lit.length)], x, y, s * 1.08, a, hexa)
    if (s > 0.0058 * L.scale) {
      crosses[g].rect(x - s * 2.6, y - s * 0.14, s * 5.2, s * 0.28)
      crosses[g].rect(x - s * 0.14, y - s * 2.6, s * 0.28, s * 5.2)
    }
  }
  inTile(l, 0, (x) => {
    const g = x.createLinearGradient(e.x0, e.y0, e.x1, e.y1)
    g.addColorStop(0, '#8e959f')
    g.addColorStop(0.5, '#b9bec6')
    g.addColorStop(1, '#7d848e')
    x.fillStyle = g
    x.fillRect(e.x0, e.y0, e.x1 - e.x0, e.y1 - e.y0)
    base.forEach((p, i) => {
      x.fillStyle = inks[i]
      x.fill(p)
    })
  })
  await breathe()
  for (let g = 0; g < 4; g++)
    inTile(l, 1 + g, (x) => {
      groups[g].forEach((p, i) => {
        x.fillStyle = lit[i]
        x.fill(p)
      })
      x.fillStyle = 'rgba(255,255,255,0.9)'
      x.fill(crosses[g])
    })
}

// ── metal ───────────────────────────────────────────────────────────────────

const METAL_TINT: Record<string, { dark: [number, number, number]; light: [number, number, number] }> = {
  oro: { dark: [0.42, 0.28, 0.07], light: [1, 0.9, 0.58] },
  plata: { dark: [0.44, 0.47, 0.52], light: [0.98, 0.99, 1] },
  cobre: { dark: [0.4, 0.18, 0.1], light: [1, 0.77, 0.63] },
  grafito: { dark: [0.1, 0.11, 0.12], light: [0.64, 0.67, 0.72] },
}

async function metal(l: Lam, which: string) {
  const { L, R } = l
  const d = l.img.data
  const tint = METAL_TINT[which] ?? METAL_TINT.plata
  const ca = Math.cos(L.angle)
  const sn = Math.sin(L.angle)
  const o1 = R() * 100
  const o2 = R() * 100
  const fine = 380 / Math.max(0.7, L.scale)
  await each(l, 0, (X, Y, o) => {
    const along = X * ca + Y * sn
    const across = -X * sn + Y * ca
    const hair = vnoise(across * fine + o1, along * 3 + o2) * 0.65 + vnoise(across * fine * 2.7 + o2, along * 7 + o1) * 0.35
    const scratch = hash3(Math.floor(across * fine * 0.35), 7, Math.floor(o1)) > 0.985 ? 0.18 : 0
    const t = along * 0.55 + across * 0.22 + L.hue
    const env = 0.5 + 0.32 * Math.sin(TAU * t * 1.3) + 0.14 * Math.sin(TAU * t * 3.1 + 1.7)
    const k = clamp(env * 0.8 + 0.1 + (hair - 0.5) * 0.3 + scratch, 0, 1)
    set(
      d,
      o,
      tint.dark[0] + (tint.light[0] - tint.dark[0]) * k,
      tint.dark[1] + (tint.light[1] - tint.dark[1]) * k,
      tint.dark[2] + (tint.light[2] - tint.dark[2]) * k,
    )
  })
  await each(l, 1, (X, Y, o) => {
    const along = X * ca + Y * sn
    const across = -X * sn + Y * ca
    const hair = vnoise(across * fine + o1, along * 3 + o2)
    const v = hair ** 3 * 1.5
    set(d, o, 1, 1, 1, v)
  })
  l.x.putImageData(l.img, 0, 0)
}

// ═══ small tools ════════════════════════════════════════════════════════════

function mk(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

function ctx2d(c: HTMLCanvasElement, read = false): CanvasRenderingContext2D {
  const x = c.getContext('2d', read ? { willReadFrequently: true } : undefined)
  if (!x) throw new Error('2d context unavailable')
  return x
}

/** The art's pixels (a copy: the shared canvas is never drawn on). */
function pixels(art: HTMLCanvasElement): Uint8ClampedArray {
  const c = mk(art.width, art.height)
  const x = ctx2d(c, true)
  x.drawImage(art, 0, 0)
  return x.getImageData(0, 0, c.width, c.height).data
}

function encode(c: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    try {
      c.toBlob(
        (b) => {
          const u = b ? URL.createObjectURL(b) : ''
          c.width = 0
          c.height = 0
          resolve(u)
        },
        'image/webp',
        0.9,
      )
    } catch {
      resolve('')
    }
  })
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

function angDist(a: number, b: number): number {
  const d = Math.abs(a - b) % TAU
  return d > Math.PI ? TAU - d : d
}

function hashStr(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash3(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function vnoise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash3(ix, iy, 13)
  const b = hash3(ix + 1, iy, 13)
  const c = hash3(ix, iy + 1, 13)
  const d = hash3(ix + 1, iy + 1, 13)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

function fbm(x: number, y: number, oct = 4): number {
  let a = 0.5
  let s = 0
  let n = 0
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x, y)
    n += a
    x = x * 2.03 + 17.1
    y = y * 2.03 + 3.7
    a *= 0.5
  }
  return s / n
}

/** The 3D foils' cosine rainbow (glsl.ts SPECTRAL), so both renderers share a spectrum. */
function spectral(p: number, out: Float32Array): Float32Array {
  const t = TAU * p
  out[0] = 0.52 + 0.48 * Math.cos(t)
  out[1] = 0.52 + 0.48 * Math.cos(t + TAU * 0.33)
  out[2] = 0.52 + 0.48 * Math.cos(t + TAU * 0.67)
  return out
}

/** Push a colour away from its grey (foil colours are purer than the cosine rainbow). */
function vivid(c: Float32Array, k: number) {
  const m = (c[0] + c[1] + c[2]) / 3
  c[0] = m + (c[0] - m) * k
  c[1] = m + (c[1] - m) * k
  c[2] = m + (c[2] - m) * k
}

function vividC(c: Float32Array, k: number): Float32Array {
  vivid(c, k)
  return c
}

function hsv(h: number, s: number, v: number, out: Float32Array) {
  const hh = ((h % 1) + 1) % 1
  const i = Math.floor(hh * 6)
  const f = hh * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  const m = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i % 6]
  out[0] = m[0]
  out[1] = m[1]
  out[2] = m[2]
}

/** "r,g,b" bytes of `c` scaled by k and pushed toward white by w. */
function mixByte(c: Float32Array, k: number, w: number): string {
  const f = (v: number) => Math.round(clamp(v * k + (1 - v * k) * w, 0, 1) * 255)
  return `${f(c[0])},${f(c[1])},${f(c[2])}`
}

function hex(c: Float32Array): string {
  const f = (v: number) =>
    Math.round(clamp(v, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${f(c[0])}${f(c[1])}${f(c[2])}`
}

function rgba(hexColor: string, a: number): string {
  const h = hexColor.replace('#', '')
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`
}

/** Separable box blur, `passes` times (≈ gaussian), radius in pixels. */
async function blur(src: Float32Array, W: number, H: number, radius: number, passes: number): Promise<Float32Array> {
  const r = Math.max(1, Math.round(radius))
  let a = Float32Array.from(src)
  let b = new Float32Array(src.length)
  const inv = 1 / (2 * r + 1)
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) {
      let acc = 0
      const row = y * W
      for (let k = -r; k <= r; k++) acc += a[row + clamp(k, 0, W - 1)]
      for (let x = 0; x < W; x++) {
        b[row + x] = acc * inv
        acc += a[row + clamp(x + r + 1, 0, W - 1)] - a[row + clamp(x - r, 0, W - 1)]
      }
    }
    for (let x = 0; x < W; x++) {
      let acc = 0
      for (let k = -r; k <= r; k++) acc += b[clamp(k, 0, H - 1) * W + x]
      for (let y = 0; y < H; y++) {
        a[y * W + x] = acc * inv
        acc += b[clamp(y + r + 1, 0, H - 1) * W + x] - b[clamp(y - r, 0, H - 1) * W + x]
      }
    }
    await breathe()
    const t = a
    a = t
    b = b.fill(0)
  }
  return a
}
