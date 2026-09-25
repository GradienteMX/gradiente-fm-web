/**
 * The printed faces of the Credencial, drawn on canvas.
 *
 * Two canvases, both atlases (front face on top, back face below):
 *   · print   what is printed on the board (sRGB, opaque): the stock, its
 *             cotton surface, the one ink
 *   · relief  half resolution; R = height (blind emboss, blurred into
 *             bevels: the seal, the pins), G = foil mask (where the role's
 *             foil is stamped: the border, the wordmark, the role chip /
 *             rank badge, the folio, the seal, the pins, the flags), B = how
 *             deep a mark is pressed (letterpress: every inked or stamped
 *             mark sinks into the board; the shader takes the stroke itself
 *             from the print, at full resolution, and this for its depth)
 * Every mark is drawn once through `Pen.draw`, which paints it on both, so
 * the relief always registers with the print. The card shader lets the
 * foil replace the ink only where both agree.
 *
 * A third, small canvas is the case's engraving: the folio, the handle and
 * the role, laser-cut into the frosted band under the card (caseShader).
 *
 * Type: Anybody's axes can't be set on canvas directly, but its width axis
 * answers to the font-stretch keywords and its weight axis to numeric
 * weights, so the wordmark's energy gradient is stepped through them (eight
 * widths × any weight). If the browser ignores stretch on canvas the steps
 * fall back to weight alone.
 *
 * Palette: the board is the role's livery (`cardStock` — the colour of a
 * format in the feed), the ink the livery's own `on`: a printed card, a
 * coloured cotton board, one ink.
 */

import type { UserRank } from '@/lib/types'
import { ROLE_LABEL } from '@/components/kit/Persona'
import { RANK_LABEL } from '@/components/kit/Glyph'
import { energyFont } from '@/lib/vibe'
import { fmt } from '@/lib/logic/time'
import type { CredencialData } from './data'
import { cardStock, roleBand } from './data'
import { drawSigil, RANK_SIGIL, ruedaPath, TROPHY_SIGIL } from './sigils'
import { hexRGBA, mixRGB, rgba, type RGBA } from './cssColor'

// ── geometry (design units: the card is 1586 × 1000, ID-1 proportions) ──────

export const DW = 1586
export const DH = 1000
export const CARD_ASPECT = DW / DH
const M = 80
const TAU = Math.PI * 2

/** The palette of the print being painted (set at the start of paint()). */
let PAL: { ink: RGBA; stock: RGBA; back: RGBA } = {
  ink: [17, 17, 17, 1],
  stock: [255, 196, 0, 1],
  back: [242, 186, 0, 1],
}
const INK = (a: number) => rgba(PAL.ink, a)

/** The engraving under the card: its canvas, in texels (the lower frosted band, ~31:1). */
export const LABEL_W = 1024
export const LABEL_H = 32

// ── fonts ───────────────────────────────────────────────────────────────────

export interface CardFonts {
  display: string
  ui: string
  read: string
  /** Labels, indices, codes, counters (TRAMA). Falls back to the UI face. */
  mono: string
  /** Canvas honours font-stretch for Anybody's wdth axis. */
  stretch: boolean
}

