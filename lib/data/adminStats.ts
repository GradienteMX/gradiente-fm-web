import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { currentHp, type HpDecayParts } from '@/lib/curation'
import { hlBracket } from '@/lib/dashboard/hl'
import {
  KIND_WEIGHTS,
  KIND_LABELS,
  KIND_CODES,
  KIND_ON_LIGHT,
  HP_EVENT_KINDS,
  LEDGER_EPOCH,
  type HpEventKind,
} from '@/lib/hp/kinds'
import { bucketByDay, dayKey, dayRange, round } from '@/lib/dashboard/scale'
import type { ContentType } from '@/lib/types'

// ── RESUMEN — the aggregate reads behind the overview tab ───────────────────
//
// Every number here is measured. Where a number CANNOT be measured, this
// module returns null and the UI states the absence — it never substitutes an
// estimate that looks like a reading. That rule is what makes the panel worth
// trusting during calibration, which is the whole point of building it.
//
// Two hard limits it reports on itself:
//
//   1. The item-side ledger starts at LEDGER_EPOCH (migration 0049). Before
//      that apply_hp_rollup DELETED every hp_events row it folded, so no
//      per-kind history exists — ~2,110 events were destroyed. A 30-day window
//      opened the week the migration lands is mostly pre-history, and
//      `ledger.coveredFrom` says exactly how much of it is real.
//   2. `decaimiento` covers only items that received an event in the same tick,
//      because those are the only rows the rollup re-anchors. Gains and that
//      decay sum to the true net change in items.hp, which is what the net line
//      means — but it is not corpus-wide decay and is never labelled as such.
//
// Aggregation happens in Node over ~600 item rows rather than in Postgres
// because HP is a LAZILY-DECAYED snapshot: items.hp is only correct as of
// hp_last_updated_at, so any SUM(hp) in SQL would add up numbers of different
// ages. currentHp() is the only correct reading and it lives in TypeScript.

/** Columns needed to decay an item to now. Mirrors HpDecayParts. */
const HP_COLUMNS =
  'id, type, hp, hp_last_updated_at, published_at, editorial, hp_decay_multiplier, date, end_date, published, title, slug, seed'

interface HpRow {
  id: string
  type: ContentType
  hp: number | null
  hp_last_updated_at: string | null
  published_at: string
  editorial: boolean | null
  hp_decay_multiplier: number | null
  date: string | null
  end_date: string | null
  published: boolean
  title: string
  slug: string
  seed: boolean | null
}

