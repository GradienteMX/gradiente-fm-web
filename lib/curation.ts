// Curation model — size + position ranking driven by HP half-life decay.
// See EspectroObsidian/Espectro/02 - Features/Curation Model.md for the full spec.
//
// Design constraints (hard):
//   - Only size and position are visible ranking signals.
//   - No per-user logs; HP lives on the item as an aggregate scalar.
//   - Editorial toggle is the only editor lever (raises spawn HP).

import { parseISO } from 'date-fns'
import type { ContentItem, ContentType } from './types'

// ── Tunables ─────────────────────────────────────────────────────────────────

const SPAWN_HP_DEFAULT = 20
const SPAWN_HP_EDITORIAL = 50

// Attention half-life — how long HP takes to halve without interaction
const ATTENTION_HALF_LIFE_HOURS: Record<ContentType, number> = {
  evento: 72,
  mix: 21 * 24,
  editorial: 7 * 24,
  review: 14 * 24,
  noticia: 48,
  opinion: 10 * 24,
  articulo: 14 * 24,
  listicle: 14 * 24,
  partner: 365 * 24, // partners don't decay — rail orders chronologically
}

// Freshness half-life — decays position independent of HP
const FRESHNESS_HALF_LIFE_HOURS: Record<ContentType, number> = {
  evento: 14 * 24,
  mix: 30 * 24,
  editorial: 10 * 24,
  review: 21 * 24,
  noticia: 3 * 24,
  opinion: 14 * 24,
  articulo: 21 * 24,
  listicle: 21 * 24,
  partner: 365 * 24,
}

// ── Basics ───────────────────────────────────────────────────────────────────

export function spawnHp(item: ContentItem): number {
  return item.editorial ? SPAWN_HP_EDITORIAL : SPAWN_HP_DEFAULT
}

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 36e5
}

function lambdaFromHalfLife(halfLifeHours: number): number {
  return Math.LN2 / halfLifeHours
}

// ── Decay λ, with event imminence modulation ─────────────────────────────────

function decayLambda(item: ContentItem, now: Date): number {
  const base = lambdaFromHalfLife(ATTENTION_HALF_LIFE_HOURS[item.type])
  if (item.type !== 'evento' || !item.date) return base

  const eventStart = parseISO(item.date)
  const eventEnd = item.endDate ? parseISO(item.endDate) : eventStart
  const hoursUntilStart = hoursBetween(now, eventStart)
  const hoursPastEnd = hoursBetween(eventEnd, now)

  // Live window: from 1h before doors to 1h after end — decay paused
  if (hoursUntilStart <= 1 && hoursPastEnd <= 1) return 0

  // Approaching the event (within 7 days): slow decay quadratically
  if (hoursUntilStart > 0 && hoursUntilStart < 7 * 24) {
    const daysUntil = hoursUntilStart / 24
    return base * Math.pow(daysUntil / 7, 2)
  }

  // More than 30 days past: accelerate decay — archival fade
  if (hoursPastEnd > 30 * 24) return base * 2

  return base
}

// ── Current HP (lazy decay from stored snapshot) ─────────────────────────────

export function currentHp(item: ContentItem, now: Date = new Date()): number {
  const hp0 = item.hp ?? spawnHp(item)
  const lastUpdated = parseISO(item.hpLastUpdatedAt ?? item.publishedAt)
  const Δt = Math.max(0, hoursBetween(lastUpdated, now))
  if (Δt === 0) return hp0
  // Per-item decay multiplier — set to 1.7 on harvested items so they fade
  // faster than non-harvested peers. Mirrored in apply_hp_rollup() (0022)
  // so the cron tick and the read-side stay in sync.
  const multiplier = item.hpDecayMultiplier ?? 1.0
  const λ = decayLambda(item, now) * multiplier
  return hp0 * Math.exp(-λ * Δt)
}

// ── Category normalization ───────────────────────────────────────────────────
// Proper spec uses rolling-90d p90. For the prototype with mock data, we
// approximate with the current max HP observed per type. This is enough to
// show relative sizing; swap for real p90 when Supabase + history exist.

export type PeakByType = Record<ContentType, number>

export function computePeakByType(items: ContentItem[], now: Date = new Date()): PeakByType {
  const peaks: PeakByType = {
    evento: 1, mix: 1, editorial: 1, review: 1, noticia: 1, opinion: 1, articulo: 1, listicle: 1, partner: 1,
  }
  for (const item of items) {
    const hp = currentHp(item, now)
    if (hp > peaks[item.type]) peaks[item.type] = hp
  }
  return peaks
}