/** Resolve a --font-* token (which may nest var()) to a family list canvas accepts. */
function cssFamily(token: string, fallback: string): string {
  if (typeof document === 'undefined' || !document.body) return fallback
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

let fontsPromise: Promise<CardFonts> | null = null

/** Resolve + load the card's faces once per session (never blocks > 2.5 s). */
export function cardFonts(): Promise<CardFonts> {
  if (fontsPromise) return fontsPromise
  fontsPromise = (async () => {
    const display = cssFamily('--font-display', 'Anybody, "Arial Narrow", sans-serif')
    const ui = cssFamily('--font-ui', '"Instrument Sans", system-ui, sans-serif')
    const read = cssFamily('--font-read', 'Newsreader, Georgia, serif')
    const mono = cssFamily('--font-mono', ui)
    const probes = [
      `300 40px ${display}`,
      `800 40px ${display}`,
      `ultra-condensed 900 40px ${display}`,
      `extra-expanded 200 40px ${display}`,
      `500 20px ${ui}`,
      `700 20px ${ui}`,
      `italic 400 20px ${read}`,
      `400 20px ${mono}`,
      `700 20px ${mono}`,
    ]
    try {
      await Promise.race([
        Promise.all(probes.map((f) => document.fonts.load(f, 'GRADIENTE Ñá@0123'))),
        new Promise((r) => setTimeout(r, 2500)),
      ])
    } catch {
      /* fall through with whatever is available */
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
    return { display, ui, read, mono, stretch }
  })()
  return fontsPromise
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

function stretchFor(wdth: number): string {
  let best = STRETCH[0]
  for (const s of STRETCH) if (Math.abs(s[0] - wdth) < Math.abs(best[0] - wdth)) best = s
  return best[1]
}

interface FontSpec {
  family: string
  size: number
  weight?: number
  /** Anybody width (wdth axis, 50–150). */
  wdth?: number
  italic?: boolean
}

// ── drawing ─────────────────────────────────────────────────────────────────

interface Mat {
  color: string | CanvasGradient
  foil?: number
  ink?: number
  height?: number
}

type Style = string | CanvasGradient
type DrawFn = (ctx: CanvasRenderingContext2D, style: Style) => void

/** A stable number per card (its folio and handle), for the dye's unevenness. */
function seedOf(d: CredencialData): number {
  const s = `${d.folio}|${d.handle ?? d.name}`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const BOARD = 512

let board: HTMLCanvasElement | null = null
/**
 * A heavy cotton board's surface, tileable, in neutral grey (mid-grey
 * changes nothing under soft-light): the cloudy formation of the pulp, a
 * scatter of fibres a little lighter or darker than the board, a fine
 * speckle. Built once; printed in design units, so a fibre is the same
 * size on the card at any resolution.
 */
function boardTile(): HTMLCanvasElement {
  if (board) return board
  const c = document.createElement('canvas')
  c.width = c.height = BOARD
  const x = c.getContext('2d')!
  const rnd = mulberry(11)
  // Formation: wrapped value noise, four octaves.
  const octaves: Array<[number, number]> = [
    [6, 0.46],
    [13, 0.28],
    [27, 0.16],
    [56, 0.1],
  ]
  const grids = octaves.map(([n]) => Float32Array.from({ length: n * n }, () => rnd()))
  const img = x.createImageData(BOARD, BOARD)
  const sm = (t: number) => t * t * (3 - 2 * t)
  for (let py = 0; py < BOARD; py++) {
    for (let px = 0; px < BOARD; px++) {
      let v = 0
      for (let o = 0; o < octaves.length; o++) {
        const [n, amp] = octaves[o]
        const g = grids[o]
        const fx = (px / BOARD) * n
        const fy = (py / BOARD) * n
        const ix = Math.floor(fx)
        const iy = Math.floor(fy)
        const tx = sm(fx - ix)
        const ty = sm(fy - iy)
        const x1 = (ix + 1) % n
        const y1 = (iy + 1) % n
        const a = g[iy * n + ix] + (g[iy * n + x1] - g[iy * n + ix]) * tx
        const b = g[y1 * n + ix] + (g[y1 * n + x1] - g[y1 * n + ix]) * tx
        v += amp * (a + (b - a) * ty)
      }
      const val = 128 + (v - 0.5) * 62 + (rnd() - 0.5) * 26
      const i = (py * BOARD + px) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, Math.round(val)))
      img.data[i + 3] = 255
    }
  }
  x.putImageData(img, 0, 0)
  // Fibres: short, gently bent strokes, drawn wrapped so the tile repeats clean.
  x.lineCap = 'round'
  for (let i = 0; i < 1500; i++) {
    const len = 6 + rnd() * 26
    const a = rnd() * Math.PI * 2
    const bend = (rnd() - 0.5) * 0.9
    const cx = rnd() * BOARD
    const cy = rnd() * BOARD
    const light = rnd() < 0.62
    x.strokeStyle = light ? `rgba(255, 255, 255, ${(0.1 + rnd() * 0.16).toFixed(3)})` : `rgba(0, 0, 0, ${(0.08 + rnd() * 0.12).toFixed(3)})`
    x.lineWidth = 0.6 + rnd() * 0.9
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ox = cx + dx * BOARD
        const oy = cy + dy * BOARD
        if (ox < -40 || oy < -40 || ox > BOARD + 40 || oy > BOARD + 40) continue
        x.beginPath()
        x.moveTo(ox, oy)
        x.quadraticCurveTo(ox + Math.cos(a + bend) * len * 0.5, oy + Math.sin(a + bend) * len * 0.5, ox + Math.cos(a) * len, oy + Math.sin(a) * len)
        x.stroke()
      }
    }
  }
  // Flecks: the inclusions of a recycled coloured stock — dark specks and
  // pale bits of undyed pulp, wrapped like the fibres.
  for (let i = 0; i < 900; i++) {
    const cx = rnd() * BOARD
    const cy = rnd() * BOARD
    const rad = 0.45 + rnd() * rnd() * 1.9
    const dark = rnd() < 0.6
    x.fillStyle = dark ? `rgba(0, 0, 0, ${(0.16 + rnd() * 0.26).toFixed(3)})` : `rgba(255, 255, 255, ${(0.2 + rnd() * 0.3).toFixed(3)})`
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ox = cx + dx * BOARD
        const oy = cy + dy * BOARD
        if (ox < -4 || oy < -4 || ox > BOARD + 4 || oy > BOARD + 4) continue
        x.beginPath()
        x.ellipse(ox, oy, rad, rad * (0.55 + rnd() * 0.45), rnd() * Math.PI, 0, Math.PI * 2)
        x.fill()
      }
    }
  }
  board = c
  return c
}

