/**
 * Livery patterns — flat, hard-edged, printed. Each returns CSS background
 * properties for a pattern in `ink` on a transparent ground (lay it over the
 * livery colour). SVG tiles are data URIs; simple ones are hard-stop CSS
 * gradients (a printed pattern, not a soft gradient).
 */

import { SPECTRUM_HEX } from '@/lib/vibe'
import type { Patron } from '@/lib/librea'

export interface PatronCss {
  backgroundImage: string
  backgroundSize: string
  /** Width of one tile in px — how far to drift for a seamless loop. */
  tile: number
}

const svg = (w: number, h: number, body: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`

export function patronCss(p: Patron, ink: string, k = 1): PatronCss {
  const s = (n: number) => Math.round(n * k * 100) / 100
  switch (p) {
    case 'peligro': {
      const t = s(28)
      return { backgroundImage: `repeating-linear-gradient(-45deg, ${ink} 0 ${s(9)}px, transparent ${s(9)}px ${s(19.8)}px)`, backgroundSize: 'auto', tile: t }
    }
    case 'surcos': {
      const t = s(64)
      return {
        backgroundImage: svg(t, t, `<g fill='none' stroke='${ink}' stroke-width='${s(1.4)}'>${[6, 12, 18, 24, 30].map((r) => `<circle cx='${t / 2}' cy='${t / 2}' r='${s(r)}'/>`).join('')}</g><circle cx='${t / 2}' cy='${t / 2}' r='${s(2)}' fill='${ink}'/>`),
        backgroundSize: `${t}px ${t}px`,
        tile: t,
      }
    }
    case 'trama': {
      const t = s(8)
      return { backgroundImage: `radial-gradient(${ink} ${s(1.9)}px, transparent ${s(2.1)}px)`, backgroundSize: `${t}px ${t}px`, tile: t }
    }
    case 'registro': {
      const t = s(32)
      const c = t / 2
      return {
        backgroundImage: svg(t, t, `<g stroke='${ink}' stroke-width='${s(1.2)}' fill='none'><circle cx='${c}' cy='${c}' r='${s(4.5)}'/><path d='M${c} ${c - s(8)}V${c + s(8)}M${c - s(8)} ${c}H${c + s(8)}'/></g>`),
        backgroundSize: `${t}px ${t}px`,
        tile: t,
      }
    }
    case 'galones': {
      const t = s(24)
      return {
        backgroundImage: svg(t, t, `<path d='M0 ${s(4)}L${t / 2} ${t / 2}L0 ${t - s(4)}M${t / 2} ${s(4)}L${t} ${t / 2}L${t / 2} ${t - s(4)}' fill='none' stroke='${ink}' stroke-width='${s(3)}'/>`),
        backgroundSize: `${t}px ${t}px`,
        tile: t,
      }
    }
    case 'renglones': {
      const t = s(9)
      return { backgroundImage: `repeating-linear-gradient(to bottom, ${ink} 0 ${s(1.2)}px, transparent ${s(1.2)}px ${t}px)`, backgroundSize: 'auto', tile: t }
    }
    case 'escala': {
      const t = s(40)
      const bars = [34, 26, 19, 12, 6].map((w, i) => `<rect x='0' y='${s(2 + i * 7.6)}' width='${s(w)}' height='${s(4.2)}'/>`).join('')
      return { backgroundImage: svg(t, t, `<g fill='${ink}'>${bars}</g>`), backgroundSize: `${t}px ${t}px`, tile: t }
    }
    case 'teletipo': {
      const t = s(60)
      const dashes = [
        [0, 6, 14],
        [18, 6, 5],
        [27, 6, 20],
        [51, 6, 5],
        [4, 16, 7],
        [15, 16, 22],
        [41, 16, 5],
        [50, 16, 8],
      ]
        .map(([x, y, w]) => `<rect x='${s(x)}' y='${s(y)}' width='${s(w)}' height='${s(3)}'/>`)
        .join('')
      return { backgroundImage: svg(t, s(20), `<g fill='${ink}'>${dashes}</g>`), backgroundSize: `${t}px ${s(20)}px`, tile: t }
    }
    case 'dial': {
      const t = s(30)
      const ticks = Array.from({ length: 5 }, (_, i) => `<rect x='${s(i * 6)}' y='${i === 0 ? 0 : s(8)}' width='${s(1.4)}' height='${i === 0 ? s(24) : s(16)}'/>`).join('')
      return { backgroundImage: svg(t, s(24), `<g fill='${ink}'>${ticks}</g>`), backgroundSize: `${t}px ${s(24)}px`, tile: t }
    }
    case 'espectro': {
      const stops = SPECTRUM_HEX.map((c, i) => `${c} ${((i / 11) * 100).toFixed(2)}% ${(((i + 1) / 11) * 100).toFixed(2)}%`).join(', ')
      return { backgroundImage: `linear-gradient(90deg, ${stops})`, backgroundSize: '100% 100%', tile: 0 }
    }
    case 'muro': {
      const t = s(48)
      return {
        backgroundImage: svg(t, t, `<g fill='none' stroke='${ink}' stroke-width='${s(1.4)}'><rect x='${s(2)}' y='${s(2)}' width='${s(20)}' height='${s(20)}'/><rect x='${s(26)}' y='${s(8)}' width='${s(20)}' height='${s(20)}'/><rect x='${s(-10)}' y='${s(26)}' width='${s(20)}' height='${s(20)}'/><rect x='${s(14)}' y='${s(26)}' width='${s(20)}' height='${s(20)}'/><rect x='${s(38)}' y='${s(32)}' width='${s(20)}' height='${s(20)}'/></g>`),
        backgroundSize: `${t}px ${t}px`,
        tile: t,
      }
    }
    case 'panal': {
      const w = s(30)
      const h = s(26)
      const hex = (cx: number, cy: number) => {
        const r = s(9)
        const pts = Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i
          return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`
        }).join(' ')
        return `<polygon points='${pts}'/>`
      }
      return {
        backgroundImage: svg(w, h, `<g fill='none' stroke='${ink}' stroke-width='${s(1.3)}'>${hex(w / 4, h / 2)}${hex((w * 3) / 4 + s(0.5), 0)}${hex((w * 3) / 4 + s(0.5), h)}</g>`),
        backgroundSize: `${w}px ${h}px`,
        tile: w,
      }
    }
    case 'barras': {
      const t = s(56)
      const widths = [2, 1, 3, 1, 1, 4, 2, 1, 2, 3, 1, 2, 1, 1, 3]
      let x = 0
      const bars = widths
        .map((w, i) => {
          const r = i % 2 === 0 ? `<rect x='${s(x)}' y='0' width='${s(w)}' height='${s(24)}'/>` : ''
          x += w + 1.2
          return r
        })
        .join('')
      return { backgroundImage: svg(t, s(24), `<g fill='${ink}'>${bars}</g>`), backgroundSize: `${t}px ${s(24)}px`, tile: t }
    }
    case 'tapete': {
      const t = s(40)
      const lines = Array.from({ length: 5 }, (_, i) => {
        const v = s(i * 8)
        const w = i === 0 ? s(1.6) : s(0.7)
        return `<rect x='${v}' y='0' width='${w}' height='${t}'/><rect x='0' y='${v}' width='${t}' height='${w}'/>`
      }).join('')
      return { backgroundImage: svg(t, t, `<g fill='${ink}'>${lines}</g>`), backgroundSize: `${t}px ${t}px`, tile: t }
    }
    case 'rueda': {
      return { backgroundImage: `repeating-conic-gradient(from 0deg at 50% 120%, ${ink} 0deg 1.4deg, transparent 1.4deg 7.2deg)`, backgroundSize: '100% 100%', tile: 0 }
    }
  }
}

/** Inline style object for a pattern layer. */
export function patronStyle(p: Patron, ink: string, k = 1): React.CSSProperties {
  const c = patronCss(p, ink, k)
  return { backgroundImage: c.backgroundImage, backgroundSize: c.backgroundSize }
}
