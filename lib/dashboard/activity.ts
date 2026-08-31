'use client'

// ── ACTIVIDAD — the derived inbox queries (FINAL_SPEC §3.2, R3) ─────────────
//
// Zero-schema, derived, prod-validated (WP0-C evidence, 2026-08-21):
//   1. comments on items I authored
//   2. replies to my comments
//   3. reactions on my comments (collapsed by target comment)
//   4. foro replies in threads I started + replies quoting my replies
//   5. LOGRO — my trophy unlocks (user_trophies, public-read RLS — VALIDATED,
//      ships per R3)
//   6. OFERTA — franja-team only, decorates the inbox route's unanswered
//      listing ids (listing_comments is a SEPARATE system, never merged into
//      the editorial comments model — it only shares this rendered list)
//
// Raw tables only — the HP event ledger never feeds this list (it is a
// deduped digest, and parsing it would also deanonymize savers). Saver identities
// never appear anywhere here by construction. Seed rows fall out naturally
// (`author_id`/`created_by` null fails every neq/eq filter).
//
// Deliberately TWO-STEP id-list queries (`.in(...)`) instead of PostgREST FK
// embeds: the raw joins were validated in SQL, embed inference was not.
// Per-user volumes are thin (14 eligible comment rows platform-wide), so the
// id lists stay tiny.
//
// Read-state lives in ONE localStorage watermark (lib/dashboard/localState) —
// this module only computes against it, it never writes it.

import { createClient } from '@/lib/supabase/client'
import { setRealUsers } from '@/lib/userOverrides'
import { trophyByKey } from '@/lib/trophies'
import type { User } from '@/lib/types'

// What happened — drives the widget's Spanish verb copy.
export type ActivityKind =
  | 'comment_on_item'
  | 'reply_to_comment'
  | 'reaction'
  | 'foro_reply'
  | 'foro_quote'
  | 'logro'
  | 'oferta'

// The d13 mono source chip (§3.2). LIVE-style labels are banned (R8);
// these are content-source names, not freshness claims.
export type ActivitySource = 'COMENTARIO' | 'FORO' | 'REACCION' | 'LOGRO' | 'OFERTA'

export interface ActivityRow {
  key: string // stable React key
  kind: ActivityKind
  source: ActivitySource
  // Actor uuid — resolve display identity via useResolvedUser (the users
  // fetched here are primed into the userOverrides cache). Null for LOGRO
  // (system rows have no actor).
  actorId: string | null
  targetTitle: string // item title / thread subject / listing title / trophy name
  excerpt?: string // short body excerpt for comment-shaped rows
  // Deep-link payload. itemSlug → open in place via lib/dashboard/openItem
  // (`/dashboard?item=<slug>&comment=<id>`); threadId → `/foro?thread=` (the
  // sanctioned page exception); listingId → MERCADO inline thread.
  itemSlug?: string
  commentId?: string
  threadId?: string
  listingId?: string
  trophyKey?: string
  count?: number // collapsed reaction count for this target
  createdAt: string // ISO — watermark comparisons + ordering
}

const ROW_LIMIT = 40
const PER_SOURCE_LIMIT = 30
const LOGRO_LIMIT = 10
const EXCERPT_LEN = 90

type CommentRow = {
  id: string
  item_id: string
  parent_id: string | null
  author_id: string | null
  body: string
  created_at: string
}

type ItemRef = { id: string; slug: string; title: string }

function excerptOf(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > EXCERPT_LEN ? `${flat.slice(0, EXCERPT_LEN - 1)}…` : flat
}

// Browser-side duplicate of the users row mapper (lib/data/users.ts is
// server-only) — same idiom as useForo/useComments.
function rowToUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isMod: row.is_mod || undefined,
    isOG: row.is_og || undefined,
    franjaId: row.franja_id ?? undefined,
    franjaAdmin: row.franja_admin || undefined,
    joinedAt: row.joined_at,
    avatarUrl: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    firma: row.firma ?? undefined,
    location: row.location ?? undefined,
  }
}

