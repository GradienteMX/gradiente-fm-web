import 'server-only'

/**
 * The world, read from Supabase — server only (the service-role key is used
 * here and must never reach a client bundle; `server-only` makes an import
 * from a client component fail the build).
 *
 *   loadPublicWorld()        what every signed-in member may see, identical
 *                            for all of them. Service role, explicit filters
 *                            (published only, public columns only), inside
 *                            a shared server cache: tag WORLD_TAG, rebuilt at
 *                            most every WORLD_REVALIDATE_S seconds — Supabase
 *                            egress is paid once per window, not per visit.
 *   loadPrivateWorld(userId) the viewer's own rows, read per request with
 *                            THEIR cookie client, so RLS decides.
 *   loadAdminWorld()         Central's ledgers and the access pipeline, only
 *                            when the caller's own row says `role = 'admin'`
 *                            — read by /central alone (app/central/page.tsx),
 *                            never with every page: an admin's ordinary page
 *                            loads stay as small as anyone's.
 *
 * Never in the public world: drafts or unpublished items, emails, anyone's
 * presence (HL) scalar, individual vibe checks, saves, votes or follows,
 * reports, the waitlist, invitations, profile_meta, the per-item HL a harvest
 * paid out.
 *
 * Writes that change the public world expire it with
 * `revalidateTag(WORLD_TAG, { expire: 0 })` from their route handler (Next
 * 16: the second argument is required; `updateTag` only works in Server
 * Actions). See lib/data/tags.ts.
 */

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { fetchPublishedItems } from '@/lib/data/items'
import { chunked, readAll } from '@/lib/data/rows'
import { rowToUser } from '@/lib/data/users'
import { rowToComment } from '@/lib/data/comments'
import { rowToReply, rowToThread } from '@/lib/data/foro'
import type { Database } from '@/lib/supabase/database.types'
import type { ContentItem, Draft, HpLedgerRow, PresenceRow, Role } from '@/lib/types'
import type { TrophyKey } from '@/lib/trophies'
import type { InviteRow, ListingComment, Reading, ReportRow, WaitlistRow } from '@/lib/store/world-core'
import type { AdminWorld, PollTally, PrivateWorld, PublicWorld } from '@/lib/store/snapshot'
import { loadMyStickers } from '@/lib/data/stickers'
import { WORLD_TAG } from '@/lib/data/tags'

/** The cache tag of the public world (lib/data/tags.ts). A write that changes it calls `revalidateTag(WORLD_TAG, { expire: 0 })`. */
export { WORLD_TAG }
/** Seconds a public snapshot is served before it is read again (stale-while-revalidate). */
export const WORLD_REVALIDATE_S = 300

/** How far back the presence and HL ledgers reach (Central's widest window; hp_events' own retention). */
const LEDGER_DAYS = 180

/** The public face of a person. engagement_hp and profile_meta stay behind. */
const USER_PUBLIC_COLUMNS = 'id, username, display_name, role, is_mod, is_og, franja_id, franja_admin, joined_at, avatar_url, bio, firma, location'

type UserRow = Database['public']['Tables']['users']['Row']
type CommentRow = Parameters<typeof rowToComment>[0]
type ThreadRow = Database['public']['Tables']['foro_threads']['Row']
type ReplyRow = Database['public']['Tables']['foro_replies']['Row']

const PRESENCE_KINDS = new Set<PresenceRow['kind']>([
  'reaction_received',
  'comment_saved',
  'item_saved',
  'comment_received',
  'vibe_check_cast',
  'vibe_check_accurate',
  'publish',
  'harvest',
])
const LEDGER_KINDS = new Set<HpLedgerRow['kind']>(['click', 'open', 'save', 'comment', 'admin_adjust', 'harvest'])

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

function sinceIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

type Read<T> = { rows: T[]; error: { message: string } | null }

/** A read that failed is logged and taken as empty — for the rows a page can live without. */
function rowsOr<T>(label: string, res: Read<T>): T[] {
  if (res.error) {
    console.error(`[world] ${label}:`, res.error.message)
    return []
  }
  return res.rows
}

// ── the public world ────────────────────────────────────────────────────────
//
// Whole tables are read page by page (lib/data/rows.ts: PostgREST cuts every
// answer at its row cap without saying so), each in a total order.

