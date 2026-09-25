'use client'

/**
 * CALCOS — the sticker art generator.
 *
 *   stickerArt(def, widthPx, frame?) → Promise<HTMLCanvasElement>
 *     `widthPx` wide, `widthPx / def.aspect` tall, transparent outside the
 *     die-cut, sRGB, same-origin (never tainted), cached per sticker × width
 *     (least-recently-used, 96 kept). The canvas is shared: read it, never
 *     draw on it. Frame 'b' is the lenticular's other picture: the same
 *     die-cut, the franja's livery (frameB).
 *   stickerArtURL(def, widthPx, frame?) → Promise<string>   the same art as
 *     a blob: URL for the DOM (painted apart, the canvas released after
 *     encoding)
 *   materialTexture(material) → Promise<string>      the light tile a
 *     material shows under the pointer (gloss, diffraction, flakes, fibre)
 *   tintaDeFranja(kind)                              a franja's team colour
 *   artWidth(cssPx, dpr)                             the widths the DOM asks for
 *
 * The idiom is a sticker sheet from The Designers Republic / Wipeout /
 * Marathon, printed the TRAMA way: flat saturated inks, big Anybody, Space
 * Mono codes and small print, pictograms, stripes, serials, barcodes. Every
 * sticker is an object — a die-cut in a stock (papel, vinil, holo, brillo,
 * transparente) with its cut edge — never a flat rectangle of UI.
 *
 * Colour is never invented:
 *   · a franja's KIND wears a livery from the LIBREA table (a sello prints
 *     ultramarine, a promotora red, a venue emerald…) — its team colour;
 *   · energy is the ink of swatches, tabs and chips (energySlotHex/energyOn);
 *   · a night's stub wears the evento livery and its flyer's own colours;
 *   · the house prints paper, ink, red and the ramp itself.
 *
 * Forms: `logo` (a contour cut around the franja's mark, computed from the
 * image's alpha or from its flat background), `tipo`, `cinta`, `boleto`,
 * `circulo`, `sello`. `art.seed` and the DESIGN (finish.ts designOf) drive
 * layout, cut and plate choices, so two franjas of the same kind never print
 * the same sticker — and every finish of one design prints the same picture.
 *
 * The stock is only the ground here. Foil stocks (holo, brillo, metal) print
 * on a plain neutral silver: the foil itself is laid out per COPY, over the
 * light areas of this print (finish.ts foilWindow) — by the 3D renderer in
 * GLSL and by the flat UIs in lib/stickers/acabado.ts. Material painters
 * draw from their own random stream, never the layout's.
 *
 * Images: logos are same-origin (/franjas/*); flyers — local or remote — go
 * through /_next/image so the canvas is never tainted. Text waits for the
 * fonts (document.fonts.load) before anything is drawn.
 */

import type { FranjaKind } from '@/lib/types'
import { LIBREA_FORMATO, LIBREA_SECCION, type Librea } from '@/lib/librea'
import { energyFont, energyOn, energySlotHex, SPECTRUM_HEX, VIBE_NAMES } from '@/lib/vibe'
import { designOf } from './finish'
import type { StickerDef, StickerMaterial } from './types'

// ═══ public API ═════════════════════════════════════════════════════════════

const CANVAS_KEEP = 96
const canvases = new Map<string, Promise<HTMLCanvasElement>>()

export function stickerArt(def: StickerDef, widthPx = 512, frame: 'a' | 'b' = 'a'): Promise<HTMLCanvasElement> {
  const w = Math.max(48, Math.min(2048, Math.round(widthPx)))
  const key = `${def.id}@${w}${frame === 'b' ? '#b' : ''}`
  const hit = canvases.get(key)
  if (hit) {
    // least-recently-used: a touch moves it to the back
    canvases.delete(key)
    canvases.set(key, hit)
    return hit
  }
  // Frame 'b' is the lenticular's alternate state (finish.ts): same die-cut.
  const p = frame === 'b' ? stickerArt(def, w, 'a').then((a) => frameB(def, a)) : render(def, w)
  canvases.set(key, p)
  if (canvases.size > CANVAS_KEEP) {
    const oldest = canvases.keys().next().value
    if (oldest !== undefined) canvases.delete(oldest)
  }
  return p
}

/** Widths the DOM asks for, so a handful of sizes serve every surface. */
export function artWidth(cssPx: number, dpr = 1): number {
  const want = cssPx * Math.min(2, Math.max(1, dpr))
  const steps = [192, 256, 384, 512, 768, 1024]
  return steps.find((s) => s >= want) ?? 1024
}

const urls = new Map<string, Promise<string>>()

/**
 * The art as an image URL for the DOM (a blob: URL, same-origin). Painted
 * once per sticker × width; the canvas is released after encoding.
 */
export function stickerArtURL(def: StickerDef, widthPx = 256, frame: 'a' | 'b' = 'a'): Promise<string> {
  const w = Math.max(48, Math.min(2048, Math.round(widthPx)))
  const key = `${def.id}@${w}${frame === 'b' ? '#b' : ''}`
  let p = urls.get(key)
  if (!p) {
    // frame b is drawn over frame a's die-cut: through the shared canvas, copied before encoding
    p = frame === 'b' ? stickerArt(def, w, 'b').then((c) => encode(copyOf(c))) : render(def, w).then(encode)
    urls.set(key, p)
  }
  return p
}

function copyOf(c: HTMLCanvasElement): HTMLCanvasElement {
  const o = mk(c.width, c.height)
  ctx2d(o).drawImage(c, 0, 0)
  return o
}

const textures = new Map<string, Promise<string>>()

/**
 * A tile for the material cue a sticker shows under the light (hover in the
 * DOM): gloss bands for vinil/transparente, diffraction for holo, flakes for
 * brillo, fibres for papel. Transparent PNG/WebP, 256 px.
 */
export function materialTexture(material: StickerMaterial): Promise<string> {
  let p = textures.get(material)
  if (!p) {
    p = Promise.resolve(paintTexture(material)).then(encode)
    textures.set(material, p)
  }
  return p
}

/** A franja's team colour: its kind's livery. Also used by the DOM shelves. */
export function tintaDeFranja(kind: FranjaKind | null | undefined): Tinta {
  return kind ? TEAM[kind] : tinta(LIBREA_FORMATO.franja)
}

// ═══ colour ═════════════════════════════════════════════════════════════════

export interface Tinta {
  color: string
  on: string
  /** Anybody axes of the livery (the "livery setting" for titles). */
  wdth: number
  wght: number
}

const INK = '#111111'
const PAPER = '#edebe3'
const RED = LIBREA_FORMATO.evento.color

const tinta = (l: Librea): Tinta => ({ color: l.color, on: l.on, wdth: l.wdth, wght: l.wght })

const TEAM: Record<FranjaKind, Tinta> = {
  label: tinta(LIBREA_FORMATO.articulo), // ultramarine: a catalog, long breath
  promoter: tinta(LIBREA_FORMATO.evento), // red: nights
  venue: tinta(LIBREA_SECCION.mapa), // emerald: a place on the map
  club: tinta(LIBREA_FORMATO.mix), // cyan
  colectivo: tinta(LIBREA_FORMATO.opinion), // violet: voices
  festival: tinta(LIBREA_FORMATO.listicle), // magenta
  medios: tinta(LIBREA_FORMATO.editorial), // lime: the press
  'mix-series': tinta(LIBREA_FORMATO.review), // yellow
  dealer: tinta(LIBREA_SECCION.puerta), // manila
  plataforma: tinta(LIBREA_FORMATO.franja), // steel
}

/** The catalog prints the kind in Spanish as the first line of a franja's art. */
const KIND_BY_LABEL: Record<string, FranjaKind> = {
  Sello: 'label',
  Promotora: 'promoter',
  Venue: 'venue',
  Dealer: 'dealer',
  Colectivo: 'colectivo',
  Festival: 'festival',
  Club: 'club',
  Medio: 'medios',
  'Serie de mixes': 'mix-series',
  Plataforma: 'plataforma',
}

/** Second plates for overprints: the livery inks. */
const ACCENTS: Tinta[] = [
  tinta(LIBREA_FORMATO.evento),
  tinta(LIBREA_FORMATO.mix),
  tinta(LIBREA_FORMATO.review),
  tinta(LIBREA_FORMATO.editorial),
  tinta(LIBREA_FORMATO.opinion),
  tinta(LIBREA_FORMATO.articulo),
  tinta(LIBREA_FORMATO.listicle),
  tinta(LIBREA_SECCION.mapa),
  tinta(LIBREA_SECCION.puerta),
]

type RGB = [number, number, number]

function hexRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