function toParts(row: HpRow): HpDecayParts {
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

export interface InteractionRow {
  key: string
  label: string
  code: string
  color: string
  nominal?: number
  weight: number
  count: number | null
}

export interface AttentionItem {
  key: string
  count: number
  label: string
  /** Where the admin goes to act. null = nothing to open (count is 0). */
  href: string | null
  action: string
  /** true when the row is a live problem rather than routine work. */
  urgent: boolean
}

export interface AdminOverview {
  window: { days: number; from: string; to: string }
  ledger: {
    epoch: string
    /** First day of the window that the ledger actually covers, or null if none. */
    coveredFrom: string | null
    /** Days of the requested window with no possible data. */
    blindDays: number
  }
  kpis: {
    hlActivo: number
    hlGanado: number | null
    hpCreadores: number
    interacciones: number | null
    contenidoActivo: number
  }
  flujo: {
    days: string[]
    hlGanado: number[]
    hpCreadores: number[]
    decaimiento: number[]
    neto: number[]
    markers: { index: number; label: string }[]
  }
  interacciones: InteractionRow[]
  atencion: AttentionItem[]
  rollup: { pending: number; lastProcessedAt: string | null; stale: boolean }
}

export async function getAdminOverview(days = 30): Promise<AdminOverview> {
  const supabase = createClient()
  const now = new Date()
  const from = new Date(now.getTime() - (days - 1) * 86_400_000)
  const fromIso = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())).toISOString()

  const [itemsRes, ledgerRes, userHpRes, pendingRes] = await Promise.all([
    supabase.from('items').select(HP_COLUMNS),
    // The ledger. Admins can read hp_events directly — hp_events_admin_read has
    // existed since 0002 and had no consumer until now.
    supabase
      .from('hp_events')
      .select('item_id, kind, weight, base_weight, created_at, processed_at')
      .gte('created_at', fromIso)
      .order('created_at', { ascending: true }),
    // user_hp_events IS retained (0020) and readable by admins
    // (user_hp_events_admin_read), so the creator-side series has real history
    // going back to May — unlike the item side.
    supabase
      .from('user_hp_events')
      .select('kind, weight, created_at')
      .gte('created_at', fromIso),
    supabase
      .from('hp_events')
      .select('id', { count: 'exact', head: true })
      .is('processed_at', null),
  ])

  const items = (itemsRes.data as HpRow[] | null) ?? []
  const ledger = (ledgerRes.data as LedgerRow[] | null) ?? []
  const userHp = (userHpRes.data as { kind: string; weight: number; created_at: string }[] | null) ?? []

  // ── KPI: HL activo ────────────────────────────────────────────────────────
  // Franjas are excluded: their 365-day half-life means they never decay and
  // would dominate a "living HL" figure with what is really just rail
  // furniture. Unpublished and seed rows are excluded for the same reason —
  // they are not in front of anyone.
  const live = items.filter((r) => r.published && r.type !== 'franja')
  const hlActivo = live.reduce((sum, r) => sum + currentHp(toParts(r), now), 0)

  // ── The day axis ──────────────────────────────────────────────────────────
  const dayKeys = dayRange(from, now)
  const epochIndex = dayKeys.findIndex((d) => d >= LEDGER_EPOCH)
  const coveredFrom = epochIndex >= 0 ? dayKeys[epochIndex] : null
  const blindDays = epochIndex < 0 ? dayKeys.length : epochIndex

  const readerRows = ledger.filter((e) => (HP_EVENT_KINDS as string[]).includes(e.kind))
  const decayRows = ledger.filter((e) => e.kind === 'decay')
  const adjustRows = ledger.filter((e) => e.kind === 'admin_adjust')

  const hlGanado = bucketByDay(readerRows, (r) => r.created_at, (r) => r.weight, from, now)
  const decaimiento = bucketByDay(decayRows, (r) => r.created_at, (r) => Math.abs(r.weight), from, now)
  const hpCreadores = bucketByDay(userHp, (r) => r.created_at, (r) => r.weight, from, now)

  // Net = what actually happened to items.hp: gains minus the decay recorded
  // alongside them, plus any admin injection. Injections are folded into the
  // net line (they DID move the feed) but never into hlGanado, which means
  // organic reach and must stay uncontaminated.
  const adjust = bucketByDay(adjustRows, (r) => r.created_at, (r) => r.weight, from, now)
  const neto = hlGanado.map((g, i) => round(g.value - decaimiento[i].value + adjust[i].value, 2))

  // Markers: real events with doors inside the window. The mockup's dotted
  // verticals are these — never evenly-spaced decoration.
  const markers = items
    .filter((r) => r.type === 'evento' && r.published && r.date)
    .map((r) => ({ day: (r.date as string).slice(0, 10), label: r.title }))
    .map((m) => ({ index: dayKeys.indexOf(m.day), label: m.label }))
    .filter((m) => m.index >= 0)
    // A 30-day window at current volume can hold 100+ events; a vertical rule
    // per event is a hatch pattern, not information. Cap at one per day.
    .filter((m, i, arr) => arr.findIndex((o) => o.index === m.index) === i)

  // ── INTERACCIONES → HL ────────────────────────────────────────────────────
  const interacciones: InteractionRow[] = HP_EVENT_KINDS.map((kind: HpEventKind) => {
    const rows = readerRows.filter((e) => e.kind === kind)
    // Count events by base_weight presence, NOT by weight / nominal: weight is
    // already novelty-scaled (x 0.6-1.5) so that division is wrong by up to
    // half. Rows written before 0049 have no base_weight and are uncountable.
    const countable = rows.filter((r) => r.base_weight !== null)
    return {
      key: kind,
      label: KIND_LABELS[kind],
      code: KIND_CODES[kind],
      color: KIND_ON_LIGHT[kind],
      nominal: KIND_WEIGHTS[kind],
      weight: round(rows.reduce((a, r) => a + r.weight, 0), 1),
      count: countable.length === rows.length ? countable.length : null,
    }
  })

  const totalGanado = round(hlGanado.reduce((a, d) => a + d.value, 0), 1)
  const totalInteracciones = interacciones.every((r) => r.count !== null)
    ? interacciones.reduce((a, r) => a + (r.count ?? 0), 0)
    : null

  // ── ATENCIÓN ──────────────────────────────────────────────────────────────
  const atencion = await buildAttention(supabase, items, now)

  // ── Rollup health ─────────────────────────────────────────────────────────
  const pending = pendingRes.count ?? 0
  const lastProcessed = ledger
    .filter((e) => e.processed_at)
    .map((e) => e.processed_at as string)
    .sort()
    .pop() ?? null
  // pg_cron runs every 5 min. Anything unprocessed for over 15 is two missed
  // ticks and worth a person looking.
  const stale =
    pending > 0 &&
    (!lastProcessed || now.getTime() - new Date(lastProcessed).getTime() > 15 * 60_000)

  return {
    window: { days, from: dayKeys[0], to: dayKeys[dayKeys.length - 1] },
    ledger: { epoch: LEDGER_EPOCH, coveredFrom, blindDays },
    kpis: {
      hlActivo: round(hlActivo, 1),
      hlGanado: blindDays === dayKeys.length ? null : totalGanado,
      hpCreadores: round(userHp.reduce((a, r) => a + r.weight, 0), 1),
      interacciones: totalInteracciones,
      contenidoActivo: live.length,
    },
    flujo: {
      days: dayKeys,
      hlGanado: hlGanado.map((d) => round(d.value, 2)),
      hpCreadores: hpCreadores.map((d) => round(d.value, 2)),
      decaimiento: decaimiento.map((d) => round(d.value, 2)),
      neto,
      markers,
    },
    interacciones,
    atencion,
    rollup: { pending, lastProcessedAt: lastProcessed, stale },
  }
}

