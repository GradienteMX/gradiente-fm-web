'use client'

/**
 * The finishes, flat — for the CSS card (no WebGL): one seeded tile per copy
 * (copySeed(uid) → foilLayout, the same layout the case's shader uses), so a
 * copy keeps its own stars, shards, swirl or grain without the GPU.
 *
 *   tile   laid over the art with `multiply`: the foil, metal or glitter bed
 *          the light areas take (dark ink stays ink — foilWindow, roughly)
 *   glint  laid over it with `screen`: flakes, stars, a gloss band
 *
 * Painted once per copy on a small canvas (≈192 px wide, the sticker's
 * aspect), cached as data URLs.
 */

import { finishOf, foilLayout, type Finish, type FoilLayout } from '@/lib/stickers/finish'
import type { StickerDef } from '@/lib/stickers/types'
import { METAL_TONE, type FinishOverride } from './stickerFinish'

export interface FlatFinish {
  finish: Finish
  tile: string | null
  glint: string | null
}

const cache = new Map<string, FlatFinish>()
const W = 192

function rng(seed: number) {
  let a = Math.floor(seed * 4294967296) | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The shader's cosine rainbow (glsl.ts SPECTRAL), 0..255. */
function spectral(p: number, lo = 0.04, hi = 0.96): [number, number, number] {
  const c = (o: number) => 0.5 + 0.5 * Math.cos(Math.PI * 2 * (p + o))
  const k = (v: number) => Math.round((lo + (hi - lo) * v) * 255)
  return [k(c(0)), k(c(0.33)), k(c(0.67))]
}

const css = ([r, g, b]: [number, number, number], a = 1) => `rgba(${r},${g},${b},${a})`

/** A small value noise for the per-pixel painters. */
function noise(seed: number) {
  const R = rng(seed)
  const n = 64
  const t = new Float32Array(n * n)
  for (let i = 0; i < t.length; i++) t[i] = R()
  const at = (x: number, y: number) => t[(((y % n) + n) % n) * n + (((x % n) + n) % n)]
  return (x: number, y: number) => {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = x - ix
    const fy = y - iy
    const ux = fx * fx * (3 - 2 * fx)
    const uy = fy * fy * (3 - 2 * fy)
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * ux
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * ux
    return a + (b - a) * uy
  }
}

function canvas(h: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  const c = document.createElement('canvas')
  c.width = W
  c.height = h
  const x = c.getContext('2d')
  return x ? [c, x] : null
}

function pixels(x: CanvasRenderingContext2D, h: number, f: (px: number, py: number) => [number, number, number]) {
  const img = x.createImageData(W, h)
  const d = img.data
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < W; px++) {
      const [r, g, b] = f(px, py)
      const i = (py * W + px) * 4
      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
      d[i + 3] = 255
    }
  }
  x.putImageData(img, 0, 0)
}

// ── the tiles (multiply) ───────────────────────────────────────────────────

function prisma(x: CanvasRenderingContext2D, h: number, L: FoilLayout, R: () => number) {
  const span = Math.hypot(W, h)
  x.save()
  x.translate(W / 2, h / 2)
  x.rotate(L.angle)
  const g = x.createLinearGradient(-span / 2, 0, span / 2, 0)
  const bands = 2 + Math.round(L.scale * 1.5)
  for (let i = 0; i <= 12; i++) g.addColorStop(i / 12, css(spectral(L.hue + (i / 12) * bands, 0.55, 1)))
  x.fillStyle = g
  x.fillRect(-span / 2, -span / 2, span, span)
  // a faint crossed grating
  x.rotate(Math.PI / 2)
  x.globalAlpha = 0.25
  const g2 = x.createLinearGradient(-span / 2, 0, span / 2, 0)
  for (let i = 0; i <= 8; i++) g2.addColorStop(i / 8, css(spectral(L.hue + 0.5 + i / 4, 0.6, 1)))
  x.fillStyle = g2
  x.fillRect(-span / 2, -span / 2, span, span)
  x.restore()
  // patches where the master turns
  x.globalAlpha = 0.18
  for (let i = 0; i < 6; i++) {
    const r = (0.15 + R() * 0.3) * W
    const rg = x.createRadialGradient(R() * W, R() * h, 0, R() * W, R() * h, r)
    rg.addColorStop(0, css(spectral(R(), 0.6, 1)))
    rg.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = rg
    x.fillRect(0, 0, W, h)
  }
  x.globalAlpha = 1
}