// The merged reverse-chron inbox. One call per provider tick (60s poll +
// focus). Includes LOGRO (R3: validated → ships). OFERTA rows are appended
// separately by the provider via fetchOfertaActivity (they depend on the
// franja slice's inbox fetch).
export async function fetchActivity(userId: string): Promise<ActivityRow[]> {
  const supabase = createClient()

  // Step A — my footprint (id lists). `created_by` is post-0012; cast past
  // the stale generated types (useMyPublishedItems idiom). published=true is
  // explicit law: RLS alone lets franja teams read own unpublished rows.
  const [myItemsRes, myCommentsRes, myThreadsRes, myRepliesRes, myTrophiesRes] =
    await Promise.all([
      supabase
        .from('items')
        .select('id, slug, title')
        .eq('created_by' as never, userId as never)
        .eq('published', true),
      supabase
        .from('comments')
        .select('id, item_id')
        .eq('author_id', userId)
        .is('deletion_at', null),
      supabase.from('foro_threads').select('id, subject').eq('author_id', userId),
      supabase.from('foro_replies').select('id').eq('author_id', userId),
      supabase
        .from('user_trophies')
        .select('trophy_key, earned_at')
        .eq('user_id', userId)
        .order('earned_at', { ascending: false })
        .limit(LOGRO_LIMIT),
    ])

  const myItems = (myItemsRes.data ?? []) as unknown as ItemRef[]
  const myItemById = new Map(myItems.map((i) => [i.id, i]))
  const myComments = (myCommentsRes.data ?? []) as unknown as { id: string; item_id: string }[]
  const myCommentIds = myComments.map((c) => c.id)
  const myCommentItemById = new Map(myComments.map((c) => [c.id, c.item_id]))
  const myThreads = (myThreadsRes.data ?? []) as unknown as { id: string; subject: string }[]
  const myThreadById = new Map(myThreads.map((t) => [t.id, t.subject]))
  const myReplyIds = ((myRepliesRes.data ?? []) as unknown as { id: string }[]).map((r) => r.id)

  // Step B — what came back to me. Empty id lists skip their query entirely.
  const commentSelect = 'id, item_id, parent_id, author_id, body, created_at'
  const [onMyItemsRes, toMyCommentsRes, reactionsRes, inMyThreadsRes, quotingMeRes] =
    await Promise.all([
      myItems.length > 0
        ? supabase
            .from('comments')
            .select(commentSelect)
            .in('item_id', Array.from(myItemById.keys()))
            .neq('author_id', userId)
            .is('deletion_at', null)
            .order('created_at', { ascending: false })
            .limit(PER_SOURCE_LIMIT)
        : Promise.resolve({ data: [] as unknown, error: null }),
      myCommentIds.length > 0
        ? supabase
            .from('comments')
            .select(commentSelect)
            .in('parent_id', myCommentIds)
            .neq('author_id', userId)
            .is('deletion_at', null)
            .order('created_at', { ascending: false })
            .limit(PER_SOURCE_LIMIT)
        : Promise.resolve({ data: [] as unknown, error: null }),
      myCommentIds.length > 0
        ? supabase
            .from('comment_reactions')
            .select('comment_id, user_id, kind, created_at')
            .in('comment_id', myCommentIds)
            .neq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(PER_SOURCE_LIMIT * 2)
        : Promise.resolve({ data: [] as unknown, error: null }),
      myThreads.length > 0
        ? supabase
            .from('foro_replies')
            .select('id, thread_id, author_id, body, created_at, quoted_reply_ids')
            .in('thread_id', Array.from(myThreadById.keys()))
            .neq('author_id', userId)
            .is('deletion_at', null)
            .order('created_at', { ascending: false })
            .limit(PER_SOURCE_LIMIT)
        : Promise.resolve({ data: [] as unknown, error: null }),
      myReplyIds.length > 0
        ? supabase
            .from('foro_replies')
            .select('id, thread_id, author_id, body, created_at, quoted_reply_ids')
            .overlaps('quoted_reply_ids', myReplyIds)
            .neq('author_id', userId)
            .is('deletion_at', null)
            .order('created_at', { ascending: false })
            .limit(PER_SOURCE_LIMIT)
        : Promise.resolve({ data: [] as unknown, error: null }),
    ])

  const rows: ActivityRow[] = []
  const seenCommentIds = new Set<string>()
  const missingItemIds = new Set<string>()

  // Replies to my comments FIRST — a reply to my comment on my own item also
  // matches the comments-on-my-items query; the reply framing wins the dedupe.
  for (const c of (toMyCommentsRes.data ?? []) as CommentRow[]) {
    seenCommentIds.add(c.id)
    if (!myItemById.has(c.item_id)) missingItemIds.add(c.item_id)
    rows.push({
      key: `reply:${c.id}`,
      kind: 'reply_to_comment',
      source: 'COMENTARIO',
      actorId: c.author_id,
      targetTitle: '', // filled after the item-title merge below
      excerpt: excerptOf(c.body),
      itemSlug: undefined,
      commentId: c.id,
      createdAt: c.created_at,
    })
  }

  for (const c of (onMyItemsRes.data ?? []) as CommentRow[]) {
    if (seenCommentIds.has(c.id)) continue
    const item = myItemById.get(c.item_id)
    rows.push({
      key: `comment:${c.id}`,
      kind: 'comment_on_item',
      source: 'COMENTARIO',
      actorId: c.author_id,
      targetTitle: item?.title ?? '',
      excerpt: excerptOf(c.body),
      itemSlug: item?.slug,
      commentId: c.id,
      createdAt: c.created_at,
    })
  }

  // Reactions collapse by target comment (§3.2 — «3 reacciones a tu
  // comentario», owner-only): one row per comment, latest actor + timestamp.
  type ReactionRow = { comment_id: string; user_id: string; kind: string; created_at: string }
  const reactionByTarget = new Map<string, { count: number; latest: ReactionRow }>()
  for (const r of (reactionsRes.data ?? []) as ReactionRow[]) {
    const agg = reactionByTarget.get(r.comment_id)
    if (agg) {
      agg.count += 1
      if (r.created_at > agg.latest.created_at) agg.latest = r
    } else {
      reactionByTarget.set(r.comment_id, { count: 1, latest: r })
    }
  }
  for (const [commentId, agg] of reactionByTarget) {
    const itemId = myCommentItemById.get(commentId)
    if (itemId && !myItemById.has(itemId)) missingItemIds.add(itemId)
    rows.push({
      key: `reaction:${commentId}`,
      kind: 'reaction',
      source: 'REACCION',
      actorId: agg.latest.user_id,
      targetTitle: '',
      itemSlug: undefined,
      commentId,
      count: agg.count,
      createdAt: agg.latest.created_at,
    })
  }

  type ForoReplyRow = {
    id: string
    thread_id: string
    author_id: string | null
    body: string
    created_at: string
  }
  const seenForoIds = new Set<string>()
  for (const r of (inMyThreadsRes.data ?? []) as ForoReplyRow[]) {
    seenForoIds.add(r.id)
    rows.push({
      key: `foro:${r.id}`,
      kind: 'foro_reply',
      source: 'FORO',
      actorId: r.author_id,
      targetTitle: myThreadById.get(r.thread_id) ?? '',
      excerpt: excerptOf(r.body),
      threadId: r.thread_id,
      createdAt: r.created_at,
    })
  }
  for (const r of (quotingMeRes.data ?? []) as ForoReplyRow[]) {
    if (seenForoIds.has(r.id)) continue
    rows.push({
      key: `foro-quote:${r.id}`,
      kind: 'foro_quote',
      source: 'FORO',
      actorId: r.author_id,
      targetTitle: myThreadById.get(r.thread_id) ?? '',
      excerpt: excerptOf(r.body),
      threadId: r.thread_id,
      createdAt: r.created_at,
    })
  }

  // LOGRO — self data, real delight, zero schema (R3: validated → ships).
  type TrophyRow = { trophy_key: string; earned_at: string }
  for (const t of (myTrophiesRes.data ?? []) as unknown as TrophyRow[]) {
    rows.push({
      key: `logro:${t.trophy_key}`,
      kind: 'logro',
      source: 'LOGRO',
      actorId: null,
      targetTitle: trophyByKey(t.trophy_key)?.label ?? t.trophy_key,
      trophyKey: t.trophy_key,
      createdAt: t.earned_at,
    })
  }

  // Titles/slugs for rows whose parent item isn't mine (replies + reactions
  // live on ANY published item I commented on). Published-only read; a miss
  // leaves the row's target label empty and the widget degrades honestly.
  if (missingItemIds.size > 0) {
    const { data } = await supabase
      .from('items')
      .select('id, slug, title')
      .in('id', Array.from(missingItemIds))
      .eq('published', true)
    for (const it of (data ?? []) as unknown as ItemRef[]) {
      myItemById.set(it.id, it)
    }
  }
  for (const row of rows) {
    if (row.kind === 'reply_to_comment' || row.kind === 'reaction') {
      const itemId = row.commentId ? myCommentItemById.get(row.commentId) : undefined
      const item = itemId ? myItemById.get(itemId) : undefined
      if (item) {
        row.targetTitle = row.targetTitle || item.title
        row.itemSlug = item.slug
      }
    }
  }

  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  const merged = rows.slice(0, ROW_LIMIT)

  // Resolve actor identities through the public-read users table into the
  // existing userOverrides cache — the widget renders via useResolvedUser,
  // no per-row fetches.
  const actorIds = new Set<string>()
  for (const r of merged) if (r.actorId) actorIds.add(r.actorId)
  if (actorIds.size > 0) {
    const { data } = await supabase.from('users').select('*').in('id', Array.from(actorIds))
    const users = ((data ?? []) as any[]).map(rowToUser)
    if (users.length > 0) setRealUsers(users)
  }

  return merged
}

