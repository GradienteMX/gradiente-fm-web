'use client'

// ── VibePriorHintL — suggest-and-apply vibe prior, pliego register ──────────
//
// Logic ported verbatim from the dark VibePriorHint
// (components/dashboard/forms/shared/VibePriorHint.tsx — untouched): the
// useVibePrior consumer updates live as the author picks genres/venue,
// APLICAR sets the range, and the component renders NOTHING when there is
// no history — it never fakes a suggestion (no-decorative-chrome rule).
// Only the skin changes: ink-on-paper mono d11 instead of amber-on-dark.

import { useVibePrior } from '@/lib/hooks/useVibePrior'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

export function VibePriorHintL({
  genres,
  venue,
  currentMin,
  currentMax,
  onApply,
}: {
  genres: string[]
  venue?: string | null
  currentMin: number
  currentMax: number
  onApply: (min: number, max: number) => void
}) {
  const { prior } = useVibePrior({ genres, venue })
  if (!prior) return null

  const alreadyApplied =
    currentMin === prior.vibeMin && currentMax === prior.vibeMax

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-d11 text-ink-soft">
      <span className="text-ink-faint">≈ SUGERIDO</span>
      <span className="font-bold tabular-nums text-ink">
        {prior.vibeMin}–{prior.vibeMax}
      </span>
      <span className="text-ink-faint">
        · {prior.basis} · {prior.sampleCount}{' '}
        {prior.sampleCount === 1 ? 'pieza' : 'piezas'}
      </span>
      {alreadyApplied ? (
        <span className="text-ink-faint">· ✓ aplicado</span>
      ) : (
        <button
          type="button"
          onClick={() => onApply(prior.vibeMin, prior.vibeMax)}
          // Real ≥44px touch / ≥36px desktop target (min-h + px padding) —
          // no pseudo-halo trickery needed once the box itself is legal.
          className={`flex min-h-11 items-center border border-ink px-3 font-bold uppercase tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
        >
          Aplicar
        </button>
      )}
    </div>
  )
}
