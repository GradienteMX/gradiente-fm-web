'use client'

import { useVibePrior } from '@/lib/hooks/useVibePrior'

// Suggest-and-apply vibe prior (Vibe Philosophy idea #3). A small, non-destructive
// suggestion that sits next to VibeField and updates live as the author picks
// genres / venue. Clicking APLICAR sets the range; the author's input is never
// silently overwritten. Renders NOTHING when there's no history — it never fakes
// a suggestion (honors the no-decorative-chrome rule).
export function VibePriorHint({
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

  const alreadyApplied = currentMin === prior.vibeMin && currentMax === prior.vibeMax

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px]" style={{ color: '#FBBF24' }}>
      <span style={{ opacity: 0.6 }}>≈ SUGERIDO</span>
      <span style={{ fontWeight: 700 }}>
        {prior.vibeMin}–{prior.vibeMax}
      </span>
      <span style={{ opacity: 0.5 }}>
        · {prior.basis} · {prior.sampleCount} {prior.sampleCount === 1 ? 'pieza' : 'piezas'}
      </span>
      {alreadyApplied ? (
        <span style={{ opacity: 0.5 }}>· ✓ aplicado</span>
      ) : (
        <button
          type="button"
          onClick={() => onApply(prior.vibeMin, prior.vibeMax)}
          className="border px-1.5 py-0.5 uppercase tracking-wider transition-opacity hover:opacity-80"
          style={{ borderColor: 'rgba(251,191,36,0.5)' }}
        >
          Aplicar
        </button>
      )}
    </div>
  )
}