class Pen {
  stretchOk: boolean
  blurPx: number
  constructor(
    public p: CanvasRenderingContext2D,
    public r: CanvasRenderingContext2D,
    fonts: CardFonts,
    blurPx: number,
  ) {
    this.stretchOk = fonts.stretch
    this.blurPx = blurPx
  }

  /** Paint the same mark on the print and, by channel, on the relief. */
  draw(m: Mat, fn: DrawFn) {
    this.p.save()
    fn(this.p, m.color)
    this.p.restore()
    const fo = m.foil ?? 0
    const ik = m.ink ?? 0
    const h = m.height ?? 0
    if (fo > 0) {
      this.r.save()
      this.r.globalCompositeOperation = 'lighter'
      fn(this.r, `rgb(0, ${Math.round(fo * 255)}, 0)`)
      this.r.restore()
    }
    if (ik > 0) {
      // How deep it's pressed: softened, so it holds across the stroke's walls.
      this.r.save()
      this.r.globalCompositeOperation = 'lighter'
      this.r.filter = 'blur(1px)'
      fn(this.r, `rgb(0, 0, ${Math.round(ik * 255)})`)
      this.r.restore()
    }
    if (h > 0) {
      this.r.save()
      this.r.globalCompositeOperation = 'lighter'
      this.r.filter = `blur(${this.blurPx}px)`
      fn(this.r, `rgb(${Math.round(h * 255)}, 0, 0)`)
      this.r.restore()
    }
  }

  font(ctx: CanvasRenderingContext2D, f: FontSpec) {
    const kw = f.wdth !== undefined && this.stretchOk ? stretchFor(f.wdth) : 'normal'
    ctx.font = `${f.italic ? 'italic ' : ''}${Math.round(f.weight ?? 400)} ${kw} ${f.size}px ${f.family}`
    if ('fontStretch' in ctx) {
      try {
        ctx.fontStretch = kw as CanvasFontStretch
      } catch {
        /* older engines */
      }
    }
  }

  measure(str: string, f: FontSpec, tracking = 0): number {
    this.font(this.p, f)
    if (!tracking) return this.p.measureText(str).width
    let w = 0
    for (const ch of str) w += this.p.measureText(ch).width
    return w + tracking * f.size * Math.max(0, [...str].length - 1)
  }

  /** Largest size ≤ max that fits `maxW` (≥ min), and the text (ellipsized if needed). */
  fit(str: string, f: FontSpec, maxW: number, min: number, tracking = 0): { size: number; text: string } {
    let size = f.size
    const w = this.measure(str, f, tracking)
    if (w > maxW) size = Math.max(min, Math.floor(f.size * (maxW / w)))
    let text = str
    while (text.length > 2 && this.measure(text, { ...f, size }, tracking) > maxW) text = text.slice(0, -2) + '…'
    return { size, text }
  }

  text(m: Mat, str: string, x: number, y: number, f: FontSpec, opts: { align?: 'left' | 'right' | 'center'; tracking?: number } = {}) {
    const tracking = opts.tracking ?? 0
    const total = this.measure(str, f, tracking)
    const x0 = opts.align === 'right' ? x - total : opts.align === 'center' ? x - total / 2 : x
    this.draw(m, (ctx, style) => {
      this.font(ctx, f)
      ctx.fillStyle = style
      ctx.textBaseline = 'alphabetic'
      ctx.textAlign = 'left'
      if (!tracking) {
        ctx.fillText(str, x0, y)
        return
      }
      let cx = x0
      for (const ch of str) {
        ctx.fillText(ch, cx, y)
        cx += ctx.measureText(ch).width + tracking * f.size
      }
    })
    return total
  }
}