function rgbHex([r, g, b]: RGB): string {
  const t = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${t(r)}${t(g)}${t(b)}`
}

function relLum([r, g, b]: RGB): number {
  const f = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** Ink or paper — whichever reads better on this ground. */
function onFor(hex: string): string {
  const L = relLum(hexRgb(hex))
  return (L + 0.05) / 0.0556 >= 0.88 / (L + 0.05) ? INK : PAPER
}

function rgbHsv([r, g, b]: RGB): [number, number, number] {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const d = max - min
  let h = 0
  if (d > 0) {
    if (max === R) h = ((G - B) / d) % 6
    else if (max === G) h = (B - R) / d + 2
    else h = (R - G) / d + 4
    h /= 6
    if (h < 0) h += 1
  }
  return [h, max === 0 ? 0 : d / max, max]
}

function hsvRgb(h: number, s: number, v: number): RGB {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
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
  ][((i % 6) + 6) % 6]
  return [m[0] * 255, m[1] * 255, m[2] * 255]
}

function hueDist(a: string, b: string): number {
  const ha = rgbHsv(hexRgb(a))
  const hb = rgbHsv(hexRgb(b))
  const dh = Math.abs(ha[0] - hb[0])
  return Math.min(dh, 1 - dh) * Math.min(ha[1], hb[1]) + Math.abs(ha[2] - hb[2]) * 0.4
}

// ═══ randomness (deterministic) ═════════════════════════════════════════════

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

function pick<T>(R: () => number, arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(R() * arr.length))]
}

// ═══ type ═══════════════════════════════════════════════════════════════════

interface Faces {
  display: string
  mono: string
  ui: string
  /** The canvas honours font-stretch (Anybody's wdth axis). */
  stretch: boolean
}

function cssFamily(token: string, fallback: string): string {
  try {
    const probe = document.createElement('span')
    probe.style.display = 'none'
    probe.style.fontFamily = `var(${token})`
    document.body.appendChild(probe)
    const v = getComputedStyle(probe).fontFamily.trim()
    probe.remove()
    return v || fallback
  } catch {
    return fallback
  }
}

let facesP: Promise<Faces> | null = null

function faces(): Promise<Faces> {
  if (facesP) return facesP
  facesP = (async () => {
    const display = cssFamily('--font-display', '"Arial Narrow", sans-serif')
    const mono = cssFamily('--font-mono', 'ui-monospace, monospace')
    const ui = cssFamily('--font-ui', 'system-ui, sans-serif')
    const probes = [
      `900 40px ${display}`,
      `ultra-condensed 900 40px ${display}`,
      `extra-expanded 500 40px ${display}`,
      `400 20px ${mono}`,
      `700 20px ${mono}`,
      `500 20px ${ui}`,
      `700 20px ${ui}`,
    ]
    try {
      await Promise.race([
        Promise.all(probes.map((f) => document.fonts.load(f, 'GRADIENTE Ñá·0123'))),
        new Promise((r) => setTimeout(r, 3000)),
      ])
    } catch {
      /* draw with what is there */
    }
    let stretch = false
    try {
      const c = document.createElement('canvas').getContext('2d')
      if (c) {
        c.font = `ultra-condensed 500 100px ${display}`
        const a = c.measureText('GRADIENTE').width
        c.font = `extra-expanded 500 100px ${display}`
        const b = c.measureText('GRADIENTE').width
        stretch = b - a > 40
      }
    } catch {
      stretch = false
    }
    return { display, mono, ui, stretch }
  })()
  return facesP
}

interface Type {
  f: 'display' | 'mono' | 'ui'
  w: number
  /** Anybody width axis (50–150). */
  wd?: number
}

const STRETCH: Array<[number, string]> = [
  [50, 'ultra-condensed'],
  [62.5, 'extra-condensed'],
  [75, 'condensed'],
  [87.5, 'semi-condensed'],
  [100, 'normal'],
  [112.5, 'semi-expanded'],
  [125, 'expanded'],
  [150, 'extra-expanded'],
]

function stretchKw(wd: number): string {
  let best = STRETCH[0]
  for (const s of STRETCH) if (Math.abs(s[0] - wd) < Math.abs(best[0] - wd)) best = s
  return best[1]
}

const MONO: Type = { f: 'mono', w: 400 }
const MONO_B: Type = { f: 'mono', w: 700 }
const UI_B: Type = { f: 'ui', w: 700 }

// ═══ the pen ════════════════════════════════════════════════════════════════

interface Pen {
  x: CanvasRenderingContext2D
  W: number
  H: number
  /** Scale against the 512-px reference the layouts were drawn at. */
  s: number
  def: StickerDef
  F: Faces
  /** Layout: keyed by the design, so every finish of it lays out the same. */
  R: () => number
  /** The stock's own grain (fibres, glitter): never drawn from R. */
  M: () => number
  stock: string
  team: Tinta
  accent: Tinta
  energy: Tinta
}

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

/**
 * The ground of each stock. Foil stocks are a light neutral: the foil (per
 * copy) shows wherever the print leaves them bare. The lenticular's lens is a
 * cool clear plastic over white.
 */
const STOCK: Record<StickerMaterial, string> = {
  papel: '#f3efe4',
  vinil: '#fbfbf8',
  holo: '#d9dde3',
  brillo: '#d2d6dd',
  transparente: 'rgba(248,248,242,0.34)',
  metal: '#e4e6ea',
  lenticular: '#f6f8fa',
}

function kindOf(def: StickerDef): FranjaKind | null {
  if (def.source !== 'franja') return null
  return KIND_BY_LABEL[def.art.lines[0] ?? ''] ?? null
}

function pen(c: HTMLCanvasElement, def: StickerDef, F: Faces): Pen {
  const x = ctx2d(c)
  const R = rng(hashStr(`${designOf(def)}:${def.art.seed}`))
  const team =
    def.source === 'franja'
      ? tintaDeFranja(kindOf(def))
      : def.source === 'evento'
        ? tinta(LIBREA_FORMATO.evento)
        : { color: INK, on: PAPER, wdth: 116, wght: 900 }
  const pool = ACCENTS.filter((a) => a.color !== team.color && hueDist(a.color, team.color) > 0.12)
  const accent = pool.length ? pick(R, pool) : { color: INK, on: PAPER, wdth: 100, wght: 900 }
  const e = def.energy
  return {
    x,
    W: c.width,
    H: c.height,
    s: c.width / 512,
    def,
    F,
    R,
    M: rng(hashStr(`${def.id}:stock`)),
    stock: STOCK[def.material],
    team,
    accent,
    energy: { color: energySlotHex(e), on: energyOn(e), wdth: energyFont(e).wdth, wght: energyFont(e).wght },
  }
}

function font(p: Pen, t: Type, px: number) {
  const fam = p.F[t.f]
  const st = t.f === 'display' && p.F.stretch && t.wd !== undefined ? `${stretchKw(t.wd)} ` : ''
  p.x.font = `${st}${t.w} ${Math.max(1, px).toFixed(2)}px ${fam}`
}

/** Without canvas font-stretch, width is carried by a horizontal scale. */
function squeeze(p: Pen, t: Type): number {
  if (t.f !== 'display' || p.F.stretch || t.wd === undefined) return 1
  return Math.max(0.62, Math.min(1.35, t.wd / 100))
}

interface TextOpts {
  t: Type
  px: number
  /** Tracking in px. */
  ls?: number
  align?: 'left' | 'center' | 'right'
  base?: CanvasTextBaseline
  fill?: string
  stroke?: string
  lw?: number
  /** Squeeze horizontally to fit (the condensed-caps gesture). */
  maxW?: number
}

function measure(p: Pen, str: string, o: TextOpts): number {
  font(p, o.t, o.px)
  const x = p.x
  let w: number
  if (o.ls) {
    w = 0
    for (const ch of str) w += x.measureText(ch).width + o.ls
    w -= o.ls
  } else w = x.measureText(str).width
  return w * squeeze(p, o.t)
}

/** Draws a line of text; returns the width it took. */
function text(p: Pen, str: string, x0: number, y0: number, o: TextOpts): number {
  const x = p.x
  const natural = measure(p, str, o)
  const k = o.maxW && natural > o.maxW ? o.maxW / natural : 1
  const w = natural * k
  const left = o.align === 'center' ? x0 - w / 2 : o.align === 'right' ? x0 - w : x0
  x.save()
  x.translate(left, y0)
  x.scale(k * squeeze(p, o.t), 1)
  x.textAlign = 'left'
  x.textBaseline = o.base ?? 'alphabetic'
  if (o.lw) {
    x.lineWidth = o.lw
    x.lineJoin = 'round'
  }
  const draw = (s: string, at: number) => {
    if (o.stroke) {
      x.strokeStyle = o.stroke
      x.strokeText(s, at, 0)
    }
    if (o.fill) {
      x.fillStyle = o.fill
      x.fillText(s, at, 0)
    }
  }
  if (o.ls) {
    let at = 0
    for (const ch of str) {
      draw(ch, at)
      at += x.measureText(ch).width + o.ls
    }
  } else draw(str, 0)
  x.restore()
  return w
}

/** Cap height of a face, as a fraction of its size. */
function capOf(p: Pen, t: Type): number {
  font(p, t, 100)
  const m = p.x.measureText('H')
  const a = m.actualBoundingBoxAscent
  return a > 0 ? Math.min(0.95, a / 100) : 0.72
}

/** Best split of words into `n` lines (minimises the widest). */
function splitLines(words: string[], n: number, widthOf: (s: string) => number): string[] {
  if (n <= 1 || words.length <= 1) return [words.join(' ')]
  if (n >= words.length) return words.slice()
  let best: string[] = [words.join(' ')]
  let bestW = Infinity
  const cuts = (start: number, left: number, acc: string[]) => {
    if (left === 1) {
      const lines = [...acc, words.slice(start).join(' ')]
      const w = Math.max(...lines.map(widthOf))
      if (w < bestW) {
        bestW = w
        best = lines
      }
      return
    }
    for (let i = start + 1; i <= words.length - left + 1; i++) cuts(i, left - 1, [...acc, words.slice(start, i).join(' ')])
  }
  cuts(0, n, [])
  return best
}

interface Block {
  lines: string[]
  px: number
  cap: number
  lead: number
}

/** Fit a title into a box: the line count that makes the type biggest. */
function fitBlock(p: Pen, str: string, t: Type, w: number, h: number, maxLines = 3, lead = 0.9, maxPx = Infinity): Block {
  const words = str.split(/\s+/).filter(Boolean)
  const cap = capOf(p, t)
  const widthOf = (s: string) => measure(p, s, { t, px: 100 })
  let best: Block = { lines: [str], px: 1, cap, lead }
  for (let n = 1; n <= Math.min(maxLines, Math.max(1, words.length)); n++) {
    const lines = splitLines(words, n, widthOf)
    const widest = Math.max(...lines.map(widthOf))
    const byW = (100 * w) / Math.max(1, widest)
    const byH = h / (cap + lead * (n - 1))
    const px = Math.min(byW, byH, maxPx)
    // one more line must earn its keep
    if (px > best.px * (n === 1 ? 1 : 1.12)) best = { lines, px, cap, lead }
  }
  return best
}

function drawBlock(p: Pen, b: Block, t: Type, x0: number, top: number, o: Omit<TextOpts, 't' | 'px'> & { maxW?: number }) {
  b.lines.forEach((line, i) => {
    const y = top + b.cap * b.px + i * b.lead * b.px
    text(p, line, x0, y, { ...o, t, px: b.px })
  })
}

function blockHeight(b: Block): number {
  return b.px * (b.cap + b.lead * (b.lines.length - 1))
}

function upper(s: string): string {
  return s.toLocaleUpperCase('es-MX')
}

/** Two or three letters that stand for a name (N.A.A.F.I. → NAAFI, Club Japan → CJ). */
function monogram(title: string): string {
  const clean = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  const words = clean
    .split(/[\s·_./\-—–]+/)
    .map((w) => w.replace(/[^A-Z0-9]/g, ''))
    .filter(Boolean)
  const joined = words.join('')
  if (!joined) return 'GR'
  if (joined.length <= 5) return joined
  if (words.length >= 2) return words.slice(0, 3).map((w) => w[0]).join('')
  return joined.slice(0, 2)
}

/** A poster title that fits a small object: the first clause of a long one, or cut at a word. */
function corto(title: string, max = 36): string {
  const t = title.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  const clause = t.split(/\s+[-–—|]\s+|:\s+|\s+\(/)[0].trim()
  if (clause.length >= 6 && clause.length <= max) return clause
  let out = ''
  for (const w of t.split(' ')) {
    if (`${out} ${w}`.trim().length > max - 1) break
    out = `${out} ${w}`.trim()
  }
  return `${out || t.slice(0, max - 1)}…`
}

// ═══ images ═════════════════════════════════════════════════════════════════

type Source = HTMLImageElement | HTMLCanvasElement

const images = new Map<string, Promise<HTMLImageElement | null>>()

function loadImage(url: string): Promise<HTMLImageElement | null> {
  let p = images.get(url)
  if (!p) {
    p = new Promise((resolve) => {
      const im = new Image()
      im.decoding = 'async'
      im.onload = () => resolve(im.naturalWidth > 0 ? im : null)
      im.onerror = () => resolve(null)
      im.src = url
    })
    images.set(url, p)
  }
  return p
}

/** Same-origin always: the optimizer re-serves remote art from our origin. */
function viaNext(src: string, w: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`
}

function logoURL(src: string): string {
  return /^https?:\/\//i.test(src) ? viaNext(src, 384) : src
}

function sizeOf(s: Source): { w: number; h: number } {
  return s instanceof HTMLImageElement ? { w: s.naturalWidth, h: s.naturalHeight } : { w: s.width, h: s.height }
}

/** The most present vivid ink in an image (or null for greys / photos without one). */
function vividOf(src: Source, crop?: { x: number; y: number; w: number; h: number }): string | null {
  const S = 40
  const c = mk(S, S)
  const x = ctx2d(c, true)
  const { w, h } = sizeOf(src)
  const r = crop ?? { x: 0, y: 0, w, h }
  try {
    x.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, S, S)
  } catch {
    return null
  }
  const d = x.getImageData(0, 0, S, S).data
  const bins = Array.from({ length: 18 }, () => ({ w: 0, r: 0, g: 0, b: 0 }))
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue
    const [hh, ss, vv] = rgbHsv([d[i], d[i + 1], d[i + 2]])
    if (vv < 0.22 || ss < 0.28) continue
    const wt = ss * ss * (0.3 + vv)
    const b = bins[Math.floor(hh * 18) % 18]
    b.w += wt
    b.r += d[i] * wt
    b.g += d[i + 1] * wt
    b.b += d[i + 2] * wt
  }
  let best = bins[0]
  for (const b of bins) if (b.w > best.w) best = b
  if (best.w / (S * S) < 0.035) return null
  const [hh, ss, vv] = rgbHsv([best.r / best.w, best.g / best.w, best.b / best.w])
  // printed as a flat ink: a touch more saturated, never muddy or blinding
  return rgbHex(hsvRgb(hh, Math.min(1, ss * 1.12 + 0.05), Math.min(0.96, Math.max(0.42, vv))))
}

// ── logos: mode, background, crop ───────────────────────────────────────────

interface Mark {
  src: Source
  mode: 'alpha' | 'flat' | 'photo'
  /** The flat background (flat mode). */
  bg: RGB | null
  /** Region of the source that holds the mark (source px). */
  crop: { x: number; y: number; w: number; h: number }
  vivid: string | null
}

const marks = new Map<string, Promise<Mark | null>>()

function markOf(src: string): Promise<Mark | null> {
  let p = marks.get(src)
  if (!p) {
    p = loadImage(logoURL(src)).then((im) => {
      if (!im) return null
      try {
        return analyze(im)
      } catch {
        return null
      }
    })
    marks.set(src, p)
  }
  return p
}

function colorDist(d: Uint8ClampedArray, i: number, bg: RGB): number {
  const r = (d[i] - bg[0]) / 255
  const g = (d[i + 1] - bg[1]) / 255
  const b = (d[i + 2] - bg[2]) / 255
  return Math.sqrt(r * r + g * g + b * b)
}

/**
 * Read a mark: transparent (use its alpha), flat (a logo on a plain ground —
 * key the ground out, hug the mark), or a photo (a round crop, the way the
 * account shows it).
 */
function analyze(src: Source): Mark {
  const { w: sw, h: sh } = sizeOf(src)
  const A = 256
  const k = Math.min(1, A / Math.max(sw, sh))
  const aw = Math.max(1, Math.round(sw * k))
  const ah = Math.max(1, Math.round(sh * k))
  const c = mk(aw, ah)
  const x = ctx2d(c, true)
  x.drawImage(src, 0, 0, aw, ah)
  const d = x.getImageData(0, 0, aw, ah).data
  const n = aw * ah
  let clear = 0
  for (let i = 3; i < d.length; i += 4) if (d[i] < 200) clear++
  const fg = new Uint8Array(n)
  let mode: Mark['mode'] = 'photo'
  let bg: RGB | null = null

  if (clear > n * 0.02) {
    mode = 'alpha'
    for (let i = 0; i < n; i++) fg[i] = d[i * 4 + 3] > 90 ? 1 : 0
  } else {
    const ring: RGB[] = []
    const band = Math.max(2, Math.round(Math.min(aw, ah) * 0.02))
    for (let yy = 0; yy < ah; yy++)
      for (let xx = 0; xx < aw; xx++) {
        if (xx >= band && xx < aw - band && yy >= band && yy < ah - band) continue
        const i = (yy * aw + xx) * 4
        ring.push([d[i], d[i + 1], d[i + 2]])
      }
    const med = (ch: 0 | 1 | 2) => {
      const v = ring.map((r) => r[ch]).sort((a, b) => a - b)
      return v[Math.floor(v.length / 2)]
    }
    bg = [med(0), med(1), med(2)]
    let near = 0
    for (const r of ring) {
      const dr = (r[0] - bg[0]) / 255
      const dg = (r[1] - bg[1]) / 255
      const db = (r[2] - bg[2]) / 255
      if (Math.sqrt(dr * dr + dg * dg + db * db) < 0.1) near++
    }
    if (near / ring.length >= 0.72) {
      let cov = 0
      for (let i = 0; i < n; i++) {
        fg[i] = colorDist(d, i * 4, bg) > 0.13 ? 1 : 0
        cov += fg[i]
      }
      cov /= n
      mode = cov < 0.002 || cov > 0.9 ? 'photo' : 'flat'
    }
  }

  let crop = { x: 0, y: 0, w: sw, h: sh }
  if (mode !== 'photo') {
    // extents of the mark, ignoring lone specks (JPEG noise)
    let x0 = aw
    let y0 = ah
    let x1 = -1
    let y1 = -1
    for (let yy = 1; yy < ah - 1; yy++)
      for (let xx = 1; xx < aw - 1; xx++) {
        const i = yy * aw + xx
        if (!fg[i]) continue
        const nb = fg[i - 1] + fg[i + 1] + fg[i - aw] + fg[i + aw]
        if (nb < 2) continue
        if (xx < x0) x0 = xx
        if (xx > x1) x1 = xx
        if (yy < y0) y0 = yy
        if (yy > y1) y1 = yy
      }
    if (x1 < 0) mode = 'photo'
    else {
      const pad = Math.max(x1 - x0, y1 - y0) * 0.05 + 1
      const cx0 = Math.max(0, x0 - pad)
      const cy0 = Math.max(0, y0 - pad)
      const cx1 = Math.min(aw, x1 + 1 + pad)
      const cy1 = Math.min(ah, y1 + 1 + pad)
      crop = { x: cx0 / k, y: cy0 / k, w: (cx1 - cx0) / k, h: (cy1 - cy0) / k }
    }
  }
  return { src, mode, bg: mode === 'flat' ? bg : null, crop, vivid: vividOf(src, mode === 'photo' ? undefined : crop) }
}

