/**
 * Rasters for the TRAMA engine.
 *
 * Text is redrawn glyph by glyph at the positions the browser actually laid
 * it out (Range rects), so line breaks, tracking and alignment are the DOM's
 * own. Anybody's arbitrary width axis can't be reached from canvas, so each
 * glyph is drawn at the nearest stretch keyword and scaled into its real box
 * — invisible at block resolution, and the DOM takes over for the crisp end.
 */

export interface Raster {
  canvas: HTMLCanvasElement
  /** Raster texels per CSS px. */
  scale: number
}

const STRETCH: Array<[number, CanvasFontStretch]> = [
  [50, 'ultra-condensed'],
  [62.5, 'extra-condensed'],
  [75, 'condensed'],
  [87.5, 'semi-condensed'],
  [100, 'normal'],
  [112.5, 'semi-expanded'],
  [125, 'expanded'],
  [150, 'extra-expanded'],
  [200, 'ultra-expanded'],
]

function nearestStretch(pct: number): CanvasFontStretch {
  let best = STRETCH[4]
  for (const s of STRETCH) if (Math.abs(s[0] - pct) < Math.abs(best[0] - pct)) best = s
  return best[1]
}

function axis(settings: string, tag: string): number | null {
  const m = new RegExp(`["']${tag}["']\\s+(-?[\\d.]+)`).exec(settings)
  return m ? Number(m[1]) : null
}

function transformText(s: string, t: string): string {
  if (t === 'uppercase') return s.toUpperCase()
  if (t === 'lowercase') return s.toLowerCase()
  return s
}

export function rasterScale(): number {
  return Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)
}

/** Draw every visible glyph of `el` into a canvas the size of `rect`. */
export function rasterText(el: HTMLElement, rect: DOMRect): Raster | null {
  const scale = rasterScale()
  const w = Math.ceil(rect.width)
  const h = Math.ceil(rect.height)
  if (w < 2 || h < 2 || w * h > 4_000_000) return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(w * scale)
  canvas.height = Math.ceil(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.textBaseline = 'alphabetic'

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  const metrics = new Map<string, TextMetrics>()
  let drew = false
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.nodeValue ?? ''
    if (!text.trim()) continue
    const parent = node.parentElement
    if (!parent) continue
    const cs = getComputedStyle(parent)
    if (cs.display === 'none') continue
    const vs = cs.fontVariationSettings || ''
    const weight = axis(vs, 'wght') ?? Number(cs.fontWeight || 400)
    const wdth = axis(vs, 'wdth') ?? (parseFloat(cs.fontStretch) || 100)
    const size = parseFloat(cs.fontSize) || 16
    const font = `${cs.fontStyle === 'italic' ? 'italic ' : ''}${Math.round(weight)} ${size}px ${cs.fontFamily}`
    ctx.font = font
    if ('fontStretch' in ctx) ctx.fontStretch = nearestStretch(wdth)
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
    ctx.fillStyle = cs.color
    const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) || 0
    const tt = cs.textTransform
    const key0 = `${font}|${ctx.fontStretch ?? ''}`
    const asc = ctx.measureText('Hg').fontBoundingBoxAscent || size * 0.8

    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (ch === ' ' || ch === '\n' || ch === '\t' || ch === ' ') continue
      // Keep surrogate pairs whole.
      const code = text.charCodeAt(i)
      const len = code >= 0xd800 && code <= 0xdbff ? 2 : 1
      range.setStart(node, i)
      range.setEnd(node, Math.min(text.length, i + len))
      const rects = range.getClientRects()
      if (len === 2) i++
      if (!rects.length) continue
      const r = rects[0]
      if (r.width < 0.5 || r.height < 0.5) continue
      const glyph = transformText(text.slice(i - len + 1, i + 1), tt)
      const mk = `${key0}|${glyph}`
      let m = metrics.get(mk)
      if (!m) {
        m = ctx.measureText(glyph)
        metrics.set(mk, m)
      }
      const box = Math.max(0.5, r.width - ls)
      const sx = m.width > 0.01 ? box / m.width : 1
      const x = (r.left - rect.left) * scale
      const y = (r.top - rect.top + asc) * scale
      ctx.setTransform(scale * sx, 0, 0, scale, x, y)
      ctx.fillText(glyph, 0, 0)
      drew = true
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  return drew ? { canvas, scale } : null
}

function objectPosition(v: string): [number, number] {
  const parts = v.split(/\s+/)
  const one = (s: string | undefined, fallback: number) => {
    if (!s) return fallback
    if (s === 'left' || s === 'top') return 0
    if (s === 'right' || s === 'bottom') return 1
    if (s === 'center') return 0.5
    if (s.endsWith('%')) return parseFloat(s) / 100
    return fallback
  }
  return [one(parts[0], 0.5), one(parts[1], 0.5)]
}

/** Copy an <img> into a canvas exactly as it's fitted on screen. */
export function rasterImage(img: HTMLImageElement, rect: { width: number; height: number }, maxWidth = 1400): Raster | null {
  if (!img.complete || !img.naturalWidth || !img.naturalHeight) return null
  const base = rasterScale()
  let cw = Math.ceil(rect.width * base)
  let ch = Math.ceil(rect.height * base)
  if (cw < 2 || ch < 2) return null
  const k = Math.min(1, maxWidth / cw)
  cw = Math.max(2, Math.round(cw * k))
  ch = Math.max(2, Math.round(ch * k))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const cs = getComputedStyle(img)
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const fit = cs.objectFit
  if (fit === 'fill') {
    ctx.drawImage(img, 0, 0, cw, ch)
  } else {
    const s = fit === 'contain' ? Math.min(cw / iw, ch / ih) : Math.max(cw / iw, ch / ih)
    const dw = iw * s
    const dh = ih * s
    const [px, py] = objectPosition(cs.objectPosition || '50% 50%')
    ctx.drawImage(img, (cw - dw) * px, (ch - dh) * py, dw, dh)
  }
  try {
    // A tainted canvas can't become a texture; find out now, not mid-frame.
    ctx.getImageData(0, 0, 1, 1)
  } catch {
    return null
  }
  return { canvas, scale: cw / rect.width }
}
