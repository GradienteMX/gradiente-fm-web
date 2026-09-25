/**
 * Stickers in the database (migration 0052) — every write the API routes and
 * scripts make, with the service-role client. The rules live here, not in
 * SQL: the catalog is derived from the items (lib/stickers/catalog.ts), the
 * same function the client runs, so what the shelf shows and what the server
 * accepts can't drift apart.
 *
 * Server-only: never import from a client component.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentItem, Role } from '@/lib/types'
import { buildStickerCatalog } from './catalog'
import { betaKit, STICKER_BATCH, STICKERS_BETA } from './beta'
import { PLACEMENT_BLEED, PLACEMENT_SCALE, SCRAPE_STEP, type CardFace, type StickerDef } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the generated Database types don't know 0052 yet
export type StickerDb = SupabaseClient<any, any, any>
type Db = StickerDb

/** A night's stub can be claimed until a week after it ends (same window as the client's STUB_WINDOW_MS). */
export const STUB_WINDOW_MS = 7 * 86_400_000
const DAY = 86_400_000

/** The batch a new grant carries: the beta's while it runs, none after. */
export const currentBatch = (): string | null => (STICKERS_BETA ? STICKER_BATCH : null)

export class StickerError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

// ── the catalog, from the published items ───────────────────────────────────

const CATALOG_COLUMNS = 'id, slug, type, title, image_url, franja_kind, franja_id, vibe_min, vibe_max, date, end_date, venue, artists'

interface CatalogRow {
  id: string
  slug: string
  type: ContentItem['type']
  title: string
  image_url: string | null
  franja_kind: string | null
  franja_id: string | null
  vibe_min: number
  vibe_max: number
  date: string | null
  end_date: string | null
  venue: string | null
  artists: string[] | null
}

/** The items the catalog is derived from — only the fields it reads. */
export async function catalogItems(db: Db): Promise<ContentItem[]> {
  const { data, error } = await db.from('items').select(CATALOG_COLUMNS).eq('published', true)
  if (error) throw new StickerError(`catalog: ${error.message}`, 500)
  return ((data ?? []) as CatalogRow[]).map(
    (r) =>
      ({
        id: r.id,
        slug: r.slug,
        type: r.type,
        title: r.title,
        imageUrl: r.image_url ?? undefined,
        franjaKind: r.franja_kind ?? undefined,
        franjaId: r.franja_id ?? undefined,
        vibeMin: r.vibe_min,
        vibeMax: r.vibe_max,
        date: r.date ?? undefined,
        endDate: r.end_date ?? undefined,
        venue: r.venue ?? undefined,
        artists: r.artists ?? undefined,
        genres: [],
        tags: [],
      }) as unknown as ContentItem,
  )
}

export async function catalogFromDb(db: Db): Promise<Record<string, StickerDef>> {
  return buildStickerCatalog(await catalogItems(db))
}

// ── copies ──────────────────────────────────────────────────────────────────

export interface NewCopy {
  /** A UUID the client minted, so it can act on the copy before any refresh. */
  uid?: string
  stickerId: string
  via: 'compra' | 'boleto' | 'regalo' | 'franja' | 'trofeo' | 'participacion' | 'beta' | 'prueba'
  serial?: number | null
  acquiredAt?: string
}

export interface CopyRow {
  uid: string
  user_id: string
  sticker_id: string
  via: NewCopy['via']
  serial: number | null
  batch: string | null
  acquired_at: string
}

export async function grantCopies(db: Db, userId: string, copies: NewCopy[], batch: string | null = currentBatch()): Promise<CopyRow[]> {
  if (!copies.length) return []
  const rows = copies.map((c) => ({
    ...(c.uid ? { uid: c.uid } : {}),
    user_id: userId,
    sticker_id: c.stickerId,
    via: c.via,
    serial: c.serial ?? null,
    batch,
    ...(c.acquiredAt ? { acquired_at: c.acquiredAt } : {}),
  }))
  const { data, error } = await db.from('sticker_copies').insert(rows).select('*')
  if (error) throw new StickerError(error.code === '23505' ? 'Esa copia ya existe.' : `grant: ${error.message}`, error.code === '23505' ? 409 : 500)
  return (data ?? []) as CopyRow[]
}

async function ownCopy(db: Db, userId: string, uid: string): Promise<CopyRow> {
  const { data, error } = await db.from('sticker_copies').select('*').eq('uid', uid).maybeSingle()
  if (error) throw new StickerError(error.message, 500)
  if (!data || (data as CopyRow).user_id !== userId) throw new StickerError('Esa copia no es tuya.', 404)
  return data as CopyRow
}

// ── placing and scraping ────────────────────────────────────────────────────

export interface PlacementInput {
  face: CardFace
  x: number
  y: number
  rot: number
  scale: number
}