/** No mark on disk (or it failed): the franja's letters, cut like a mark. */
function monogramMark(p: Pen, title: string): Mark {
  const S = 320
  const c = mk(S, S)
  const x = ctx2d(c)
  x.fillStyle = '#ffffff'
  x.fillRect(0, 0, S, S)
  const m = monogram(title)
  const t: Type = { f: 'display', w: 900, wd: m.length > 3 ? 62 : 88 }
  const sub: Pen = { ...p, x }
  const b = fitBlock(sub, m, t, S * 0.9, S * 0.8, 2, 0.86)
  const top = (S - blockHeight(b)) / 2
  drawBlock(sub, b, t, S / 2, top, { align: 'center', fill: p.team.color })
  return { src: c, mode: 'flat', bg: [255, 255, 255], crop: { x: 0, y: 0, w: S, h: S }, vivid: p.team.color }
}

// ── flyers ──────────────────────────────────────────────────────────────────

interface Flyer {
  src: HTMLImageElement
  vivid: string | null
}

const flyers = new Map<string, Promise<Flyer | null>>()

function flyerOf(src: string): Promise<Flyer | null> {
  let p = flyers.get(src)
  if (!p) {
    p = loadImage(viaNext(src, 640)).then((im) => (im ? { src: im, vivid: vividOf(im) } : null))
    flyers.set(src, p)
  }
  return p
}

/** Cover-fit crop of a source into a box of this aspect. */
function coverCrop(s: Source, aspect: number, fx = 0.5, fy = 0.5) {
  const { w, h } = sizeOf(s)
  if (w / h > aspect) {
    const cw = h * aspect
    return { x: (w - cw) * fx, y: 0, w: cw, h }
  }
  const ch = w / aspect
  return { x: 0, y: (h - ch) * fy, w, h: ch }
}

// ═══ distance fields (contour cuts) ═════════════════════════════════════════

const INF = 1e20

function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    const dq = q - v[k]
    d[q] = dq * dq + f[v[k]]
  }
}

/** Euclidean distance (cells) from every cell to the nearest set cell. */
function edt(mask: Uint8Array, nx: number, ny: number): Float32Array {
  const n = Math.max(nx, ny)
  const f = new Float64Array(n)
  const d = new Float64Array(n)
  const v = new Int32Array(n)
  const z = new Float64Array(n + 1)
  const tmp = new Float64Array(nx * ny)
  const out = new Float32Array(nx * ny)
  for (let xx = 0; xx < nx; xx++) {
    for (let yy = 0; yy < ny; yy++) f[yy] = mask[yy * nx + xx] ? 0 : INF
    edt1d(f, ny, d, v, z)
    for (let yy = 0; yy < ny; yy++) tmp[yy * nx + xx] = d[yy]
  }
  for (let yy = 0; yy < ny; yy++) {
    for (let xx = 0; xx < nx; xx++) f[xx] = tmp[yy * nx + xx]
    edt1d(f, nx, d, v, z)
    for (let xx = 0; xx < nx; xx++) out[yy * nx + xx] = Math.sqrt(d[xx])
  }
  return out
}

/**
 * Drop specks: components far smaller than the mark and away from it (JPEG
 * noise around a cut-out) would each grow their own blob of vinyl. Small
 * parts close to the mark (an accent, the dot of an i) stay.
 */
function despeckle(fg: Uint8Array, nx: number, ny: number, near: number) {
  const label = new Int32Array(nx * ny).fill(-1)
  const areas: number[] = []
  const q = new Int32Array(nx * ny)
  for (let s = 0; s < fg.length; s++) {
    if (!fg[s] || label[s] >= 0) continue
    const id = areas.length
    let head = 0
    let tail = 0
    q[tail++] = s
    label[s] = id
    let area = 0
    while (head < tail) {
      const i = q[head++]
      area++
      const xx = i % nx
      const yy = (i - xx) / nx
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const ax = xx + dx
          const ay = yy + dy
          if (ax < 0 || ay < 0 || ax >= nx || ay >= ny) continue
          const j = ay * nx + ax
          if (fg[j] && label[j] < 0) {
            label[j] = id
            q[tail++] = j
          }
        }
    }
    areas.push(area)
  }
  if (areas.length < 2) return
  const big = Math.max(...areas)
  const keep = areas.map((a) => a >= Math.max(10, big * 0.03))
  const core = new Uint8Array(nx * ny)
  for (let i = 0; i < fg.length; i++) if (label[i] >= 0 && keep[label[i]]) core[i] = 1
  const d = edt(core, nx, ny)
  const closest = new Float32Array(areas.length).fill(Infinity)
  for (let i = 0; i < fg.length; i++) if (label[i] >= 0 && !keep[label[i]]) closest[label[i]] = Math.min(closest[label[i]], d[i])
  for (let i = 0; i < fg.length; i++) if (label[i] >= 0 && !keep[label[i]] && closest[label[i]] > near) fg[i] = 0
}

/** Region within `thr` of the mask, with enclosed holes filled (a cut never leaves islands). */
function region(dist: Float32Array, nx: number, ny: number, thr: number): Uint8Array {
  const inside = new Uint8Array(nx * ny)
  for (let i = 0; i < inside.length; i++) inside[i] = dist[i] <= thr ? 1 : 0
  const seen = new Uint8Array(nx * ny)
  const q = new Int32Array(nx * ny)
  let head = 0
  let tail = 0
  const push = (i: number) => {
    if (!inside[i] && !seen[i]) {
      seen[i] = 1
      q[tail++] = i
    }
  }
  for (let xx = 0; xx < nx; xx++) {
    push(xx)
    push((ny - 1) * nx + xx)
  }
  for (let yy = 0; yy < ny; yy++) {
    push(yy * nx)
    push(yy * nx + nx - 1)
  }
  while (head < tail) {
    const i = q[head++]
    const xx = i % nx
    const yy = (i - xx) / nx
    if (xx > 0) push(i - 1)
    if (xx < nx - 1) push(i + 1)
    if (yy > 0) push(i - nx)
    if (yy < ny - 1) push(i + nx)
  }
  for (let i = 0; i < inside.length; i++)
    if (!inside[i] && !seen[i]) {
      inside[i] = 1
      dist[i] = 0
    }
  return inside
}

/** Alpha of a field region at canvas resolution (bilinear, 1-px antialias), plus its inner cut line. */
function fieldAlpha(dist: Float32Array, nx: number, ny: number, W: number, H: number, thr: number, lineW = 0): { fill: HTMLCanvasElement; line: HTMLCanvasElement | null } {
  const fill = mk(W, H)
  const fx = ctx2d(fill)
  const img = fx.createImageData(W, H)
  const a = img.data
  const line = lineW > 0 ? mk(W, H) : null
  const lx = line ? ctx2d(line) : null
  const limg = lx ? lx.createImageData(W, H) : null
  const la = limg ? limg.data : null
  const pxCell = W / nx
  const edge = thr + 0.5
  for (let py = 0; py < H; py++) {
    const gy = Math.max(0, Math.min(ny - 1.001, ((py + 0.5) * ny) / H - 0.5))
    const y0 = Math.floor(gy)
    const ty = gy - y0
    for (let px = 0; px < W; px++) {
      const gx = Math.max(0, Math.min(nx - 1.001, ((px + 0.5) * nx) / W - 0.5))
      const x0 = Math.floor(gx)
      const tx = gx - x0
      const i = y0 * nx + x0
      const d00 = dist[i]
      const d10 = dist[i + 1]
      const d01 = dist[i + nx]
      const d11 = dist[i + nx + 1]
      const dd = (d00 * (1 - tx) + d10 * tx) * (1 - ty) + (d01 * (1 - tx) + d11 * tx) * ty
      const o = (py * W + px) * 4
      const al = Math.max(0, Math.min(1, (edge - dd) * pxCell + 0.5))
      a[o] = a[o + 1] = a[o + 2] = 255
      a[o + 3] = al * 255
      if (la) {
        const inner = Math.max(0, Math.min(1, (edge - dd) * pxCell - lineW + 0.5))
        la[o] = la[o + 1] = la[o + 2] = 0
        la[o + 3] = Math.max(0, al - inner) * 255
      }
    }
  }
  fx.putImageData(img, 0, 0)
  if (lx && limg) lx.putImageData(limg, 0, 0)
  return { fill, line }
}

// ═══ shapes ═════════════════════════════════════════════════════════════════

type Cut = 'chamfer' | 'round' | 'diag' | 'square'

function shape(cut: Cut, x0: number, y0: number, w: number, h: number, k: number): Path2D {
  const p = new Path2D()
  const c = Math.max(0, Math.min(k, w / 2, h / 2))
  if (cut === 'round') {
    if (typeof p.roundRect === 'function') p.roundRect(x0, y0, w, h, c)
    else p.rect(x0, y0, w, h)
    return p
  }
  if (cut === 'square' || c === 0) {
    p.rect(x0, y0, w, h)
    return p
  }
  const tl = c
  const br = c
  const tr = cut === 'diag' ? 0 : c
  const bl = cut === 'diag' ? 0 : c
  p.moveTo(x0 + tl, y0)
  p.lineTo(x0 + w - tr, y0)
  p.lineTo(x0 + w, y0 + tr)
  p.lineTo(x0 + w, y0 + h - br)
  p.lineTo(x0 + w - br, y0 + h)
  p.lineTo(x0 + bl, y0 + h)
  p.lineTo(x0, y0 + h - bl)
  p.lineTo(x0, y0 + tl)
  p.closePath()
  return p
}

function circle(cx: number, cy: number, r: number): Path2D {
  const p = new Path2D()
  p.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2)
  return p
}

/** A strip of tape: straight sides, ends torn in a ragged zigzag. */
function tapePath(W: number, H: number, R: () => number, amp: number): Path2D {
  const p = new Path2D()
  const teeth = 5 + Math.floor(R() * 4)
  // each end, top → bottom
  const end = (from: number, dir: 1 | -1) => {
    const pts: Array<[number, number]> = []
    for (let i = 0; i <= teeth * 2; i++) {
      const y = 0.5 + ((H - 1) * i) / (teeth * 2)
      const off = i % 2 === 1 ? amp * (0.55 + 0.45 * R()) : amp * 0.1 * R()
      pts.push([from + dir * off, y])
    }
    return pts
  }
  const left = end(0.5, 1)
  const right = end(W - 0.5, -1)
  p.moveTo(left[0][0], left[0][1])
  for (const [px, py] of right) p.lineTo(px, py)
  for (let i = left.length - 1; i >= 0; i--) p.lineTo(left[i][0], left[i][1])
  p.closePath()
  return p
}

/** A ticket: rounded corners, a notch top and bottom where the stub tears. */
function ticketPath(W: number, H: number, r: number, xp: number, nr: number): Path2D {
  const p = new Path2D()
  p.moveTo(r, 0.5)
  p.lineTo(xp - nr, 0.5)
  p.arc(xp, 0.5, nr, Math.PI, 0, true)
  p.lineTo(W - r, 0.5)
  p.arcTo(W - 0.5, 0.5, W - 0.5, r, r)
  p.lineTo(W - 0.5, H - r)
  p.arcTo(W - 0.5, H - 0.5, W - r, H - 0.5, r)
  p.lineTo(xp + nr, H - 0.5)
  p.arc(xp, H - 0.5, nr, 0, Math.PI, true)
  p.lineTo(r, H - 0.5)
  p.arcTo(0.5, H - 0.5, 0.5, H - r, r)
  p.lineTo(0.5, r)
  p.arcTo(0.5, 0.5, r, 0.5, r)
  p.closePath()
  return p
}

/** A seal's edge: serrated like a foil seal, scalloped, or a rubber stamp's rough circle. */
function sealPath(cx: number, cy: number, R0: number, R: () => number, kind: 'burst' | 'scallop' | 'rough'): Path2D {
  const p = new Path2D()
  if (kind === 'rough') {
    const n = 90
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2
      const r = R0 * (0.965 + 0.035 * R())
      const px = cx + r * Math.cos(a)
      const py = cy + r * Math.sin(a)
      if (i === 0) p.moveTo(px, py)
      else p.lineTo(px, py)
    }
    p.closePath()
    return p
  }
  const n = kind === 'burst' ? 26 + Math.floor(R() * 16) : 14 + Math.floor(R() * 8)
  const inner = R0 * (kind === 'burst' ? 0.91 : 0.9)
  if (kind === 'burst') {
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
      const r = (i % 2 ? inner : R0) * (0.992 + 0.008 * R())
      const px = cx + r * Math.cos(a)
      const py = cy + r * Math.sin(a)
      if (i === 0) p.moveTo(px, py)
      else p.lineTo(px, py)
    }
  } else {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2
      const a1 = ((i + 1) / n) * Math.PI * 2
      const am = (a0 + a1) / 2
      const x0 = cx + inner * Math.cos(a0)
      const y0 = cy + inner * Math.sin(a0)
      if (i === 0) p.moveTo(x0, y0)
      const k = R0 * 1.06
      p.quadraticCurveTo(cx + k * Math.cos(am), cy + k * Math.sin(am), cx + inner * Math.cos(a1), cy + inner * Math.sin(a1))
    }
  }
  p.closePath()
  return p
}

// ═══ print marks ════════════════════════════════════════════════════════════

function barcode(p: Pen, x0: number, y0: number, w: number, h: number, key: string, color: string, vertical = false) {
  const R = rng(hashStr(key))
  const bars: Array<[number, number]> = []
  let u = 0
  const push = (bw: number, gap: number) => {
    bars.push([u, bw])
    u += bw + gap
  }
  push(1, 1)
  push(1, 1)
  while (u < 56) push(1 + Math.floor(R() * 3), 1 + Math.floor(R() * 2))
  push(1, 1)
  push(1, 0)
  const k = (vertical ? h : w) / u
  p.x.fillStyle = color
  for (const [s0, bw] of bars) {
    if (vertical) p.x.fillRect(x0, y0 + s0 * k, w, Math.max(0.6, bw * k))
    else p.x.fillRect(x0 + s0 * k, y0, Math.max(0.6, bw * k), h)
  }
}

function regMark(p: Pen, cx: number, cy: number, r: number, color: string, lw: number) {
  const x = p.x
  x.save()
  x.strokeStyle = color
  x.lineWidth = lw
  x.beginPath()
  x.arc(cx, cy, r * 0.55, 0, Math.PI * 2)
  x.moveTo(cx - r, cy)
  x.lineTo(cx + r, cy)
  x.moveTo(cx, cy - r)
  x.lineTo(cx, cy + r)
  x.stroke()
  x.restore()
}

function chevrons(p: Pen, x0: number, cy: number, size: number, n: number, color: string) {
  const x = p.x
  x.fillStyle = color
  for (let i = 0; i < n; i++) {
    const a = x0 + i * size * 0.78
    x.beginPath()
    x.moveTo(a, cy - size / 2)
    x.lineTo(a + size * 0.62, cy)
    x.lineTo(a, cy + size / 2)
    x.closePath()
    x.fill()
  }
  return n * size * 0.78
}