// ── Per-type score multipliers ────────────────────────────────────────────────
// Constants, not per-item knobs. Corrects cross-type dominance in sort order:
// events win top positions via imminence; these priors re-balance longtail types.
const TYPE_SCORE_MULTIPLIER: Partial<Record<ContentType, number>> = {
  review:    1.3,
  opinion:   1.2,
  editorial: 1.1,
  articulo:  1.3,
  listicle:  1.3,
  noticia:   0.8,
}

// ── Score, freshness, prominence ─────────────────────────────────────────────

export function score(item: ContentItem, peaks: PeakByType, now: Date = new Date()): number {
  const hp = currentHp(item, now)
  const base = hp / Math.max(peaks[item.type], 1)
  return base * (TYPE_SCORE_MULTIPLIER[item.type] ?? 1.0)
}

export function freshness(item: ContentItem, now: Date = new Date()): number {
  const published = parseISO(item.publishedAt)
  const ageHours = Math.max(0, hoursBetween(published, now))
  const λ = lambdaFromHalfLife(FRESHNESS_HALF_LIFE_HOURS[item.type])
  return Math.exp(-λ * ageHours)
}

function imminenceBonus(item: ContentItem, now: Date = new Date()): number {
  if (item.type !== 'evento' || !item.date) return 0
  const start = parseISO(item.date)
  const end = item.endDate ? parseISO(item.endDate) : start
  const hoursUntilStart = hoursBetween(now, start)
  const hoursPastEnd = hoursBetween(end, now)

  // Live window: between 1h pre-doors and 1h post-end
  if (hoursUntilStart <= 1 && hoursPastEnd <= 1) return 1.0
  // Within 24h before doors
  if (hoursUntilStart > 0 && hoursUntilStart <= 24) return 0.5
  return 0
}

// Past/upcoming bias for eventos. Two-sided so the home feed reads as
// "upcoming first, then everything else, then archive" without users seeing
// review/mix/articulo cards pushed above tonight's party.
//
//   - Upcoming eventos get a flat +0.6 lift, putting them above non-event
//     content (which sits in the 0.5–1.0 prominence band thanks to the
//     review/articulo/listicle 1.3× type multipliers).
//   - Past eventos take -1.0 — they live in the mosaic as filler / archive,
//     but always rank below upcoming items. Recent-past still beats
//     old-past via HP+freshness, just at the bottom of the page.
function eventTimingAdjustment(item: ContentItem, now: Date = new Date()): number {
  if (item.type !== 'evento' || !item.date) return 0
  const end = item.endDate ? parseISO(item.endDate) : parseISO(item.date)
  return hoursBetween(end, now) > 0 ? -1.0 : 0.6
}

export function prominence(
  item: ContentItem,
  peaks: PeakByType,
  now: Date = new Date(),
): number {
  return (
    0.5 * freshness(item, now) +
    0.5 * score(item, peaks, now) +
    imminenceBonus(item, now) +
    eventTimingAdjustment(item, now)
  )
}

// ── Size tier from score ─────────────────────────────────────────────────────

export type CardTier = 'sm' | 'md' | 'lg' | 'xl'

export interface CardLayout {
  tier: CardTier
  colSpan: 1 | 2 | 3
  rowSpan: 1 | 2
  // Explicit column anchor (1-indexed). When set, the cell is pinned to that
  // column; when undefined, dense-flow places it. Used by rankItems to
  // alternate lg cards between left (col 1) and right (col 2) anchors so the
  // wide emphasis cards don't all gravitate to the same side.
  colStart?: 1 | 2 | 3
  intensity: number
}