interface LedgerRow {
  item_id: string
  kind: string
  weight: number
  base_weight: number | null
  created_at: string
  processed_at: string | null
}

/**
 * The ATENCIÓN queue. Five rows, every count measured, no row invented to fill
 * the panel — a zero renders as a zero and the row goes quiet rather than
 * disappearing, so the operator learns the queue's full shape.
 */
async function buildAttention(
  supabase: ReturnType<typeof createClient>,
  items: HpRow[],
  now: Date,
): Promise<AttentionItem[]> {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)

  // ÍTEMS EN CAÍDA — pieces that dropped an HL bracket over the last week.
  // Both readings decay from the SAME stored anchor, so for an item that was
  // not re-anchored in the window this is exact. For one that WAS re-anchored
  // (it received events) the 7-days-ago figure is a lower bound, which biases
  // toward under-reporting falls — the safe direction for an alert.
  const falling = items.filter((r) => {
    if (!r.published || r.type === 'franja' || r.hp === null) return false
    const parts = toParts(r)
    return hlBracket(currentHp(parts, now)) !== hlBracket(currentHp(parts, weekAgo))
  }).length

  // EVENTOS EN <48H — doors within two days, still published.
  const in48h = items.filter((r) => {
    if (r.type !== 'evento' || !r.published || !r.date) return false
    const t = new Date(r.date).getTime()
    return t > now.getTime() && t < now.getTime() + 48 * 3_600_000
  }).length

  // BORRADORES — the only unpublished rows in the database.
  const drafts = items.filter((r) => !r.published).length

  // REPORTES — reads through the caller's session; reports_read_staff admits
  // mods and admins. Returns 0 (not an error) until migration 0049 is applied,
  // which is the correct degradation: no table, nothing reported.
  let openReports = 0
  const reportsRes = await supabase
    .from('reports' as never)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'abierto')
  openReports = reportsRes.count ?? 0

  return [
    {
      key: 'caida',
      count: falling,
      label: 'ÍTEMS QUE BAJARON DE BANDA (7D)',
      href: falling > 0 ? '/admin?tab=contenido&orden=caida' : null,
      action: 'REVISAR',
      urgent: false,
    },
    {
      key: 'eventos48',
      count: in48h,
      label: 'EVENTOS EN <48H',
      href: in48h > 0 ? '/admin?tab=eventos&filtro=proximos' : null,
      action: 'REVISAR AHORA',
      urgent: in48h > 0,
    },
    {
      key: 'borradores',
      count: drafts,
      label: 'BORRADORES SIN PUBLICAR',
      href: drafts > 0 ? '/admin?tab=contenido&estado=borrador' : null,
      action: 'ABRIR',
      urgent: false,
    },
    {
      key: 'reportes',
      count: openReports,
      label: 'REPORTES ABIERTOS',
      href: openReports > 0 ? '/admin?tab=moderacion' : null,
      action: 'MODERAR',
      urgent: openReports > 0,
    },
  ]
}

export { dayKey }