function stripes(p: Pen, r: { x: number; y: number; w: number; h: number }, angle: number, band: number, color: string, ground?: string) {
  const x = p.x
  x.save()
  x.beginPath()
  x.rect(r.x, r.y, r.w, r.h)
  x.clip()
  if (ground) {
    x.fillStyle = ground
    x.fillRect(r.x, r.y, r.w, r.h)
  }
  x.translate(r.x + r.w / 2, r.y + r.h / 2)
  x.rotate(angle)
  const span = Math.hypot(r.w, r.h)
  x.fillStyle = color
  for (let s = -span; s < span; s += band * 2) x.fillRect(s, -span, band, span * 2)
  x.restore()
}

function dialTicks(p: Pen, x0: number, y0: number, w: number, h: number, color: string, step: number) {
  const x = p.x
  x.fillStyle = color
  let i = 0
  for (let a = x0; a <= x0 + w; a += step, i++) {
    const major = i % 5 === 0
    x.fillRect(a, y0 + (major ? 0 : h * 0.42), Math.max(1, step * 0.24), major ? h : h * 0.58)
  }
}

/** Energy printed the TRAMA way: a hard swatch and its slot code. */
function energyChip(p: Pen, x0: number, y0: number, h: number, color: string, align: 'left' | 'right' = 'left'): number {
  const e = Math.round(Math.max(0, Math.min(10, p.def.energy)))
  const label = `E·${String(e).padStart(2, '0')} ${VIBE_NAMES[e]}`
  const px = h * 0.62
  const tw = measure(p, label, { t: MONO_B, px, ls: px * 0.06 })
  const total = h + h * 0.35 + tw
  const left = align === 'right' ? x0 - total : x0
  p.x.fillStyle = energySlotHex(e)
  p.x.fillRect(left, y0, h, h)
  p.x.strokeStyle = color
  p.x.lineWidth = Math.max(1, p.s)
  p.x.strokeRect(left + 0.5, y0 + 0.5, h - 1, h - 1)
  text(p, label, left + h * 1.35, y0 + h * 0.8, { t: MONO_B, px, ls: px * 0.06, fill: color })
  return total
}

function spectrumSteps(p: Pen, x0: number, y0: number, w: number, h: number) {
  const n = SPECTRUM_HEX.length
  for (let i = 0; i < n; i++) {
    p.x.fillStyle = SPECTRUM_HEX[i]
    p.x.fillRect(x0 + (w * i) / n, y0, w / n + 0.6, h)
  }
}

function xMark(p: Pen, cx: number, cy: number, r: number, color: string, lw: number) {
  const x = p.x
  x.save()
  x.strokeStyle = color
  x.lineWidth = lw
  x.lineCap = 'butt'
  x.beginPath()
  x.moveTo(cx - r, cy - r)
  x.lineTo(cx + r, cy + r)
  x.moveTo(cx + r, cy - r)
  x.lineTo(cx - r, cy + r)
  x.stroke()
  x.restore()
}

function star(p: Pen, cx: number, cy: number, r: number, color: string) {
  const x = p.x
  x.fillStyle = color
  x.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const rr = i % 2 ? r * 0.42 : r
    const px = cx + rr * Math.cos(a)
    const py = cy + rr * Math.sin(a)
    if (i === 0) x.moveTo(px, py)
    else x.lineTo(px, py)
  }
  x.closePath()
  x.fill()
}

/** A photo printed through a halftone screen: one ink, dots by darkness. */
function halftone(p: Pen, src: Source, r: { x: number; y: number; w: number; h: number }, o: { cell: number; angle: number; ink: string; ground: string | null; invert?: boolean }) {
  const cell = Math.max(2, o.cell)
  const sw = Math.max(8, Math.ceil((r.w / cell) * 2))
  const sh = Math.max(8, Math.ceil((r.h / cell) * 2))
  const c = mk(sw, sh)
  const cx = ctx2d(c, true)
  const crop = coverCrop(src, r.w / r.h)
  cx.drawImage(src, crop.x, crop.y, crop.w, crop.h, 0, 0, sw, sh)
  const d = cx.getImageData(0, 0, sw, sh).data
  const L = new Float32Array(sw * sh)
  const hist: number[] = []
  for (let i = 0; i < L.length; i++) {
    const l = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255
    L[i] = l
    if (i % 3 === 0) hist.push(l)
  }
  hist.sort((a, b) => a - b)
  const lo = hist[Math.floor(hist.length * 0.03)] ?? 0
  const hi = hist[Math.floor(hist.length * 0.97)] ?? 1
  const span = Math.max(0.08, hi - lo)
  const x = p.x
  x.save()
  x.beginPath()
  x.rect(r.x, r.y, r.w, r.h)
  x.clip()
  if (o.ground) {
    x.fillStyle = o.ground
    x.fillRect(r.x, r.y, r.w, r.h)
  }
  x.fillStyle = o.ink
  x.beginPath()
  const ccx = r.x + r.w / 2
  const ccy = r.y + r.h / 2
  const cos = Math.cos(o.angle)
  const sin = Math.sin(o.angle)
  const n = Math.ceil(Math.hypot(r.w, r.h) / 2 / cell) + 1
  for (let i = -n; i <= n; i++)
    for (let j = -n; j <= n; j++) {
      const u = i * cell
      const v = j * cell
      const px = ccx + u * cos - v * sin
      const py = ccy + u * sin + v * cos
      if (px < r.x - cell || px > r.x + r.w + cell || py < r.y - cell || py > r.y + r.h + cell) continue
      const sx = Math.max(0, Math.min(sw - 1, Math.floor(((px - r.x) / r.w) * sw)))
      const sy = Math.max(0, Math.min(sh - 1, Math.floor(((py - r.y) / r.h) * sh)))
      let l = (L[sy * sw + sx] - lo) / span
      l = Math.max(0, Math.min(1, l))
      const dark = o.invert ? l : 1 - l
      const rad = cell * 0.5 * Math.sqrt(dark) * 1.28
      if (rad < cell * 0.07) continue
      x.moveTo(px + rad, py)
      x.arc(px, py, rad, 0, Math.PI * 2)
    }
  x.fill()
  x.restore()
}

/** Characters around a circle, upright, evenly spaced to fill [from, to]. */
function ringText(p: Pen, str: string, cx: number, cy: number, r: number, from: number, to: number, o: { t: Type; px: number; color: string }) {
  const x = p.x
  font(p, o.t, o.px)
  const chars = [...str]
  const widths = chars.map((ch) => x.measureText(ch).width)
  const total = widths.reduce((a, b) => a + b, 0)
  const arc = (to - from) * r
  const gap = Math.max(0, (arc - total) / Math.max(1, chars.length))
  let a = from
  x.save()
  x.fillStyle = o.color
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  chars.forEach((ch, i) => {
    const w = widths[i]
    const mid = a + (w / 2 + gap / 2) / r
    x.save()
    x.translate(cx + r * Math.cos(mid), cy + r * Math.sin(mid))
    x.rotate(mid + Math.PI / 2)
    x.fillText(ch, 0, 0)
    x.restore()
    a += (w + gap) / r
  })
  x.restore()
}

/** Repeat a phrase until it fills most of an arc; shrink it first if it can't fit once. */
function ringPhrase(p: Pen, parts: string[], r: number, span: number, t: Type, px: number, minPx: number, sep = ' · '): { str: string; px: number } {
  const phrase = parts.filter(Boolean).join(sep) + sep
  const arc = span * r
  let size = px
  let w = measure(p, phrase, { t, px: size })
  while (w > arc * 0.94 && size > minPx) {
    size *= 0.93
    w = measure(p, phrase, { t, px: size })
  }
  if (w > arc * 0.94) {
    // still too long: cut the phrase to what fits
    let s = phrase
    while (s.length > 4 && measure(p, s + '…' + sep, { t, px: size }) > arc * 0.94) s = s.slice(0, -1)
    return { str: s.trimEnd() + '…' + sep, px: size }
  }
  const reps = Math.max(1, Math.floor((arc * 0.96) / w))
  return { str: phrase.repeat(reps), px: size }
}

// ═══ stock & materials ══════════════════════════════════════════════════════

/**
 * A foil stock with nothing on it yet: neutral silver with one soft sheen
 * (the foil itself is per copy — acabado.ts / the GLSL — over this ground).
 */
function foilStock(p: Pen) {
  const { x, W, H, M } = p
  const a = -0.9 + M() * 0.4
  const cx = W / 2
  const cy = H / 2
  const r = Math.hypot(W, H) / 2
  const g = x.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  const base = p.stock
  g.addColorStop(0, '#eef0f3')
  g.addColorStop(0.42, base)
  g.addColorStop(0.5, '#e7e9ed')
  g.addColorStop(0.58, base)
  g.addColorStop(1, '#c9ced5')
  x.save()
  x.fillStyle = g
  x.fillRect(0, 0, W, H)
  x.restore()
}

/** A fine metallic grain under glitter (the flakes themselves are per copy). */
function grain(p: Pen) {
  const { x, W, H, M } = p
  const n = Math.round((W * H) / 40)
  x.save()
  for (let i = 0; i < n; i++) {
    x.globalAlpha = 0.08 + M() * 0.12
    x.fillStyle = M() < 0.5 ? '#ffffff' : '#8c919a'
    const sz = Math.max(0.8, p.s * (0.8 + M() * 1.2))
    x.fillRect(M() * W, M() * H, sz, sz)
  }
  x.restore()
}

function fibres(p: Pen) {
  const { x, W, H, M: R } = p
  const n = Math.round((W * H) / 520)
  x.save()
  x.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    const len = (2 + R() * 7) * p.s
    const a = R() * Math.PI
    const px = R() * W
    const py = R() * H
    x.globalAlpha = 0.035 + R() * 0.05
    x.strokeStyle = R() < 0.7 ? '#5a5140' : '#ffffff'
    x.lineWidth = Math.max(0.5, 0.55 * p.s)
    x.beginPath()
    x.moveTo(px, py)
    x.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len)
    x.stroke()
  }
  x.restore()
}

/** The stock's ground over the whole canvas (the caller clips or trims to the die). */
function stock(p: Pen) {
  const { x, W, H, def } = p
  x.fillStyle = p.stock
  x.fillRect(0, 0, W, H)
  if (def.material === 'holo' || def.material === 'brillo' || def.material === 'metal') foilStock(p)
  if (def.material === 'brillo') grain(p)
}

/** The unprinted sticker: its stock, inside the cut. */
function base(p: Pen, die: Path2D) {
  const { x } = p
  x.save()
  x.clip(die)
  stock(p)
  x.restore()
}

/** Foil-like stocks: the ones a design lays out as metal (rings left bare, no stamp wear). */
function foilish(def: StickerDef): boolean {
  return def.material === 'holo' || def.material === 'brillo' || def.material === 'metal'
}

/** What the material does over the print, the cut edge, and nothing outside the cut. */
function finish(p: Pen, die: Path2D) {
  const { x, def } = p
  x.save()
  x.clip(die)
  if (def.material === 'papel') fibres(p)
  x.restore()
  // nothing lives outside the die
  x.save()
  x.globalCompositeOperation = 'destination-in'
  x.fillStyle = '#000'
  x.fill(die)
  x.restore()
  // the cut edge: a hairline just inside
  x.save()
  x.clip(die)
  x.strokeStyle = def.material === 'transparente' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)'
  x.lineWidth = Math.max(1.2, 2.2 * p.s)
  x.stroke(die)
  x.restore()
}

// ═══ forms ══════════════════════════════════════════════════════════════════

type Rect = { x: number; y: number; w: number; h: number }

function titleType(p: Pen, wght?: number): Type {
  // energy typography, or the livery's own setting — the seed decides
  if (p.R() < 0.5) {
    const f = energyFont(p.def.energy)
    return { f: 'display', w: wght ?? f.wght, wd: f.wdth }
  }
  return { f: 'display', w: wght ?? p.team.wght, wd: p.team.wdth }
}

// ── logo: the contour cut ───────────────────────────────────────────────────

