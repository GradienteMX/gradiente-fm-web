/**
 * CENTRAL — the numbers.
 *
 * Pure functions over the world; nothing here touches React or the DOM.
 * Every figure traces back to one of three records:
 *
 *   · the item ledger   (`HpLedgerRow`: click/open/save/comment, admin_adjust,
 *                        harvest — exact, with the applied weight)
 *   · the presence ledger (`PresenceRow`: what creators received)
 *   · each piece's HL snapshot (`hp` + `hpLastUpdatedAt`), read only through
 *     `currentHp` — the one copy of the decay ladder. No second copy lives here.
 *
 * Where the record cannot say something, the functions return what IS known
 * and say where knowledge starts. Nothing is invented to fill a gap.
 */

import type { ContentItem, ContentType, FranjaKind, HpLedgerRow, PresenceRow } from '@/lib/types'
import {
  currentHp,
  rankItems,
  spawnHp,
  TYPE_SCORE_MULTIPLIER,
  type CardTier,
  type HpDecayParts,
  type RankedItem,
} from '@/lib/curation'
import { composeHome } from '@/lib/logic/feed'
import { KIND_WEIGHTS, type ReaderKind } from '@/lib/store/world-core'

export const HOUR = 3_600_000
export const DAY = 24 * HOUR

// ── formatting (es-MX, true minus) ──────────────────────────────────────────

