/**
 * CALCOS — stickers for the credencial.
 *
 * A sticker is a small printed object that says who you stand with: a
 * franja's mark bought from its store, the stub of a night you had a ticket
 * for, the house's own. Stickers are applied to the credencial's case like
 * decals on a well-used object — permanent once pressed (CS rules: you can
 * only scrape them off) — and they age: the older the sticker, the more the
 * case reads like a wall that's been stuck on for years.
 *
 * Contract shared by the world core (acquire / apply / scrape), the art
 * generator (lib/stickers/arte.ts), the 3D credencial and the UIs.
 */

/**
 * The stock a sticker is printed on. The same design can come in several
 * finishes — each a catalog entry of its own, grouped by `design`. The full
 * visual spec of every finish lives in ./finish.ts (both renderers follow it).
 */
export type StickerMaterial = 'papel' | 'vinil' | 'holo' | 'brillo' | 'transparente' | 'metal' | 'lenticular'
/** Holographic foil families (material 'holo'): each reads as a different stock at a glance. */
export type HoloKind = 'prisma' | 'galaxia' | 'hielo' | 'diamante' | 'laser' | 'aceite' | 'escamas' | 'motivo'
/** Foil metals (material 'metal'). */
export type Metal = 'oro' | 'plata' | 'cobre' | 'grafito'
/** Raised or pressed detail over the stock. */
export type Relieve = 'liso' | 'tinta' | 'gofrado' | 'hundido' | 'barniz' | 'domo'
export type StickerForm = 'logo' | 'tipo' | 'boleto' | 'circulo' | 'cinta' | 'sello'
export type StickerSource = 'franja' | 'evento' | 'casa'
/**
 * How a copy was obtained (sticker_copies.via): a store purchase, a night's
 * stub, a gift from the house; after release the unlock rules (franja
 * membership, trophies, participation); during the closed beta the kit and
 * store vouchers ('beta') and the admins' test sheet ('prueba').
 */
export type StickerVia = 'compra' | 'boleto' | 'regalo' | 'franja' | 'trofeo' | 'participacion' | 'beta' | 'prueba'

export interface StickerArt {
  /** Main word(s): the franja's or the night's name. */
  title: string
  /** Secondary lines: kind, venue, date, line-up… (already in display order). */
  lines: string[]
  /** Short code printed small: 'FR·NAAF', 'EV·25.09'. */
  code: string
  /** Franja logo (same-origin, e.g. /franjas/<slug>.png). */
  logo?: string
  /** Event flyer (remote or local; the generator routes it through /_next/image). */
  image?: string
  /** ISO date for dated stickers (events). */
  date?: string
  /** 0..1, stable per sticker — layout variation for the generator. */
  seed: number
}

export interface StickerDef {
  id: string
  source: StickerSource
  franjaId?: string
  eventId?: string
  /** Human name for lists: "N.A.A.F.I. — holo". */
  name: string
  form: StickerForm
  material: StickerMaterial
  /** The design this entry prints; entries sharing it are the same sticker in other finishes (defaults to `id`). */
  design?: string
  /** Foil family, for material 'holo' (default 'prisma'). */
  holo?: HoloKind
  /** Foil metal, for material 'metal' (default 'plata'). */
  metal?: Metal
  /** Raised or pressed detail (default 'liso'). */
  relieve?: Relieve
  /** Energy 0..10 the design is inked in (franja mean / event band mid). */
  energy: number
  /** MXN. Only franja stickers carry a price (the demo never charges). */
  price?: number
  /** Limited run; serials are issued in acquisition order. */
  edition?: number
  art: StickerArt
  /** The way this sticker is obtained. */
  via: StickerVia
  /** Default width on the card, as a fraction of the card's width (0.18–0.36). */
  size: number
  /** Die-cut aspect ratio, width / height. */
  aspect: number
}

/** One copy in someone's binder. Applying it consumes it into a placement. */
export interface StickerCopy {
  uid: string
  stickerId: string
  userId: string
  at: string
  via: StickerVia
  /** n of `edition` for limited stickers. */
  serial?: number
}

export type CardFace = 'frente' | 'dorso'

export interface StickerPlacement {
  /** The copy's uid (a copy is placed at most once). */
  uid: string
  userId: string
  /** The sticker it is (denormalized — someone else's binder is private, their card isn't). */
  stickerId?: string
  face: CardFace
  /**
   * Centre on the face, 0..1 over the printed card from the face's top-left
   * corner. It may sit past the card, on the case's margin, up to
   * PLACEMENT_BLEED beyond either edge: a sticker that hangs past the case's
   * outline wraps round its edge onto the other face.
   */
  x: number
  y: number
  /** Radians, clockwise. */
  rot: number
  /** 0.6..1.5 × the sticker's default size. */
  scale: number
  /** Stacking order: later applications sit above earlier ones. */
  z: number
  /** When it was pressed — age (and its patina) counts from here. */
  at: string
  /** 0..1 scraped; at 1 the sticker is gone for good. */
  wear: number
}

export const SCRAPE_STEP = 0.25
export const PLACEMENT_SCALE: readonly [number, number] = [0.6, 1.5]
/** How far past the printed card a sticker's centre may sit (face units); the editor clamps to the case's real outline. */
export const PLACEMENT_BLEED = 0.1