// ── the printer ─────────────────────────────────────────────────────────────

export class CardPrinter {
  readonly print: HTMLCanvasElement
  readonly relief: HTMLCanvasElement
  /** The case's engraving (white on black): LABEL_W × LABEL_H. */
  readonly label: HTMLCanvasElement
  readonly width: number
  readonly faceH: number
  private reliefFaceH: number

  constructor(width: number) {
    this.width = width
    this.faceH = Math.round(width / CARD_ASPECT)
    this.print = document.createElement('canvas')
    this.print.width = width
    this.print.height = this.faceH * 2
    const rw = Math.round(width / 2)
    this.reliefFaceH = Math.round(this.faceH / 2)
    this.relief = document.createElement('canvas')
    this.relief.width = rw
    this.relief.height = this.reliefFaceH * 2
    this.label = document.createElement('canvas')
    this.label.width = LABEL_W
    this.label.height = LABEL_H
  }

  paint(d: CredencialData, fonts: CardFonts) {
    const st = cardStock(d.role)
    const stock = hexRGBA(st.stock)
    PAL = { ink: hexRGBA(st.ink), stock, back: mixRGB(stock, [0, 0, 0, 1], 0.05) }
    this.engrave(d, fonts)
    const p = this.print.getContext('2d')!
    const r = this.relief.getContext('2d')!
    p.setTransform(1, 0, 0, 1, 0, 0)
    r.setTransform(1, 0, 0, 1, 0, 0)
    r.globalCompositeOperation = 'source-over'
    // The relief is a data map (height/foil/ink channels), not a color: zero it.
    r.fillStyle = 'rgb(0, 0, 0)'
    r.fillRect(0, 0, this.relief.width, this.relief.height)

    const blurPx = Math.max(1, Math.min(3, Math.round((this.relief.width / DW) * 5)))
    const pen = new Pen(p, r, fonts, blurPx)

    for (const face of [0, 1] as const) {
      const sx = this.width / DW
      const sy = this.faceH / DH
      const rsx = this.relief.width / DW
      const rsy = this.reliefFaceH / DH
      p.setTransform(sx, 0, 0, sy, 0, face * this.faceH)
      r.setTransform(rsx, 0, 0, rsy, 0, face * this.reliefFaceH)
      p.save()
      r.save()
      p.beginPath()
      p.rect(0, 0, DW, DH)
      p.clip()
      r.beginPath()
      r.rect(0, 0, DW, DH)
      r.clip()
      this.base(p, face, seedOf(d))
      frame(pen)
      if (face === 0) front(pen, d, fonts)
      else if (d.surface === 'invitation') backInvitation(pen, d, fonts)
      else backPublic(pen, d, fonts)
      p.restore()
      r.restore()
    }
    p.setTransform(1, 0, 0, 1, 0, 0)
    r.setTransform(1, 0, 0, 1, 0, 0)
  }

