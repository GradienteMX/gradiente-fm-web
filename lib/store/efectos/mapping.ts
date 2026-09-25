/**
 * From a world action to the request its route expects — pure (no fetch, no
 * React), so every contract below is unit-tested (tests/store/efectos.test.ts)
 * against the route code it mirrors. The effects (the other modules here)
 * only add the network, the ordering and the ids.
 */

import type { ContentItem, EntityRef, MarketplaceListing, ReactionKind, User } from '@/lib/types'
import { FRANJA_PUBLISHABLE_TYPES } from '@/lib/permissions'
import type { InviteRow, Reading, ReportRow } from '../world-core'
import type { Method } from './http'

export interface Req {
  method: Method
  url: string
  body?: unknown
}

/** A request the route won't take, said in Spanish before anything is sent. */
export interface Refused {
  refused: string
}

const enc = encodeURIComponent
const DAY = 86_400_000

// ── the reader ──────────────────────────────────────────────────────────────

/** PUT /api/vibe-checks/[itemId] { vibeMin, vibeMax } (integers 0–10, min ≤ max) · DELETE to take it back. */
export function readingRequest(itemId: string, band: Reading | null): Req {
  const url = `/api/vibe-checks/${enc(itemId)}`
  if (!band) return { method: 'DELETE', url }
  const clamp = (v: number) => Math.min(10, Math.max(0, Math.round(v)))
  const lo = clamp(Math.min(band[0], band[1]))
  const hi = clamp(Math.max(band[0], band[1]))
  return { method: 'PUT', url, body: { vibeMin: lo, vibeMax: hi } }
}

/** POST /api/polls/[pollId]/vote { choiceIds } (replaces the vote) · DELETE when nothing is left picked. */
export function voteRequest(pollId: string, choiceIds: string[]): Req {
  const url = `/api/polls/${enc(pollId)}/vote`
  return choiceIds.length ? { method: 'POST', url, body: { choiceIds } } : { method: 'DELETE', url }
}

/** POST /api/comments/[id]/reactions { kind } (replaces any earlier one) · DELETE to clear. */
export function reactRequest(commentId: string, kind: ReactionKind | null): Req {
  const url = `/api/comments/${enc(commentId)}/reactions`
  return kind ? { method: 'POST', url, body: { kind } } : { method: 'DELETE', url }
}

export function saveItemRequest(itemId: string, on: boolean): Req {
  return { method: on ? 'POST' : 'DELETE', url: `/api/saves/items/${enc(itemId)}` }
}

export function saveCommentRequest(commentId: string, on: boolean): Req {
  return { method: on ? 'POST' : 'DELETE', url: `/api/saves/comments/${enc(commentId)}` }
}

export function followRequest(franjaId: string, on: boolean): Req {
  return { method: on ? 'POST' : 'DELETE', url: `/api/follows/${enc(franjaId)}` }
}

// ── comments & the foro ─────────────────────────────────────────────────────

/**
 * POST /api/comments/[id]/tombstone { reason } · DELETE restores. An author
 * retiring their own comment sends an empty reason, as production always
 * did: the stub tells author from moderator by who retired it, not by text.
 */
export function commentTombstoneRequest(id: string, reason: string | null, byAuthor: boolean): Req {
  const url = `/api/comments/${enc(id)}/tombstone`
  return reason === null ? { method: 'DELETE', url } : { method: 'POST', url, body: { reason: byAuthor ? '' : reason } }
}

/** POST /api/foro/{threads|replies}/[id]/tombstone { reason } · DELETE restores. */
export function foroTombstoneRequest(target: 'thread' | 'reply', id: string, reason: string | null): Req {
  const url = `/api/foro/${target === 'thread' ? 'threads' : 'replies'}/${enc(id)}/tombstone`
  return reason === null ? { method: 'DELETE', url } : { method: 'POST', url, body: { reason } }
}

// ── people ──────────────────────────────────────────────────────────────────

type ProfilePatch = Partial<Pick<User, 'displayName' | 'bio' | 'firma' | 'location' | 'avatarUrl'>>

/** PATCH /api/users/me — snake_case; an emptied field is cleared (null), the display name never is. */
export function profileBody(patch: ProfilePatch): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  const clean = (v: string | undefined) => (v ?? '').trim() || null
  if ('displayName' in patch) out.display_name = (patch.displayName ?? '').trim()
  if ('bio' in patch) out.bio = clean(patch.bio)
  if ('firma' in patch) out.firma = clean(patch.firma)
  if ('location' in patch) out.location = clean(patch.location)
  if ('avatarUrl' in patch) out.avatar_url = clean(patch.avatarUrl)
  return out
}

type UserAdminPatch = Partial<Pick<User, 'role' | 'isMod' | 'isOG' | 'franjaId' | 'franjaAdmin'>>

