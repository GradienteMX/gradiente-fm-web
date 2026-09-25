/**
 * The map's colors are the page's colors. GL cannot read CSS, so the
 * controller probes the design tokens through a 1×1 canvas — any CSS color
 * syntax resolves to sRGB bytes — and re-probes when they change. Flip the
 * palette in globals.css and the land reprints itself; no color literal
 * lives in this directory (the fallbacks below only guard a missing token).
 *
 *   ground  --paper   (legacy --obs-0)   the sheet the land is printed on
 *   plate   --paper-3 (legacy --obs-2)   listing / franja plates
 *   ink     --ink                        seams, rings, halftone, shadow
 *   e0…e10  --e0 … --e10                 the energy ramp
 */

export type RGB = [number, number, number]

export interface Palette {
  ground: RGB
  plate: RGB
  ink: RGB
  spectrum: RGB[]
  key: string
}

const PAIRS: [string, string][] = [
  ['--paper', '--obs-0'],
  ['--paper-3', '--obs-2'],
  ['--ink', '--ink'],
  ...Array.from({ length: 11 }, (_, i) => [`--e${i}`, `--e${i}`] as [string, string]),
]

let probe: CanvasRenderingContext2D | null = null

function toRGB(css: string, fallback: RGB): RGB {
  if (!css) return fallback
  if (!probe) {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    probe = c.getContext('2d', { willReadFrequently: true })
  }
  if (!probe) return fallback
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = '#000'
  probe.fillStyle = css
  probe.fillRect(0, 0, 1, 1)
  const d = probe.getImageData(0, 0, 1, 1).data
  return [d[0] / 255, d[1] / 255, d[2] / 255]
}

function rawTokens(el: Element): string[] {
  const cs = getComputedStyle(el)
  return PAIRS.map(([a, b]) => cs.getPropertyValue(a).trim() || cs.getPropertyValue(b).trim())
}

export function readPalette(el: Element = document.documentElement): Palette {
  const raw = rawTokens(el)
  return {
    ground: toRGB(raw[0], [0.93, 0.92, 0.89]),
    plate: toRGB(raw[1], [0.89, 0.88, 0.84]),
    ink: toRGB(raw[2], [0.07, 0.07, 0.07]),
    spectrum: raw.slice(3).map((v, i) => toRGB(v, [0.5 + i / 20, 0.5, 0.5 - i / 20])),
    key: raw.join('|'),
  }
}

/** Cheap check: have the tokens changed since `key`? */
export function paletteKey(el: Element = document.documentElement): string {
  return rawTokens(el).join('|')
}
