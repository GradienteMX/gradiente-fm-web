/**
 * THE CLOSED BETA'S STICKERS — enough for every tester to try the whole
 * system, and nothing that survives the release.
 *
 * Everything granted or created while the beta runs carries STICKER_BATCH
 * (sticker_copies.batch, sticker_stub_claims.batch, sticker_vouchers.batch);
 * `scripts/stickersBeta.ts --wipe` deletes it all at release and the real
 * unlock rules (support, franja membership, trophies, tickets) start from a
 * clean slate.
 *
 * The kit is the same size for everyone — stickers never read as rank:
 *   · six copies that between them cover every material a card can wear
 *     (the tester's own franja's mark when they have one, a house sticker,
 *     a holo, a foil, a dome or lenticular, a paper relief), two of them
 *     already pressed onto the case — at staggered ages, so the patina can be
 *     judged — and the rest in the binder, for the editor;
 *   · BETA_VOUCHERS store picks, to try a franja's shelf before payments exist;
 *   · admins also get a test sheet (one of every finish) in their binder,
 *     via 'prueba', to QA the renderer — never pressed for them.
 * Deterministic per user (hashed from the user id), so re-running the seed
 * never re-rolls anyone's kit.
 */

import type { Role } from '@/lib/types'
import { CASA_STICKERS } from './catalog'
import { copySeed } from './finish'
import type { CardFace, StickerDef } from './types'

export const STICKER_BATCH = 'beta-2026'
/** While true, every grant, stub claim and store pick is tagged with STICKER_BATCH. */
export const STICKERS_BETA = true
export const BETA_VOUCHERS = 3

export interface KitCopy {
  stickerId: string
  via: 'beta' | 'prueba'
}

export interface KitPlacement {
  /** Index into BetaKit.copies. */
  copy: number
  face: CardFace
  x: number
  y: number
  rot: number
  scale: number
  /** How long ago it was pressed (days) — the patina to test. */
  ageDays: number
}

export interface BetaKit {
  copies: KitCopy[]
  placements: KitPlacement[]
  vouchers: number
}

const h = (userId: string, salt: string) => copySeed(`${userId}:${salt}`)
const pick = <T,>(list: readonly T[], r: number): T | undefined => (list.length ? list[Math.min(list.length - 1, Math.floor(r * list.length))] : undefined)

/** The base mark of a franja (vinyl, no relief) — the design every other finish derives from. */
function isBaseLogo(d: StickerDef): boolean {
  return d.source === 'franja' && d.form === 'logo' && d.material === 'vinil' && !d.relieve && (!d.design || d.design === d.id)
}

export function betaKit(user: { id: string; role: Role; franjaId?: string | null }, catalog: Record<string, StickerDef>): BetaKit {
  const defs = Object.values(catalog).sort((a, b) => a.id.localeCompare(b.id))
  const franja = defs.filter((d) => d.source === 'franja')
  const logos = franja.filter(isBaseLogo)
  const holo = franja.filter((d) => d.material === 'holo')
  const metal = franja.filter((d) => d.material === 'metal')
  const domo = franja.filter((d) => d.relieve === 'domo' || d.material === 'lenticular')
  const relief = franja.filter((d) => d.material === 'papel' && d.relieve && d.relieve !== 'liso')

  const chosen: string[] = []
  const take = (d: StickerDef | undefined) => {
    if (d && !chosen.includes(d.id)) chosen.push(d.id)
  }
  // 1. their own franja's mark (belonging is the first thing a card shows), else any
  take(logos.find((d) => user.franjaId && d.franjaId === user.franjaId) ?? pick(logos, h(user.id, 'logo')))
  // 2. the house
  take(catalog[pick(CASA_STICKERS, h(user.id, 'casa')) ?? CASA_STICKERS[0]])
  // 3–6. one of each finish family
  take(pick(holo, h(user.id, 'holo')))
  take(pick(metal, h(user.id, 'metal')))
  take(pick(domo, h(user.id, 'domo')))
  take(pick(relief, h(user.id, 'relieve')))

  const copies: KitCopy[] = chosen.map((stickerId) => ({ stickerId, via: 'beta' }))

  // Two already on the case: the mark over the front's top-right corner
  // (hanging past the card, so it wraps round the edge), the house sticker
  // low on the back. Ages staggered so testers see the patina.
  const j = (salt: string, span: number) => (h(user.id, salt) - 0.5) * span
  const placements: KitPlacement[] = []
  if (copies.length > 0) {
    placements.push({ copy: 0, face: 'frente', x: 0.93 + j('x0', 0.04), y: 0.1 + j('y0', 0.05), rot: -0.22 + j('r0', 0.3), scale: 1, ageDays: 60 + Math.round(h(user.id, 'a0') * 420) })
  }
  if (copies.length > 1) {
    placements.push({ copy: 1, face: 'dorso', x: 0.16 + j('x1', 0.06), y: 0.84 + j('y1', 0.05), rot: 0.18 + j('r1', 0.3), scale: 0.95, ageDays: 20 + Math.round(h(user.id, 'a1') * 200) })
  }

  // Admins QA the renderer: one of every finish, in the binder only.
  if (user.role === 'admin') {
    const finishKey = (d: StickerDef) => [d.material, d.holo ?? '', d.metal ?? '', d.relieve ?? 'liso'].join('/')
    const seen = new Set(chosen.map((id) => catalog[id]).filter(Boolean).map(finishKey))
    for (const d of defs) {
      const k = finishKey(d)
      if (seen.has(k) || d.source === 'evento') continue
      seen.add(k)
      copies.push({ stickerId: d.id, via: 'prueba' })
    }
  }

  return { copies, placements, vouchers: BETA_VOUCHERS }
}