/**
 * `user-admin` means two different powers, so two routes:
 *
 *   a site admin (Central)      PATCH /api/admin/users/[id] — role, flags,
 *                               franja; a removed franja is null
 *   a franja's own admin        /api/franjas/[franja]/team (the franja_team_*
 *   (Taller → Franja → Equipo)  definer RPCs): POST adds, DELETE retires,
 *                               PATCH toggles franja_admin — never a role
 *
 * `targetFranjaId` is the franja the person belongs to BEFORE the change.
 */
export function userAdminRequests(
  userId: string,
  patch: UserAdminPatch,
  ctx: { viewerIsAdmin: boolean; targetFranjaId: string | null },
): Req[] | Refused {
  if (ctx.viewerIsAdmin) {
    const body: Record<string, unknown> = {}
    if ('role' in patch && patch.role) body.role = patch.role
    if ('isMod' in patch) body.is_mod = Boolean(patch.isMod)
    if ('isOG' in patch) body.is_og = Boolean(patch.isOG)
    if ('franjaId' in patch) body.franja_id = patch.franjaId || null
    if ('franjaAdmin' in patch) body.franja_admin = Boolean(patch.franjaAdmin) && Boolean(patch.franjaId ?? ctx.targetFranjaId)
    if (!Object.keys(body).length) return []
    return [{ method: 'PATCH', url: `/api/admin/users/${enc(userId)}`, body }]
  }
  if ('role' in patch || 'isMod' in patch || 'isOG' in patch) return { refused: 'Los roles y las banderas solo los cambia administración.' }
  const out: Req[] = []
  if ('franjaId' in patch) {
    if (patch.franjaId) {
      out.push({ method: 'POST', url: `/api/franjas/${enc(patch.franjaId)}/team`, body: { user_id: userId } })
      if (patch.franjaAdmin) out.push({ method: 'PATCH', url: `/api/franjas/${enc(patch.franjaId)}/team`, body: { user_id: userId, franja_admin: true } })
      return out
    }
    if (!ctx.targetFranjaId) return []
    return [{ method: 'DELETE', url: `/api/franjas/${enc(ctx.targetFranjaId)}/team`, body: { user_id: userId } }]
  }
  if ('franjaAdmin' in patch) {
    if (!ctx.targetFranjaId) return { refused: 'Esa persona no está en el equipo.' }
    return [{ method: 'PATCH', url: `/api/franjas/${enc(ctx.targetFranjaId)}/team`, body: { user_id: userId, franja_admin: Boolean(patch.franjaAdmin) } }]
  }
  return []
}

// ── franjas ─────────────────────────────────────────────────────────────────

/** ContentItem field → franja column, and whether a franja's own team may change it. */
const FRANJA_FIELDS: Partial<Record<keyof ContentItem, { col: string; team: boolean; nullable: boolean }>> = {
  title: { col: 'title', team: false, nullable: false },
  subtitle: { col: 'subtitle', team: false, nullable: true },
  franjaKind: { col: 'franja_kind', team: false, nullable: false },
  vibeMin: { col: 'vibe_min', team: false, nullable: false },
  vibeMax: { col: 'vibe_max', team: false, nullable: false },
  imageUrl: { col: 'image_url', team: true, nullable: true },
  franjaUrl: { col: 'franja_url', team: true, nullable: true },
  marketplaceEnabled: { col: 'marketplace_enabled', team: true, nullable: false },
  marketplaceDescription: { col: 'marketplace_description', team: true, nullable: true },
  marketplaceLocation: { col: 'marketplace_location', team: true, nullable: true },
  marketplaceCurrency: { col: 'marketplace_currency', team: true, nullable: true },
}

/**
 * A franja's own card. A site admin goes through PATCH /api/admin/franjas/[id]
 * (every field above); the franja's team through PATCH /api/franjas/[id]
 * (links, logo, the storefront: marketplace_* — self-service since fase D).
 * A field neither route takes is refused before anything is sent.
 */
export function franjaPatchRequest(franjaId: string, patch: Partial<ContentItem>, asAdmin: boolean): Req | Refused {
  const body: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch) as Array<[keyof ContentItem, unknown]>) {
    const f = FRANJA_FIELDS[key]
    if (!f) return { refused: 'Ese cambio de la franja no se puede guardar desde aquí.' }
    if (!asAdmin && !f.team) return { refused: 'Ese cambio de la franja lo hace administración.' }
    if (typeof value === 'string') body[f.col] = value.trim() || (f.nullable ? null : value.trim())
    else if (value === undefined || value === null) body[f.col] = f.nullable ? null : undefined
    else body[f.col] = value
  }
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k]
  return { method: 'PATCH', url: asAdmin ? `/api/admin/franjas/${enc(franjaId)}` : `/api/franjas/${enc(franjaId)}`, body }
}

