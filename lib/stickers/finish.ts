/**
 * FINISHES — how a sticker's surface is made, and the spec both renderers
 * follow: the 3D credencial (components/credencial/sticker*.ts, GLSL) and the
 * flat UIs (components/stickers/*, lib/stickers/arte.ts, canvas + CSS).
 *
 * A finish is the stock (material), its foil family or metal, and a relief.
 * The same design can be printed in several finishes — each a catalog entry
 * of its own (StickerDef.design groups them), like the paper / holo / foil
 * runs of one sticker. Every COPY is unique: the foil's layout (stars,
 * shards, facets, flakes, rings, swirls, sequins, motif phase) is seeded by
 * the copy's uid (copySeed), so two copies of the same holo never catch the
 * light the same way. Shelves (nothing owned yet) show a sample seeded by the
 * design id.
 *
 * ── Stock ────────────────────────────────────────────────────────────────
 *   papel         matte paper: fibres, soft light, no gloss.
 *   vinil         a gloss film over the print: one clean highlight that
 *                 slides with the tilt, the studio reflected at grazing.
 *   holo          the print over a holographic foil (a HoloKind): the light
 *                 areas of the art let the foil through; dark ink stays ink.
 *   brillo        glitter: flakes (size and density seeded) that flip one
 *                 by one — they twinkle, they don't slide.
 *   transparente  clear film: only the ink prints; the film is a glint.
 *   metal         foil stamping (a Metal): the light areas are bare metal
 *                 (a mirror with faint hairlines), the ink sits on top, matte.
 *   lenticular    fine ridges over two interleaved frames (the design, and
 *                 its alternate — stickerArt(def, w, 'b')); tilting across the
 *                 ridges flips from one to the other, with a band of both.
 *
 * ── Holo families (the hard part: each must read at a glance) ────────────
 *   prisma    a diffraction grating: micro-lines at a seeded angle; spectral
 *             bands sweep across as it tilts; a faint crossed grating adds
 *             moiré. The classic.
 *   galaxia   deep space: a dark smoky foil under the light areas; a seeded
 *             star field in three depths (dust, stars, a few four-point
 *             flares) where each star glints at its own angle; a spectral
 *             nebula haze that drifts with the view.
 *   hielo     cracked ice: seeded Voronoi shards (20–60 per sticker), each a
 *             flat mirror at its own tilt, flashing its own colour at its
 *             own angle; thin white cracks between them.
 *   diamante  diamond plate: a regular lattice of pyramidal facets (seeded
 *             angle and pitch); each facet face flashes — engineered, where
 *             hielo is random.
 *   laser     concentric grooves round a seeded centre (often off the
 *             sticker) plus faint radial spokes: rainbow arcs that swing
 *             round the centre as the view moves, like a CD.
 *   aceite    thin-film interference: a domain-warped thickness field →
 *             oil-slick swirls (magenta, green, gold, blue) that shift with
 *             the viewing angle.
 *   escamas   sequins / fish scale: overlapping discs on a hex grid, each a
 *             small tilted mirror (seeded jitter) — they flash in rows.
 *   motivo    pattern holo: a repeated motif (the registration mark ⊕, a
 *             four-point star, or the sticker's code letters — seeded)
 *             struck into the foil; the motifs diffract at a different
 *             phase from the ground.
 *
 * ── Metals ───────────────────────────────────────────────────────────────
 *   oro (warm gold), plata (cool silver), cobre (rosy copper), grafito
 *   (dark gunmetal). Mirror-like, hairline-brushed at a seeded angle.
 *
 * ── Relief ───────────────────────────────────────────────────────────────
 *   liso      flat.
 *   tinta     raised ink (screen print): the dark ink stands proud, its
 *             edges catch light.
 *   gofrado   blind emboss: the design's main shapes pushed up from behind,
 *             soft rounded shoulders.
 *   hundido   deboss: the design pressed into the stock.
 *   barniz    spot varnish: gloss only on the ink, the rest stays matte.
 *   domo      epoxy dome: the whole sticker under a clear domed resin — a
 *             big rolling highlight, a slightly magnified print, darker
 *             refracting rim.
 *
 * Age, grime, scraping and curled corners apply over every finish (foil
 * dulls and scuffs, glitter sheds, varnish yellows, domes haze).
 */

import type { HoloKind, Metal, Relieve, StickerDef, StickerMaterial } from './types'

// (Flat renderer: lib/stickers/acabado.ts paints each family per copy on a
// canvas once — tiles of the foil, glint groups, relief light — and CSS
// moves them with the pointer. See its header for the per-family recipes.)

export interface Finish {
  material: StickerMaterial
  /** Set for 'holo' (and used as the lenticular's sheen family: prisma). */
  holo: HoloKind | null
  /** Set for 'metal'. */
  metal: Metal | null
  relieve: Relieve
}

export function finishOf(def: Pick<StickerDef, 'material' | 'holo' | 'metal' | 'relieve'>): Finish {
  return {
    material: def.material,
    holo: def.material === 'holo' ? (def.holo ?? 'prisma') : null,
    metal: def.material === 'metal' ? (def.metal ?? 'plata') : null,
    relieve: def.relieve ?? 'liso',
  }
}