// Lever 1 — `md` tier gets per-type geometry so the grid stops collapsing to
// wide-left / thin-right. Text-heavy types render as tall 1×2 portraits;
// visual types stay as wide 2×1 landscapes.
const MD_GEOMETRY: Record<ContentItem['type'], { colSpan: 1 | 2; rowSpan: 1 | 2 }> = {
  // Text-heavy → tall portrait (slots into column 3 alongside wide neighbors)
  review:    { colSpan: 1, rowSpan: 2 },
  articulo:  { colSpan: 1, rowSpan: 2 },
  listicle:  { colSpan: 1, rowSpan: 2 },
  editorial: { colSpan: 1, rowSpan: 2 },
  opinion:   { colSpan: 1, rowSpan: 2 },
  noticia:   { colSpan: 1, rowSpan: 2 },
  // Events stay a 1×1 square at md — a plain listing shouldn't become a big
  // horizontal bar just from spawn HP. Popular (editorial/elevated) events still
  // earn a 2×2 via the lg path below; everything else reads as a compact tile.
  evento:    { colSpan: 1, rowSpan: 1 },
  // Visual → wide landscape (flyer / cover art reads better at width)
  mix:       { colSpan: 2, rowSpan: 1 },
  partner:   { colSpan: 2, rowSpan: 1 },
}

// Thresholds back to original 1.0 / 0.5 — `rankItems` applies rank-aware caps
// on top of these (top-1 lg-qualifying item gets promoted to xl 3×2; the next
// few stay lg with alternating anchors; the rest demote to md).
const LG_THRESHOLD = 1.0
const MD_THRESHOLD = 0.5

export function cardLayout(
  item: ContentItem,
  peaks: PeakByType,
  now: Date = new Date(),
): CardLayout {
  const s = score(item, peaks, now)
  if (s >= LG_THRESHOLD) {
    return { tier: 'lg', colSpan: 2, rowSpan: 2, intensity: Math.min(1, s - LG_THRESHOLD) }
  }
  if (s >= MD_THRESHOLD) {
    const geom = MD_GEOMETRY[item.type]
    return {
      tier: 'md',
      colSpan: geom.colSpan,
      rowSpan: geom.rowSpan,
      intensity: (s - MD_THRESHOLD) / (LG_THRESHOLD - MD_THRESHOLD),
    }
  }
  return { tier: 'sm', colSpan: 1, rowSpan: 1, intensity: s / MD_THRESHOLD }
}

export function sizeForScore(s: number): CardTier {
  if (s >= 1.0) return 'lg'
  if (s >= 0.5) return 'md'
  return 'sm'
}

// ── Sort + enrich helpers ────────────────────────────────────────────────────

export interface RankedItem {
  item: ContentItem
  score: number
  prominence: number
  tier: CardTier
  layout: CardLayout
}

// Rank-aware tier caps applied after sorting. Without these, every fresh
// text-heavy item lands in `lg` (because their type multiplier × observed-max
// normalization keeps their score above 1.0), producing a tower of 2×2 cards
// down the left side. Caps:
//
//   - Top-1 lg-qualifying item → promoted to xl (3×2 full-width feature).
//   - Next MAX_LG items → stay lg (2×2), with colStart alternating between
//     col 1 (left) and col 2 (right) so emphasis distributes across the grid.
//   - Further lg-qualifying items → demoted to md (per-type geometry from
//     MD_GEOMETRY: 1×2 tall for text, 2×1 wide for visual).
const MAX_LG = 3