  /** The board: its washed livery (the back a hair deeper), its cotton surface, its uneven dye. */
  private base(p: CanvasRenderingContext2D, face: 0 | 1, seed: number) {
    p.fillStyle = rgba(face === 0 ? PAL.stock : PAL.back)
    p.fillRect(0, 0, DW, DH)
    p.save()
    p.globalCompositeOperation = 'soft-light'
    const pat = p.createPattern(boardTile(), 'repeat')
    if (pat) {
      // the two faces are different stretches of the same board
      if (face === 1) pat.setTransform(new DOMMatrix().translate(211, 137))
      p.fillStyle = pat
      p.fillRect(0, 0, DW, DH)
    }
    p.restore()
    // The dye isn't even: a broad fade where light reached it (a corner
    // seeded per card; the back faded from the other side), and a few deep
    // clouds where the colour pooled in the pulp.
    const rnd = mulberry(seed * 31 + face * 7 + 3)
    const corner = Math.floor(rnd() * 4)
    const fx = (corner % 2 === 0) !== (face === 1) ? 0 : DW
    const fy = corner < 2 ? 0 : DH
    const reach = Math.hypot(DW, DH) * (0.7 + rnd() * 0.25)
    const fade = p.createRadialGradient(fx, fy, 0, fx, fy, reach)
    fade.addColorStop(0, 'rgba(255, 251, 238, 0.34)')
    fade.addColorStop(0.45, 'rgba(255, 251, 238, 0.12)')
    fade.addColorStop(1, 'rgba(255, 251, 238, 0)')
    p.save()
    p.fillStyle = fade
    p.fillRect(0, 0, DW, DH)
    p.globalCompositeOperation = 'multiply'
    const deep = mixRGB(face === 0 ? PAL.stock : PAL.back, [0, 0, 0, 1], 0.28)
    for (let i = 0; i < 3; i++) {
      const cx = rnd() * DW
      const cy = rnd() * DH
      const rad = (0.22 + rnd() * 0.3) * DW
      const g = p.createRadialGradient(cx, cy, 0, cx, cy, rad)
      const a = 0.22 + rnd() * 0.16
      g.addColorStop(0, rgba([deep[0], deep[1], deep[2], a]))
      g.addColorStop(0.6, rgba([deep[0], deep[1], deep[2], a * 0.35]))
      g.addColorStop(1, rgba([deep[0], deep[1], deep[2], 0]))
      p.fillStyle = g
      p.fillRect(0, 0, DW, DH)
    }
    p.restore()
  }

  /**
   * The case's engraving, laser-cut into the frosted band under the card:
   * the folio at one end, the handle (or the invitation) and the role at
   * the other. Real data only.
   */
  private engrave(d: CredencialData, fonts: CardFonts) {
    const x = this.label.getContext('2d')
    if (!x) return
    x.setTransform(1, 0, 0, 1, 0, 0)
    x.fillStyle = '#000'
    x.fillRect(0, 0, LABEL_W, LABEL_H)
    x.fillStyle = '#fff'
    x.textBaseline = 'middle'
    const size = Math.round(LABEL_H * 0.56)
    x.font = `700 ${size}px ${fonts.mono}`
    const tracked = (str: string, x0: number, alignRight: boolean) => {
      const chars = [...str]
      const gap = size * 0.2
      const w = chars.reduce((s, ch) => s + x.measureText(ch).width, 0) + gap * Math.max(0, chars.length - 1)
      let cx = alignRight ? x0 - w : x0
      for (const ch of chars) {
        x.fillText(ch, cx, LABEL_H / 2 + 1)
        cx += x.measureText(ch).width + gap
      }
    }
    const pad = 44
    tracked(`FOLIO ${d.folio}`, pad, false)
    const who = d.handle ? `@${d.handle}` : d.surface === 'invitation' ? 'Invitación' : ''
    tracked([who, ROLE_LABEL[d.role]].filter(Boolean).join(' · ').toUpperCase(), LABEL_W - pad, true)
  }
}

// ── faces ───────────────────────────────────────────────────────────────────

function wordmarkLetters(fonts: CardFonts, size: number, band: [number, number]): Array<[string, FontSpec]> {
  const letters = 'GRADIENTE'.split('')
  return letters.map((ch, i) => {
    const e = band[0] + ((band[1] - band[0]) * i) / (letters.length - 1)
    const { wdth, wght } = energyFont(e)
    return [ch, { family: fonts.display, size, weight: wght, wdth }]
  })
}

function wordmarkWidth(pen: Pen, fonts: CardFonts, size: number, band: [number, number]): number {
  return wordmarkLetters(fonts, size, band).reduce((w, [ch, f]) => w + pen.measure(ch, f) + size * 0.01, -size * 0.01)
}

/** GRADIENTE as a typographic gradient across `band`; `x` is the left edge. */
function wordmark(pen: Pen, fonts: CardFonts, x: number, y: number, size: number, band: [number, number], mat: Mat) {
  let cx = x
  for (const [ch, f] of wordmarkLetters(fonts, size, band)) {
    const w = pen.measure(ch, f)
    pen.text(mat, ch, cx, y, f)
    cx += w + size * 0.01
  }
  return cx - x
}

/** A boxed chip: square, 1px-ish ink, the TRAMA grammar. */
function box(pen: Pen, x: number, cy: number, w: number, h: number, mat: Mat, dashed = false) {
  pen.draw(mat, (ctx, style) => {
    ctx.beginPath()
    ctx.rect(x, cy - h / 2, w, h)
    ctx.lineWidth = 2
    if (dashed) ctx.setLineDash([6, 5])
    ctx.strokeStyle = style
    ctx.stroke()
  })
}