async function readPublicWorld(): Promise<PublicWorld> {
  const started = Date.now()
  const db = createAdminClient()
  const at = Date.now()

  const [items, usersRes, commentsRes, threadsRes, votesRes, trophiesRes, listingRes] = await Promise.all([
    // Throws on failure: an outage must never be cached as an empty site.
    fetchPublishedItems(db),
    readAll<UserRow>((f, t) => db.from('users').select(USER_PUBLIC_COLUMNS).order('joined_at').order('id').range(f, t)),
    readAll<CommentRow>((f, t) => db.from('comments').select('*, comment_reactions(*)').order('created_at').order('id').range(f, t)),
    readAll<ThreadRow>((f, t) => db.from('foro_threads').select('*').eq('archived', false).order('bumped_at', { ascending: false }).order('id').range(f, t)),
    // Counted here; who voted never leaves this function.
    readAll<{ poll_id: string; choice_ids: string[] | null }>((f, t) => db.from('poll_votes').select('poll_id, choice_ids').order('poll_id').order('user_id').range(f, t)),
    readAll<{ user_id: string; trophy_key: string; earned_at: string }>((f, t) =>
      db.from('user_trophies').select('user_id, trophy_key, earned_at').order('user_id').order('trophy_key').range(f, t),
    ),
    readAll<{ id: string; listing_id: string; author_id: string; parent_id: string | null; body: string; created_at: string }>((f, t) =>
      db.from('listing_comments').select('id, listing_id, author_id, parent_id, body, created_at').order('created_at').order('id').range(f, t),
    ),
  ])
  if (usersRes.error) throw new Error(`[world] users: ${usersRes.error.message}`)

  // The HL a harvest paid out is the harvester's own number: not public.
  const publicItems: ContentItem[] = items.map((it) => {
    if (it.harvestedAmount === undefined) return it
    const { harvestedAmount: _paid, ...rest } = it
    return rest
  })
  const itemIds = new Set(publicItems.map((i) => i.id))

  const users = usersRes.rows.map(rowToUser)
  const franjaOf = new Map(users.map((u) => [u.id, u.franjaId]))

  const comments = rowsOr('comments', commentsRes)
    .filter((c) => itemIds.has(c.item_id))
    .map(rowToComment)

  const threadRows = rowsOr('foro_threads', threadsRes)
  const threads = threadRows.map(rowToThread)
  const replyReads = await Promise.all(
    chunked(threadRows.map((t) => t.id)).map((ids) =>
      readAll<ReplyRow>((f, t) => db.from('foro_replies').select('*').in('thread_id', ids).order('created_at').order('id').range(f, t)),
    ),
  )
  const replies = replyReads.flatMap((r) => rowsOr('foro_replies', r)).map(rowToReply)

  const pollIds = new Set(publicItems.flatMap((i) => (i.poll ? [i.poll.id] : [])))
  const polls: Record<string, PollTally> = {}
  for (const v of rowsOr('poll_votes', votesRes)) {
    if (!pollIds.has(v.poll_id)) continue
    const t = (polls[v.poll_id] ??= { voters: 0, counts: {} })
    t.voters += 1
    for (const c of v.choice_ids ?? []) t.counts[c] = (t.counts[c] ?? 0) + 1
  }

  const trophies: PublicWorld['trophies'] = {}
  for (const r of rowsOr('user_trophies', trophiesRes)) {
    ;(trophies[r.user_id] ??= {})[r.trophy_key as TrophyKey] = r.earned_at
  }

  const listingFranja = new Map<string, string>()
  for (const it of publicItems) for (const l of it.marketplaceListings ?? []) listingFranja.set(l.id, it.id)
  const listingComments: ListingComment[] = []
  for (const c of rowsOr('listing_comments', listingRes)) {
    const franjaId = listingFranja.get(c.listing_id)
    if (!franjaId) continue
    listingComments.push({
      id: c.id,
      listingId: c.listing_id,
      franjaId,
      authorId: c.author_id,
      body: c.body,
      parentId: c.parent_id,
      // As production badges it: a member of the listing's franja team.
      isSeller: franjaOf.get(c.author_id) === franjaId,
      at: c.created_at,
    })
  }

  const world: PublicWorld = { at, items: publicItems, users, comments, threads, replies, polls, trophies, listingComments }

  if (process.env.NODE_ENV === 'development') {
    const bytes = JSON.stringify(world).length
    console.info(
      `[world] instantánea pública leída: ${publicItems.length} piezas · ${users.length} personas · ${comments.length} comentarios · ${threads.length} hilos · ${(bytes / 1024).toFixed(0)} KB · ${Date.now() - started} ms`,
    )
    // unstable_cache refuses entries over 2 MB (and in production silently
    // stops caching them — every visit would read Supabase again).
    if (bytes > 1.5 * 1024 * 1024) console.warn(`[world] la instantánea pesa ${(bytes / 1048576).toFixed(2)} MB: cerca del límite de 2 MB de la caché de datos`)
  }
  return world
}