function galaxia(x: CanvasRenderingContext2D, h: number, L: FoilLayout, R: () => number) {
  x.fillStyle = '#16132a'
  x.fillRect(0, 0, W, h)
  for (let i = 0; i < 5; i++) {
    const cx = R() * W
    const cy = R() * h
    const r = (0.25 + R() * 0.4) * W
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r)
    rg.addColorStop(0, css(spectral(L.hue + R() * 0.5, 0.15, 0.55), 0.55))
    rg.addColorStop(1, 'rgba(22,19,42,0)')
    x.fillStyle = rg
    x.fillRect(0, 0, W, h)
  }
}

function hielo(x: CanvasRenderingContext2D, h: number, L: FoilLayout, R: () => number) {
  const n = Math.round(20 + 40 * L.density)
  const pts: [number, number, [number, number, number]][] = []
  for (let i = 0; i < n; i++) pts.push([R() * W, R() * h, spectral(R(), 0.55, 1)])
  pixels(x, h, (px, py) => {
    let d1 = 1e9
    let d2 = 1e9
    let c: [number, number, number] = [255, 255, 255]
    for (const [qx, qy, col] of pts) {
      const d = (qx - px) ** 2 + (qy - py) ** 2
      if (d < d1) {
        d2 = d1
        d1 = d
        c = col
      } else if (d < d2) d2 = d
    }
    return Math.sqrt(d2) - Math.sqrt(d1) < 1.2 ? [255, 255, 255] : c
  })
}

function diamante(x: CanvasRenderingContext2D, h: number, L: FoilLayout) {
  const pitch = 9 * L.scale
  const ca = Math.cos(L.angle)
  const sa = Math.sin(L.angle)
  const shade = [1, 0.62, 0.8, 0.5]
  pixels(x, h, (px, py) => {
    const u = (px * ca + py * sa) / pitch
    const v = (-px * sa + py * ca) / pitch
    const cx = u - Math.floor(u) - 0.5
    const cy = v - Math.floor(v) - 0.5
    const k = Math.abs(cx) > Math.abs(cy) ? (cx > 0 ? 0 : 2) : cy > 0 ? 1 : 3
    const [r, g, b] = spectral(L.hue + (Math.floor(u) + Math.floor(v)) * 0.07 + k * 0.2, 0.75, 1)
    const s = shade[k]
    return [r * s, g * s, b * s]
  })
}

function laser(x: CanvasRenderingContext2D, h: number, L: FoilLayout) {
  const cx = L.cx * W
  const cy = (1 - L.cy) * h
  const g = x.createConicGradient(L.angle, cx, cy)
  for (let i = 0; i <= 16; i++) g.addColorStop(i / 16, css(spectral(L.hue + (i / 16) * 2, 0.5, 1)))
  x.fillStyle = g
  x.fillRect(0, 0, W, h)
  x.strokeStyle = 'rgba(255,255,255,0.35)'
  x.lineWidth = 0.6
  const rMax = Math.hypot(W, h) * 1.2
  for (let r = 3; r < rMax; r += 3) {
    x.beginPath()
    x.arc(cx, cy, r, 0, Math.PI * 2)
    x.stroke()
  }
}

function aceite(x: CanvasRenderingContext2D, h: number, L: FoilLayout, seed: number) {
  const n1 = noise(seed)
  const n2 = noise(seed + 0.37)
  const k = 0.035 / L.scale
  pixels(x, h, (px, py) => {
    const qx = px * k
    const qy = py * k
    const wx = n1(qx + 1.3, qy) * 2.2
    const wy = n2(qx, qy + 5.2) * 2.2
    const th = 250 + 620 * n1(qx + wx, qy + wy)
    const opd = 2.84 * th
    const c = (lam: number) => 0.5 + 0.5 * Math.cos((Math.PI * 2 * opd) / lam + Math.PI)
    return [Math.round((0.35 + 0.65 * c(650)) * 255), Math.round((0.35 + 0.65 * c(540)) * 255), Math.round((0.35 + 0.65 * c(450)) * 255)]
  })
}