async function formLogo(p: Pen) {
  const { x, W, H, def, R } = p
  const found = def.art.logo ? await markOf(def.art.logo) : null
  const mark = found ?? monogramMark(p, def.art.title)
  const tabAt = pick(R, ['br', 'bl', 'bc', 'br', 'bl', 'none'] as const)
  const hasTab = tabAt !== 'none'

  // Where the mark sits: room below for the tab, the plate and the border.
  const m0 = W * 0.08
  const box: Rect = hasTab ? { x: m0, y: H * 0.06, w: W - 2 * m0, h: H * 0.7 } : { x: m0, y: m0, w: W - 2 * m0, h: H - 2 * m0 }
  const ca = mark.crop.w / mark.crop.h
  const fit = Math.min(box.w / mark.crop.w, box.h / mark.crop.h)
  const dw = mark.crop.w * fit
  const dh = mark.crop.h * fit
  const dst: Rect = { x: box.x + (box.w - dw) / 2, y: box.y + (box.h - dh) * (hasTab ? 0.85 : 0.5), w: dw, h: dh }

  // The mark on a grid (2× supersampled, then pooled).
  const nx = 200
  const ny = Math.max(8, Math.round((nx * H) / W))
  const G = 2
  const gc = mk(nx * G, ny * G)
  const gx = ctx2d(gc, true)
  const sx = (nx * G) / W
  const sy = (ny * G) / H
  const fg = new Uint8Array(nx * ny)
  const round = mark.mode === 'photo' && Math.abs(ca - 1) < 0.18
  if (mark.mode === 'photo') {
    gx.fillStyle = '#fff'
    gx.beginPath()
    if (round) gx.arc((dst.x + dst.w / 2) * sx, (dst.y + dst.h / 2) * sy, (Math.min(dst.w, dst.h) / 2) * sx, 0, Math.PI * 2)
    else if (typeof gx.roundRect === 'function') gx.roundRect(dst.x * sx, dst.y * sy, dst.w * sx, dst.h * sy, Math.min(dst.w, dst.h) * 0.08 * sx)
    else gx.rect(dst.x * sx, dst.y * sy, dst.w * sx, dst.h * sy)
    gx.fill()
    const d = gx.getImageData(0, 0, nx * G, ny * G).data
    for (let yy = 0; yy < ny; yy++)
      for (let xx = 0; xx < nx; xx++) {
        let c = 0
        for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) c += d[((yy * G + j) * nx * G + xx * G + i) * 4 + 3] > 127 ? 1 : 0
        fg[yy * nx + xx] = c >= 2 ? 1 : 0
      }
  } else {
    if (mark.bg) {
      gx.fillStyle = rgbHex(mark.bg)
      gx.fillRect(0, 0, nx * G, ny * G)
    }
    gx.drawImage(mark.src, mark.crop.x, mark.crop.y, mark.crop.w, mark.crop.h, dst.x * sx, dst.y * sy, dst.w * sx, dst.h * sy)
    const d = gx.getImageData(0, 0, nx * G, ny * G).data
    for (let yy = 0; yy < ny; yy++)
      for (let xx = 0; xx < nx; xx++) {
        let c = 0
        for (let j = 0; j < G; j++)
          for (let i = 0; i < G; i++) {
            const o = ((yy * G + j) * nx * G + xx * G + i) * 4
            c += mark.bg ? (colorDist(d, o, mark.bg) > 0.1 ? 1 : 0) : d[o + 3] > 80 ? 1 : 0
          }
        fg[yy * nx + xx] = c >= 2 ? 1 : 0
      }
  }

  // plate: the mark's own ground hugging it; die: the vinyl border around plate + tab
  const plateR = mark.mode === 'photo' ? 0 : nx * 0.024
  const borderR = nx * 0.036
  if (mark.mode !== 'photo') despeckle(fg, nx, ny, plateR * 2 + 2)
  const d1 = edt(fg, nx, ny)
  const plate = region(d1, nx, ny, plateR)
  let bx0 = nx
  let by0 = ny
  let bx1 = 0
  let by1 = 0
  for (let yy = 0; yy < ny; yy++)
    for (let xx = 0; xx < nx; xx++)
      if (plate[yy * nx + xx]) {
        bx0 = Math.min(bx0, xx)
        bx1 = Math.max(bx1, xx)
        by0 = Math.min(by0, yy)
        by1 = Math.max(by1, yy)
      }
  if (bx1 <= bx0) throw new Error('empty mark')
  const mask2 = plate.slice()
  let tab: Rect | null = null
  if (hasTab) {
    const tw = W * 0.4
    const th = H * 0.1
    const pl = (bx0 / nx) * W
    const pr = ((bx1 + 1) / nx) * W
    const pb = ((by1 + 1) / ny) * H
    let tx = tabAt === 'br' ? pr - tw * 0.82 : tabAt === 'bl' ? pl - tw * 0.18 : (pl + pr) / 2 - tw / 2
    tx = Math.max(W * 0.06, Math.min(W * 0.94 - tw, tx))
    const ty = Math.min(H * 0.9 - th, pb - th * 0.25)
    tab = { x: tx, y: ty, w: tw, h: th }
    const c0 = Math.floor((tab.x / W) * nx)
    const c1 = Math.ceil(((tab.x + tab.w) / W) * nx)
    const r0 = Math.floor((tab.y / H) * ny)
    const r1 = Math.ceil(((tab.y + tab.h) / H) * ny)
    for (let yy = Math.max(0, r0); yy < Math.min(ny, r1); yy++) for (let xx = Math.max(0, c0); xx < Math.min(nx, c1); xx++) mask2[yy * nx + xx] = 1
  }
  const d2 = edt(mask2, nx, ny)
  region(d2, nx, ny, borderR)
  const lineW = Math.max(1.2, 2.2 * p.s)
  const die = fieldAlpha(d2, nx, ny, W, H, borderR, lineW)

  // 1 · stock everywhere (the die trims it at the end)
  stock(p)

  // 2 · the mark
  const layer = mk(W, H)
  const lx = ctx2d(layer, true)
  if (mark.mode === 'photo') {
    lx.save()
    lx.beginPath()
    if (round) lx.arc(dst.x + dst.w / 2, dst.y + dst.h / 2, Math.min(dst.w, dst.h) / 2, 0, Math.PI * 2)
    else if (typeof lx.roundRect === 'function') lx.roundRect(dst.x, dst.y, dst.w, dst.h, Math.min(dst.w, dst.h) * 0.08)
    else lx.rect(dst.x, dst.y, dst.w, dst.h)
    lx.clip()
    lx.drawImage(mark.src, mark.crop.x, mark.crop.y, mark.crop.w, mark.crop.h, dst.x, dst.y, dst.w, dst.h)
    lx.restore()
    // the photo's own thin frame, like a printed border
    lx.strokeStyle = 'rgba(0,0,0,0.25)'
    lx.lineWidth = Math.max(1, p.s * 1.4)
    lx.beginPath()
    if (round) lx.arc(dst.x + dst.w / 2, dst.y + dst.h / 2, Math.min(dst.w, dst.h) / 2, 0, Math.PI * 2)
    else lx.rect(dst.x, dst.y, dst.w, dst.h)
    lx.stroke()
  } else if (mark.mode === 'flat' && mark.bg && relLum(mark.bg) < 0.8) {
    // a coloured or dark ground: the plate hugs the mark in that ground
    const plateA = fieldAlpha(d1, nx, ny, W, H, plateR)
    lx.fillStyle = rgbHex(mark.bg)
    lx.fillRect(0, 0, W, H)
    lx.drawImage(mark.src, mark.crop.x, mark.crop.y, mark.crop.w, mark.crop.h, dst.x, dst.y, dst.w, dst.h)
    lx.globalCompositeOperation = 'destination-in'
    lx.drawImage(plateA.fill, 0, 0)
    lx.globalCompositeOperation = 'source-over'
  } else {
    // a pale ground or a transparent mark: key the ground out, the vinyl shows
    lx.drawImage(mark.src, mark.crop.x, mark.crop.y, mark.crop.w, mark.crop.h, dst.x, dst.y, dst.w, dst.h)
    if (mark.bg) {
      const x0 = Math.max(0, Math.floor(dst.x))
      const y0 = Math.max(0, Math.floor(dst.y))
      const w0 = Math.min(W - x0, Math.ceil(dst.w) + 1)
      const h0 = Math.min(H - y0, Math.ceil(dst.h) + 1)
      const img = lx.getImageData(x0, y0, w0, h0)
      const a = img.data
      for (let i = 0; i < a.length; i += 4) {
        const dd = colorDist(a, i, mark.bg)
        a[i + 3] = Math.round(a[i + 3] * Math.max(0, Math.min(1, (dd - 0.05) / 0.16)))
      }
      lx.putImageData(img, x0, y0)
    }
  }
  x.drawImage(layer, 0, 0)

  // 3 · the tab: the franja's code in its energy's ink
  if (tab) {
    const g = pick(R, ['energy', 'ink', 'team'] as const)
    const t = g === 'energy' ? p.energy : g === 'ink' ? { color: INK, on: PAPER } : p.team
    x.fillStyle = t.color
    x.fillRect(tab.x, tab.y, tab.w, tab.h)
    const pad = tab.h * 0.22
    const bcW = tab.w * 0.26
    const leftBar = tabAt !== 'bl'
    const bx = leftBar ? tab.x + tab.w - pad - bcW : tab.x + pad
    barcode(p, bx, tab.y + pad, bcW, tab.h - 2 * pad, designOf(def), t.on)
    const tx0 = leftBar ? tab.x + pad : tab.x + pad * 2 + bcW
    text(p, def.art.code, tx0, tab.y + tab.h * 0.66, { t: MONO_B, px: tab.h * 0.44, ls: tab.h * 0.03, fill: t.on, maxW: tab.w - bcW - pad * 3 })
  }

  // 4 · the material over the print
  if (def.material === 'papel') fibres(p)

  // 5 · the cut
  x.globalCompositeOperation = 'destination-in'
  x.drawImage(die.fill, 0, 0)
  x.globalCompositeOperation = 'source-over'
  if (die.line) {
    const lc = mk(W, H)
    const l2 = ctx2d(lc)
    l2.drawImage(die.line, 0, 0)
    l2.globalCompositeOperation = 'source-in'
    l2.fillStyle = 'rgba(0,0,0,0.2)'
    l2.fillRect(0, 0, W, H)
    x.drawImage(lc, 0, 0)
  }
}

// ── tipo: a typographic block ───────────────────────────────────────────────

function formTipo(p: Pen) {
  const { x, W, H, def, R } = p
  const cut = pick(R, ['chamfer', 'round', 'diag', 'square'] as const)
  const bw = H * 0.045
  const k = H * (cut === 'round' ? 0.06 : 0.1)
  const die = shape(cut, 0.5, 0.5, W - 1, H - 1, k)
  const inner = shape(cut, bw, bw, W - 2 * bw, H - 2 * bw, Math.max(0, k - bw * 0.6))
  base(p, die)
  const b: Rect = { x: bw, y: bw, w: W - 2 * bw, h: H - 2 * bw }
  x.save()
  x.clip(inner)
  if (def.source === 'casa') tipoCasa(p, b)
  else {
    const v = pick(R, ['bloque', 'dividido', 'calca'] as const)
    if (v === 'bloque') tipoBloque(p, b)
    else if (v === 'dividido') tipoDividido(p, b)
    else tipoCalca(p, b)
  }
  x.restore()
  finish(p, die)
}

/** A full flood of the team colour, the name huge with its second plate off register. */
function tipoBloque(p: Pen, b: Rect) {
  const { x, def, team, accent } = p
  const pad = b.h * 0.075
  x.fillStyle = team.color
  x.fillRect(b.x, b.y, b.w, b.h)
  // top strip: code chip, kind, chevrons, a heavy rule
  const sh = b.h * 0.13
  const cpx = sh * 0.62
  const code = def.art.code
  const cw = measure(p, code, { t: MONO_B, px: cpx, ls: cpx * 0.06 }) + cpx * 0.9
  x.fillStyle = team.on
  x.fillRect(b.x + pad, b.y + pad * 0.8, cw, sh)
  text(p, code, b.x + pad + cpx * 0.45, b.y + pad * 0.8 + sh * 0.76, { t: MONO_B, px: cpx, ls: cpx * 0.06, fill: team.color })
  text(p, upper(def.art.lines[0] ?? 'Franja'), b.x + pad + cw + cpx * 0.7, b.y + pad * 0.8 + sh * 0.76, { t: MONO_B, px: cpx * 0.86, ls: cpx * 0.14, fill: team.on })
  chevrons(p, b.x + b.w - pad - sh * 2.1, b.y + pad * 0.8 + sh / 2, sh * 0.9, 3, team.on)
  const ruleY = b.y + pad * 0.8 + sh + pad * 0.5
  x.fillStyle = team.on
  x.fillRect(b.x + pad, ruleY, b.w - 2 * pad, Math.max(2, b.h * 0.018))
  // the franja livery's pictogram: frequency ticks hanging from the rule
  dialTicks(p, b.x + pad, ruleY, b.w - 2 * pad, b.h * 0.05, team.on, Math.max(3, b.w * 0.012))
  // bottom strip
  const bh = b.h * 0.16
  const by = b.y + b.h - pad * 0.8 - bh
  barcode(p, b.x + pad, by, b.w * 0.24, bh, designOf(def), team.on)
  const chipW = energyChip(p, b.x + b.w - pad, by + bh * 0.22, bh * 0.56, team.on, 'right')
  const small = upper(def.art.lines[1] ?? 'Gradiente · CDMX')
  const smallW = b.w - 2 * pad - b.w * 0.27 - chipW - pad * 0.6
  text(p, small, b.x + pad + b.w * 0.27, by + bh * 0.42, { t: MONO_B, px: bh * 0.34, ls: bh * 0.04, fill: team.on, maxW: smallW })
  text(p, 'GRADIENTE.ORG', b.x + pad + b.w * 0.27, by + bh * 0.9, { t: MONO, px: bh * 0.3, ls: bh * 0.05, fill: team.on, maxW: smallW })
  // the name, with its misregistered plate
  const t = titleType(p, 900)
  const top = ruleY + b.h * 0.05 + pad * 0.7
  const room = by - pad * 0.7 - top
  const blk = fitBlock(p, upper(def.art.title), t, b.w - 2 * pad, room, 3, 0.88)
  const y0 = top + (room - blockHeight(blk)) / 2
  const off = blk.px * 0.045
  drawBlock(p, blk, t, b.x + pad + off, y0 + off, { fill: accent.color === team.on ? INK : accent.color })
  drawBlock(p, blk, t, b.x + pad, y0, { fill: team.on })
}

/** Ink on the left with the monogram in the team colour; the name on the stock. */
function tipoDividido(p: Pen, b: Rect) {
  const { x, def, team, R } = p
  const lw = b.w * (0.3 + R() * 0.08)
  x.fillStyle = INK
  x.fillRect(b.x, b.y, lw, b.h)
  const mono = monogram(def.art.title)
  const mt: Type = { f: 'display', w: 900, wd: mono.length > 2 ? 58 : 76 }
  const blk = fitBlock(p, mono, mt, lw * 0.78, b.h * 0.64, 1, 0.9)
  drawBlock(p, blk, mt, b.x + lw * 0.56, b.y + (b.h - blockHeight(blk)) / 2 - b.h * 0.03, { fill: team.color, align: 'center' })
  // the code, running up the edge
  x.save()
  x.translate(b.x + lw * 0.12, b.y + b.h * 0.92)
  x.rotate(-Math.PI / 2)
  text(p, `${def.art.code} · ${upper(def.art.lines[0] ?? '')}`, 0, 0, { t: MONO_B, px: b.h * 0.07, ls: b.h * 0.012, fill: PAPER, maxW: b.h * 0.84 })
  x.restore()
  // right side: the name on the stock, then a hazard band in the team colour
  const rx = b.x + lw
  const rw = b.w - lw
  const pad = b.h * 0.08
  const band = b.h * 0.2
  stripes(p, { x: rx, y: b.y + b.h - band, w: rw, h: band }, Math.PI / 4, band * 0.32, INK, team.color)
  const t = titleType(p)
  const kind = upper(def.art.lines[0] ?? 'Franja')
  text(p, kind, rx + pad, b.y + pad + b.h * 0.06, { t: MONO_B, px: b.h * 0.07, ls: b.h * 0.012, fill: INK })
  const top = b.y + pad + b.h * 0.12
  const room = b.h - band - pad - (top - b.y) - pad * 0.4
  const blk2 = fitBlock(p, upper(def.art.title), t, rw - 2 * pad, room, 3, 0.9)
  drawBlock(p, blk2, t, rx + pad, top + (room - blockHeight(blk2)) * 0.4, { fill: INK })
  // the code chip sits on the band
  const cpx = band * 0.36
  const cw = measure(p, def.art.code, { t: MONO_B, px: cpx, ls: cpx * 0.08 }) + cpx
  x.fillStyle = PAPER
  x.fillRect(rx + rw - pad - cw, b.y + b.h - band + band * 0.24, cw, band * 0.52)
  text(p, def.art.code, rx + rw - pad - cw / 2, b.y + b.h - band + band * 0.62, { t: MONO_B, px: cpx, ls: cpx * 0.08, fill: INK, align: 'center' })
}

