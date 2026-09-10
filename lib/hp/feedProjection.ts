import { TYPE_SCORE_MULTIPLIER, sizeForScore, type CardTier } from '@/lib/curation'

// ── Feed projection for the HL lever ─────────────────────────────────────────
//
// The mosaic sizes a card by `score = currentHp / (max currentHp of the same
// type on the page) × TYPE_SCORE_MULTIPLIER`, tiered at 0.5 (md) and 1.0 (lg)
// — see lib/curation.ts. So "how much HL does it take to matter" is a question
// about the TYPE'S PEAK, not an absolute number. These helpers turn a peak plus
// a delta into what the operator will actually see, and back.
//
// `peakOthers` is the highest live HL among the OTHER published items of the
// type. When the item itself climbs above it, the item becomes the peak and its
// score is simply the multiplier.

export const TIER_FRACTION: Record<Exclude<CardTier, 'sm' | 'xl'>, number> = { md: 0.5, lg: 1.0 }

export function typeMultiplier(type: string): number {
  return TYPE_SCORE_MULTIPLIER[type as keyof typeof TYPE_SCORE_MULTIPLIER] ?? 1.0
}

export function feedScore(hp: number, peakOthers: number, multiplier: number): number {
  const peak = Math.max(peakOthers, hp, 1)
  return (hp / peak) * multiplier
}

export function feedTier(hp: number, peakOthers: number, multiplier: number): CardTier {
  return sizeForScore(feedScore(hp, peakOthers, multiplier))
}

// Minimal live HL at which the item reaches `tier`, or null when the tier is
// unreachable for the type (a noticia at 0.8× can top its type and still read
// md — that is the curation model, not the lever).
export function hpToReachTier(tier: 'md' | 'lg', peakOthers: number, multiplier: number): number | null {
  const f = TIER_FRACTION[tier]
  const peak = Math.max(peakOthers, 1)
  const needed = (f * peak) / multiplier
  if (needed <= peak) return needed
  return multiplier >= f ? peak * 1.02 : null
}

// Positive delta that lands the item at `tier` (plus a hair so rounding on the
// server side cannot leave it one hundredth short). 0 when already there.
export function deltaToReachTier(
  tier: 'md' | 'lg',
  currentHp: number,
  peakOthers: number,
  multiplier: number,
): number | null {
  const target = hpToReachTier(tier, peakOthers, multiplier)
  if (target === null) return null
  return Math.max(0, Math.ceil((target - currentHp + 0.05) * 100) / 100)
}