/** The border: a rule inset from the cut, foil-stamped (it carries the role's foil). */
function frame(pen: Pen) {
  pen.draw({ color: INK(0.9), foil: 1, ink: 0.7 }, (ctx, style) => {
    ctx.lineWidth = 6
    ctx.strokeStyle = style
    ctx.strokeRect(30, 30, DW - 60, DH - 60)
  })
}

/** A structural rule in ink. */
function rule(pen: Pen, y: number, x0 = M, x1 = DW - M, alpha = 0.9) {
  pen.draw({ color: INK(alpha), ink: 0.4 }, (ctx, style) => {
    ctx.fillStyle = style
    ctx.fillRect(x0, y, x1 - x0, 2)
  })
}

/** Mono label: uppercase, tracked — labels, indices, codes. */
function mono(
  pen: Pen,
  fonts: CardFonts,
  text: string,
  x: number,
  y: number,
  size: number,
  alpha: number,
  opts: { align?: 'left' | 'right' | 'center'; weight?: number; tracking?: number; foil?: number } = {},
) {
  return pen.text({ color: INK(alpha), ink: 0.8, foil: opts.foil }, text.toUpperCase(), x, y, { family: fonts.mono, size, weight: opts.weight ?? 400 }, { align: opts.align, tracking: opts.tracking ?? 0.12 })
}

function field(pen: Pen, fonts: CardFonts, x: number, label: string) {
  mono(pen, fonts, label, x, 838, 17, 0.62)
}