/** A Wipeout team decal: a diagonal band, the name knocked out of the stock, registration marks. */
function tipoCalca(p: Pen, b: Rect) {
  const { x, def, team, accent, R, s } = p
  const angle = -(0.14 + R() * 0.16)
  const cy = b.y + b.h * (0.52 + (R() - 0.5) * 0.1)
  const th = b.h * 0.44
  x.save()
  x.translate(b.x + b.w / 2, cy)
  x.rotate(angle)
  const span = b.w * 1.4
  x.fillStyle = team.color
  x.fillRect(-span / 2, -th / 2, span, th)
  x.fillStyle = INK
  x.fillRect(-span / 2, -th / 2 - th * 0.16, span, Math.max(2, th * 0.05))
  x.fillStyle = accent.color
  x.fillRect(-span / 2, th / 2 + th * 0.1, span, Math.max(2, th * 0.07))
  x.restore()
  const pad = b.h * 0.08
  // header: channel chip and code
  const cpx = b.h * 0.075
  const chip = `CANAL ${LIBREA_FORMATO.franja.canal} · FR`
  const cw = measure(p, chip, { t: MONO_B, px: cpx, ls: cpx * 0.1 }) + cpx
  x.fillStyle = INK
  x.fillRect(b.x + pad, b.y + pad, cw, cpx * 1.7)
  text(p, chip, b.x + pad + cpx / 2, b.y + pad + cpx * 1.22, { t: MONO_B, px: cpx, ls: cpx * 0.1, fill: PAPER })
  text(p, def.art.code, b.x + b.w - pad - b.h * 0.18, b.y + pad + cpx * 1.22, { t: MONO_B, px: cpx, ls: cpx * 0.1, fill: INK, align: 'right' })
  regMark(p, b.x + b.w - pad - b.h * 0.05, b.y + pad + cpx * 0.85, b.h * 0.05, RED, Math.max(1, 1.6 * s))
  regMark(p, b.x + pad + b.h * 0.05, b.y + b.h - pad - b.h * 0.05, b.h * 0.05, RED, Math.max(1, 1.6 * s))
  // the name, knocked out of the stock so it reads over the band
  const t = titleType(p, 900)
  const room: Rect = { x: b.x + pad, y: b.y + b.h * 0.24, w: b.w - 2 * pad - b.h * 0.3, h: b.h * 0.52 }
  const blk = fitBlock(p, upper(def.art.title), t, room.w, room.h, 2, 0.9)
  const y0 = room.y + (room.h - blockHeight(blk)) / 2
  drawBlock(p, blk, t, room.x, y0, { stroke: p.stock === STOCK.transparente ? PAPER : p.stock, lw: blk.px * 0.14 })
  drawBlock(p, blk, t, room.x, y0, { fill: INK })
  chevrons(p, b.x + b.w - pad - b.h * 0.26, y0 + blockHeight(blk) / 2, b.h * 0.13, 3, INK)
  // foot
  const chipW = energyChip(p, b.x + b.w - pad, b.y + b.h - pad - b.h * 0.085, b.h * 0.085, INK, 'right')
  text(p, `${upper(def.art.lines[0] ?? '')} · GRADIENTE · CDMX`, b.x + pad + b.h * 0.14, b.y + b.h - pad - b.h * 0.02, { t: MONO_B, px: b.h * 0.062, ls: b.h * 0.012, fill: INK, maxW: b.w - 2 * pad - b.h * 0.14 - chipW - pad * 0.6 })
}

/** The house's line: the ramp, and ENERGÍA, NO GÉNERO set from glacial to volcán. */
function tipoCasa(p: Pen, b: Rect) {
  const { x, def, s } = p
  const pad = b.h * 0.08
  spectrumSteps(p, b.x, b.y, b.w, b.h * 0.16)
  x.fillStyle = INK
  x.fillRect(b.x, b.y + b.h * 0.16, b.w, Math.max(2, 2 * s))
  const title = upper(def.art.title)
  const comma = title.indexOf(',')
  const words = title.split(/\s+/)
  const mid = Math.ceil(words.length / 2)
  const lines = (comma > 0 ? [title.slice(0, comma + 1), title.slice(comma + 1).trim()] : [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]).filter(Boolean)
  const top = b.y + b.h * 0.16 + pad
  const room = b.h * 0.56
  const lineH = room / lines.length
  lines.forEach((line, li) => {
    // each letter a step hotter: width falls, weight rises
    const chars = [...line]
    const e = (i: number) => ((li * chars.length + i) / Math.max(1, lines.length * chars.length - 1)) * 10
    const tOf = (i: number): Type => {
      const f = energyFont(e(i))
      return { f: 'display', w: Math.max(620, f.wght), wd: f.wdth }
    }
    const widthAt = (px: number) => chars.reduce((sum, ch, i) => sum + measure(p, ch, { t: tOf(i), px }), 0)
    const px = Math.min(lineH * 1.12, (100 * (b.w - 2 * pad)) / widthAt(100))
    let at = b.x + pad
    const bl = top + lineH * (li + 1) - lineH * 0.14
    chars.forEach((ch, i) => {
      at += text(p, ch, at, bl, { t: tOf(i), px, fill: INK })
    })
  })
  const fy = b.y + b.h - pad
  text(p, `${def.art.code} — DE LA CASA · ${upper(def.art.lines.join(' · '))}`, b.x + pad, fy, { t: MONO_B, px: b.h * 0.062, ls: b.h * 0.012, fill: INK, maxW: b.w * 0.62 })
  regMark(p, b.x + b.w - pad - b.h * 0.05, fy - b.h * 0.03, b.h * 0.055, RED, Math.max(1, 1.8 * s))
  barcode(p, b.x + b.w - pad - b.h * 0.15 - b.w * 0.18, fy - b.h * 0.08, b.w * 0.16, b.h * 0.08, designOf(def), INK)
}

// ── cinta: a strip of tape ──────────────────────────────────────────────────

function formCinta(p: Pen) {
  const { x, W, H, def, R } = p
  const die = tapePath(W, H, R, H * 0.075)
  base(p, die)
  x.save()
  x.clip(die)
  const v = pick(R, ['peligro', 'gaffer', 'teletipo'] as const)
  const title = upper(def.art.title)
  const t = titleType(p, 900)
  const repeatRow = (draw: (at: number, i: number) => number, sepW: number) => {
    let at = -R() * W * 0.3
    let i = 0
    while (at < W && i < 64) {
      at += Math.max(1, draw(at, i)) + sepW
      i++
    }
  }
  if (v === 'peligro') {
    stripes(p, { x: 0, y: 0, w: W, h: H }, Math.PI / 4, H * 0.16, INK, p.team.color)
    const bh = H * 0.56
    const by = (H - bh) / 2
    x.fillStyle = p.stock === STOCK.transparente ? PAPER : p.stock
    x.fillRect(0, by, W, bh)
    x.fillStyle = INK
    x.fillRect(0, by, W, Math.max(2, H * 0.025))
    x.fillRect(0, by + bh - Math.max(2, H * 0.025), W, Math.max(2, H * 0.025))
    const blk = fitBlock(p, title, t, W, bh * 0.7, 1, 1)
    const px = Math.min(blk.px, bh * 0.66 / blk.cap)
    const bl = by + bh / 2 + (blk.cap * px) / 2
    const sep = bh * 0.5
    repeatRow((at) => {
      const w = text(p, title, at, bl, { t, px, fill: INK })
      xMark(p, at + w + sep / 2, by + bh / 2, bh * 0.14, INK, Math.max(2, bh * 0.07))
      return w
    }, sep)
  } else if (v === 'gaffer') {
    x.fillStyle = p.team.color
    x.fillRect(0, 0, W, H)
    const on = p.team.on
    const lpx = H * 0.085
    const line = `${def.art.code} — ${title} — ${upper(def.art.lines.join(' · '))} — `
    const lw = measure(p, line, { t: MONO_B, px: lpx, ls: lpx * 0.12 })
    for (let at = -R() * lw; at < W; at += lw) {
      text(p, line, at, H * 0.16, { t: MONO_B, px: lpx, ls: lpx * 0.12, fill: on })
      text(p, line, at - lw * 0.37, H * 0.93, { t: MONO_B, px: lpx, ls: lpx * 0.12, fill: on })
    }
    x.fillStyle = on
    x.fillRect(0, H * 0.22, W, Math.max(1.5, H * 0.012))
    x.fillRect(0, H * 0.78, W, Math.max(1.5, H * 0.012))
    const room = H * 0.46
    const blk = fitBlock(p, title, t, W, room, 1, 1)
    const px = Math.min(blk.px, room / blk.cap)
    const bl = H / 2 + (blk.cap * px) / 2
    const sep = H * 0.34
    repeatRow((at, i) => {
      const w = text(p, title, at, bl, i % 2 ? { t, px, stroke: on, lw: Math.max(1.5, px * 0.035) } : { t, px, fill: on })
      regMark(p, at + w + sep / 2, H / 2, H * 0.1, on, Math.max(1.5, H * 0.018))
      return w
    }, sep)
  } else {
    x.fillStyle = INK
    x.fillRect(0, 0, W, H)
    // ticker dashes
    const row = (y: number) => {
      let at = -R() * 40 * p.s
      while (at < W) {
        const w = (6 + R() * 30) * p.s
        x.fillRect(at, y, w, Math.max(1.5, H * 0.03))
        at += w + (4 + R() * 10) * p.s
      }
    }
    x.fillStyle = p.team.color
    row(H * 0.1)
    row(H * 0.86)
    const room = H * 0.52
    const blk = fitBlock(p, title, t, W, room, 1, 1)
    const px = Math.min(blk.px, room / blk.cap)
    const bl = H / 2 + (blk.cap * px) / 2
    const sep = H * 0.3
    repeatRow((at, i) => {
      const w = text(p, title, at, bl, { t, px, fill: i % 3 === 2 ? PAPER : p.team.color })
      chevrons(p, at + w + sep * 0.22, H / 2, H * 0.16, 2, PAPER)
      return w
    }, sep)
    text(p, def.art.code, W * 0.5, H * 0.26, { t: MONO_B, px: H * 0.07, ls: H * 0.02, fill: PAPER, align: 'center' })
  }
  x.restore()
  finish(p, die)
}

// ── boleto: the stub of a night ─────────────────────────────────────────────

function dateParts(iso: string | undefined) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
  const DAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
  const two = (n: number) => String(n).padStart(2, '0')
  return {
    day: two(d.getDate()),
    month: MONTHS[d.getMonth()],
    monthNum: two(d.getMonth() + 1),
    year: String(d.getFullYear()),
    weekday: DAYS[d.getDay()],
    time: `${two(d.getHours())}:${two(d.getMinutes())}`,
  }
}