export function rankItems(
  items: ContentItem[],
  now: Date = new Date(),
): RankedItem[] {
  const peaks = computePeakByType(items, now)
  const ranked: RankedItem[] = items
    .map((item) => {
      const s = score(item, peaks, now)
      const layout = cardLayout(item, peaks, now)
      return {
        item,
        score: s,
        prominence: prominence(item, peaks, now),
        tier: layout.tier,
        layout,
      }
    })
    .sort((a, b) => b.prominence - a.prominence)

  let xlAssigned = false
  let lgAssigned = 0
  for (const r of ranked) {
    if (r.layout.tier !== 'lg') continue

    // Events earn a big cell only by curator intent (editorial/elevated). A
    // freshly-created event sits at its type's HP peak and would otherwise grab
    // an lg/xl slot purely from spawn HP — which floods the home with big
    // horizontal event bars. Plain events drop to md (a 1×1 square).
    if (r.item.type === 'evento' && !r.item.editorial && !r.item.elevated) {
      const geom = MD_GEOMETRY['evento']
      r.layout = { tier: 'md', colSpan: geom.colSpan, rowSpan: geom.rowSpan, intensity: 1 }
      r.tier = 'md'
      continue
    }

    if (!xlAssigned) {
      r.layout = { tier: 'xl', colSpan: 3, rowSpan: 2, colStart: 1, intensity: 1 }
      r.tier = 'xl'
      xlAssigned = true
      continue
    }

    if (lgAssigned < MAX_LG) {
      // Alternate anchor: even index left (col 1), odd index right (col 2).
      r.layout = { ...r.layout, colStart: lgAssigned % 2 === 0 ? 1 : 2 }
      lgAssigned++
      continue
    }

    // Excess lg → demote to md using per-type geometry.
    const geom = MD_GEOMETRY[r.item.type]
    r.layout = {
      tier: 'md',
      colSpan: geom.colSpan,
      rowSpan: geom.rowSpan,
      intensity: 1,
    }
    r.tier = 'md'
  }

  // Lever — break clustering without losing the macro "big at top, small at
  // bottom" gradient. Two-step:
  //
  //   1. Pull sm cards forward by gradient distribution. The k-th sm of N
  //      lands at the position where the cumulative sm fraction hits
  //      ((p+1)/total)^K. K > 1 biases the curve toward the end (more sm
  //      at the bottom) while still sprinkling sm through the middle, so
  //      the page never ends in a wall of squares.
  //   2. After the sm/big weave settles, sweep the big-items zone to break
  //      runs of same-shape mdT/mdW neighbors via local swaps.
  //
  // Shape key includes colStart so lg-left / lg-right alternation counts
  // as variety (a run of [lg-L, lg-R, lg-L] isn't treated as a run).
  const shapeKey = (r: RankedItem) =>
    `${r.layout.colSpan}x${r.layout.rowSpan}-${r.layout.colStart ?? 'flow'}`

  const TOP_KEEP = Math.min(ranked.length, 4) // xl + lg cluster stays intact
  const top = ranked.slice(0, TOP_KEEP)
  const rest = ranked.slice(TOP_KEEP)
  const restBig = rest.filter((r) => r.layout.tier !== 'sm')
  const restSm = rest.filter((r) => r.layout.tier === 'sm')

  let weaved: RankedItem[]
  if (restSm.length > 0 && restBig.length > 0) {
    const restTotal = restBig.length + restSm.length
    const K = 1.5 // gradient exponent — higher = more end-loaded
    const targetSmAt = (p: number) =>
      Math.pow((p + 1) / restTotal, K) * restSm.length

    weaved = []
    let bigIdx = 0
    let smIdx = 0
    for (let p = 0; p < restTotal; p++) {
      if (smIdx < targetSmAt(p) && smIdx < restSm.length) {
        weaved.push(restSm[smIdx++])
      } else if (bigIdx < restBig.length) {
        weaved.push(restBig[bigIdx++])
      } else if (smIdx < restSm.length) {
        weaved.push(restSm[smIdx++])
      }
    }
  } else {
    weaved = rest
  }

  const out = [...top, ...weaved]

  // Pass 2 — break mdT/mdW runs inside the big zone. Forward swap with a
  // small max-pass cap; backward fallback rescues edges.
  const MAX_RUN = 2
  const MAX_PASSES = 4
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false
    for (let i = MAX_RUN; i < out.length; i++) {
      const k = shapeKey(out[i])
      let isRun = true
      for (let w = 1; w <= MAX_RUN; w++) {
        if (shapeKey(out[i - w]) !== k) {
          isRun = false
          break
        }
      }
      if (!isRun) continue
      let j = -1
      for (let f = i + 1; f < out.length; f++) {
        if (shapeKey(out[f]) !== k) {
          j = f
          break
        }
      }
      if (j === -1) {
        // Backward fallback — but never below TOP_KEEP, which is the
        // prominence-anchored top cluster (xl + first few lg/upcoming
        // events). Without this floor, a long run of same-shape items at
        // the end of `weaved` would swap with the xl card at idx 0 and
        // drag the most-prominent item deep into the list. Observed when
        // the //EVENTO filter shows 1 upcoming + 115 past sm cards: the
        // upcoming xl got swapped to idx 113.
        for (let b = i - MAX_RUN - 1; b >= TOP_KEEP; b--) {
          if (shapeKey(out[b]) !== k) {
            j = b
            break
          }
        }
      }
      if (j === -1) continue
      const tmp = out[i]
      out[i] = out[j]
      out[j] = tmp
      changed = true
    }
    if (!changed) break
  }

  // Lever 3 — tail variety. Past the big zone the feed decays to a wall of
  // identical 1×1 sm squares (HP scores fall below MD_THRESHOLD, so every
  // remaining item is sm). That reads as a spreadsheet, not a mosaic. Walk
  // the sm tail and promote roughly every SM_BEAT-th card to an md cell,
  // alternating wide (2×1) and tall (1×2) so the page keeps a "one big, many
  // small" rhythm to the very bottom. Deterministic (index-driven, no random),
  // so the layout is identical for every viewer — No-Algorithm holds. We honor
  // a type's natural orientation when it's strong (visual → wide, text → tall)
  // but force alternation when the tail is monotype (e.g. all events) so we
  // don't get a column of identical wide bars.
  // Two drivers, so the tail is alive instead of a static grid of squares:
  //
  //   a. ACTIVITY — `layout.intensity` is the sub-threshold score (0→1: how
  //      close this sm item is to crossing into md). Items with real activity
  //      that simply haven't accrued enough HP to jump a full tier still grow:
  //      above ACTIVE_HI they go wide (2×1, "this is moving"); above ACTIVE_LO
  //      they go tall (1×2, "this has some pull"). Because intensity tracks the
  //      live HP/freshness, these change as the cron tick + realtime re-rank
  //      flow in — the same card breathes between sm → tall → wide over its
  //      life. Deterministic per snapshot (same data → same layout for all
  //      viewers): No-Algorithm holds.
  //   b. RHYTHM — even a dead-quiet tail (all intensities low, e.g. an
  //      all-past-events archive) gets a promotion every SM_BEAT-th card,
  //      alternating orientation, so the page never decays to a wall of 1×1s.
  const ACTIVE_HI = 0.66
  const ACTIVE_LO = 0.4
  // Hard variety guarantees:
  //   - MAX_SM_RUN: never let this many 1×1 squares pass in a row without a
  //     bigger cell breaking them up. ~3 cols/row, so 5 ≈ never three full
  //     lines of squares. Tighter inside the first FOCUS_COUNT items where the
  //     eye actually lingers.
  //   - SHAPE_CYCLE: when we force a break (or hit the activity bands), we pull
  //     the next shape from a rotating cycle so the structure keeps shifting
  //     instead of repeating the same md over and over. Includes the 2×2 lg for
  //     the occasional big punch in the mid-feed.
  const FOCUS_COUNT = 50
  const SHAPE_CYCLE: { tier: CardTier; colSpan: 1 | 2; rowSpan: 1 | 2 }[] = [
    { tier: 'md', colSpan: 2, rowSpan: 1 }, // wide
    { tier: 'md', colSpan: 1, rowSpan: 2 }, // tall
    { tier: 'md', colSpan: 2, rowSpan: 1 }, // wide
    { tier: 'lg', colSpan: 2, rowSpan: 2 }, // big punch
    { tier: 'md', colSpan: 1, rowSpan: 2 }, // tall
  ]
  // Anchor columns a shape can sit in (3-col grid). Rotating colStart per shape
  // means two identical cells never stack in the same column — so the eye never
  // sees more than ~2 identical rows in the same place before the unit shifts.
  const ANCHORS: Record<string, (1 | 2 | 3)[]> = {
    '2x1': [1, 2],    // wide bar → left or center
    '1x2': [1, 2, 3], // tall column → any of three
    '2x2': [1, 2],    // big punch → left or right block
  }
  const anchorIdx: Record<string, number> = { '2x1': 0, '1x2': 0, '2x2': 0 }
  const nextColStart = (colSpan: number, rowSpan: number): 1 | 2 | 3 => {
    const key = `${colSpan}x${rowSpan}`
    const cols = ANCHORS[key] ?? [1]
    const c = cols[anchorIdx[key] % cols.length]
    anchorIdx[key] = (anchorIdx[key] ?? 0) + 1
    return c
  }

  let cycleIdx = 0
  let smRun = 0
  for (let i = TOP_KEEP; i < out.length; i++) {
    const r = out[i]
    if (r.layout.tier !== 'sm') {
      smRun = 0
      continue
    }

    const activity = r.layout.intensity
    const maxRun = i < FOCUS_COUNT ? 4 : 6
    let shape: { tier: CardTier; colSpan: 1 | 2; rowSpan: 1 | 2 } | null = null

    if (activity >= ACTIVE_HI) {
      shape = { tier: 'md', colSpan: 2, rowSpan: 1 } // hot → horizontal
    } else if (activity >= ACTIVE_LO) {
      shape = { tier: 'md', colSpan: 1, rowSpan: 2 } // warm → vertical
    } else if (smRun >= maxRun) {
      // Run got too long — force a break, pulling the next shape from the
      // rotating cycle so consecutive breaks don't look identical.
      shape = SHAPE_CYCLE[cycleIdx % SHAPE_CYCLE.length]
      cycleIdx++
    }

    if (!shape) {
      smRun++
      continue
    }

    r.layout = {
      tier: shape.tier,
      colSpan: shape.colSpan,
      rowSpan: shape.rowSpan,
      colStart: nextColStart(shape.colSpan, shape.rowSpan),
      intensity: r.layout.intensity,
    }
    r.tier = shape.tier
    smRun = 0
  }

  return out
}