function escamas(x: CanvasRenderingContext2D, h: number, L: FoilLayout) {
  const s = 13 * L.scale
  const rows = Math.ceil(h / (s * 0.5)) + 3
  const cols = Math.ceil(W / s) + 2
  x.fillStyle = '#c9ced6'
  x.fillRect(0, 0, W, h)
  // top rows first: each lower row lies over the one above
  for (let row = -2; row < rows; row++) {
    const off = (((row % 2) + 2) % 2) * 0.5
    const col = spectral(L.hue + row * 0.09, 0.55, 1)
    for (let c = -1; c < cols; c++) {
      const cx = (c + off) * s
      const cy = row * s * 0.5
      const g = x.createRadialGradient(cx - s * 0.15, cy - s * 0.2, 0, cx, cy, s * 0.62)
      g.addColorStop(0, '#ffffff')
      g.addColorStop(0.55, css(col))
      g.addColorStop(1, css([col[0] * 0.6, col[1] * 0.6, col[2] * 0.6]))
      x.fillStyle = g
      x.beginPath()
      x.arc(cx, cy, s * 0.62, 0, Math.PI * 2)
      x.fill()
    }
  }
}

function motivo(x: CanvasRenderingContext2D, h: number, L: FoilLayout, def: StickerDef, R: () => number) {
  prisma(x, h, L, R)
  const pitch = 26 * L.scale
  x.save()
  x.strokeStyle = css(spectral(L.hue + 0.5, 0.2, 0.6))
  x.fillStyle = css(spectral(L.hue + 0.5, 0.2, 0.6))
  x.lineWidth = 1.6
  x.font = `700 ${(pitch * 0.34).toFixed(1)}px ui-monospace, monospace`
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  for (let py = pitch / 2; py < h + pitch; py += pitch) {
    for (let px = pitch / 2; px < W + pitch; px += pitch) {
      if (L.motif === 0) {
        x.beginPath()
        x.arc(px, py, pitch * 0.27, 0, Math.PI * 2)
        x.moveTo(px - pitch * 0.42, py)
        x.lineTo(px + pitch * 0.42, py)
        x.moveTo(px, py - pitch * 0.42)
        x.lineTo(px, py + pitch * 0.42)
        x.stroke()
      } else if (L.motif === 1) {
        const r = pitch * 0.36
        x.beginPath()
        x.moveTo(px, py - r)
        x.quadraticCurveTo(px, py, px + r, py)
        x.quadraticCurveTo(px, py, px, py + r)
        x.quadraticCurveTo(px, py, px - r, py)
        x.quadraticCurveTo(px, py, px, py - r)
        x.fill()
      } else x.fillText(def.art.code.replace(/\s+/g, ''), px, py)
    }
  }
  x.restore()
}

function metal(x: CanvasRenderingContext2D, h: number, L: FoilLayout, f: Finish, R: () => number) {
  const [r, g, b] = METAL_TONE[f.metal ?? 'plata']
  const base = (k: number): [number, number, number] => [Math.min(255, r * 255 * k), Math.min(255, g * 255 * k), Math.min(255, b * 255 * k)]
  const span = Math.hypot(W, h)
  x.save()
  x.translate(W / 2, h / 2)
  x.rotate(L.angle + Math.PI / 2)
  // broad bands across the brushing: where the studio slides
  const gr = x.createLinearGradient(-span / 2, 0, span / 2, 0)
  const steps = 7
  for (let i = 0; i <= steps; i++) gr.addColorStop(i / steps, css(base(0.55 + 0.6 * R())))
  x.fillStyle = gr
  x.fillRect(-span / 2, -span / 2, span, span)
  // hairlines along the brushing
  x.rotate(-Math.PI / 2)
  for (let i = 0; i < 260; i++) {
    x.globalAlpha = 0.05 + R() * 0.12
    x.fillStyle = R() < 0.5 ? '#ffffff' : '#000000'
    x.fillRect(-span / 2, -span / 2 + R() * span, span, 0.6)
  }
  x.restore()
  x.globalAlpha = 1
}

// ── the glints (screen) ────────────────────────────────────────────────────

