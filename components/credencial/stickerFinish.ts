/**
 * A sticker's finish (lib/stickers/finish.ts — the spec) as the case's
 * shader reads it: indices for the material, the holo family and the
 * relief, the metal's tone, and the copy's seeded foil layout packed in two
 * vec4s. Also the small texture the 'motivo' family strikes when its motif
 * is the sticker's code.
 *
 *   uMat    0 papel · 1 vinil · 2 holo · 3 brillo · 4 transparente · 5 metal · 6 lenticular
 *   uKind   0 prisma · 1 galaxia · 2 hielo · 3 diamante · 4 laser · 5 aceite · 6 escamas · 7 motivo
 *   uRel    0 liso · 1 tinta · 2 gofrado · 3 hundido · 4 barniz · 5 domo
 *   uMetal  F0 (display space) · how much it tarnishes
 *   uFoilA  angle · scale · hue · density
 *   uFoilB  centre x · centre y (sticker uv) · motif · a spare seeded 0..1
 */

import { copySeed, finishOf, foilLayout, type Finish, type FoilLayout } from '@/lib/stickers/finish'
import type { HoloKind, Metal, Relieve, StickerDef, StickerMaterial } from '@/lib/stickers/types'

/** Development: a finish forced over the catalog's (window.__calcosGL). */
export type FinishOverride = Partial<Pick<StickerDef, 'material' | 'holo' | 'metal' | 'relieve'>>

export const MAT_INDEX: Record<StickerMaterial, number> = { papel: 0, vinil: 1, holo: 2, brillo: 3, transparente: 4, metal: 5, lenticular: 6 }
export const HOLO_INDEX: Record<HoloKind, number> = { prisma: 0, galaxia: 1, hielo: 2, diamante: 3, laser: 4, aceite: 5, escamas: 6, motivo: 7 }
export const RELIEVE_INDEX: Record<Relieve, number> = { liso: 0, tinta: 1, gofrado: 2, hundido: 3, barniz: 4, domo: 5 }

/** Each metal's reflectance (display space) and how much it tarnishes with age. */
export const METAL_TONE: Record<Metal, readonly [number, number, number, number]> = {
  oro: [1.0, 0.8, 0.42, 0.12],
  plata: [0.93, 0.94, 0.96, 0.55],
  cobre: [0.97, 0.64, 0.5, 0.7],
  grafito: [0.38, 0.39, 0.42, 0.2],
}

export interface FinishUniforms {
  finish: Finish
  layout: FoilLayout
  seed: number
  mat: number
  kind: number
  rel: number
  metal: readonly [number, number, number, number]
  foilA: [number, number, number, number]
  foilB: [number, number, number, number]
}

/** The finish of one copy: `seedKey` is the copy's uid (a shelf sample: the design id). */
export function finishUniforms(def: StickerDef, seedKey: string, over?: FinishOverride | null): FinishUniforms {
  const finish = finishOf({
    material: over?.material ?? def.material,
    holo: over?.holo ?? def.holo,
    metal: over?.metal ?? def.metal,
    relieve: over?.relieve ?? def.relieve,
  })
  const seed = copySeed(seedKey)
  const layout = foilLayout(seed)
  return {
    finish,
    layout,
    seed,
    mat: MAT_INDEX[finish.material] ?? 0,
    kind: finish.holo ? HOLO_INDEX[finish.holo] : 0,
    rel: RELIEVE_INDEX[finish.relieve] ?? 0,
    metal: METAL_TONE[finish.metal ?? 'plata'],
    foilA: [layout.angle, layout.scale, layout.hue, layout.density],
    foilB: [layout.cx, layout.cy, layout.motif, (seed * 7.31) % 1],
  }
}

function monoFamily(): string {
  try {
    const probe = document.createElement('span')
    probe.style.display = 'none'
    probe.style.fontFamily = 'var(--font-mono)'
    document.body.appendChild(probe)
    const v = getComputedStyle(probe).fontFamily.trim()
    probe.remove()
    return v || 'ui-monospace, monospace'
  } catch {
    return 'ui-monospace, monospace'
  }
}

/** The sticker's code as a 2:1 tile (white on black, red channel read), for 'motivo' · código. */
export function paintMotif(code: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const x = c.getContext('2d')
  if (!x) return c
  x.fillStyle = '#000'
  x.fillRect(0, 0, c.width, c.height)
  const text = code.replace(/\s+/g, '') || 'GR'
  const fam = monoFamily()
  let px = 70
  x.font = `700 ${px}px ${fam}`
  const w = x.measureText(text).width
  if (w > 216) {
    px = (px * 216) / w
    x.font = `700 ${px.toFixed(1)}px ${fam}`
  }
  x.fillStyle = '#fff'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(text, 128, 68)
  return c
}
