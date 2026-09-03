import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { statusForRpcError } from '@/lib/api/requireAdmin'
import { bucketByDay, shares, type DayKey } from '@/lib/dashboard/scale'
import type { HpEventKind } from '@/lib/hp/kinds'

// ── GET /api/users/me/reception?dias=30 ─────────────────────────────────────
//
// The read behind RECEPCIÓN: how a creator's own work was received. Two
// halves in one payload because the space needs both to be honest about
// which one has history.
//
//   presencia — the CREATOR-side ledger (user_hp_events), running since May.
//               Four months of real rows. This is what the space opens on.
//   obra      — the PER-ITEM ledger (hp_events via creator_reception()),
//               which began at LEDGER_EPOCH (2026-09-02) and is hours old.
//
// Leading with presencia is not a layout preference: opening on obra would
// greet every creator with an empty chart and read as "nobody received you",
// which is the opposite of the truth.
//
// SELF-ONLY, permanently. There is no /api/users/<id>/reception and there
// must not be — same rule as /api/users/me/engagement. Reception is a
// creator looking at their own work; the moment it can be pointed at someone
// else it becomes a leaderboard, and the no-leaderboard rule
// ([[project_user_hp_visibility]]) is the reason the HP scalar is private in
// the first place. The gate here is the session, and the session only.
//
// WHAT THIS ROUTE REFUSES TO RETURN
//
//   · attribution_key. It encodes the SAVER/REACTOR id on the recipient's
//     own rows, and user_hp_events_self_read admits the recipient to those
//     rows — that was the leak migration 0050 §1 closed by revoking the
//     column from `authenticated`. Selecting it here would now fail the
//     request outright, which is the correct outcome twice over. Saves are
//     anonymous; that is a product promise, not a default.
//
//   · Per-kind weight sums. Returning `events` and a weight side by side
//     lets anyone divide one by the other and read the ladder off the wire.
//     Shares only, same reasoning the 0050 §2 header spells out for the item
//     side. The UI never prints a weight either.
//
//     RESIDUAL, stated so nobody trusts this further than it goes: the daily
//     `serie` sums to the window total, and share × total recovers per-kind
//     weight sums to within rounding. Unlike the item side there is no
//     novelty multiplier on user_hp_events to blur that — creator-side
//     weights are flat constants (0018). So this half leaks the creator-side
//     ladder to a determined analyst with a spreadsheet. The guard is
//     against a price list PRINTED ON THE SCREEN — a creator handed one
//     optimises for the price list instead of the work — not against
//     arithmetic. The sparkline is worth that trade; a per-kind weight
//     column would not be.
//
// Anonymous callers get 401 rather than an empty payload: the space is
// mounted inside the auth-gated dashboard, so a logged-out request is a bug
// or a probe, and either deserves a straight answer.

const DEFAULT_DAYS = 30
// 180 is sweep_old_hp_events()'s retention ceiling. Asking for more can only
// return sparser data while implying something was lost, so the window is
// clamped rather than rejected — a hand-edited URL degrades, it does not 400.
const MAX_DAYS = 180

/**
 * The creator-side vocabulary, in the order the space reads them. These are
 * NOT the four item-side reader kinds (click/open/save/comment) — different
 * ledger, different table, different meaning. Nothing should ever map one
 * vocabulary onto the other.
 *
 * `publish` is synthetic: the writers stamp `publish_<type>` (eight variants,
 * 0018 §5 / 0048), and splitting a creator's own publishing across eight rows
 * is noise in a surface about how OTHERS received them. Collapsed to one
 * bucket here.
 *
 * `vibe_check_accurate` has never fired in production and will keep reading
 * zero indefinitely: 0021 credits the bonus only once an item has
 * check_count >= 5, and the busiest item in prod has 3. The row stays in the
 * list anyway — a gesture that exists and has never paid out is a true thing
 * to show, and hiding it would make the zero look like an absence of data
 * rather than an absence of events.
 */
const USER_KINDS = [
  'item_saved',
  'comment_received',
  'reaction_received',
  'comment_saved',
  'harvest',
  'vibe_check_cast',
  'vibe_check_accurate',
  'publish',
] as const

export type ReceptionKind = (typeof USER_KINDS)[number]

export interface ReceptionKindRow {
  /** A ReceptionKind, or a raw ledger kind this route did not recognise. */
  kind: string
  events: number
  /** Percentage of the window's HP, one decimal. Never a weight. */
  share: number
}

export interface ReceptionPresencia {
  /** Start of the bucketed window, floored to a UTC day. */
  since: string
  events: number
  kinds: ReceptionKindRow[]
  /** Daily TOTAL HP, all kinds combined, gap-filled. Zero days are real. */
  serie: { day: DayKey; value: number }[]
}

/** One reader kind's footprint on one item, as creator_reception() returns it. */
export interface ReceptionItemKind {
  kind: HpEventKind
  events: number
  share: number
}

export interface ReceptionItem {
  id: string
  title: string
  slug: string
  item_type: string
  published_at: string | null
  /** STALE ANCHOR. Decay it with currentHp() before showing it to anyone. */
  hp: number
  hp_last_updated_at: string | null
  editorial: boolean
  hp_decay_multiplier: number | null
  item_date: string | null
  item_end_date: string | null
  published: boolean
  kinds: ReceptionItemKind[]
}

export interface ReceptionObra {
  days: number
  since: string
  items: ReceptionItem[]
  totals: ReceptionItemKind[]
}

/**
 * `migracion_pendiente` is not an error state — it is the honest name for a
 * backend half that does not exist in this database yet. The UI renders it as
 * a MarginNote, never as an ErrorLine and never as an empty item list, which
 * would read as "nobody received your work".
 */