function stars(x: CanvasRenderingContext2D, h: number, R: () => number, n: number) {
  for (let i = 0; i < n; i++) {
    const big = R() < 0.06
    x.globalAlpha = 0.4 + R() * 0.6
    x.fillStyle = R() < 0.7 ? '#ffffff' : css(spectral(R(), 0.6, 1))
    const px = R() * W
    const py = R() * h
    const s = big ? 1.6 : 0.5 + R() * 0.9
    x.beginPath()
    x.arc(px, py, s, 0, Math.PI * 2)
    x.fill()
    if (big) {
      x.fillRect(px - 7, py - 0.4, 14, 0.8)
      x.fillRect(px - 0.4, py - 7, 0.8, 14)
    }
  }
  x.globalAlpha = 1
}

function flakes(x: CanvasRenderingContext2D, h: number, R: () => number, n: number) {
  for (let i = 0; i < n; i++) {
    x.globalAlpha = 0.35 + R() * 0.65
    x.fillStyle = R() < 0.5 ? '#ffffff' : css(spectral(R(), 0.55, 1))
    x.save()
    x.translate(R() * W, R() * h)
    x.rotate(R() * Math.PI)
    const s = 0.8 + R() * 2.2
    x.fillRect(-s / 2, -s / 2, s, s)
    x.restore()
  }
  x.globalAlpha = 1
}

function gloss(x: CanvasRenderingContext2D, h: number, L: FoilLayout) {
  const span = Math.hypot(W, h)
  x.save()
  x.translate(W / 2, h / 2)
  x.rotate(-0.6 + (L.angle - Math.PI / 2) * 0.2)
  x.fillStyle = 'rgba(255,255,255,0.55)'
  x.fillRect(-span * 0.06, -span, span * 0.12, span * 2)
  x.fillStyle = 'rgba(255,255,255,0.35)'
  x.fillRect(span * 0.1, -span, span * 0.03, span * 2)
  x.restore()
}

/** The flat finish of one copy (seedKey: its uid; a shelf sample: `muestra:<design>`). */
export function flatFinish(def: StickerDef, seed: number, over?: FinishOverride | null): FlatFinish {
  const finish = finishOf({
    material: over?.material ?? def.material,
    holo: over?.holo ?? def.holo,
    metal: over?.metal ?? def.metal,
    relieve: over?.relieve ?? def.relieve,
  })
  const key = `${finish.material}:${finish.holo ?? ''}:${finish.metal ?? ''}:${seed}:${def.aspect}:${def.art.code}`
  const hit = cache.get(key)
  if (hit) return hit
  const out: FlatFinish = { finish, tile: null, glint: null }
  if (typeof document === 'undefined') return out
  const h = Math.max(32, Math.round(W / Math.max(0.2, def.aspect)))
  const L = foilLayout(seed)
  const R = rng(seed)
  try {
    const t = finish.material === 'holo' || finish.material === 'metal' || finish.material === 'brillo' ? canvas(h) : null
    if (t) {
      const [c, x] = t
      if (finish.material === 'metal') metal(x, h, L, finish, R)
      else if (finish.material === 'brillo') {
        x.fillStyle = '#b9bec6'
        x.fillRect(0, 0, W, h)
      } else {
        const k = finish.holo ?? 'prisma'
        if (k === 'prisma') prisma(x, h, L, R)
        else if (k === 'galaxia') galaxia(x, h, L, R)
        else if (k === 'hielo') hielo(x, h, L, R)
        else if (k === 'diamante') diamante(x, h, L)
        else if (k === 'laser') laser(x, h, L)
        else if (k === 'aceite') aceite(x, h, L, seed)
        else if (k === 'escamas') escamas(x, h, L)
        else motivo(x, h, L, def, R)
      }
      out.tile = c.toDataURL('image/png')
    }
    const g = canvas(h)
    if (g) {
      const [c, x] = g
      let any = true
      if (finish.material === 'brillo') flakes(x, h, R, Math.round(260 + 420 * L.density))
      else if (finish.material === 'holo' && finish.holo === 'galaxia') stars(x, h, R, Math.round(90 + 140 * L.density))
      else if (finish.material === 'vinil' || finish.material === 'lenticular' || finish.relieve === 'domo') gloss(x, h, L)
      else any = false
      if (any) out.glint = c.toDataURL('image/png')
    }
  } catch {
    /* the plain art is still the sticker */
  }
  cache.set(key, out)
  return out
}
