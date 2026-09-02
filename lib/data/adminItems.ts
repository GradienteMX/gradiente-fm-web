import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentHp, spawnHp, type HpDecayParts } from '@/lib/curation'
import { hlBracket, type HlBracketLabel } from '@/lib/dashboard/hl'
import {
  HP_EVENT_KINDS,
  KIND_CODES,
  KIND_LABELS,
  KIND_ON_LIGHT,
  KIND_WEIGHTS,
  LEDGER_EPOCH,
  type HpEventKind,
} from '@/lib/hp/kinds'
import { bucketByDay, dayRange, round } from '@/lib/dashboard/scale'
import { ADMIN_PAGE_SIZE } from '@/lib/admin/paging'
import type { ContentType } from '@/lib/types'

// ── CONTENIDO — the surveillance surface's reads ────────────────────────────
//
// Before this module /admin could see exactly one content type: eventos. The
// other 151 items (mixes, reseñas, editoriales, opiniones, artículos, listas,
// noticias) had no admin surface at all — getAllEventsAdmin() is hardcoded to
// .eq('type','evento'). This is the cross-type read.
//
// WHY SOME READS USE THE SERVICE ROLE. Three counts an admin legitimately needs
// are invisible to their own session:
//   · user_saves is `user_saves_self_only` — a session query returns the
//     ADMIN'S OWN saves, which silently reads 0 or 1 instead of erroring. A
//     wrong number that looks right is worse than no number, so saves go
//     through createAdminClient().
//   · drafts is `drafts_self_only` for the same reason.
// Everything else reads through the caller's session so RLS stays the
// enforcing layer. The gate is always requireAdmin() at the route; the service
// role is for reach, never for authorization.

const LIST_COLUMNS =
  'id, type, title, slug, image_url, hp, hp_last_updated_at, published_at, editorial, hp_decay_multiplier, date, end_date, published, seed, franja_id, created_by, elevated, pinned'

interface ItemRow {
  id: string
  type: ContentType
  title: string
  slug: string
  image_url: string | null
  hp: number | null
  hp_last_updated_at: string | null
  published_at: string
  editorial: boolean | null
  hp_decay_multiplier: number | null
  date: string | null
  end_date: string | null
  published: boolean
  seed: boolean | null
  franja_id: string | null
  created_by: string | null
  elevated: boolean | null
  pinned: boolean | null
}

function toParts(row: ItemRow): HpDecayParts {
  return {
    type: row.type,
    hp: row.hp,
    hpLastUpdatedAt: row.hp_last_updated_at,
    publishedAt: row.published_at,
    editorial: row.editorial ?? false,
    hpDecayMultiplier: row.hp_decay_multiplier,
    date: row.date,
    endDate: row.end_date,
  }
}

export interface KindDelta {
  kind: HpEventKind
  label: string
  code: string
  color: string
  nominal: number
  weight: number
  count: number | null
}

export interface AdminItemRow {
  id: string
  type: ContentType
  title: string
  slug: string
  imageUrl: string | null
  /** Decayed to NOW — never the raw items.hp column, which is a stale anchor. */
  hp: number
  /** Whether hp is a real reading or the spawn default (hp IS NULL). */
  hpIsSpawn: boolean
  bracket: HlBracketLabel
  published: boolean
  editorial: boolean
  elevated: boolean
  pinned: boolean
  seed: boolean
  franjaId: string | null
  publishedAt: string
  date: string | null
  /** HL gained from reader interactions over the window. */
  deltaHl: number
  /** HL removed by decay over the window (positive number). */
  deltaDecay: number
  /** HL added by admin injection over the window. Signed. */
  deltaAdmin: number
  /** 7-day daily net, for the row sparkline. */
  spark: number[]
  harvested: boolean
}

export interface ListOptions {
  days?: number
  type?: ContentType | 'all'
  estado?: 'all' | 'publicado' | 'borrador'
  q?: string
  orden?: 'hp' | 'reciente' | 'delta' | 'caida'
  limit?: number
  offset?: number
}

export interface AdminItemList {
  rows: AdminItemRow[]
  total: number
  window: { days: number; ledgerCovers: boolean }
}

