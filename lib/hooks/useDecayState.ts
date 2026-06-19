'use client'

// ── HP DEATH RITUAL — mortality readout (WAVE 2) ─────────────────────────────
//
// Card size is the only ranking signal; this makes the END of an item's life a
// visible, DATA-TRUE event. We read the item's live HP via currentHp (the same
// lazy-decay function the grid sorts by — see lib/curation.ts) and map the
// bottom of the HP range to a `mortality` scalar in 0..1 where 1 = about to
// die. The treatment (DecayState) is a pure data readout: no RNG, no per-card
// canvas (Safari context cap), CSS only.
//
// Honesty rules:
//   - mortality is derived ONLY from currentHp(item, now). Same input the
//     ranker uses, so what you SEE (erosion) and what you GET (small + low)
//     agree.
//   - It must NOT fire on fresh or healthy items — only the dying tail below
//     DYING_THRESHOLD. Above the threshold mortality is exactly 0 and the
//     consumer renders nothing.
//   - Eventos that have already ended are excluded: /agenda + the home grid
//     already desaturate past eventos (MosaicItem isPast / ContentCard `past`).
//     Layering erosion on top of that double-treats and reads ugly. A past
//     evento's "death" is its date passing, which the existing //PASADO chrome
//     already narrates — the erosion ritual is for items dying of NEGLECT
//     (HP decay), not of the calendar.

import { useEffect, useMemo, useState } from 'react'
import { currentHp } from '@/lib/curation'
import { isExpired } from '@/lib/utils'
import type { ContentItem } from '@/lib/types'

// ── Tunables ─────────────────────────────────────────────────────────────────

/** Absolute HP at/below which an item enters the dying tail. Spawn HP is 20
 *  (default) / 50 (editorial) and decays exponentially; by the time an item is
 *  under ~3 HP it is deep in the longtail — score normalization keeps it a
 *  `sm` card destined to drop out of the feed. Below this the erosion treatment
 *  begins (subtly) and intensifies toward DEAD_HP. */
export const DYING_THRESHOLD = 3

/** HP at/below which mortality saturates to 1.0 ("about to die"). Items rarely
 *  reach exactly 0 (exp decay never hits zero), so we clamp the floor here. */
export const DEAD_HP = 0.4

/** Partners never decay (ATTENTION_HALF_LIFE 365d, chronological rail) — they
 *  must never erode. Excluded by type below. */

// ── Mortality math ────────────────────────────────────────────────────────────

/**
 * Pure mortality from live HP. 0 above the dying threshold (healthy/fresh),
 * ramping to 1 at DEAD_HP. Eased (quadratic) so the bottom of the tail erodes
 * conspicuously while the entry into the tail stays subtle — the visual weight
 * tracks "how close to gone", not raw HP.
 *
 * Returns 0 (→ no treatment) for partners and already-past eventos.
 */
export function computeMortality(item: ContentItem, now: Date): number {
  if (item.type === 'partner') return 0
  // Past eventos already carry the //PASADO desaturate treatment — don't
  // double up. Their end is the calendar, not neglect.
  if (item.type === 'evento' && isExpired(item, now)) return 0

  const hp = currentHp(item, now)
  if (hp >= DYING_THRESHOLD) return 0
  if (hp <= DEAD_HP) return 1

  // Linear position in the dying band, then eased toward the dead end.
  const linear = (DYING_THRESHOLD - hp) / (DYING_THRESHOLD - DEAD_HP)
  return clamp01(linear * linear)
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export interface DecayState {
  /** 0..1, 1 = about to die. 0 means "render no treatment". */
  mortality: number
  /** True once mortality crosses the floor where the treatment is perceptible.
   *  The consumer can skip rendering the overlay entirely when false (zero DOM
   *  for the overwhelming majority of healthy cards). */
  isDying: boolean
  /** prefers-reduced-motion — erosion itself is a static readout regardless,
   *  but the dissolve EXIT must be instant when true. */
  reducedMotion: boolean
}

// Below this mortality the erosion is imperceptible; skip the overlay to keep
// the DOM clean and avoid any compositor cost on the healthy majority.
const VISIBLE_FLOOR = 0.04

/**
 * Live decay readout for a card. `now` is captured once on mount (a single
 * fresh Date) — the home feed re-mounts/re-ranks on its own cadence, and a
 * per-card ticking clock would be churn for a value that moves on the scale of
 * hours/days. Honest enough: mortality reflects the HP at render time, the same
 * instant the ranker used to size the card.
 */
export function useDecayState(item: ContentItem): DecayState {
  // One fresh `now` per mount. useMemo (not useState init) so it's stable
  // across re-renders without an extra state slot.
  const now = useMemo(() => new Date(), [])
  const mortality = useMemo(() => computeMortality(item, now), [item, now])

  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return {
    mortality,
    isDying: mortality > VISIBLE_FLOOR,
    reducedMotion,
  }
}