// ── Agenda ranking — democratic mosaic ───────────────────────────────────────
//
// The /agenda surface is NOT the HP-prominence mosaic. Its job is a dense,
// fully-packed wall of events read in chronological order, with a rich mix of
// shapes (wide, tall, square, the occasional big block). HP is deliberately
// almost ignored here — the listing is democratic — with ONE exception: a
// genuinely hot event (HP at/above its type peak) earns a big 2×2 so the truly
// popular nights still pop.
//
// Ordering: upcoming first (soonest → furthest), past at the bottom (most
// recent → oldest). Shapes come from a rotating palette weighted toward squares
// so dense auto-flow fills cleanly, with run-breaking so no shape repeats
// back-to-back. It's deterministic per snapshot (No-Algorithm holds) yet shifts
// naturally day to day: as events pass, draw closer, and gain/lose HP, both the
// chronological index and the hot-event set move — so the wall re-tiles itself.
const AGENDA_PALETTE: { tier: CardTier; colSpan: 1 | 2; rowSpan: 1 | 2 }[] = [
  { tier: 'sm', colSpan: 1, rowSpan: 1 }, // square
  { tier: 'md', colSpan: 2, rowSpan: 1 }, // wide
  { tier: 'sm', colSpan: 1, rowSpan: 1 }, // square
  { tier: 'md', colSpan: 1, rowSpan: 2 }, // tall
  { tier: 'md', colSpan: 2, rowSpan: 1 }, // wide
  { tier: 'sm', colSpan: 1, rowSpan: 1 }, // square
  { tier: 'md', colSpan: 1, rowSpan: 2 }, // tall
]