export async function listAdminItems(opts: ListOptions = {}): Promise<AdminItemList> {
  const {
    days = 30,
    type = 'all',
    estado = 'all',
    q = '',
    orden = 'hp',
    limit = ADMIN_PAGE_SIZE,
    offset = 0,
  } = opts

  const supabase = createClient()
  const now = new Date()
  const from = new Date(now.getTime() - (days - 1) * 86_400_000)
  const sparkFrom = new Date(now.getTime() - 6 * 86_400_000)

  // The whole corpus is 601 rows — small enough to rank in Node, which is
  // REQUIRED rather than merely convenient: ordering by items.hp in SQL sorts
  // snapshots of different ages against each other, so a stale row outranks a
  // fresher one that is actually hotter. Only currentHp() can order this, and
  // it lives in TypeScript.
  let query = supabase.from('items').select(LIST_COLUMNS)
  if (type !== 'all') query = query.eq('type', type)
  if (estado === 'publicado') query = query.eq('published', true)
  if (estado === 'borrador') query = query.eq('published', false)
  if (q.trim()) {
    // Escape PostgREST's ilike wildcards so a literal % in a title cannot
    // become a scan — same guard as /api/admin/users/search.
    const safe = q.trim().replace(/[%_]/g, (c) => `\\${c}`)
    query = query.ilike('title', `%${safe}%`)
  }

  const [itemsRes, ledgerRes] = await Promise.all([
    query,
    supabase
      .from('hp_events')
      .select('item_id, kind, weight, base_weight, created_at')
      .gte('created_at', from.toISOString()),
  ])

  const items = (itemsRes.data as ItemRow[] | null) ?? []
  const ledger = (ledgerRes.data as LedgerRow[] | null) ?? []

  const byItem = new Map<string, LedgerRow[]>()
  for (const e of ledger) {
    const list = byItem.get(e.item_id)
    if (list) list.push(e)
    else byItem.set(e.item_id, [e])
  }

  const sparkDays = dayRange(sparkFrom, now)

  const rows: AdminItemRow[] = items.map((row) => {
    const parts = toParts(row)
    const events = byItem.get(row.id) ?? []
    const reader = events.filter((e) => (HP_EVENT_KINDS as string[]).includes(e.kind))
    const decay = events.filter((e) => e.kind === 'decay')
    const admin = events.filter((e) => e.kind === 'admin_adjust')

    const sparkRows = events.filter((e) => e.created_at >= sparkFrom.toISOString())
    const spark = bucketByDay(sparkRows, (e) => e.created_at, (e) => e.weight, sparkFrom, now)

    const hp = currentHp(parts, now)
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      slug: row.slug,
      imageUrl: row.image_url,
      hp: round(hp, 1),
      hpIsSpawn: row.hp === null,
      bracket: hlBracket(hp),
      published: row.published,
      editorial: Boolean(row.editorial),
      elevated: Boolean(row.elevated),
      pinned: Boolean(row.pinned),
      seed: Boolean(row.seed),
      franjaId: row.franja_id,
      publishedAt: row.published_at,
      date: row.date,
      deltaHl: round(reader.reduce((a, e) => a + e.weight, 0), 1),
      deltaDecay: round(Math.abs(decay.reduce((a, e) => a + e.weight, 0)), 1),
      deltaAdmin: round(admin.reduce((a, e) => a + e.weight, 0), 1),
      spark: spark.map((d) => round(d.value, 2)),
      harvested: (row.hp_decay_multiplier ?? 1) !== 1,
    }
  })

  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)
  const sorted = [...rows]
  if (orden === 'hp') sorted.sort((a, b) => b.hp - a.hp)
  else if (orden === 'reciente')
    sorted.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  else if (orden === 'delta') sorted.sort((a, b) => b.deltaHl - a.deltaHl)
  else if (orden === 'caida') {
    // Biggest bracket fall first, then biggest absolute HL loss.
    const fall = (r: AdminItemRow) => {
      const src = items.find((i) => i.id === r.id)
      if (!src) return 0
      const parts = toParts(src)
      return currentHp(parts, weekAgo) - currentHp(parts, now)
    }
    sorted.sort((a, b) => fall(b) - fall(a))
  }

  return {
    rows: sorted.slice(offset, offset + limit),
    total: sorted.length,
    window: { days, ledgerCovers: from.toISOString().slice(0, 10) >= LEDGER_EPOCH },
  }
}

interface LedgerRow {
  item_id: string
  kind: string
  weight: number
  base_weight: number | null
  created_at: string
}

// ── The expanded dossier ────────────────────────────────────────────────────

export interface AdminAdjustment {
  at: string
  actor: string | null
  delta: number
  applied: number
  before: number
  after: number
  reason: string | null
}

export interface AdminItemDetail {
  id: string
  type: ContentType
  title: string
  slug: string
  imageUrl: string | null
  published: boolean
  editorial: boolean
  elevated: boolean
  pinned: boolean
  seed: boolean
  publishedAt: string
  date: string | null
  franjaTitle: string | null
  creator: { username: string; displayName: string | null } | null
  /** Live HP, decayed to now. */
  hp: number
  hpIsSpawn: boolean
  spawn: number
  bracket: HlBracketLabel
  hpAnchoredAt: string | null
  decayMultiplier: number
  /** Per-kind HL over the window, reader kinds only. */
  breakdown: KindDelta[]
  decayInWindow: number
  /** Every admin injection this item has received, newest first. */
  adjustments: AdminAdjustment[]
  /** Counts from their own tables — these are exact, not ledger-derived. */
  counts: { saves: number; comments: number; vibeChecks: number; reports: number }
  /** Daily net over the window, for the detail chart. */
  series: { days: string[]; net: number[] }
  ledgerStartsAt: string
}