/**
 * The public world, cached for everyone (tag WORLD_TAG). The catalog and the
 * people are required: if either can't be read this throws and nothing is
 * cached (callers decide what an empty page looks like). The other tables
 * degrade to empty, logged, for one revalidate window at most.
 */
export const loadPublicWorld = unstable_cache(readPublicWorld, ['world:public:v1'], {
  tags: [WORLD_TAG],
  revalidate: WORLD_REVALIDATE_S,
})

// ── the private overlay ─────────────────────────────────────────────────────

function toPresenceRow(r: { id: number; user_id: string; kind: string; weight: number; created_at: string }): PresenceRow | null {
  // Publishing is recorded per format (publish_mix, publish_evento…).
  const kind = (r.kind.startsWith('publish_') ? 'publish' : r.kind) as PresenceRow['kind']
  if (!PRESENCE_KINDS.has(kind)) return null
  // attribution_key is not readable (0050 §1: it names the saver or reactor);
  // the row's own id keeps it unique.
  return { userId: r.user_id, kind, weight: Number(r.weight), at: r.created_at, key: `uhe:${r.id}` }
}

function toDraft(row: { item_payload: unknown; created_at: string; updated_at: string }, authorId: string): Draft | null {
  const p = row.item_payload as (Partial<ContentItem> & Record<string, unknown>) | null
  if (!p || typeof p.id !== 'string' || typeof p.type !== 'string') return null
  // Production's composer stamps client-only bookkeeping (_draftState, _createdAt…) into the payload.
  const clean = Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith('_'))) as unknown as ContentItem
  const item: ContentItem = { ...clean, genres: Array.isArray(clean.genres) ? clean.genres : [], tags: Array.isArray(clean.tags) ? clean.tags : [] }
  // The item id is the draft's natural key (POST /api/drafts upserts on it,
  // DELETE /api/drafts/[itemId] removes by it), so it is the draft's id too.
  return { id: item.id, type: item.type, authorId, item, state: 'borrador', createdAt: row.created_at, updatedAt: row.updated_at }
}

function toReport(r: {
  id: number | string
  reporter_id: string
  target_type: ReportRow['targetType']
  target_id: string
  reason: ReportRow['reason']
  note: string | null
  status: ReportRow['status']
  resolution: string | null
  resolved_at: string | null
  created_at: string
}): ReportRow {
  return {
    id: String(r.id),
    reporterId: r.reporter_id,
    targetType: r.target_type,
    targetId: r.target_id,
    reason: r.reason,
    note: r.note ?? undefined,
    at: r.created_at,
    status: r.status,
    resolution: r.resolution ?? undefined,
    resolvedAt: r.resolved_at ?? undefined,
  }
}

type PresenceDbRow = { id: number; user_id: string; kind: string; weight: number; created_at: string }