export function rankAgenda(
  items: ContentItem[],
  now: Date = new Date(),
): RankedItem[] {
  const peaks = computePeakByType(items, now)
  const nowMs = now.getTime()

  const sorted: RankedItem[] = items
    .map((item) => ({
      item,
      score: score(item, peaks, now),
      prominence: prominence(item, peaks, now),
      tier: 'sm' as CardTier,
      layout: { tier: 'sm', colSpan: 1, rowSpan: 1, intensity: 0 } as CardLayout,
    }))
    .sort((a, b) => {
      const ta = parseISO(a.item.date ?? a.item.publishedAt).getTime()
      const tb = parseISO(b.item.date ?? b.item.publishedAt).getTime()
      const aPast = ta < nowMs ? 1 : 0
      const bPast = tb < nowMs ? 1 : 0
      // Upcoming block first (soonest → furthest); past block last
      // (most-recent → oldest).
      if (aPast !== bPast) return aPast - bPast
      if (aPast) return tb - ta
      if (ta !== tb) return ta - tb
      return b.prominence - a.prominence
    })

  const keyOf = (s: { colSpan: number; rowSpan: number }) =>
    `${s.colSpan}x${s.rowSpan}`
  let prevKey = ''
  let p = 0
  for (const r of sorted) {
    // Hot-event exception: HP at/above the type peak → big 2×2 block.
    if (r.score >= LG_THRESHOLD) {
      r.layout = { tier: 'lg', colSpan: 2, rowSpan: 2, intensity: 1 }
      r.tier = 'lg'
      prevKey = '2x2'
      continue
    }
    let shape = AGENDA_PALETTE[p % AGENDA_PALETTE.length]
    if (keyOf(shape) === prevKey) {
      p++
      shape = AGENDA_PALETTE[p % AGENDA_PALETTE.length]
    }
    p++
    r.layout = {
      tier: shape.tier,
      colSpan: shape.colSpan,
      rowSpan: shape.rowSpan,
      intensity: 0,
    }
    r.tier = shape.tier
    prevKey = keyOf(shape)
  }

  return sorted
}