export type ObraEstado = 'ok' | 'migracion_pendiente'

export interface ReceptionPayload {
  days: number
  presencia: ReceptionPresencia
  obra: ReceptionObra | null
  obraEstado: ObraEstado
}

interface UserHpRow {
  kind: string
  weight: number
  created_at: string
}

/** Folds the eight `publish_<type>` variants into one bucket. */
function bucketKind(kind: string): string {
  return kind.startsWith('publish_') ? 'publish' : kind
}

export async function GET(request: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = Number(request.nextUrl.searchParams.get('dias'))
  const days = Number.isFinite(raw)
    ? Math.min(MAX_DAYS, Math.max(1, Math.round(raw)))
    : DEFAULT_DAYS

  const now = new Date()
  // Floor to a UTC day so bucketByDay's dense series starts on a bucket
  // boundary — a rolling timestamp would put a partial day at each end and
  // make the first and last sparkline columns lie about their height.
  const from = new Date(now.getTime() - (days - 1) * 86_400_000)
  const fromDay = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  )

  // Deliberately three columns. NOT attribution_key — see the header; the
  // grant no longer covers it, so adding it would 42501 the whole request.
  //
  // .eq('user_id') is NOT redundant with RLS, which is the trap here. There
  // are two SELECT policies on this table and they are OR'd:
  // user_hp_events_self_read (user_id = auth.uid()) and
  // user_hp_events_admin_read (private.auth_is_admin()). Without the filter an
  // admin opening their own RECEPCIÓN would silently aggregate every user's
  // ledger and see a "presencia" that is the whole site's. The filter is what
  // makes this route self-only for everybody, not just for non-admins.
  //
  // Unbounded by row count on purpose: at beta volume a creator's 180-day
  // slice is hundreds of rows, and an explicit .limit() would silently
  // truncate the total instead of failing loudly if that ever changed.
  const [presenciaRes, obraRes] = await Promise.all([
    supabase
      .from('user_hp_events')
      .select('kind, weight, created_at')
      .eq('user_id', user.id)
      .gte('created_at', fromDay.toISOString()),
    supabase.rpc('creator_reception' as never, { p_days: days } as never),
  ])

  if (presenciaRes.error) {
    return NextResponse.json({ error: presenciaRes.error.message }, { status: 500 })
  }

  const rows = (presenciaRes.data as UserHpRow[] | null) ?? []

  // Every canonical kind is emitted even at zero, plus any ledger kind this
  // route has not been taught. Dropping an unknown kind would quietly shrink
  // a creator's own history the day a ninth writer ships.
  const seen = new Set(rows.map((r) => bucketKind(r.kind)))
  const keys: string[] = [
    ...USER_KINDS,
    ...[...seen].filter((k) => !(USER_KINDS as readonly string[]).includes(k)).sort(),
  ]

  const counts = keys.map((k) => rows.filter((r) => bucketKind(r.kind) === k).length)
  const weights = keys.map((k) =>
    rows.filter((r) => bucketKind(r.kind) === k).reduce((sum, r) => sum + r.weight, 0),
  )
  // shares() is the only thing the weights are used for. They are summed here
  // and never leave the function.
  const pct = shares(weights)

  const kinds: ReceptionKindRow[] = keys
    .map((kind, i) => ({ kind, events: counts[i], share: pct[i] }))
    // Share descending so the bar reads "most of your HL came from X" without
    // the UI re-sorting; canonical index breaks ties so the order is stable
    // across polls instead of shuffling on every equal-share render.
    .sort((a, b) => b.share - a.share || keys.indexOf(a.kind) - keys.indexOf(b.kind))

  const presencia: ReceptionPresencia = {
    since: fromDay.toISOString(),
    events: rows.length,
    kinds,
    serie: bucketByDay(rows, (r) => r.created_at, (r) => r.weight, fromDay, now),
  }

  // ── obra ──────────────────────────────────────────────────────────────────
  // "the RPC does not exist yet" arrives under TWO codes, and the obvious one
  // is the wrong one. Verified against prod on 2026-09-02, with 0050 still
  // unapplied: supabase-js .rpc() goes through PostgREST, which resolves the
  // function against its own schema cache and answers 404 PGRST202 — the
  // Postgres call never happens, so the undefined_function errcode 42883 is
  // never raised. 42883 is kept alongside it for the narrow window where
  // PostgREST has a function cached that the database no longer has.
  //
  // PGRST202 also covers the minutes right after 0050 is pasted into the SQL
  // editor, while the schema cache is still stale. Degrading to a named
  // absence is the honest answer in both cases: this is a deployment state,
  // not a failure. presencia — the more valuable half — survives it. Every
  // other errcode is the RPC's own vocabulary and gets translated; the route
  // is not the authorization authority here.
  const obraError = obraRes.error as { code?: string; message?: string } | null
  const obraMissing =
    obraError !== null && (obraError.code === 'PGRST202' || obraError.code === '42883')
  if (obraError && !obraMissing) {
    return NextResponse.json(
      { error: obraError.message ?? 'creator_reception falló' },
      { status: statusForRpcError(obraError.code) },
    )
  }

  const payload: ReceptionPayload = {
    days,
    presencia,
    // The jsonb passes through untouched: creator_reception() is where the
    // aggregation-as-privacy-boundary lives, and re-shaping it here would put
    // a second author on that contract.
    obra: obraMissing ? null : ((obraRes.data as ReceptionObra | null) ?? null),
    obraEstado: obraMissing ? 'migracion_pendiente' : 'ok',
  }

  return NextResponse.json(payload)
}
