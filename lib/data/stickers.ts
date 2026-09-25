import 'server-only'

/**
 * Server reads for stickers (migration 0052), in the client's shapes.
 *
 *   getStickerCatalog()   the catalog, derived from the published items
 *   getPublicStickers()   every sticker pressed on every card, and how much of
 *                         each numbered run is issued — public to members;
 *                         cached apart from the world (tag 'stickers'), so a
 *                         press or a scrape doesn't rebuild the whole snapshot
 *   loadMyStickers()      one person's binder, stub claims and beta vouchers
 *
 * Until 0052 is applied the tables don't exist: every read degrades to empty
 * so the site keeps working.
 */

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { catalogFromDb, type CopyRow, type PlacementRow, type StickerDb } from '@/lib/stickers/store'
import type { StickerCopy, StickerDef, StickerPlacement } from '@/lib/stickers/types'
import type { PrivateStickers } from '@/lib/store/snapshot'

// Untyped: the generated Database types predate 0052.
const admin = () => createAdminClient() as unknown as StickerDb

/** 0052 not applied yet: Postgres says 42P01, PostgREST's schema cache says PGRST205. */
const missingTable = (code?: string) => code === '42P01' || code === 'PGRST205'

/** What a sticker write revalidates: `revalidateTag(STICKERS_TAG, { expire: 0 })`. */
export const STICKERS_TAG = 'stickers'

export const getStickerCatalog: () => Promise<Record<string, StickerDef>> = unstable_cache(
  async () => {
    try {
      return await catalogFromDb(admin())
    } catch (e) {
      console.error('[stickers] catalog:', e)
      return {}
    }
  },
  ['sticker-catalog'],
  // The catalog only changes when franjas or nights are published.
  { tags: ['world', 'sticker-catalog'], revalidate: 3600 },
)

export const toPlacement = (r: PlacementRow): StickerPlacement => ({
  uid: r.uid,
  userId: r.user_id,
  stickerId: r.sticker_id,
  face: r.face,
  x: r.x,
  y: r.y,
  rot: r.rot,
  scale: r.scale,
  z: r.z,
  at: r.placed_at,
  wear: r.wear,
})

export const toCopy = (r: CopyRow): StickerCopy => ({
  uid: r.uid,
  stickerId: r.sticker_id,
  userId: r.user_id,
  at: r.acquired_at,
  via: r.via,
  serial: r.serial ?? undefined,
})

export const getPublicStickers: () => Promise<{ placements: StickerPlacement[]; stickerSerials: Record<string, number> }> = unstable_cache(
  async () => {
    const db = admin()
    const [pl, se] = await Promise.all([db.from('sticker_placements').select('*').order('z', { ascending: true }), db.from('sticker_serials').select('sticker_id, last')])
    if (pl.error) {
      // 0052 not applied yet — no stickers anywhere, quietly.
      if (!missingTable(pl.error.code)) console.error('[stickers] placements:', pl.error.message)
      return { placements: [], stickerSerials: {} }
    }
    const stickerSerials: Record<string, number> = {}
    for (const r of (se.data ?? []) as Array<{ sticker_id: string; last: number }>) stickerSerials[r.sticker_id] = r.last
    return { placements: ((pl.data ?? []) as PlacementRow[]).map(toPlacement), stickerSerials }
  },
  ['stickers:public:v1'],
  { tags: [STICKERS_TAG], revalidate: 300 },
)

export async function loadMyStickers(userId: string): Promise<PrivateStickers> {
  const db = admin()
  const [copies, claims, vouchers] = await Promise.all([
    db.from('sticker_copies').select('*').eq('user_id', userId).order('acquired_at', { ascending: false }),
    db.from('sticker_stub_claims').select('sticker_id, claimed_at').eq('user_id', userId),
    db.from('sticker_vouchers').select('remaining').eq('user_id', userId).maybeSingle(),
  ])
  if (copies.error) {
    if (!missingTable(copies.error.code)) console.error('[stickers] binder:', copies.error.message)
    return { copies: [], claims: {}, vouchers: 0 }
  }
  const claimed: Record<string, string> = {}
  for (const r of (claims.data ?? []) as Array<{ sticker_id: string; claimed_at: string }>) claimed[r.sticker_id] = r.claimed_at
  return {
    copies: ((copies.data ?? []) as CopyRow[]).map(toCopy),
    claims: claimed,
    vouchers: (vouchers.data as { remaining: number } | null)?.remaining ?? 0,
  }
}
