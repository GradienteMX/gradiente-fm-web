'use client'

// ── VibeMeterLight — the §1.6(b) light-ground vibe framing ──────────────────
//
// The 11-slot calibrated plate rendered on cream. VIBE_SLOT_COLORS was
// calibrated for #0D0D0D, so on paper every slot cell gets a 1px ink outline:
// unlit slots render outline-only (paper shows through), lit slots keep their
// hue but SHAPE + OUTLINE carry the information — the hue is redundant, so
// all 11 slots stay individually distinguishable on light ground.
//
// Words-only law (R9): the accessible name and any adjacent label use the
// VIBE_SLOT_NAMES vocabulary via vibeRangeLabel — a numeric vibe scalar never
// renders. VIBE_SLOT_COLORS is imported from lib/utils (READ-ONLY, triple-copy
// lockstep) and never altered here.

import { VIBE_SLOT_COLORS, vibeRangeLabel, clsx } from '@/lib/utils'

export interface VibeMeterLightProps {
  // Inclusive integer band [lo, hi] in slot space 0–10 (pass the output of
  // effectiveVibeBand or a self-median). null = calibrated plate, nothing lit.
  band: [number, number] | null
  className?: string
}

export function VibeMeterLight({ band, className }: VibeMeterLightProps) {
  const lo =
    band === null ? null : Math.max(0, Math.min(10, Math.round(Math.min(band[0], band[1]))))
  const hi =
    band === null ? null : Math.max(0, Math.min(10, Math.round(Math.max(band[0], band[1]))))
  const label =
    lo !== null && hi !== null
      ? `VIBE · ${vibeRangeLabel({ vibeMin: lo, vibeMax: hi })}`
      : 'VIBE · SIN SEÑAL'

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={clsx('flex h-3 w-full gap-0.5', className)}
    >
      {VIBE_SLOT_COLORS.map((color, slot) => {
        const lit = lo !== null && hi !== null && slot >= lo && slot <= hi
        return (
          <span
            key={slot}
            className="min-w-0 flex-1 border border-ink"
            style={{ backgroundColor: lit ? color : 'transparent' }}
          />
        )
      })}
    </div>
  )
}