async function formBoleto(p: Pen) {
  const { x, W, H, def, R, s } = p
  const fl = def.art.image ? await flyerOf(def.art.image) : null
  const r = H * 0.035
  const xp = W * (0.7 + R() * 0.04)
  const nr = H * 0.075
  const die = ticketPath(W, H, r, xp, nr)
  base(p, die)
  const dp = dateParts(def.art.date)
  const band: Tinta = fl?.vivid && R() < 0.45 ? { color: fl.vivid, on: onFor(fl.vivid), wdth: 118, wght: 900 } : p.team
  const bw = H * 0.04
  const lines = def.art.lines
  const venue = upper(lines[0] ?? 'CDMX')
  const lineup = lines[2] ?? ''
  x.save()
  x.clip(die)

  // ── the main part ──
  const m: Rect = { x: bw, y: bw, w: xp - nr * 0.6 - bw, h: H - 2 * bw }
  const bandH = m.h * 0.19
  x.fillStyle = band.color
  x.fillRect(m.x, m.y, m.w, bandH)
  stripes(p, { x: m.x + m.w - m.w * 0.17, y: m.y, w: m.w * 0.17, h: bandH }, Math.PI / 4, bandH * 0.22, band.on)
  const cpx = bandH * 0.4
  const cw = measure(p, def.art.code, { t: MONO_B, px: cpx, ls: cpx * 0.08 }) + cpx
  x.fillStyle = band.on
  x.fillRect(m.x + bandH * 0.22, m.y + bandH * 0.2, cw, bandH * 0.6)
  text(p, def.art.code, m.x + bandH * 0.22 + cw / 2, m.y + bandH * 0.62, { t: MONO_B, px: cpx, ls: cpx * 0.08, fill: band.color, align: 'center' })
  text(p, 'BOLETO · ENTRADA GENERAL', m.x + bandH * 0.22 + cw + cpx * 0.7, m.y + bandH * 0.64, { t: MONO_B, px: cpx * 0.9, ls: cpx * 0.12, fill: band.on, maxW: m.w * 0.83 - cw - bandH * 0.9 })

  const bodyY = m.y + bandH + m.h * 0.05
  const footH = m.h * 0.1
  const bodyH = m.h - bandH - m.h * 0.05 - footH - m.h * 0.03
  const side = Math.min(bodyH, m.w * 0.42)
  const flyerLeft = R() < 0.6
  const panel: Rect = { x: flyerLeft ? m.x : m.x + m.w - side, y: bodyY, w: side, h: bodyH }
  if (fl) {
    const scheme = pick(R, ['ink', 'band', 'energy'] as const)
    const ground = scheme === 'band' ? band.color : scheme === 'energy' ? p.energy.color : PAPER
    const ink = scheme === 'ink' ? INK : scheme === 'band' ? band.on : p.energy.on
    halftone(p, fl.src, panel, { cell: Math.max(3, 5.2 * s), angle: pick(R, [Math.PI / 4, Math.PI / 12, (5 * Math.PI) / 12]), ink, ground })
  } else {
    // no flyer: the date is the picture
    x.fillStyle = p.energy.color
    x.fillRect(panel.x, panel.y, panel.w, panel.h)
    const t: Type = { f: 'display', w: 900, wd: 70 }
    const blk = fitBlock(p, dp?.day ?? '··', t, panel.w * 0.8, panel.h * 0.62, 1)
    drawBlock(p, blk, t, panel.x + panel.w / 2, panel.y + panel.h * 0.1, { fill: p.energy.on, align: 'center' })
    text(p, dp ? `${dp.month} ${dp.year}` : 'CDMX', panel.x + panel.w / 2, panel.y + panel.h * 0.9, { t: MONO_B, px: panel.h * 0.1, ls: panel.h * 0.015, fill: p.energy.on, align: 'center' })
  }
  x.strokeStyle = INK
  x.lineWidth = Math.max(1, 1.6 * s)
  x.strokeRect(panel.x + 0.5, panel.y + 0.5, panel.w - 1, panel.h - 1)

  // the words beside the picture
  const tx0 = flyerLeft ? panel.x + side + m.w * 0.04 : m.x
  const tw = m.w - side - m.w * 0.04
  const t = titleType(p, 900)
  const titleRoom = bodyH * 0.5
  const blk = fitBlock(p, upper(corto(def.art.title)), t, tw, titleRoom, 3, 0.9)
  drawBlock(p, blk, t, tx0, bodyY, { fill: INK })
  let y = bodyY + blockHeight(blk) + bodyH * 0.08
  text(p, venue, tx0, y + bodyH * 0.07, { t: MONO_B, px: bodyH * 0.085, ls: bodyH * 0.01, fill: INK, maxW: tw })
  y += bodyH * 0.13
  if (dp) {
    const dt: Type = { f: 'display', w: 900, wd: 88 }
    const dpx = bodyH * 0.2
    // the band's ink when it reads on the stock, else ink
    const dateInk = onFor(band.color) === PAPER ? band.color : INK
    const w1 = text(p, `${dp.day}.${dp.monthNum}`, tx0, y + dpx * capOf(p, dt), { t: dt, px: dpx, fill: dateInk })
    text(p, `${dp.weekday} ${dp.time}`, tx0 + w1 + dpx * 0.25, y + dpx * capOf(p, dt), { t: MONO_B, px: dpx * 0.42, ls: dpx * 0.04, fill: INK, maxW: tw - w1 - dpx * 0.25 })
    y += dpx * 0.95
  }
  if (lineup) {
    const lpx = bodyH * 0.075
    const room = bodyY + bodyH - y
    if (room > lpx * 1.1) {
      const words = lineup.split(' · ')
      let l1 = ''
      let l2 = ''
      for (const w of words) {
        const cand = l1 ? `${l1} · ${w}` : w
        if (!l2 && measure(p, cand, { t: UI_B, px: lpx }) <= tw) l1 = cand
        else l2 = l2 ? `${l2} · ${w}` : w
      }
      text(p, l1, tx0, y + lpx, { t: UI_B, px: lpx, fill: INK, maxW: tw })
      if (l2 && room > lpx * 2.3) text(p, l2, tx0, y + lpx * 2.2, { t: UI_B, px: lpx, fill: INK, maxW: tw })
    }
  }

  // foot: small print and the energy
  const fy = m.y + m.h - footH
  x.fillStyle = INK
  x.fillRect(m.x, fy - m.h * 0.02, m.w, Math.max(1, 1.2 * s))
  text(p, 'TALÓN VÁLIDO COMO RECUERDO · NO TRANSFERIBLE · GRADIENTE · CDMX', m.x, fy + footH * 0.62, { t: MONO, px: footH * 0.46, ls: footH * 0.03, fill: INK, maxW: m.w * 0.62 })
  energyChip(p, m.x + m.w, fy + footH * 0.08, footH * 0.72, INK, 'right')

  // ── perforation ──
  x.fillStyle = INK
  const dash = H * 0.022
  for (let yy = nr + dash; yy < H - nr - dash; yy += dash * 2.2) x.fillRect(xp - 0.5, yy, Math.max(1, s), dash)

  // ── the stub ──
  const st: Rect = { x: xp + nr * 0.6, y: bw, w: W - bw - (xp + nr * 0.6), h: H - 2 * bw }
  const sp = st.w * 0.1
  x.fillStyle = band.color
  x.fillRect(st.x, st.y, st.w, st.h * 0.15)
  text(p, 'TALÓN', st.x + st.w / 2, st.y + st.h * 0.108, { t: MONO_B, px: st.h * 0.075, ls: st.h * 0.02, fill: band.on, align: 'center' })
  if (dp) {
    const dt: Type = { f: 'display', w: 900, wd: 64 }
    const blk2 = fitBlock(p, dp.day, dt, st.w - 2 * sp, st.h * 0.3, 1)
    drawBlock(p, blk2, dt, st.x + st.w / 2, st.y + st.h * 0.2, { fill: INK, align: 'center' })
    text(p, `${dp.month} ${dp.year}`, st.x + st.w / 2, st.y + st.h * 0.2 + blockHeight(blk2) + st.h * 0.1, { t: MONO_B, px: st.h * 0.07, ls: st.h * 0.012, fill: INK, align: 'center', maxW: st.w - 2 * sp })
  }
  const serial = String(hashStr(designOf(def)) % 100000).padStart(5, '0')
  text(p, `Nº ${serial}`, st.x + st.w / 2, st.y + st.h * 0.7, { t: MONO_B, px: st.h * 0.062, ls: st.h * 0.01, fill: INK, align: 'center', maxW: st.w - 2 * sp })
  barcode(p, st.x + sp, st.y + st.h * 0.75, st.w - 2 * sp, st.h * 0.16, designOf(def) + ':stub', INK)
  text(p, 'ADMITE UNO', st.x + st.w / 2, st.y + st.h * 0.985, { t: MONO, px: st.h * 0.05, ls: st.h * 0.012, fill: INK, align: 'center', maxW: st.w - 2 * sp })
  x.restore()
  finish(p, die)

  // the perforation holes go through the stock
  x.save()
  x.globalCompositeOperation = 'destination-out'
  const hr = Math.max(1, H * 0.009)
  for (let yy = nr + dash * 2.2; yy < H - nr - dash; yy += dash * 2.2) {
    x.beginPath()
    x.arc(xp, yy - dash * 0.1, hr, 0, Math.PI * 2)
    x.fill()
  }
  x.restore()
}

// ── círculo: a flyer (or a mark) in a ring of text ──────────────────────────

async function formCirculo(p: Pen) {
  const { x, W, H, def, R, s } = p
  const cx = W / 2
  const cy = H / 2
  const Rr = Math.min(W, H) / 2 - 0.5
  const die = circle(cx, cy, Rr)
  base(p, die)
  const bw = Rr * 0.075
  const r0 = Rr - bw
  const r1 = r0 * (0.7 + R() * 0.05)
  const metal = foilish(def)
  let disc: { draw: () => void } | null = null
  let ring: Tinta
  const fl = def.source === 'evento' && def.art.image ? await flyerOf(def.art.image) : null
  const mark = def.source !== 'evento' && def.art.logo ? await markOf(def.art.logo) : null
  if (def.source === 'evento') {
    ring = fl?.vivid && R() < 0.5 ? { color: fl.vivid, on: onFor(fl.vivid), wdth: 118, wght: 900 } : R() < 0.75 ? p.team : { color: INK, on: PAPER, wdth: 100, wght: 900 }
  } else ring = metal ? { color: '', on: INK, wdth: 100, wght: 900 } : R() < 0.6 ? p.team : { color: INK, on: PAPER, wdth: 100, wght: 900 }
  const rd = r1 - Math.max(1.5, 2 * s)
  if (fl) {
    disc = {
      draw: () => {
        const crop = coverCrop(fl.src, 1, 0.5, 0.42)
        x.drawImage(fl.src, crop.x, crop.y, crop.w, crop.h, cx - rd, cy - rd, rd * 2, rd * 2)
      },
    }
  } else if (mark) {
    disc = {
      draw: () => {
        if (mark.mode === 'photo') {
          const crop = coverCrop(mark.src, 1)
          x.drawImage(mark.src, crop.x, crop.y, crop.w, crop.h, cx - rd, cy - rd, rd * 2, rd * 2)
          return
        }
        x.fillStyle = mark.bg ? rgbHex(mark.bg) : metal ? 'rgba(255,255,255,0.35)' : p.stock
        x.fillRect(cx - rd, cy - rd, rd * 2, rd * 2)
        const k = Math.min((rd * 1.25) / mark.crop.w, (rd * 1.25) / mark.crop.h)
        x.drawImage(mark.src, mark.crop.x, mark.crop.y, mark.crop.w, mark.crop.h, cx - (mark.crop.w * k) / 2, cy - (mark.crop.h * k) / 2, mark.crop.w * k, mark.crop.h * k)
      },
    }
  }
  x.save()
  x.clip(circle(cx, cy, r0))
  if (ring.color) {
    x.fillStyle = ring.color
    x.fillRect(0, 0, W, H)
  }
  // the disc
  x.save()
  x.clip(circle(cx, cy, rd))
  if (disc) disc.draw()
  else {
    // no picture: the monogram on the energy's ink
    x.fillStyle = p.energy.color
    x.fillRect(0, 0, W, H)
    const t: Type = { f: 'display', w: 900, wd: 70 }
    const blk = fitBlock(p, monogram(def.art.title), t, rd * 1.3, rd * 0.9, 1)
    drawBlock(p, blk, t, cx, cy - blockHeight(blk) / 2, { fill: p.energy.on, align: 'center' })
  }
  x.restore()
  x.strokeStyle = ring.color ? ring.on : INK
  x.lineWidth = Math.max(1.5, 2.2 * s)
  x.stroke(circle(cx, cy, r1))
  x.lineWidth = Math.max(1, 1.2 * s)
  x.stroke(circle(cx, cy, r0 - Math.max(2, 3 * s)))
  // text around the ring, leaving the bottom for the chip and the top for the mark
  const rt = (r0 + r1) / 2
  const gapA = 0.36
  const from = Math.PI / 2 + gapA
  const to = Math.PI / 2 + Math.PI * 2 - gapA
  const dp = dateParts(def.art.date)
  const parts =
    def.source === 'evento'
      ? [upper(corto(def.art.title, 30)), dp ? `${dp.day} ${dp.month} ${dp.year}` : '', upper(def.art.lines[0] ?? '')]
      : [upper(def.art.title), def.edition ? `EDICIÓN DE ${def.edition}` : upper(def.art.lines[1] ?? ''), def.art.code]
  const want = (r0 - r1) * 0.44
  const ph = ringPhrase(p, parts, rt, to - from, MONO_B, want, want * 0.62)
  ringText(p, ph.str, cx, cy, rt, from, to, { t: MONO_B, px: ph.px, color: ring.color ? ring.on : INK })
  // the chip at the bottom, the registration mark at the top
  const chipH = (r0 - r1) * 0.62
  const cpx = chipH * 0.56
  const cw = measure(p, def.art.code, { t: MONO_B, px: cpx, ls: cpx * 0.06 }) + cpx
  x.fillStyle = ring.color ? ring.on : INK
  x.fillRect(cx - cw / 2, cy + rt - chipH / 2, cw, chipH)
  text(p, def.art.code, cx, cy + rt + chipH * 0.3, { t: MONO_B, px: cpx, ls: cpx * 0.06, fill: ring.color ? ring.color : PAPER, align: 'center' })
  x.restore()
  finish(p, die)
}

// ── sello: a seal with a rough edge ─────────────────────────────────────────

async function formSello(p: Pen) {
  const { x, W, H, def, R, s } = p
  const cx = W / 2
  const cy = H / 2
  const R0 = Math.min(W, H) / 2 - 0.5
  const casa = def.source === 'casa'
  const edge = casa ? 'burst' : pick(R, ['burst', 'scallop', 'rough'] as const)
  const die = sealPath(cx, cy, R0, R, edge)
  base(p, die)
  const metal = foilish(def)
  const mark = !casa && def.art.logo ? await markOf(def.art.logo) : null
  const inkA = casa ? RED : p.team.color
  const inkB = INK
  const rp = R0 * 0.84

  // Inks go on their own layer so the stamp can wear (a rubber stamp never prints solid).
  const layer = mk(W, H)
  const lx = ctx2d(layer)
  const lp: Pen = { ...p, x: lx }
  const solid = !metal && !casa && R() < 0.5
  // or only the core printed solid, the mark knocked out of it
  const core = !solid && !casa && R() < 0.45
  const centre = solid || core ? p.team.on : inkB
  if (solid) {
    lx.fillStyle = inkA
    lx.fill(circle(cx, cy, rp))
  }
  const onA = solid ? p.team.on : inkB
  lx.strokeStyle = solid ? p.team.on : inkA
  lx.lineWidth = Math.max(2, rp * 0.045)
  lx.stroke(circle(cx, cy, rp * 0.95))
  lx.lineWidth = Math.max(1, rp * 0.014)
  lx.stroke(circle(cx, cy, rp * 0.88))
  lx.stroke(circle(cx, cy, rp * 0.6))
  if (core) {
    lx.fillStyle = inkA
    lx.fill(circle(cx, cy, rp * 0.6))
  }
  // ring text between the lines
  const rt = rp * 0.74
  const parts = casa ? ['GRADIENTE', 'TRAMA', 'REGISTRO', 'CDMX'] : [upper(def.art.title), def.edition ? `EDICIÓN DE ${def.edition}` : upper(def.art.lines[0] ?? ''), 'CDMX']
  const want = rp * 0.15
  const ph = ringPhrase(lp, parts, rt, Math.PI * 2 * 0.97, MONO_B, want, want * 0.6, ' ★ ')
  const turn = -Math.PI / 2 + (R() - 0.5) * 0.7
  ringText(lp, ph.str, cx, cy, rt, turn, turn + Math.PI * 2 * 0.999, { t: MONO_B, px: ph.px, color: onA })
  // the centre
  if (casa) {
    regMark(lp, cx, cy - rp * 0.04, rp * 0.44, RED, Math.max(2, rp * 0.05))
  } else if (mark && mark.mode !== 'photo' && R() < 0.55) {
    const k = Math.min((rp * 0.78) / mark.crop.w, (rp * 0.62) / mark.crop.h)
    const w = mark.crop.w * k
    const h = mark.crop.h * k
    const mc = mk(Math.ceil(w), Math.ceil(h))
    const mx = ctx2d(mc, true)
    mx.drawImage(mark.src, mark.crop.x, mark.crop.y, mark.crop.w, mark.crop.h, 0, 0, w, h)
    // a stamp prints the mark in one ink
    const img = mx.getImageData(0, 0, mc.width, mc.height)
    const a = img.data
    for (let i = 0; i < a.length; i += 4) {
      const cover = mark.bg ? Math.max(0, Math.min(1, (colorDist(a, i, mark.bg) - 0.06) / 0.16)) : a[i + 3] / 255
      a[i + 3] = cover * 255
    }
    mx.putImageData(img, 0, 0)
    mx.globalCompositeOperation = 'source-in'
    mx.fillStyle = centre
    mx.fillRect(0, 0, mc.width, mc.height)
    lx.drawImage(mc, cx - w / 2, cy - h / 2 - rp * 0.06)
  } else {
    const t: Type = { f: 'display', w: 900, wd: 64 }
    const blk = fitBlock(lp, monogram(def.art.title), t, rp * 0.92, rp * 0.5, 1)
    drawBlock(lp, blk, t, cx, cy - blockHeight(blk) / 2 - rp * 0.08, { fill: centre, align: 'center' })
  }
  // the ribbon across (inside the text ring)
  const rw = rp * 1.02
  const rh = rp * 0.2
  const ry = cy + rp * 0.3
  lx.fillStyle = solid ? p.team.on : inkB
  lx.beginPath()
  lx.moveTo(cx - rw / 2 - rh * 0.5, ry - rh / 2)
  lx.lineTo(cx + rw / 2 + rh * 0.5, ry - rh / 2)
  lx.lineTo(cx + rw / 2 + rh * 0.15, ry)
  lx.lineTo(cx + rw / 2 + rh * 0.5, ry + rh / 2)
  lx.lineTo(cx - rw / 2 - rh * 0.5, ry + rh / 2)
  lx.lineTo(cx - rw / 2 - rh * 0.15, ry)
  lx.closePath()
  lx.fill()
  const ribbon = casa ? def.art.code : def.edition ? `${def.art.code} · ${def.edition}` : def.art.code
  text(lp, ribbon, cx, ry + rh * 0.3, { t: MONO_B, px: rh * 0.58, ls: rh * 0.08, fill: solid ? inkA : metal ? '#e9ecf0' : p.stock === STOCK.transparente ? PAPER : p.stock, align: 'center', maxW: rw * 0.92 })
  star(lp, cx, cy - rp * 0.5, rp * 0.05, solid || core ? p.team.on : inkA)
  // wear: a stamp's ink never lands solid
  if (!metal) {
    lx.save()
    lx.globalCompositeOperation = 'destination-out'
    const n = Math.round((W * H) / 900)
    for (let i = 0; i < n; i++) {
      lx.globalAlpha = 0.25 + R() * 0.6
      lx.beginPath()
      lx.arc(R() * W, R() * H, (0.4 + R() * 1.6) * s, 0, Math.PI * 2)
      lx.fill()
    }
    lx.restore()
  }
  x.save()
  x.clip(die)
  x.drawImage(layer, 0, 0)
  x.restore()
  finish(p, die)
}