function front(pen: Pen, d: CredencialData, fonts: CardFonts) {
  const band = roleBand(d.role)
  const invite = d.surface === 'invitation'

  // Wordmark — a typographic gradient across the role's family; foil-stamped.
  wordmark(pen, fonts, M - 4, 152, 64, band, { color: INK(1), foil: 1, ink: 0.8 })
  mono(pen, fonts, invite ? 'Invitación' : 'Credencial', DW - M, 118, 19, 0.9, { align: 'right', weight: 700 })
  mono(pen, fonts, 'Beta cerrada', DW - M, 150, 16, 0.55, { align: 'right' })

  // Seal — the Rueda: thirty spokes, an empty hub. The mark of the door.
  const seal = { cx: DW - M - 124, cy: 456, R: 124 }
  pen.draw({ color: INK(0.5), foil: 0.9, height: 0.4 }, (ctx, style) => {
    ctx.save()
    ctx.translate(seal.cx - seal.R, seal.cy - seal.R)
    const k = (seal.R * 2) / 20
    ctx.scale(k, k)
    ctx.lineCap = 'butt'
    ctx.lineWidth = 0.16
    ctx.strokeStyle = style
    ctx.stroke(new Path2D(ruedaPath(30, 3.1, 9.8)))
    ctx.beginPath()
    ctx.arc(10, 10, 2.5, 0, TAU)
    ctx.lineWidth = 0.18
    ctx.stroke()
    ctx.restore()
  })

  // Name — set at its energy (the band of their pieces, or the role's own).
  const { wdth, wght } = energyFont(d.energy)
  const nameFont: FontSpec = { family: fonts.display, size: 124, weight: wght, wdth }
  const fitted = pen.fit(d.name, nameFont, DW - 2 * M - 300, 52)
  pen.text({ color: INK(1), ink: 1 }, fitted.text, M - 4, 488, { ...nameFont, size: fitted.size })

  // @handle
  if (d.handle) pen.text({ color: INK(0.78), ink: 1 }, `@${d.handle}`, M, 560, { family: fonts.ui, size: 36, weight: 500 })
  else pen.text({ color: INK(0.36), ink: 0.6 }, '@ tu usuario', M, 560, { family: fonts.ui, size: 36, weight: 400 })

  // Badge row — role for staff, living rank for readers; flags; team.
  const cy = 650
  let x = M
  const bf: FontSpec = { family: fonts.mono, size: 20, weight: 700 }
  if (d.role !== 'user') {
    const label = ROLE_LABEL[d.role].toUpperCase()
    const tw = pen.measure(label, bf, 0.12)
    box(pen, x, cy, tw + 40, 48, { color: INK(1), foil: 0.8, ink: 0.7 })
    pen.text({ color: INK(1), foil: 1, ink: 0.9 }, label, x + 20, cy + 7, bf, { tracking: 0.12 })
    x += tw + 40 + 14
  } else {
    const rank: UserRank = d.rank
    const label = RANK_LABEL[rank]
    const tw = pen.measure(label, bf, 0.12)
    const w = tw + 40 + 34
    box(pen, x, cy, w, 48, { color: INK(1), foil: 0.8, ink: 0.7 })
    pen.draw({ color: INK(1), foil: 1, ink: 0.9 }, (ctx, style) => drawSigil(ctx, RANK_SIGIL[rank], x + 32, cy, 24, style, 1.6))
    pen.text({ color: INK(1), foil: 1, ink: 0.9 }, label, x + 54, cy + 7, bf, { tracking: 0.12 })
    x += w + 14
  }
  // Flags are a small extra mark: stamped in the same foil as the role.
  const ff: FontSpec = { family: fonts.mono, size: 17, weight: 700 }
  for (const flag of [d.isMod ? 'MOD' : null, d.isOG ? 'OG' : null]) {
    if (!flag) continue
    const tw = pen.measure(flag, ff, 0.12)
    box(pen, x, cy, tw + 30, 40, { color: INK(0.7), foil: 0.9, ink: 0.5 }, true)
    pen.text({ color: INK(0.85), foil: 1, ink: 1 }, flag, x + 15, cy + 6, ff, { tracking: 0.12 })
    x += tw + 30 + 12
  }
  if (d.team) {
    const t = pen.fit(`EQUIPO · ${d.team.toUpperCase()}`, { family: fonts.mono, size: 17 }, DW - M - 280 - x, 12, 0.1)
    pen.text({ color: INK(0.66), ink: 0.8 }, t.text, x + 6, cy + 6, { family: fonts.mono, size: t.size }, { tracking: 0.1 })
  }

  rule(pen, 780)

  // Fields — folio (a serial: the order of arrival), issued, firma / code.
  const c1 = M
  const c2 = M + 540
  const c3 = M + 880
  const vf: FontSpec = { family: fonts.mono, size: 46, weight: 700 }
  field(pen, fonts, c1, 'Folio · orden de llegada')
  pen.text({ color: INK(1), foil: 1, ink: 1 }, d.folio, c1, 902, vf, { tracking: 0.02 })
  field(pen, fonts, c2, invite ? 'Emitida' : 'En la señal desde')
  pen.text({ color: INK(1), ink: 1 }, d.issued, c2, 902, vf, { tracking: 0.02 })
  const w3 = DW - M - c3
  if (invite && d.code) {
    field(pen, fonts, c3, 'Código')
    const f = pen.fit(d.code, { family: fonts.mono, size: 36, weight: 700 }, w3, 20, 0.04)
    pen.text({ color: INK(1), foil: 0.5, ink: 1 }, f.text, c3, 900, { family: fonts.mono, size: f.size, weight: 700 }, { tracking: 0.04 })
  } else if (d.firma) {
    field(pen, fonts, c3, 'Firma')
    const f = pen.fit(d.firma, { family: fonts.read, size: 38, weight: 400, italic: true }, w3, 22)
    pen.text({ color: INK(0.9), ink: 1 }, f.text, c3, 900, { family: fonts.read, size: f.size, weight: 400, italic: true })
  } else if (d.handle) {
    field(pen, fonts, c3, 'Perfil')
    const f = pen.fit(`gradiente.org/u/${d.handle}`, { family: fonts.mono, size: 24 }, w3, 14)
    pen.text({ color: INK(0.8), ink: 1 }, f.text, c3, 898, { family: fonts.mono, size: f.size })
  }
}

function backHeader(pen: Pen, fonts: CardFonts, label: string, sub: string | null, d: CredencialData) {
  const w = mono(pen, fonts, label, M, 118, 19, 0.9, { weight: 700 })
  if (sub) mono(pen, fonts, sub, M + w + 22, 118, 19, 0.55)
  const band = roleBand(d.role)
  wordmark(pen, fonts, DW - M - wordmarkWidth(pen, fonts, 30, band), 120, 30, band, { color: INK(0.8), foil: 0.6, ink: 0.6 })
}