export interface PlacementRow extends PlacementInput {
  uid: string
  user_id: string
  sticker_id: string
  z: number
  placed_at: string
  wear: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export async function placeCopy(db: Db, userId: string, uid: string, p: PlacementInput, placedAt?: string): Promise<PlacementRow> {
  if (p.face !== 'frente' && p.face !== 'dorso') throw new StickerError('Cara inválida.', 400)
  for (const v of [p.x, p.y, p.rot, p.scale]) if (typeof v !== 'number' || !Number.isFinite(v)) throw new StickerError('Posición inválida.', 400)
  const copy = await ownCopy(db, userId, uid)
  const { data: already } = await db.from('sticker_placements').select('uid').eq('uid', uid).maybeSingle()
  if (already) throw new StickerError('Ya está pegado: solo sale raspando.', 409)
  const { data: top } = await db.from('sticker_placements').select('z').eq('user_id', userId).order('z', { ascending: false }).limit(1).maybeSingle()
  const row = {
    uid,
    user_id: userId,
    sticker_id: copy.sticker_id,
    face: p.face,
    x: clamp(p.x, -PLACEMENT_BLEED, 1 + PLACEMENT_BLEED),
    y: clamp(p.y, -PLACEMENT_BLEED, 1 + PLACEMENT_BLEED),
    rot: p.rot,
    scale: clamp(p.scale, PLACEMENT_SCALE[0], PLACEMENT_SCALE[1]),
    z: ((top as { z: number } | null)?.z ?? 0) + 1,
    ...(placedAt ? { placed_at: placedAt } : {}),
  }
  const { data, error } = await db.from('sticker_placements').insert(row).select('*').single()
  if (error) throw new StickerError(error.code === '23505' ? 'Ya está pegado.' : error.message, error.code === '23505' ? 409 : 500)
  return data as PlacementRow
}

/** One pass of the scraper. At full wear the sticker — and the copy — are gone for good. */
export async function scrapeCopy(db: Db, userId: string, uid: string, amount = SCRAPE_STEP): Promise<{ wear: number } | { gone: true }> {
  await ownCopy(db, userId, uid)
  const { data: pl, error } = await db.from('sticker_placements').select('wear').eq('uid', uid).maybeSingle()
  if (error) throw new StickerError(error.message, 500)
  if (!pl) throw new StickerError('No está pegado.', 409)
  const wear = (pl as { wear: number }).wear + clamp(amount, 0, SCRAPE_STEP)
  if (wear >= 0.999) {
    const { error: e2 } = await db.from('sticker_copies').delete().eq('uid', uid).eq('user_id', userId)
    if (e2) throw new StickerError(e2.message, 500)
    return { gone: true }
  }
  const { error: e3 } = await db.from('sticker_placements').update({ wear }).eq('uid', uid).eq('user_id', userId)
  if (e3) throw new StickerError(e3.message, 500)
  return { wear }
}

// ── a night's stub ──────────────────────────────────────────────────────────

export async function claimStub(db: Db, userId: string, eventId: string, catalog: Record<string, StickerDef>, nowMs = Date.now(), uid?: string): Promise<CopyRow> {
  const def = catalog[`st-ev-${eventId}`]
  if (!def || def.via !== 'boleto') throw new StickerError('Esa noche no tiene talón.', 404)
  const { data: ev, error } = await db.from('items').select('date, end_date').eq('id', eventId).maybeSingle()
  if (error) throw new StickerError(error.message, 500)
  const end = Date.parse((ev as { end_date: string | null; date: string | null } | null)?.end_date ?? (ev as { date: string | null } | null)?.date ?? '')
  if (Number.isFinite(end) && nowMs > end + STUB_WINDOW_MS) throw new StickerError('El talón de esa noche ya cerró (una semana después).', 410)
  const batch = currentBatch()
  const { error: claimErr } = await db.from('sticker_stub_claims').insert({ user_id: userId, sticker_id: def.id, batch })
  if (claimErr) throw new StickerError(claimErr.code === '23505' ? 'Ya tienes el talón de esa noche.' : claimErr.message, claimErr.code === '23505' ? 409 : 500)
  try {
    const [copy] = await grantCopies(db, userId, [{ uid, stickerId: def.id, via: 'boleto' }], batch)
    return copy
  } catch (e) {
    await db.from('sticker_stub_claims').delete().eq('user_id', userId).eq('sticker_id', def.id)
    throw e
  }
}

// ── the beta's store picks ──────────────────────────────────────────────────

export async function redeemVoucher(db: Db, userId: string, stickerId: string, catalog: Record<string, StickerDef>, uid?: string): Promise<{ copy: CopyRow; remaining: number }> {
  if (!STICKERS_BETA) throw new StickerError('Los vales eran de la beta.', 410)
  const def = catalog[stickerId]
  if (!def || def.source !== 'franja' || def.via !== 'compra') throw new StickerError('Ese calco no está en ninguna tienda.', 404)
  if (def.edition) {
    const { data: s } = await db.from('sticker_serials').select('last').eq('sticker_id', def.id).maybeSingle()
    if (((s as { last: number } | null)?.last ?? 0) >= def.edition) throw new StickerError('Edición agotada.', 409)
  }
  const { data: left, error } = await db.rpc('sticker_use_voucher', { p_user: userId })
  if (error) throw new StickerError(error.message, 500)
  if (left === null || left === undefined) throw new StickerError('No te quedan vales.', 409)
  const refund = () => db.rpc('sticker_refund_voucher', { p_user: userId })
  let serial: number | null = null
  if (def.edition) {
    const { data: n, error: e2 } = await db.rpc('sticker_next_serial', { p_sticker_id: def.id })
    if (e2) {
      await refund()
      throw new StickerError(e2.message, 500)
    }
    if ((n as number) > def.edition) {
      await refund()
      throw new StickerError('Edición agotada.', 409)
    }
    serial = n as number
  }
  try {
    const [copy] = await grantCopies(db, userId, [{ uid, stickerId: def.id, via: 'beta', serial }])
    return { copy, remaining: left as number }
  } catch (e) {
    await refund()
    throw e
  }
}

// ── the beta kit ────────────────────────────────────────────────────────────

/** Grants a tester their kit once (idempotent: skipped if they already hold any beta copy). */
export async function grantBetaKit(
  db: Db,
  user: { id: string; role: Role; franja_id?: string | null },
  catalog: Record<string, StickerDef>,
  nowMs = Date.now(),
): Promise<{ granted: boolean; copies: number; placed: number }> {
  const { count, error } = await db.from('sticker_copies').select('uid', { count: 'exact', head: true }).eq('user_id', user.id).eq('batch', STICKER_BATCH)
  if (error) throw new StickerError(error.message, 500)
  if ((count ?? 0) > 0) return { granted: false, copies: 0, placed: 0 }

  const kit = betaKit({ id: user.id, role: user.role, franjaId: user.franja_id }, catalog)
  // A pressed copy was acquired the day before it was pressed.
  const acquiredAt = kit.copies.map((_, i) => {
    const p = kit.placements.find((pl) => pl.copy === i)
    return p ? new Date(nowMs - (p.ageDays + 1) * DAY).toISOString() : new Date(nowMs).toISOString()
  })
  const rows = await grantCopies(
    db,
    user.id,
    kit.copies.map((c, i) => ({ stickerId: c.stickerId, via: c.via, acquiredAt: acquiredAt[i] })),
    STICKER_BATCH,
  )
  let placed = 0
  for (const p of kit.placements) {
    const copy = rows[p.copy]
    if (!copy) continue
    await placeCopy(db, user.id, copy.uid, p, new Date(nowMs - p.ageDays * DAY).toISOString())
    placed++
  }
  const { error: vErr } = await db.from('sticker_vouchers').upsert({ user_id: user.id, remaining: kit.vouchers, batch: STICKER_BATCH }, { onConflict: 'user_id' })
  if (vErr) throw new StickerError(vErr.message, 500)
  return { granted: true, copies: rows.length, placed }
}

/** The release's clean slate: everything from the beta goes, serial counters restart from what remains. */
export async function wipeBeta(db: Db): Promise<{ copies: number; claims: number; vouchers: number }> {
  const del = async (table: string) => {
    const { count, error } = await db.from(table).delete({ count: 'exact' }).eq('batch', STICKER_BATCH)
    if (error) throw new StickerError(`${table}: ${error.message}`, 500)
    return count ?? 0
  }
  const copies = await del('sticker_copies') // placements cascade
  const claims = await del('sticker_stub_claims')
  const vouchers = await del('sticker_vouchers')
  const { data: kept, error } = await db.from('sticker_copies').select('sticker_id, serial').not('serial', 'is', null)
  if (error) throw new StickerError(error.message, 500)
  const last = new Map<string, number>()
  for (const r of (kept ?? []) as Array<{ sticker_id: string; serial: number }>) last.set(r.sticker_id, Math.max(last.get(r.sticker_id) ?? 0, r.serial))
  const { error: e2 } = await db.from('sticker_serials').delete().neq('sticker_id', '')
  if (e2) throw new StickerError(e2.message, 500)
  if (last.size) {
    const { error: e3 } = await db.from('sticker_serials').insert([...last].map(([sticker_id, n]) => ({ sticker_id, last: n })))
    if (e3) throw new StickerError(e3.message, 500)
  }
  return { copies, claims, vouchers }
}