// ═══ render ═════════════════════════════════════════════════════════════════

async function render(def: StickerDef, W: number): Promise<HTMLCanvasElement> {
  const H = Math.max(8, Math.round(W / def.aspect))
  const c = mk(W, H)
  try {
    const F = await faces()
    const p = pen(c, def, F)
    switch (def.form) {
      case 'logo':
        await formLogo(p)
        break
      case 'tipo':
        formTipo(p)
        break
      case 'cinta':
        formCinta(p)
        break
      case 'boleto':
        await formBoleto(p)
        break
      case 'circulo':
        await formCirculo(p)
        break
      case 'sello':
        await formSello(p)
        break
    }
  } catch {
    // A sticker always arrives: a plain die-cut if the print failed.
    fallback(c, def)
  }
  return c
}

function fallback(c: HTMLCanvasElement, def: StickerDef) {
  const x = ctx2d(c)
  const W = c.width
  const H = c.height
  x.setTransform(1, 0, 0, 1, 0, 0)
  x.globalCompositeOperation = 'source-over'
  x.globalAlpha = 1
  x.clearRect(0, 0, W, H)
  const round = def.form === 'circulo' || def.form === 'sello'
  const die = round ? circle(W / 2, H / 2, Math.min(W, H) / 2 - 1) : shape('round', 1, 1, W - 2, H - 2, Math.min(W, H) * 0.08)
  x.fillStyle = STOCK.vinil
  x.fill(die)
  const e = energySlotHex(def.energy)
  x.save()
  x.clip(die)
  x.fillStyle = e
  const inset = Math.min(W, H) * 0.06
  x.fillRect(inset, inset, W - 2 * inset, H - 2 * inset)
  x.fillStyle = energyOn(def.energy)
  x.font = `800 ${Math.round(Math.min(H * 0.2, W * 0.12))}px system-ui, sans-serif`
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(def.art.title.slice(0, 16).toUpperCase(), W / 2, H / 2, W * 0.8)
  x.restore()
}

// ═══ encoding & textures ════════════════════════════════════════════════════

function encode(c: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    const done = (u: string) => {
      // release the backing store: the blob holds the picture now
      c.width = 0
      c.height = 0
      resolve(u)
    }
    try {
      c.toBlob(
        (b) => {
          if (b) done(URL.createObjectURL(b))
          else {
            try {
              const u = c.toDataURL('image/png')
              done(u)
            } catch {
              done('')
            }
          }
        },
        'image/webp',
        0.92,
      )
    } catch {
      done('')
    }
  })
}

function paintTexture(m: StickerMaterial): HTMLCanvasElement {
  const S = 256
  const c = mk(S, S)
  const x = ctx2d(c)
  const R = rng(hashStr(`tex:${m}`))
  if (m === 'holo') {
    // diffraction: hard spectral bands and fine grating lines, seamless along x
    const cols = ['#ff5f9e', '#ffb13d', '#fff15a', '#5dff9b', '#38d5ff', '#6b7cff', '#c35dff']
    const bands = 14
    for (let i = 0; i < bands; i++) {
      x.fillStyle = cols[i % cols.length]
      x.fillRect((S * i) / bands, 0, S / bands + 0.5, S)
    }
    x.globalAlpha = 0.35
    x.fillStyle = '#ffffff'
    for (let i = 0; i < S; i += 3) x.fillRect(i, 0, 1, S)
    x.globalAlpha = 1
  } else if (m === 'brillo') {
    const cols = ['#ffffff', '#fff3c4', '#c9f0ff', '#ffd1f0', '#d7ffcf']
    for (let i = 0; i < 520; i++) {
      const sz = 1 + R() * 3
      x.globalAlpha = 0.4 + R() * 0.6
      x.fillStyle = cols[Math.floor(R() * cols.length)]
      x.save()
      x.translate(R() * S, R() * S)
      x.rotate(R() * Math.PI)
      x.fillRect(-sz / 2, -sz / 2, sz, sz)
      x.restore()
    }
    x.globalAlpha = 1
  } else if (m === 'papel') {
    x.lineCap = 'round'
    for (let i = 0; i < 900; i++) {
      const len = 2 + R() * 9
      const a = R() * Math.PI
      const px = R() * S
      const py = R() * S
      x.globalAlpha = 0.08 + R() * 0.14
      x.strokeStyle = R() < 0.75 ? '#4a4232' : '#ffffff'
      x.lineWidth = 0.7
      x.beginPath()
      x.moveTo(px, py)
      x.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len)
      x.stroke()
    }
    x.globalAlpha = 1
  } else {
    // gloss: a wide hard band and a thin one, diagonal across a clear tile
    x.save()
    x.translate(S / 2, S / 2)
    x.rotate(-0.55)
    x.fillStyle = 'rgba(255,255,255,0.8)'
    x.fillRect(-S * 0.07, -S, S * 0.14, S * 2)
    x.fillStyle = 'rgba(255,255,255,0.55)'
    x.fillRect(S * 0.11, -S, S * 0.035, S * 2)
    x.restore()
  }
  return c
}

/**
 * The lenticular's second picture (frame 'b'): the same die-cut as frame a —
 * its alpha, to the pixel — printed as the franja's other face: the livery at
 * full volume. The team colour flooded, its dial ticks in rows, the monogram
 * (or, on a long sticker, the name) set huge with its second plate off
 * register, an ink band with the code and a barcode, the energy chip. Tilting
 * across the ridges flips the mark into its colours and back.
 */
async function frameB(def: StickerDef, a: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const W = a.width
  const H = a.height
  const c = mk(W, H)
  try {
    const F = await faces()
    const p = pen(c, def, F)
    const { x, s, team, accent } = p
    const ac = mk(W, H)
    const ax = ctx2d(ac, true)
    ax.drawImage(a, 0, 0)
    const alpha = ax.getImageData(0, 0, W, H).data
    let x0 = W
    let y0 = H
    let x1 = -1
    let y1 = -1
    for (let yy = 0; yy < H; yy++)
      for (let xx = 0; xx < W; xx++) {
        if (alpha[(yy * W + xx) * 4 + 3] < 128) continue
        if (xx < x0) x0 = xx
        if (xx > x1) x1 = xx
        if (yy < y0) y0 = yy
        if (yy > y1) y1 = yy
      }
    if (x1 < 0) throw new Error('empty die')
    const box: Rect = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
    const long = box.w / box.h > 1.8
    /** The die's inside across a band of rows (a contour cut is rarely a rectangle). */
    const span = (top: number, bottom: number): { l: number; r: number } => {
      let l = box.x
      let r = box.x + box.w
      for (let yy = Math.max(0, Math.floor(top)); yy <= Math.min(H - 1, Math.ceil(bottom)); yy++) {
        let a0 = -1
        let a1 = -1
        for (let xx = 0; xx < W; xx++)
          if (alpha[(yy * W + xx) * 4 + 3] >= 128) {
            if (a0 < 0) a0 = xx
            a1 = xx
          }
        if (a0 < 0) continue
        l = Math.max(l, a0)
        r = Math.min(r, a1 + 1)
      }
      return r - l > box.w * 0.25 ? { l, r } : { l: box.x, r: box.x + box.w }
    }

    // 1 · the livery, flooded
    x.fillStyle = team.color
    x.fillRect(0, 0, W, H)
    // 2 · its pictogram: frequency ticks in rows, faint
    x.save()
    x.globalAlpha = 0.24
    const row = box.h * (long ? 0.34 : 0.15)
    for (let yy = box.y + row * 0.3; yy < box.y + box.h; yy += row) dialTicks(p, box.x, yy, box.w, row * 0.32, team.on, Math.max(3, Math.min(box.w, box.h) * 0.022))
    x.restore()
    // 3 · the ink band: the code and a barcode
    const bandH = box.h * (long ? 0.22 : 0.16)
    const bandY = box.y + box.h * (long ? 0.7 : 0.72)
    x.fillStyle = INK
    x.fillRect(0, bandY, W, bandH)
    const bs = span(bandY, bandY + bandH)
    const bw = bs.r - bs.l
    const bpx = bandH * 0.44
    text(p, def.art.code, bs.l + bw * 0.08, bandY + bandH * 0.66, { t: MONO_B, px: bpx, ls: bpx * 0.08, fill: PAPER, maxW: bw * 0.46 })
    barcode(p, bs.l + bw * 0.6, bandY + bandH * 0.22, bw * 0.3, bandH * 0.56, designOf(def) + ':b', PAPER)
    // 4 · the monogram (or the name), huge, its second plate off register
    const word = long ? upper(corto(def.art.title, 26)) : monogram(def.art.title)
    const t: Type = { f: 'display', w: 900, wd: long ? 96 : word.length > 3 ? 62 : 84 }
    const top0 = box.y + box.h * (long ? 0.12 : 0.16)
    const roomH = box.h * 0.5
    const ms = span(top0, top0 + roomH)
    const room: Rect = { x: ms.l + (ms.r - ms.l) * 0.1, y: top0, w: (ms.r - ms.l) * 0.8, h: roomH }
    const blk = fitBlock(p, word, t, room.w, room.h, long ? 1 : 2, 0.88)
    const top = room.y + (room.h - blockHeight(blk)) / 2
    const off = blk.px * 0.05
    const plate = accent.color === team.on ? INK : accent.color
    drawBlock(p, blk, t, room.x + room.w / 2 + off, top + off, { fill: plate, align: 'center' })
    drawBlock(p, blk, t, room.x + room.w / 2, top, { fill: team.on, align: 'center' })
    // 5 · the energy, top right (inside the die at that height)
    const chipH = box.h * (long ? 0.13 : 0.075)
    const chipY = box.y + box.h * 0.08
    const cs = span(chipY, chipY + chipH)
    energyChip(p, cs.r - (cs.r - cs.l) * 0.07, chipY, chipH, team.on, 'right')
    // 6 · frame a's die, exactly
    x.globalCompositeOperation = 'destination-in'
    x.drawImage(a, 0, 0)
    x.globalCompositeOperation = 'source-over'
    // 7 · its cut edge: a hairline just inside
    const r = Math.max(1, Math.round(1.6 * s))
    const inside = new Uint8Array(W * H)
    for (let i = 0; i < inside.length; i++) inside[i] = alpha[i * 4 + 3] >= 128 ? 1 : 0
    const eroded = erode(erode(inside, W, H, r, true), W, H, r, false)
    const img = x.getImageData(0, 0, W, H)
    const o = img.data
    for (let i = 0; i < inside.length; i++) {
      if (!inside[i] || eroded[i]) continue
      o[i * 4] *= 0.8
      o[i * 4 + 1] *= 0.8
      o[i * 4 + 2] *= 0.8
    }
    x.putImageData(img, 0, 0)
  } catch {
    const x = ctx2d(c)
    x.clearRect(0, 0, W, H)
    x.drawImage(a, 0, 0)
  }
  return c
}

/** One pass of a min filter (row or column), radius r: shrinks a 0/1 mask. */
function erode(m: Uint8Array, W: number, H: number, r: number, rows: boolean): Uint8Array {
  const out = new Uint8Array(m.length)
  const n = rows ? W : H
  const lines = rows ? H : W
  for (let l = 0; l < lines; l++) {
    let run = 0
    // distance to the last 0 behind, then ahead: a pixel stays when neither is within r
    const behind = new Int32Array(n)
    for (let k = 0; k < n; k++) {
      const v = rows ? m[l * W + k] : m[k * W + l]
      run = v ? run + 1 : 0
      behind[k] = run
    }
    run = 0
    for (let k = n - 1; k >= 0; k--) {
      const i = rows ? l * W + k : k * W + l
      run = m[i] ? run + 1 : 0
      out[i] = behind[k] > r && run > r ? 1 : 0
    }
  }
  return out
}