const nfCache = new Map<number, Intl.NumberFormat>()
function nf(d: number): Intl.NumberFormat {
  let f = nfCache.get(d)
  if (!f) {
    f = new Intl.NumberFormat('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d })
    nfCache.set(d, f)
  }
  return f
}

const tiny = (v: number, d: number) => Math.abs(v) < 0.5 * 10 ** -d

/** A plain number; negatives carry a true minus. */
export function num(v: number, d = 1): string {
  if (tiny(v, d)) return nf(d).format(0)
  return (v < 0 ? '−' : '') + nf(d).format(Math.abs(v))
}

/** Explicit sign — a delta that drops its «+» reads as a total. */
export function signed(v: number, d = 1): string {
  if (tiny(v, d)) return nf(d).format(0)
  return (v > 0 ? '+' : '−') + nf(d).format(Math.abs(v))
}

export function int(v: number): string {
  return nf(0).format(v)
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTHS_UP = MONTHS.map((m) => m.toUpperCase())

/** «23 sep» */
export function dayLabel(ms: number): string {
  const d = new Date(ms)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** «23 sep · 14:05» */
export function stamp(ms: number): string {
  const d = new Date(ms)
  return `${dayLabel(ms)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** «23 sep 2026» */
export function dateLong(ms: number): string {
  return `${dayLabel(ms)} ${new Date(ms).getFullYear()}`
}

/** «SEP 2026» — the issue line printed on an invitation. */
export function issueLine(ms: number): string {
  const d = new Date(ms)
  return `${MONTHS_UP[d.getMonth()]} ${d.getFullYear()}`
}

// ── days ────────────────────────────────────────────────────────────────────

/**
 * Local-midnight boundaries for a window of `days`, the last one being now
 * (today is a partial day). Length = days + 1.
 */
export function dayBounds(days: number, nowMs: number): number[] {
  const today = new Date(nowMs)
  today.setHours(0, 0, 0, 0)
  const out: number[] = []
  for (let i = days - 1; i >= 0; i--) {
    const s = new Date(today)
    s.setDate(s.getDate() - i)
    out.push(s.getTime())
  }
  out.push(nowMs)
  return out
}

/** Index k with bounds[k] < t ≤ bounds[k+1], or −1 outside the window. */
export function bucketOf(bounds: number[], t: number): number {
  const last = bounds.length - 1
  if (t <= bounds[0] || t > bounds[last]) return -1
  let lo = 0
  let hi = last
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (bounds[mid] < t) lo = mid
    else hi = mid
  }
  return lo
}

// ── ledger indexes ──────────────────────────────────────────────────────────

export function ledgerByItem(ledger: HpLedgerRow[]): Map<string, HpLedgerRow[]> {
  const m = new Map<string, HpLedgerRow[]>()
  for (const r of ledger) {
    const list = m.get(r.itemId)
    if (list) list.push(r)
    else m.set(r.itemId, [r])
  }
  for (const list of m.values()) list.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  return m
}

export const READER_KINDS: ReaderKind[] = ['click', 'open', 'save', 'comment']

export const KIND_LABEL: Record<HpLedgerRow['kind'], string> = {
  click: 'Clic',
  open: 'Apertura',
  save: 'Guardado',
  comment: 'Comentario',
  admin_adjust: 'Ajuste admin',
  harvest: 'Cosecha',
}

export function isReaderKind(k: HpLedgerRow['kind']): k is ReaderKind {
  return k in KIND_WEIGHTS
}

// ── HL trajectories ─────────────────────────────────────────────────────────
//
// An item's HL is a lazily-decayed snapshot: (hp, anchor). Each ledger row
// records exactly one re-anchoring — the reducer decays to the event, adds
// the applied weight, and re-anchors there. Walking the rows backwards from
// the snapshot therefore reconstructs the whole trajectory exactly:
//
//     value just before event e   = value after e − applied weight
//     value after the previous e′ = that ÷ decay factor over (e′, e]
//
// The walk stops at the first row. Before it, the piece either sat on its
// spawn curve since birth (checkable: the pre-event value must equal the
// spawn curve there) or on a seed snapshot the record never saw. In the
// second case knowledge starts at that first row — or at the snapshot's own
// anchor when there are no rows at all — and anything earlier is only bounded
// from below by the untouched spawn curve.

export interface Anchor {
  t: number
  iso: string
  h: number
  mult: number
}

export interface Jump {
  t: number
  pre: number
  post: number
  kind: HpLedgerRow['kind']
  /** What was asked for (base weight; for admin_adjust, the requested delta). */
  base: number
  note?: string
}

export interface Traj {
  birth: number
  /** Knowledge starts here. Before it: the spawn curve (a lower bound). */
  known: number
  anchors: Anchor[]
  jumps: Jump[]
  /** HL the piece carries the instant it is born (spawn, or its snapshot). */
  birthJump: number
  /** Gains whose timing the record never saw, landing at `known`. */
  unknownJump: number
}

function parts(item: ContentItem, hp: number | undefined, anchorIso: string | undefined, mult: number): HpDecayParts {
  return {
    type: item.type,
    publishedAt: item.publishedAt,
    editorial: item.editorial,
    date: item.date,
    endDate: item.endDate,
    hp,
    hpLastUpdatedAt: anchorIso,
    hpDecayMultiplier: mult,
  }
}

function spawnCurve(item: ContentItem, t: number, birth: number): number {
  if (t < birth) return 0
  return currentHp(parts(item, undefined, undefined, 1), new Date(t))
}

function factor(item: ContentItem, fromIso: string, fromMs: number, toMs: number, mult: number): number {
  if (toMs <= fromMs) return 1
  return currentHp(parts(item, 1, fromIso, mult), new Date(toMs))
}

function anchorValue(item: ContentItem, a: Anchor, t: number): number {
  return currentHp(parts(item, a.h, a.iso, a.mult), new Date(t))
}

export function buildTraj(item: ContentItem, rows: HpLedgerRow[] | undefined): Traj {
  const birth = Date.parse(item.publishedAt)
  const spawn = spawnHp(item)
  const anchorIso = item.hpLastUpdatedAt ?? item.publishedAt
  const anchorT = Date.parse(anchorIso)
  let cur: Anchor = { t: anchorT, iso: anchorIso, h: item.hp ?? spawn, mult: item.hpDecayMultiplier ?? 1 }
  const anchors: Anchor[] = [cur]
  const jumps: Jump[] = []

  // Only rows of this incarnation: the newest one must be the current anchor
  // (a piece deleted and re-published under the same id starts over).
  let rs = rows ?? []
  if (rs.length && Math.abs(Date.parse(rs[rs.length - 1].at) - anchorT) > 1) rs = []

  const finish = (known: number, unknownJump: number): Traj => {
    let k = known
    let u = unknownJump
    if (k < birth) {
      // A snapshot anchored before the piece existed: knowledge starts at birth.
      k = birth
      u = 0
    }
    const first = anchors[0]
    const birthJump = k === birth ? (first.t <= birth ? anchorValue(item, first, birth) : spawn) : spawn
    return { birth, known: k, anchors, jumps, birthJump, unknownJump: u }
  }

  for (let k = rs.length - 1; k >= 0; k--) {
    const r = rs[k]
    const e = Date.parse(r.at)
    const pre = cur.h - r.weight
    const multBefore = r.kind === 'harvest' ? 1 : cur.mult
    jumps.unshift({ t: e, pre, post: cur.h, kind: r.kind, base: r.baseWeight, note: r.note })
    const prev = rs[k - 1]
    if (prev) {
      const tp = Date.parse(prev.at)
      const f = factor(item, prev.at, tp, e, multBefore)
      cur = { t: tp, iso: prev.at, h: f > 1e-12 ? pre / f : pre, mult: multBefore }
      anchors.unshift(cur)
      continue
    }
    const s = spawnCurve(item, e, birth)
    if (multBefore === 1 && Math.abs(s - pre) <= 1e-6 * Math.max(1, Math.abs(pre))) {
      anchors.unshift({ t: birth, iso: item.publishedAt, h: spawn, mult: 1 })
      return finish(birth, 0)
    }
    return finish(e, pre - s)
  }

  if (Math.abs(anchorT - birth) <= 1 && Math.abs(cur.h - spawn) <= 1e-9 && cur.mult === 1) return finish(birth, 0)
  return finish(anchorT, cur.h - spawnCurve(item, anchorT, birth))
}

/** HL at each (ascending) instant, following the reconstructed trajectory. */
export function sampleAsc(item: ContentItem, tr: Traj, times: number[]): number[] {
  const out = new Array<number>(times.length)
  let ai = 0
  for (let k = 0; k < times.length; k++) {
    const t = times[k]
    if (t < tr.birth) {
      out[k] = 0
      continue
    }
    if (t < tr.known) {
      out[k] = spawnCurve(item, t, tr.birth)
      continue
    }
    while (ai + 1 < tr.anchors.length && tr.anchors[ai + 1].t <= t) ai++
    out[k] = anchorValue(item, tr.anchors[ai], t)
  }
  return out
}

function jumpsWithin(tr: Traj, a: number, b: number): number {
  let J = 0
  if (tr.birth > a && tr.birth <= b) J += tr.birthJump
  if (tr.known > tr.birth && tr.known > a && tr.known <= b) J += tr.unknownJump
  for (const j of tr.jumps) if (j.t > a && j.t <= b) J += j.post - j.pre
  return J
}

/** HL lost to decay in (a, b]: what was there, plus what arrived, minus what is left. */
export function decayBetween(item: ContentItem, tr: Traj, a: number, b: number): number {
  const [va, vb] = sampleAsc(item, tr, [a, b])
  return Math.max(0, va + jumpsWithin(tr, a, b) - vb)
}

/**
 * Decay per day across the corpus, in two parts that are never blended:
 *   exact — what the model computes along each piece's known trajectory;
 *   bound — before knowledge starts, the decay of the untouched spawn curve,
 *           a floor under what really happened (touches only ever add HL).
 */
export function decaySeries(items: ContentItem[], trajs: Map<string, Traj>, bounds: number[]): { exact: number[]; bound: number[] } {
  const D = bounds.length - 1
  const exact = new Array<number>(D).fill(0)
  const bound = new Array<number>(D).fill(0)
  for (const it of items) {
    const tr = trajs.get(it.id)
    if (!tr || tr.birth >= bounds[D]) continue
    const vs = sampleAsc(it, tr, bounds)
    const spawn = spawnHp(it)
    const jumpsIn = (a: number, b: number) => {
      let J = 0
      for (const j of tr.jumps) if (j.t > a && j.t <= b) J += j.post - j.pre
      return J
    }
    for (let k = 0; k < D; k++) {
      const a = bounds[k]
      const b = bounds[k + 1]
      if (b <= tr.birth) continue
      const born = tr.birth > a ? spawn : 0
      if (tr.known <= a) {
        const d = vs[k] + jumpsIn(a, b) - vs[k + 1]
        if (d > 0) exact[k] += d
      } else if (tr.known > b) {
        const d = vs[k] + born - vs[k + 1]
        if (d > 0) bound[k] += d
      } else {
        const [vKnown] = sampleAsc(it, tr, [tr.known])
        const sKnown = spawnCurve(it, tr.known, tr.birth)
        const d0 = vs[k] + (tr.birth > a && tr.birth <= tr.known ? spawn : 0) - sKnown
        const d1 = vKnown + jumpsIn(tr.known, b) - vs[k + 1]
        if (d0 > 0) bound[k] += d0
        if (d1 > 0) exact[k] += d1
      }
    }
  }
  return { exact, bound }
}

/**
 * Points for a sparkline over [from, to]: regular samples on the known part,
 * plus a before/after pair at every ledger jump so an interaction reads as a
 * step. The line begins where the record begins — never earlier.
 */
export function trajectoryPoints(item: ContentItem, tr: Traj, from: number, to: number, step: number): Array<[number, number]> {
  const start = Math.max(from, tr.known, tr.birth)
  if (start >= to) return []
  const times: number[] = []
  for (let t = start; t < to; t += step) times.push(t)
  times.push(to)
  const inside = tr.jumps.filter((j) => j.t >= start && j.t <= to)
  for (const j of inside) times.push(j.t)
  times.sort((a, b) => a - b)
  const uniq = times.filter((t, i) => i === 0 || t !== times[i - 1])
  const vals = sampleAsc(item, tr, uniq)
  const pts: Array<[number, number]> = []
  let ji = 0
  for (let i = 0; i < uniq.length; i++) {
    const t = uniq[i]
    while (ji < inside.length && inside[ji].t < t) ji++
    if (ji < inside.length && inside[ji].t === t) {
      // one or more jumps at this instant: the value before the first, then after
      pts.push([t, inside[ji].pre])
      while (ji < inside.length && inside[ji].t === t) ji++
    }
    pts.push([t, vals[i]])
  }
  return pts
}

/**
 * Before knowledge starts: the untouched spawn curve, a floor under what
 * really happened. Drawn dashed, never joined to the known line.
 */
export function floorPoints(item: ContentItem, tr: Traj, from: number, to: number, step: number): Array<[number, number]> {
  const a = Math.max(from, tr.birth)
  const b = Math.min(to, tr.known)
  if (b - a < step / 4) return []
  const times: number[] = []
  for (let t = a; t < b; t += step) times.push(t)
  times.push(b)
  return times.map((t) => [t, spawnCurve(item, t, tr.birth)] as [number, number])
}

// ── the field (what is in front of someone) ─────────────────────────────────

export type FeedWhere = 'mosaico' | 'portada' | 'pulso' | 'archivo' | 'franja'

export const WHERE_LABEL: Record<FeedWhere, string> = {
  mosaico: 'En el mosaico',
  portada: 'En portada',
  pulso: 'En el pulso',
  archivo: 'Archivo',
  franja: 'Franja',
}

export interface FeedModel {
  grid: ContentItem[]
  where: Map<string, FeedWhere>
}

/** The home as composed right now, with the horizon wide open (0–10). */
export function feedModel(items: ContentItem[], now: Date): FeedModel {
  const comp = composeHome(items, now)
  const where = new Map<string, FeedWhere>()
  for (const it of items) where.set(it.id, it.type === 'franja' ? 'franja' : 'archivo')
  for (const it of comp.railEvents) where.set(it.id, 'pulso')
  for (const it of comp.portada) where.set(it.id, 'portada')
  for (const it of comp.gridItems) where.set(it.id, 'mosaico')
  return { grid: comp.gridItems, where }
}

export function rankGrid(grid: ContentItem[], now: Date, override?: { id: string; hp: number }): RankedItem[] {
  if (!override) return rankItems(grid, now)
  const iso = now.toISOString()
  return rankItems(
    grid.map((i) => (i.id === override.id ? { ...i, hp: override.hp, hpLastUpdatedAt: iso } : i)),
    now,
  )
}

export const TIER_LABEL: Record<CardTier, string> = {
  sm: 'SM · 1×1',
  md: 'MD · media',
  lg: 'LG · 2×2',
  xl: 'XL · 3×2',
}

/**
 * Deltas that would carry a piece to a size threshold inside its type
 * (score = HL ÷ type peak × type multiplier; md at 0.5, lg at 1.0). `null`
 * when the threshold is out of reach for the type. Rank caps still apply
 * after this — the projection, not the preset, says what actually renders.
 */
export function presetDeltas(grid: ContentItem[], now: Date, item: ContentItem, hlNow: number) {
  let peakOthers = 1
  for (const g of grid) {
    if (g.type !== item.type || g.id === item.id) continue
    const v = currentHp(g, now)
    if (v > peakOthers) peakOthers = v
  }
  const mult = TYPE_SCORE_MULTIPLIER[item.type] ?? 1
  const toReach = (f: number): number | null => {
    const needed = (f * peakOthers) / mult
    const target = needed <= peakOthers ? needed : mult >= f ? peakOthers * 1.02 : null
    if (target === null) return null
    return Math.max(0, Math.ceil((target - hlNow + 0.05) * 100) / 100)
  }
  const plainEvent = item.type === 'evento' && !item.editorial && !item.elevated
  return {
    peakOthers,
    mult,
    md: toReach(0.5),
    lg: plainEvent ? null : toReach(1.0),
    cima: hlNow > peakOthers ? 0 : Math.ceil((peakOthers * 1.02 - hlNow + 0.05) * 100) / 100,
  }
}

/**
 * Where each ranked cell lands in a 3-column `grid-auto-flow: dense` grid —
 * the same placement the Organismo gets from CSS (every item searches from
 * the start; anchored items keep their column). Used by the lever's maqueta.
 */
export interface Placed {
  id: string
  row: number
  col: number
  cs: number
  rs: number
  tier: CardTier
}

export function packDense(ranked: RankedItem[], cols = 3): Placed[] {
  const taken: boolean[][] = []
  const free = (r: number, c: number, cs: number, rs: number) => {
    if (c < 0 || c + cs > cols) return false
    for (let y = r; y < r + rs; y++) for (let x = c; x < c + cs; x++) if (taken[y]?.[x]) return false
    return true
  }
  const mark = (r: number, c: number, cs: number, rs: number) => {
    for (let y = r; y < r + rs; y++) {
      taken[y] ??= []
      for (let x = c; x < c + cs; x++) taken[y][x] = true
    }
  }
  const out: Placed[] = []
  for (const rk of ranked) {
    const cs = Math.min(cols, rk.layout.colSpan)
    const rs = rk.layout.rowSpan
    const anchor = rk.layout.colStart && rk.layout.colStart - 1 + cs <= cols ? rk.layout.colStart - 1 : null
    let placed: { r: number; c: number } | null = null
    for (let r = 0; !placed && r < 4000; r++) {
      if (anchor !== null) {
        if (free(r, anchor, cs, rs)) placed = { r, c: anchor }
      } else {
        for (let c = 0; c + cs <= cols; c++)
          if (free(r, c, cs, rs)) {
            placed = { r, c }
            break
          }
      }
    }
    if (!placed) continue
    mark(placed.r, placed.c, cs, rs)
    out.push({ id: rk.item.id, row: placed.r, col: placed.c, cs, rs, tier: rk.tier })
  }
  return out
}

// ── overview (RESUMEN) ──────────────────────────────────────────────────────

export interface KindRow {
  kind: ReaderKind
  rows: number
  base: number
  sumBase: number
  sumApplied: number
  /** Σ applied ÷ Σ base — the average novelty multiplier. Shown only here. */
  novelty: number | null
}

export interface KindTable {
  readers: KindRow[]
  total: { rows: number; sumBase: number; sumApplied: number; novelty: number | null }
  adjust: { rows: number; sum: number }
  harvest: { rows: number; sum: number }
}

export function kindTable(rows: HpLedgerRow[]): KindTable {
  const readers: KindRow[] = READER_KINDS.map((kind) => ({ kind, rows: 0, base: KIND_WEIGHTS[kind], sumBase: 0, sumApplied: 0, novelty: null }))
  const adjust = { rows: 0, sum: 0 }
  const harvest = { rows: 0, sum: 0 }
  for (const r of rows) {
    if (isReaderKind(r.kind)) {
      const k = readers[READER_KINDS.indexOf(r.kind)]
      k.rows++
      k.sumBase += r.baseWeight
      k.sumApplied += r.weight
    } else if (r.kind === 'admin_adjust') {
      adjust.rows++
      adjust.sum += r.weight
    } else if (r.kind === 'harvest') {
      harvest.rows++
      harvest.sum += r.weight
    }
  }
  for (const k of readers) k.novelty = k.sumBase > 0 ? k.sumApplied / k.sumBase : null
  const total = readers.reduce(
    (t, k) => ({ rows: t.rows + k.rows, sumBase: t.sumBase + k.sumBase, sumApplied: t.sumApplied + k.sumApplied, novelty: null as number | null }),
    { rows: 0, sumBase: 0, sumApplied: 0, novelty: null as number | null },
  )
  total.novelty = total.sumBase > 0 ? total.sumApplied / total.sumBase : null
  return { readers, total, adjust, harvest }
}

export function rowsWithin<T extends { at: string }>(rows: T[], from: number, to: number): T[] {
  return rows.filter((r) => {
    const t = Date.parse(r.at)
    return t > from && t <= to
  })
}

export function perDay<T extends { at: string }>(rows: T[], bounds: number[], value: (r: T) => number): number[] {
  const out = new Array<number>(bounds.length - 1).fill(0)
  for (const r of rows) {
    const k = bucketOf(bounds, Date.parse(r.at))
    if (k >= 0) out[k] += value(r)
  }
  return out
}

export function presenceIn(rows: PresenceRow[], from: number, to: number): number {
  let s = 0
  for (const r of rows) {
    const t = Date.parse(r.at)
    if (t > from && t <= to) s += r.weight
  }
  return s
}

// ── franjas ─────────────────────────────────────────────────────────────────

export const FRANJA_KINDS: FranjaKind[] = ['label', 'promoter', 'venue', 'club', 'colectivo', 'festival', 'dealer', 'medios', 'mix-series', 'plataforma']

export const FRANJA_KIND_LABEL: Record<FranjaKind, string> = {
  label: 'Sello',
  promoter: 'Promotora',
  venue: 'Venue',
  dealer: 'Dealer',
  colectivo: 'Colectivo',
  festival: 'Festival',
  club: 'Club',
  medios: 'Medio',
  'mix-series': 'Serie de mixes',
  plataforma: 'Plataforma',
}

// ── formats ─────────────────────────────────────────────────────────────────

export const CONTENT_TYPES: ContentType[] = ['evento', 'mix', 'noticia', 'review', 'editorial', 'opinion', 'articulo', 'listicle']

/** Accent- and case-insensitive containment. */
export function matches(hay: string | undefined | null, needle: string): boolean {
  if (!needle) return true
  if (!hay) return false
  const f = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return f(hay).includes(f(needle))
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
