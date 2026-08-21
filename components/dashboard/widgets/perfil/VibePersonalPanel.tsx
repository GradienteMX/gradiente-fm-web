'use client'

// ── VIBE PERSONAL — the black panel inside PERFIL (FINAL_SPEC §3.8) ─────────
//
// Rendered ONLY from the user's own vibe_checks rows (provider slice
// `vibeSelf` — the WP0-C RLS probe VALIDATED, so the panel ships). This is
// one of the three widget-borne black panels in the closed R5 inventory;
// PerfilWidget mats it in ≥20px cream so it never touches a widget edge.
//
// Framing (a) per §1.6: inside a black panel the VIBE_SLOT_COLORS ramp keeps
// its dark calibration — lit slots at full hue, unlit slots at the low-alpha
// unlit-LED idiom from components/VibeMeter.tsx. Words-only law (R9): the
// readout is the median band's WORDS via vibeRangeLabel + the check count —
// a numeric vibe scalar never renders.
//
// Small-N honesty: below VIBE_CHECK_THRESHOLD (5) own checks the plate stays
// unlit and the panel declares «SEÑAL INSUFICIENTE · N/5 CHECKS» — prod
// reality is that this is the common case today (max 9 checks per user).

import type { VibeSelfCheck } from '@/components/dashboard/DashboardDataProvider'
import { VIBE_CHECK_THRESHOLD, VIBE_SLOT_COLORS, vibeRangeLabel } from '@/lib/utils'

// Matches VibeMeter's unlit-LED alpha ('33' ≈ 20%) — dim enough to read
// unlit, bright enough to keep each slot's hue on the ink panel.
const UNLIT_ALPHA = '33'

export interface VibePersonalPanelProps {
  checks: VibeSelfCheck[]
  // Provider slice flags — render honest loading/error, never fake data.
  loaded: boolean
  error: boolean
}

function median(sortedAsc: number[]): number {
  const n = sortedAsc.length
  const mid = Math.floor(n / 2)
  return n % 2 === 1 ? sortedAsc[mid] : (sortedAsc[mid - 1] + sortedAsc[mid]) / 2
}

// Median band across the user's own checks: median of the lows, median of
// the highs — the same aggregation shape the crowd rollup uses per item.
function medianBand(checks: VibeSelfCheck[]): [number, number] {
  const lows = checks.map((c) => c.vibeMin).sort((a, b) => a - b)
  const highs = checks.map((c) => c.vibeMax).sort((a, b) => a - b)
  const lo = Math.max(0, Math.min(10, Math.round(median(lows))))
  const hi = Math.max(0, Math.min(10, Math.round(median(highs))))
  return lo <= hi ? [lo, hi] : [hi, lo]
}

export function VibePersonalPanel({ checks, loaded, error }: VibePersonalPanelProps) {
  const count = checks.length
  const enough = count >= VIBE_CHECK_THRESHOLD
  const band = enough ? medianBand(checks) : null
  const words = band ? vibeRangeLabel({ vibeMin: band[0], vibeMax: band[1] }) : null

  return (
    <div className="flex flex-col gap-3 border border-ink bg-panel p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-d11 font-bold uppercase tracking-widest text-panel-text">
          {'// VIBE PERSONAL'}
        </span>
        {count > 0 && (
          <span className="font-mono text-d11 tracking-widest text-panel-text tabular-nums">
            {count} {count === 1 ? 'CHECK' : 'CHECKS'}
          </span>
        )}
      </div>

      {!loaded && !error && count === 0 ? (
        // §2.6 loading — one hairline shimmer, never a spinner.
        <div aria-hidden className="h-0.5 w-1/2 bg-panel-text motion-safe:animate-blink" />
      ) : error && count === 0 ? (
        <p className="font-mono text-d13 text-panel-text">
          SEÑAL INTERRUMPIDA — se reintenta al volver.
        </p>
      ) : (
        <>
          {/* The calibrated plate: full ramp always renders; only the median
              band lights, and only at threshold. */}
          <div
            role="img"
            aria-label={words ? `VIBE · ${words}` : 'VIBE · SIN SEÑAL SUFICIENTE'}
            className="flex h-2.5 w-full gap-px"
          >
            {VIBE_SLOT_COLORS.map((color, slot) => {
              const lit = band !== null && slot >= band[0] && slot <= band[1]
              return (
                <span
                  key={slot}
                  className="min-w-0 flex-1"
                  style={{ backgroundColor: lit ? color : `${color}${UNLIT_ALPHA}` }}
                />
              )
            })}
          </div>

          {enough && words ? (
            <div className="flex items-baseline justify-between gap-3">
              {/* Acid on panel — sanctioned framing; words only, never a numeral. */}
              <span className="font-mono text-d13 font-bold uppercase tracking-widest text-acid">
                {words}
              </span>
              <span className="font-mono text-d11 tracking-widest text-panel-text">
                MEDIANA DE TUS CHECKS
              </span>
            </div>
          ) : (
            <p className="font-mono text-d13 text-panel-text">
              SEÑAL INSUFICIENTE · {count}/{VIBE_CHECK_THRESHOLD} CHECKS
            </p>
          )}
        </>
      )}
    </div>
  )
}