/** 0..1, stable per string (FNV-1a): a copy's uid → the seed of its foil. */
export function copySeed(uid: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < uid.length; i++) {
    h ^= uid.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return ((h >>> 0) % 1_000_003) / 1_000_003
}

/**
 * The seeded layout of a copy's foil, shared by both renderers so a copy
 * looks like itself in the binder and on the case. All values derive from
 * the seed alone.
 */
export interface FoilLayout {
  /** Radians: grating / lattice / brushing direction. */
  angle: number
  /** 0.6..1.6: pattern pitch multiplier. */
  scale: number
  /** Laser centre / nebula core, in sticker UV (may sit off the sticker). */
  cx: number
  cy: number
  /** 0..1: phase of the spectrum (which colour leads). */
  hue: number
  /** 0..1: density (stars, shards, flakes). */
  density: number
  /** 0..2: which motif ('motivo'): 0 registro ⊕, 1 estrella, 2 código. */
  motif: 0 | 1 | 2
}

export function foilLayout(seed: number): FoilLayout {
  const r = (k: number) => {
    const x = Math.sin((seed * 12.9898 + k * 78.233) * 43758.5453) * 43758.5453
    return x - Math.floor(x)
  }
  return {
    angle: r(1) * Math.PI,
    scale: 0.6 + r(2),
    cx: -0.3 + r(3) * 1.6,
    cy: -0.3 + r(4) * 1.6,
    hue: r(5),
    density: r(6),
    motif: Math.min(2, Math.floor(r(7) * 3)) as 0 | 1 | 2,
  }
}

export const MATERIAL_NOMBRE: Record<StickerMaterial, string> = {
  papel: 'Papel',
  vinil: 'Vinil',
  holo: 'Holo',
  brillo: 'Brillo',
  transparente: 'Transparente',
  metal: 'Foil',
  lenticular: 'Lenticular',
}

export const HOLO_NOMBRE: Record<HoloKind, string> = {
  prisma: 'Prisma',
  galaxia: 'Galaxia',
  hielo: 'Hielo roto',
  diamante: 'Diamante',
  laser: 'Láser',
  aceite: 'Aceite',
  escamas: 'Escamas',
  motivo: 'Motivo',
}

export const METAL_NOMBRE: Record<Metal, string> = {
  oro: 'Oro',
  plata: 'Plata',
  cobre: 'Cobre',
  grafito: 'Grafito',
}

export const RELIEVE_NOMBRE: Record<Relieve, string> = {
  liso: 'Liso',
  tinta: 'Tinta en relieve',
  gofrado: 'Gofrado',
  hundido: 'Hundido',
  barniz: 'Barniz a registro',
  domo: 'Domo de resina',
}

/** "Holo · Galaxia", "Foil · Oro · Gofrado", "Papel". */
export function finishLabel(f: Finish): string {
  const parts: string[] = [MATERIAL_NOMBRE[f.material]]
  if (f.holo && f.material === 'holo') parts.push(HOLO_NOMBRE[f.holo])
  if (f.metal) parts.push(METAL_NOMBRE[f.metal])
  if (f.relieve !== 'liso') parts.push(RELIEVE_NOMBRE[f.relieve])
  return parts.join(' · ')
}

// ── shared helpers (additive) ───────────────────────────────────────────────

/** Every holo family, metal and relief, in catalog order (seeding, dev sheets). */
export const HOLO_KINDS: readonly HoloKind[] = ['prisma', 'galaxia', 'hielo', 'diamante', 'laser', 'aceite', 'escamas', 'motivo']
export const METALS: readonly Metal[] = ['oro', 'plata', 'cobre', 'grafito']
export const RELIEVES: readonly Relieve[] = ['liso', 'tinta', 'gofrado', 'hundido', 'barniz', 'domo']

/**
 * The design an entry prints: entries sharing it are the same sticker in
 * other finishes. The art's layout (plates, cuts, barcodes) is keyed by it,
 * so every finish of a design prints the same picture.
 */
export function designOf(def: Pick<StickerDef, 'id' | 'design'>): string {
  return def.design ?? def.id
}

/** Stocks whose foil, glitter or metal is laid out per copy (copySeed): no two copies alike. */
export function isOneOfAKind(f: Finish): boolean {
  return f.material === 'holo' || f.material === 'brillo' || f.material === 'metal'
}

/** The seed a shelf shows before anyone owns a copy: a sample, the design's own. */
export function sampleSeed(design: string): number {
  return copySeed(`muestra:${design}`)
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * The window: how much of the foil (holo, glitter or bare metal) shows
 * through a printed pixel, from its display-space colour (0..1 per channel).
 * The light, unsaturated print — the bare stock, white and pale inks — lets
 * the foil through; dark or saturated ink stays ink. GLSL twin:
 *   smoothstep(0.35, 0.9, luma(c)) * (1.0 - 0.6 * smoothstep(0.25, 0.65, max3(c) - min3(c)))
 * with luma = dot(c, vec3(0.299, 0.587, 0.114)).
 */
export function foilWindow(r: number, g: number, b: number): number {
  const l = 0.299 * r + 0.587 * g + 0.114 * b
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  return smooth(0.35, 0.9, l) * (1 - 0.6 * smooth(0.25, 0.65, sat))
}