export async function getAdminItemDetail(
  itemId: string,
  days = 30,
): Promise<AdminItemDetail | null> {
  const supabase = createClient()
  const admin = createAdminClient()
  const now = new Date()
  const from = new Date(now.getTime() - (days - 1) * 86_400_000)

  const { data: row } = await supabase
    .from('items')
    .select(LIST_COLUMNS)
    .eq('id', itemId)
    .maybeSingle()
  if (!row) return null
  const item = row as ItemRow

  const [ledgerRes, auditRes, savesRes, commentsRes, vibesRes, reportsRes, franjaRes, creatorRes] =
    await Promise.all([
      supabase
        .from('hp_events')
        .select('item_id, kind, weight, base_weight, created_at')
        .eq('item_id', itemId)
        .gte('created_at', from.toISOString()),
      // audit_log has an admin-read policy and, before 0049, had never been
      // written to by anything. Every row here is an HL injection.
      supabase
        .from('audit_log')
        .select('actor_id, payload, created_at')
        .eq('target_type', 'item')
        .eq('target_id', itemId)
        .eq('action', 'hp_adjust')
        .order('created_at', { ascending: false })
        .limit(50),
      // Service role: user_saves_self_only would otherwise return the admin's
      // own saves and read as 0.
      admin.from('user_saves').select('user_id', { count: 'exact', head: true }).eq('item_id', itemId),
      supabase.from('comments').select('id', { count: 'exact', head: true }).eq('item_id', itemId),
      supabase.from('vibe_checks').select('id', { count: 'exact', head: true }).eq('item_id', itemId),
      supabase
        .from('reports' as never)
        .select('id', { count: 'exact', head: true })
        .eq('target_type', 'item')
        .eq('target_id', itemId),
      item.franja_id
        ? supabase.from('items').select('title').eq('id', item.franja_id).maybeSingle()
        : Promise.resolve({ data: null }),
      item.created_by
        ? supabase
            .from('users')
            .select('username, display_name')
            .eq('id', item.created_by)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

  const ledger = (ledgerRes.data as LedgerRow[] | null) ?? []
  const reader = ledger.filter((e) => (HP_EVENT_KINDS as string[]).includes(e.kind))

  const breakdown: KindDelta[] = HP_EVENT_KINDS.map((kind: HpEventKind) => {
    const rows = reader.filter((e) => e.kind === kind)
    const countable = rows.filter((e) => e.base_weight !== null)
    return {
      kind,
      label: KIND_LABELS[kind],
      code: KIND_CODES[kind],
      color: KIND_ON_LIGHT[kind],
      nominal: KIND_WEIGHTS[kind],
      weight: round(rows.reduce((a, e) => a + e.weight, 0), 2),
      // null, not 0, when any row predates base_weight: an unknown count must
      // print «—». Showing 0 next to a non-zero HL contribution would look
      // like a bug in the system rather than a limit of the record.
      count: countable.length === rows.length ? countable.length : null,
    }
  })

  const parts = toParts(item)
  const hp = currentHp(parts, now)
  const series = bucketByDay(ledger, (e) => e.created_at, (e) => e.weight, from, now)

  const adjustments: AdminAdjustment[] = (
    (auditRes.data as { actor_id: string | null; payload: Record<string, unknown>; created_at: string }[] | null) ?? []
  ).map((a) => ({
    at: a.created_at,
    actor: (a.actor_id as string | null) ?? null,
    delta: Number(a.payload?.delta ?? 0),
    applied: Number(a.payload?.applied ?? 0),
    before: Number(a.payload?.before ?? 0),
    after: Number(a.payload?.after ?? 0),
    reason: (a.payload?.reason as string | null) ?? null,
  }))

  const franja = franjaRes.data as { title: string } | null
  const creator = creatorRes.data as { username: string; display_name: string | null } | null

  return {
    id: item.id,
    type: item.type,
    title: item.title,
    slug: item.slug,
    imageUrl: item.image_url,
    published: item.published,
    editorial: Boolean(item.editorial),
    elevated: Boolean(item.elevated),
    pinned: Boolean(item.pinned),
    seed: Boolean(item.seed),
    publishedAt: item.published_at,
    date: item.date,
    franjaTitle: franja?.title ?? null,
    creator: creator ? { username: creator.username, displayName: creator.display_name } : null,
    hp: round(hp, 2),
    hpIsSpawn: item.hp === null,
    spawn: spawnHp(parts),
    bracket: hlBracket(hp),
    hpAnchoredAt: item.hp_last_updated_at,
    decayMultiplier: item.hp_decay_multiplier ?? 1,
    breakdown,
    decayInWindow: round(
      Math.abs(ledger.filter((e) => e.kind === 'decay').reduce((a, e) => a + e.weight, 0)),
      2,
    ),
    adjustments,
    counts: {
      saves: savesRes.count ?? 0,
      comments: commentsRes.count ?? 0,
      vibeChecks: vibesRes.count ?? 0,
      reports: reportsRes.count ?? 0,
    },
    series: { days: series.map((d) => d.day), net: series.map((d) => round(d.value, 2)) },
    ledgerStartsAt: LEDGER_EPOCH,
  }
}