// ── OFERTA fold-in (franja-team only) ──────────────────────────────────────
//
// The inbox route (GET /api/franjas/[id]/inbox) stays the authority on which
// listings have an open buyer thread — this only decorates those ids with the
// latest comment's actor + timestamp so the rows sort honestly into the
// merged list. Called by the provider with the franja slice's data; obeys
// that slice's ≥5-min cadence floor (never its own poll).
export async function fetchOfertaActivity(
  unansweredListingIds: readonly string[],
  listingTitleById: ReadonlyMap<string, string>,
): Promise<ActivityRow[]> {
  if (unansweredListingIds.length === 0) return []
  const supabase = createClient()
  const { data, error } = await supabase
    .from('listing_comments')
    .select('id, listing_id, author_id, created_at')
    .in('listing_id', Array.from(unansweredListingIds))
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[fetchOfertaActivity]', error)
    return []
  }
  type Row = { id: string; listing_id: string; author_id: string | null; created_at: string }
  // Rows are created_at-desc: first row seen per listing is its latest comment.
  const latestByListing = new Map<string, Row>()
  for (const r of (data ?? []) as Row[]) {
    if (!latestByListing.has(r.listing_id)) latestByListing.set(r.listing_id, r)
  }
  const out: ActivityRow[] = []
  for (const [listingId, r] of latestByListing) {
    out.push({
      key: `oferta:${listingId}:${r.id}`,
      kind: 'oferta',
      source: 'OFERTA',
      actorId: r.author_id,
      targetTitle: listingTitleById.get(listingId) ?? '',
      listingId,
      createdAt: r.created_at,
    })
  }
  const actorIds = Array.from(new Set(out.map((r) => r.actorId).filter((id): id is string => !!id)))
  if (actorIds.length > 0) {
    const { data: userRows } = await supabase.from('users').select('*').in('id', actorIds)
    const users = ((userRows ?? []) as any[]).map(rowToUser)
    if (users.length > 0) setRealUsers(users)
  }
  return out
}

// Merge helper for the provider: activity + oferta, one reverse-chron list.
export function mergeActivityRows(...lists: ReadonlyArray<readonly ActivityRow[]>): ActivityRow[] {
  const seen = new Set<string>()
  const out: ActivityRow[] = []
  for (const list of lists) {
    for (const row of list) {
      if (seen.has(row.key)) continue
      seen.add(row.key)
      out.push(row)
    }
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  return out
}

// Unread = rows newer than the single localStorage watermark. The spine and
// the widget badge call this with the SAME rows and the SAME watermark —
// one number, one source (§3.0/§3.2).
export function countUnread(rows: readonly ActivityRow[], watermarkIso: string | null): number {
  if (!watermarkIso) return rows.length
  let n = 0
  for (const r of rows) if (r.createdAt > watermarkIso) n += 1
  return n
}

// The watermark advance value: max createdAt of the rendered rows (the
// widget writes it through lib/dashboard/localState after the in-viewport
// dwell rule — never on mount).
export function latestActivityTimestamp(rows: readonly ActivityRow[]): string | null {
  let max: string | null = null
  for (const r of rows) if (!max || r.createdAt > max) max = r.createdAt
  return max
}