async function readAdminWorld(db: Awaited<ReturnType<typeof createClient>>): Promise<AdminWorld> {
  const at = Date.now()
  const since = sinceIso(LEDGER_DAYS)
  // user_saves is self-only under RLS; the per-item COUNT is the one admin read
  // that needs the service role (lib/api/requireAdmin says the same). Only
  // item ids are selected, and only counts leave this function.
  const service = createAdminClient()
  const [ledgerRes, presenceRes, waitRes, invitesRes, savesRes] = await Promise.all([
    // Decay rows are recomputed by Central from the anchors, not shipped.
    readAll<{ item_id: string; kind: string; weight: number; base_weight: number | null; created_at: string }>((f, t) =>
      db.from('hp_events').select('item_id, kind, weight, base_weight, created_at').neq('kind', 'decay').gte('created_at', since).order('created_at').order('id').range(f, t),
    ),
    readAll<PresenceDbRow>((f, t) => db.from('user_hp_events').select('id, user_id, kind, weight, created_at').gte('created_at', since).order('created_at').order('id').range(f, t)),
    readAll<{
      id: string
      alias: string
      email: string
      city: string | null
      source: string | null
      status: string
      created_at: string
      invite: { used_at: string | null } | null
    }>((f, t) => db.from('waitlist_signups').select('id, alias, email, city, source, status, created_at, invite:invite_codes(used_at)').order('created_at').order('id').range(f, t)),
    readAll<{
      code: string
      card_name: string | null
      intended_role: Role
      intended_is_mod: boolean
      intended_franja_id: string | null
      intended_franja_admin: boolean
      folio: number | null
      folio_denominator: number | null
      issued_label: string | null
      created_at: string
      expires_at: string | null
      used_by: string | null
      used_at: string | null
    }>((f, t) =>
      db
        .from('invite_codes')
        .select('code, card_name, intended_role, intended_is_mod, intended_franja_id, intended_franja_admin, folio, folio_denominator, issued_label, created_at, expires_at, used_by, used_at')
        .order('created_at')
        .order('code')
        .range(f, t),
    ),
    readAll<{ item_id: string }>((f, t) => service.from('user_saves').select('item_id').order('item_id').order('user_id').range(f, t)),
  ])

  const ledger: HpLedgerRow[] = []
  for (const r of rowsOr('hp_events', ledgerRes)) {
    if (!LEDGER_KINDS.has(r.kind as HpLedgerRow['kind'])) continue
    ledger.push({ itemId: r.item_id, kind: r.kind as HpLedgerRow['kind'], baseWeight: Number(r.base_weight ?? r.weight), weight: Number(r.weight), at: r.created_at })
  }

  const presence = rowsOr('user_hp_events (admin)', presenceRes)
    .map(toPresenceRow)
    .filter((r): r is PresenceRow => r !== null)

  const waitlist: WaitlistRow[] = rowsOr('waitlist_signups', waitRes).map((r) => ({
    id: r.id,
    alias: r.alias,
    email: r.email,
    city: r.city ?? '',
    source: r.source ?? undefined,
    at: r.created_at,
    status: r.status === 'invited' ? (r.invite?.used_at ? 'registrado' : 'invitado') : 'espera',
  }))

  const invites: InviteRow[] = rowsOr('invite_codes', invitesRes).map((r) => {
    const d = new Date(r.created_at)
    return {
      code: r.code,
      name: r.card_name?.trim() ?? '',
      role: r.intended_role,
      isMod: r.intended_is_mod || undefined,
      franjaId: r.intended_franja_id ?? undefined,
      franjaAdmin: r.intended_franja_admin || undefined,
      folio: r.folio != null ? `${String(r.folio).padStart(3, '0')}/${r.folio_denominator ?? 150}` : '',
      issued: r.issued_label?.trim() || `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      createdAt: r.created_at,
      expiresAt: r.expires_at ?? undefined,
      usedBy: r.used_by ?? undefined,
      usedAt: r.used_at ?? undefined,
    }
  })

  const saveCounts: Record<string, number> = {}
  for (const r of rowsOr('user_saves (conteo)', savesRes)) saveCounts[r.item_id] = (saveCounts[r.item_id] ?? 0) + 1

  return { at, ledger, presence, waitlist, invites, saveCounts }
}

/**
 * Central's ledgers and the access pipeline — for the signed-in admin only
 * (their own row, read with their own cookie client, says `role = 'admin'`),
 * null for anyone else. Read by /central's page, not by the root layout: the
 * 180-day HL ledger and every creator's presence rows travel only to the one
 * surface that shows them. Uncached, like the private overlay.
 */
export async function loadAdminWorld(): Promise<AdminWorld | null> {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return null
  const { data: me, error } = await db.from('users').select('role').eq('id', user.id).maybeSingle()
  if (error) {
    console.error('[world] tu rol (Central):', error.message)
    return null
  }
  if ((me as { role?: Role } | null)?.role !== 'admin') return null
  return readAdminWorld(db)
}

/**
 * The franjas the viewer follows (migration 0053, table franja_follows —
 * private: RLS self-only, never counted, never shown to anyone else). Until
 * 0053 is applied the table doesn't exist and this is empty, quietly.
 */
async function readMyFollows(db: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string[]> {
  // Untyped: the generated Database types predate 0053.
  const untyped = db as unknown as {
    from: (t: 'franja_follows') => {
      select: (c: string) => {
        eq: (k: string, v: string) => { order: (k: string) => PromiseLike<{ data: Array<{ franja_id: string }> | null; error: { code?: string; message: string } | null }> }
      }
    }
  }
  const { data, error } = await untyped.from('franja_follows').select('franja_id').eq('user_id', userId).order('created_at')
  if (error) {
    // 0053 not applied yet — nobody follows anything, quietly. (PostgREST
    // answers PGRST205 for a table it doesn't know; Postgres itself 42P01.)
    if (error.code !== 'PGRST205' && error.code !== '42P01') console.error('[world] franja_follows:', error.message)
    return []
  }
  return (data ?? []).map((r) => r.franja_id)
}

/**
 * The viewer's own rows, as RLS lets them read them. Null when their user
 * row can't be read (an auth account without a profile): they're treated as
 * signed out. Uncached — it's theirs and it's small.
 */
export async function loadPrivateWorld(userId: string): Promise<PrivateWorld | null> {
  const db = await createClient()
  const at = Date.now()
  const since = sinceIso(LEDGER_DAYS)

  // Explicit `user_id` filters, not RLS alone: vibe_checks and poll_votes are
  // readable by every member row by row (their policies are `true`), and
  // nobody's world may carry anyone else's.
  const [meRes, draftsRes, savesRes, savedCommentsRes, votesRes, readingsRes, presenceRes, reportsRes] = await Promise.all([
    db.from('users').select(`${USER_PUBLIC_COLUMNS}, engagement_hp, engagement_hp_last_updated_at`).eq('id', userId).maybeSingle(),
    readAll<{ item_payload: unknown; created_at: string; updated_at: string }>((f, t) =>
      db.from('drafts').select('item_payload, created_at, updated_at').eq('author_id', userId).order('updated_at', { ascending: false }).order('id').range(f, t),
    ),
    readAll<{ item_id: string; saved_at: string }>((f, t) => db.from('user_saves').select('item_id, saved_at').eq('user_id', userId).order('item_id').range(f, t)),
    readAll<{ comment_id: string; saved_at: string }>((f, t) =>
      db.from('saved_comments').select('comment_id, saved_at').eq('user_id', userId).order('comment_id').range(f, t),
    ),
    readAll<{ poll_id: string; choice_ids: string[] | null }>((f, t) => db.from('poll_votes').select('poll_id, choice_ids').eq('user_id', userId).order('poll_id').range(f, t)),
    readAll<{ item_id: string; vibe_min: number; vibe_max: number }>((f, t) =>
      db.from('vibe_checks').select('item_id, vibe_min, vibe_max').eq('user_id', userId).order('item_id').range(f, t),
    ),
    readAll<PresenceDbRow>((f, t) =>
      db.from('user_hp_events').select('id, user_id, kind, weight, created_at').eq('user_id', userId).gte('created_at', since).order('created_at').order('id').range(f, t),
    ),
    // RLS: your own reports; every report for moderators and admins.
    readAll<Parameters<typeof toReport>[0]>((f, t) =>
      db.from('reports').select('id, reporter_id, target_type, target_id, reason, note, status, resolution, resolved_at, created_at').order('created_at').order('id').range(f, t),
    ),
  ])

  if (meRes.error) {
    console.error('[world] tu fila de usuario:', meRes.error.message)
    return null
  }
  if (!meRes.data) return null
  const row = meRes.data as unknown as UserRow
  const me = rowToUser(row)

  const drafts = rowsOr('drafts', draftsRes)
    .map((r) => toDraft(r, userId))
    .filter((d): d is Draft => d !== null)

  const saves: Record<string, string> = {}
  for (const r of rowsOr('user_saves', savesRes)) saves[r.item_id] = r.saved_at
  const savedComments: Record<string, string> = {}
  for (const r of rowsOr('saved_comments', savedCommentsRes)) savedComments[r.comment_id] = r.saved_at
  const votes: Record<string, string[]> = {}
  for (const r of rowsOr('poll_votes', votesRes)) if (r.choice_ids?.length) votes[r.poll_id] = r.choice_ids
  const readings: Record<string, Reading> = {}
  for (const r of rowsOr('vibe_checks', readingsRes)) readings[r.item_id] = [r.vibe_min, r.vibe_max]

  const presenceRows = rowsOr('user_hp_events', presenceRes)
    .map(toPresenceRow)
    .filter((r): r is PresenceRow => r !== null)

  const reports = rowsOr('reports', reportsRes).map(toReport)

  const [follows, stickers] = await Promise.all([readMyFollows(db, userId), loadMyStickers(userId)])

  return {
    at,
    me,
    presence: { hp: Number(row.engagement_hp ?? 0), at: row.engagement_hp_last_updated_at ?? new Date(at).toISOString() },
    presenceRows,
    drafts,
    saves,
    savedComments,
    votes,
    readings,
    follows,
    reports,
    stickers,
  }
}