/** A listing as /api/franjas/[id]/listings takes it (POST: with id + published_at; PATCH: the rest). */
export function listingBody(l: MarketplaceListing, forCreate: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: l.title,
    category: l.category,
    subcategory: l.subcategory ?? null,
    price: l.price,
    condition: l.condition,
    status: l.status,
    description: l.description ?? null,
    tags: l.tags ?? [],
    shipping_mode: l.shippingMode ?? null,
    images: l.images,
    embeds: l.embeds ?? [],
    sale_url: l.saleUrl ?? null,
    whatsapp: l.whatsapp ?? null,
    contact_email: l.email ?? null,
    related_links: l.relatedLinks ?? [],
  }
  if (forCreate) {
    body.id = l.id
    body.published_at = l.publishedAt
  }
  return body
}

// ── moderation & access ─────────────────────────────────────────────────────

export function reportBody(r: ReportRow): Record<string, unknown> {
  return { target_type: r.targetType, target_id: r.targetId, reason: r.reason, note: r.note ?? null }
}

/**
 * POST /api/admin/invite-codes — the code the admin already copied is the
 * one stored (the route takes a proposed INV- code). Expiry travels as days
 * from issue; null = never expires.
 */
export function inviteBody(row: InviteRow): Record<string, unknown> {
  const days = row.expiresAt ? Math.max(1, Math.round((Date.parse(row.expiresAt) - Date.parse(row.createdAt)) / DAY)) : null
  return {
    code: row.code,
    card_name: row.name.trim() || null,
    intended_role: row.role,
    intended_is_mod: Boolean(row.isMod),
    intended_franja_id: row.franjaId || null,
    intended_franja_admin: Boolean(row.franjaId && row.franjaAdmin),
    expires_in_days: days,
  }
}

// ── publishing ──────────────────────────────────────────────────────────────

/** What only the server knows about a piece, or what the composer wraps it in: never sent. */
const NOT_SENT = [
  'creator',
  'franja',
  'createdById',
  'hp',
  'hpLastUpdatedAt',
  'harvestedAt',
  'harvestedAmount',
  'hpDecayMultiplier',
  'vibeCheckCount',
  'vibeCheckMedianMin',
  'vibeCheckMedianMax',
  'marketplaceListings',
  'attributeFranja',
  '_draftState',
] as const

/**
 * Fields the route leaves ALONE when absent (it only writes them when the
 * payload names them), and what "emptied" means for each. The composer drops
 * an emptied list or value (undefined), so an edit that clears one must say
 * so, or the server keeps the old links and the next snapshot brings them
 * back.
 */
const CLEARED_ON_EDIT: Partial<Record<keyof ContentItem, unknown>> = {
  entities: [],
  franjaRefs: [],
  links: [],
  country: null,
  year: null,
  subjectKind: null,
}

/**
 * POST /api/items { item, mode }. `mode` says whether this is a new piece
 * ('create': the route refuses to overwrite an existing id) or an edit.
 *
 * Franja attribution travels as production's explicit `attributeFranja`
 * (the route stamps franja_id / source / editorial itself, from the
 * author's own row — never from the payload): true when the piece carries
 * the author's own franja, false when an edit takes it off, absent
 * otherwise (an admin editing another franja's piece keeps its stamp).
 */
export function publishBody(item: ContentItem, ctx: { me: User | null; existing: ContentItem | null }): { item: ContentItem; mode: 'create' | 'edit' } {
  const out = { ...item } as Record<string, unknown>
  for (const k of NOT_SENT) delete out[k]
  if (ctx.existing) {
    for (const [k, empty] of Object.entries(CLEARED_ON_EDIT) as Array<[keyof ContentItem, unknown]>) {
      const had = ctx.existing[k]
      if (out[k] === undefined && had !== undefined && had !== null && !(Array.isArray(had) && had.length === 0)) out[k] = empty
    }
  }
  const me = ctx.me
  if (me?.franjaId && FRANJA_PUBLISHABLE_TYPES.includes(item.type)) {
    if (item.franjaId === me.franjaId) out.attributeFranja = true
    else if (!item.franjaId && ctx.existing?.franjaId === me.franjaId) out.attributeFranja = false
  }
  return { item: out as unknown as ContentItem, mode: ctx.existing ? 'edit' : 'create' }
}

/** Entities that aren't rows yet (the composer names them `ent-<kind>-<slug>`) — /api/entities resolves or creates them. */
export function unresolvedEntities(list: EntityRef[] | undefined, isRowId: (id: string) => boolean): EntityRef[] {
  return (list ?? []).filter((e) => !isRowId(e.id))
}
