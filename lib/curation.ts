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
  const λ = decayLambda(item, now)
  return hp0 * Math.exp(-λ * Δt)
}

// ── Category normalization ───────────────────────────────────────────────────
// Proper spec uses rolling-90d p90. For the prototype with mock data, we
// approximate with the current max HP observed per type. This is enough to
// show relative sizing; swap for real p90 when Supabase + history exist.

export type PeakByType = Record<ContentType, number>

export function computePeakByType(items: ContentItem[], now: Date = new Date()): PeakByType {
  const peaks: PeakByType = {
    evento: 1, mix: 1, editorial: 1, review: 1, noticia: 1, opinion: 1, articulo: 1, partner: 1,
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

export function prominence(
  item: ContentItem,
  peaks: PeakByType,
  now: Date = new Date(),
): number {
  return 0.5 * freshness(item, now) + 0.5 * score(item, peaks, now) + imminenceBonus(item, now)
}

// ── Size tier from score ─────────────────────────────────────────────────────

export type CardTier = 'sm' | 'md' | 'lg'

export interface CardLayout {
  tier: CardTier
  colSpan: 1 | 2 | 3
  rowSpan: 1 | 2
  intensity: number
}

export function cardLayout(
  item: ContentItem,
  peaks: PeakByType,
  now: Date = new Date(),
): CardLayout {
  const s = score(item, peaks, now)
  if (s >= 1.0) return { tier: 'lg', colSpan: 2, rowSpan: 2, intensity: Math.min(1, s - 1.0) }
  if (s >= 0.5) return { tier: 'md', colSpan: 2, rowSpan: 1, intensity: (s - 0.5) / 0.5 }
  return { tier: 'sm', colSpan: 1, rowSpan: 1, intensity: s / 0.5 }
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

export function rankItems(
  items: ContentItem[],
  now: Date = new Date(),
): RankedItem[] {
  const peaks = computePeakByType(items, now)
  return items
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
}