/** A pin: a square plate, blind-embossed; the sigil printed in ink. */
function pin(pen: Pen, fonts: CardFonts, cx: number, cy: number, r: number, key: CredencialData['pins'][number]) {
  pen.draw({ color: rgba(mixRGB(PAL.stock, PAL.ink, 0.06)), foil: 0.1, height: 0.3 }, (ctx, style) => {
    ctx.fillStyle = style
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r)
  })
  pen.draw({ color: INK(1), foil: 0.4, height: 0.5 }, (ctx, style) => {
    ctx.beginPath()
    ctx.rect(cx - r, cy - r, 2 * r, 2 * r)
    ctx.lineWidth = 2
    ctx.strokeStyle = style
    ctx.stroke()
  })
  pen.draw({ color: INK(1), foil: 1, ink: 1, height: 1 }, (ctx, style) => drawSigil(ctx, TROPHY_SIGIL[key.key], cx, cy, r * 1.04, style, 1.6))
  const lf: FontSpec = { family: fonts.mono, size: 15, weight: 700 }
  const t = pen.fit(key.label, lf, 250, 10, 0.08)
  pen.text({ color: INK(0.9), ink: 1 }, t.text, cx, cy + r + 44, { ...lf, size: t.size }, { align: 'center', tracking: 0.08 })
  mono(pen, fonts, key.earned, cx, cy + r + 72, 14, 0.55, { align: 'center' })
}

function backPublic(pen: Pen, d: CredencialData, fonts: CardFonts) {
  backHeader(pen, fonts, 'Insignias', d.handle ? `@${d.handle}` : null, d)
  const pins = d.pins.slice(0, 10)
  if (!pins.length) {
    pen.text({ color: INK(0.85), ink: 1 }, 'Aún sin insignias.', DW / 2, 452, { family: fonts.display, size: 58, weight: 300, wdth: 125 }, { align: 'center' })
    pen.text({ color: INK(0.6), ink: 0.8 }, 'Se ganan publicando, conversando y calibrando. No se compran.', DW / 2, 516, { family: fonts.ui, size: 25 }, { align: 'center' })
  } else {
    const rows = pins.length <= 5 ? [pins] : [pins.slice(0, Math.ceil(pins.length / 2)), pins.slice(Math.ceil(pins.length / 2))]
    const r = 72
    const cell = 262
    const ys = rows.length === 1 ? [410] : [318, 598]
    rows.forEach((row, ri) => {
      const x0 = DW / 2 - ((row.length - 1) * cell) / 2
      row.forEach((pk, i) => pin(pen, fonts, x0 + i * cell, ys[ri], r, pk))
    })
  }
  rule(pen, 800)
  if (d.handle) mono(pen, fonts, `gradiente.org/u/${d.handle}`, M, 880, 20, 0.8, { tracking: 0.02 })
  mono(pen, fonts, `Folio ${d.folio}`, DW - M, 880, 19, 0.8, { align: 'right', weight: 700, foil: 1 })
}

function backInvitation(pen: Pen, d: CredencialData, fonts: CardFonts) {
  backHeader(pen, fonts, 'Invitación', 'código de acceso', d)
  if (d.code) {
    const f = pen.fit(d.code, { family: fonts.mono, size: 112, weight: 700 }, DW - 2 * M, 56, 0.02)
    // Engraved: the code is the plate's raised mark, foil-stamped.
    pen.text({ color: INK(1), foil: 1, ink: 1, height: 0.5 }, f.text, M - 4, 420, { family: fonts.mono, size: f.size, weight: 700 }, { tracking: 0.02 })
  }
  pen.text({ color: INK(0.8), ink: 1 }, 'Válida para una sola identidad.', M, 490, { family: fonts.ui, size: 30, weight: 500 })
  if (d.expires) {
    let when = d.expires
    try {
      when = fmt.long(d.expires)
    } catch {
      /* keep ISO */
    }
    pen.text({ color: INK(0.6), ink: 0.8 }, `Vence el ${when}.`, M, 536, { family: fonts.ui, size: 24, weight: 500 })
  }
  pen.text({ color: INK(0.7), ink: 0.9 }, 'Aquí se prenderán tus insignias:', M, 656, { family: fonts.read, size: 34, weight: 400, italic: true })
  pen.text({ color: INK(0.7), ink: 0.9 }, 'se ganan publicando, conversando y calibrando.', M, 702, { family: fonts.read, size: 34, weight: 400, italic: true })
  rule(pen, 800)
  mono(pen, fonts, 'La Puerta · gradiente.org/welcome', M, 880, 19, 0.8)
  mono(pen, fonts, `Emitida ${d.issued}`, DW - M, 880, 19, 0.8, { align: 'right', weight: 700 })
}
