'use client'

import { useEffect, useRef } from 'react'
import { vibeToColor, vibeToLabel } from '@/lib/utils'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

// ── VibeFieldL — pliego fork of forms/shared/Fields.tsx VibeField ───────────
//
// The dark original was DELETED in fase F; this fork is the only copy.
// It copies the
// two-thumb drag machine VERBATIM — the commitment gestures are deliberate
// (vibe-check friction is intentional; never simplify to a plain slider) —
// and restyles only the chrome: thermal ramp ticks on paper, ink thumbs,
// ink readout with bordered ramp swatches.
//
// Items express a SPAN (vibeMin <= vibeMax) so authors can capture wide-band
// entities (a label, a venue) AND single-point ones (a peak-time event at
// 8-8). See `project_vibe_range_arc` memory.
//
// Three input affordances:
//   - Drag either thumb (custom pointer handler — mirrors VibeFader so the
//     single-point auto-switch works from a collapsed range)
//   - Click a bar in the spectrum strip to collapse the range to that point
//   - Shift+click a bar to extend the nearer edge to it (quick range expand)
//   - Keyboard: Arrow keys step ±1, Home/End jump to extremes

// Out-of-band tick/track color on cream (the dark original used #242424).
const OFF_TICK = '#D9D6CC'

function RampSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="h-2.5 w-2.5 shrink-0 border border-ink"
      style={{ backgroundColor: color }}
    />
  )
}

export function VibeFieldL({
  valueMin,
  valueMax,
  onChange,
}: {
  valueMin: number
  valueMax: number
  onChange: (min: number, max: number) => void
}) {
  const isPoint = valueMin === valueMax
  const minColor = vibeToColor(valueMin)
  const maxColor = vibeToColor(valueMax)
  const minLabel = vibeToLabel(valueMin)
  const maxLabel = vibeToLabel(valueMax)

  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<'min' | 'max' | null>(null)
  // Mirror current values so the window listener always reads fresh values
  // (closure over props would be stale across drag frames).
  const valuesRef = useRef({ min: valueMin, max: valueMax })
  valuesRef.current = { min: valueMin, max: valueMax }

  // Background gradient between the two thumbs — fills the active band.
  // 11 stops at every integer keep the discrete bucket colors true; outside
  // [min, max] is muted so the active band reads as the highlight.
  const trackBg = (() => {
    const stops = Array.from({ length: 11 }, (_, i) => {
      const inBand = i >= valueMin && i <= valueMax
      const pct = (i / 10) * 100
      return `${inBand ? vibeToColor(i) : OFF_TICK} ${pct}%`
    })
    return `linear-gradient(to right, ${stops.join(', ')})`
  })()

  const valueFromX = (clientX: number): number => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return Math.max(0, Math.min(10, Math.round(ratio * 10)))
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return
      const val = valueFromX(e.clientX)
      const { min: curMin, max: curMax } = valuesRef.current

      // Single-point auto-switch (mirrors VibeFader): when both thumbs sit
      // at the same value, leftward drag flips active to 'min', rightward
      // flips to 'max'. Otherwise the thumb on top of the DOM stack would
      // clamp away the motion.
      if (curMin === curMax) {
        if (val < curMin && draggingRef.current === 'max') {
          draggingRef.current = 'min'
        } else if (val > curMax && draggingRef.current === 'min') {
          draggingRef.current = 'max'
        }
      }

      if (draggingRef.current === 'min') {
        onChange(Math.min(val, curMax), curMax)
      } else {
        onChange(curMin, Math.max(val, curMin))
      }
    }
    const onUp = () => {
      draggingRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [onChange])

  const handleThumbPointerDown =
    (thumb: 'min' | 'max') => (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      draggingRef.current = thumb
    }

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Click on the gradient track (not on a thumb) — start dragging the
    // nearer thumb from the click point. Mirrors the header VibeSlider's
    // track-click behavior.
    e.preventDefault()
    const val = valueFromX(e.clientX)
    const distMin = Math.abs(val - valueMin)
    const distMax = Math.abs(val - valueMax)
    if (distMin <= distMax) {
      draggingRef.current = 'min'
      onChange(Math.min(val, valueMax), valueMax)
    } else {
      draggingRef.current = 'max'
      onChange(valueMin, Math.max(val, valueMin))
    }
  }

  const handleThumbKeyDown =
    (thumb: 'min' | 'max') => (e: React.KeyboardEvent<HTMLButtonElement>) => {
      let delta = 0
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -1
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = 1
      else if (e.key === 'Home') {
        e.preventDefault()
        if (thumb === 'min') onChange(0, valueMax)
        else onChange(valueMin, valueMin)
        return
      } else if (e.key === 'End') {
        e.preventDefault()
        if (thumb === 'min') onChange(valueMax, valueMax)
        else onChange(valueMin, 10)
        return
      } else return
      e.preventDefault()
      if (thumb === 'min') {
        const next = Math.max(0, Math.min(valueMax, valueMin + delta))
        onChange(next, valueMax)
      } else {
        const next = Math.min(10, Math.max(valueMin, valueMax + delta))
        onChange(valueMin, next)
      }
    }

  const handleBarClick = (i: number, shift: boolean) => {
    if (!shift) {
      onChange(i, i)
      return
    }
    // Shift+click: extend nearer edge.
    const distToMin = Math.abs(i - valueMin)
    const distToMax = Math.abs(i - valueMax)
    if (distToMin <= distToMax) onChange(Math.min(i, valueMax), valueMax)
    else onChange(valueMin, Math.max(i, valueMin))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
          VIBE
        </span>
        {isPoint ? (
          <span className="flex items-center gap-1.5 font-mono text-d13 tabular-nums text-ink">
            <RampSwatch color={minColor} />
            {valueMin} · {minLabel}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 font-mono text-d13 tabular-nums text-ink">
            <RampSwatch color={minColor} />
            <span>
              {valueMin} {minLabel}
            </span>
            <span className="text-ink-faint">→</span>
            <RampSwatch color={maxColor} />
            <span>
              {valueMax} {maxLabel}
            </span>
          </span>
        )}
      </div>

      {/* Custom pointer-driven slider. Track catches clicks (drags nearer
          thumb), thumb buttons catch direct pointer-down (drag that thumb),
          window pointermove + pointerup own the drag lifecycle. Mirrors
          VibeFader so the single-point auto-switch works identically.
          44px tall — the drag surface is a first-class input. */}
      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        className="relative h-11 cursor-col-resize touch-none"
      >
        <div
          className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2"
          style={{ background: trackBg }}
        />
        {/* Thumb hit area: the visible button is 24×44 — the ::before halo
            pads it to ≥44×44 (pointer events on the pseudo hit the button,
            so the drag machine's handlers are untouched). */}
        <button
          type="button"
          onPointerDown={handleThumbPointerDown('min')}
          onKeyDown={handleThumbKeyDown('min')}
          aria-label={`vibe mínimo: ${valueMin}`}
          className={`absolute inset-y-0 flex w-6 -translate-x-1/2 cursor-col-resize items-center justify-center bg-transparent before:absolute before:inset-y-0 before:-inset-x-2.5 before:content-[''] ${FOCUS_RING}`}
          style={{ left: `${(valueMin / 10) * 100}%` }}
        >
          <span aria-hidden className="block h-5 w-[3px] bg-ink" />
        </button>
        <button
          type="button"
          onPointerDown={handleThumbPointerDown('max')}
          onKeyDown={handleThumbKeyDown('max')}
          aria-label={`vibe máximo: ${valueMax}`}
          className={`absolute inset-y-0 flex w-6 -translate-x-1/2 cursor-col-resize items-center justify-center bg-transparent before:absolute before:inset-y-0 before:-inset-x-2.5 before:content-[''] ${FOCUS_RING}`}
          style={{ left: `${(valueMax / 10) * 100}%` }}
        >
          <span aria-hidden className="block h-5 w-[3px] bg-ink" />
        </button>
      </div>

      {/* Thermal ramp ticks on paper — in-band bars carry the ramp color,
          out-of-band bars mute to the cream tick tone. */}
      <div className="flex items-end gap-[3px]">
        {Array.from({ length: 11 }).map((_, i) => {
          const inBand = i >= valueMin && i <= valueMax
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => handleBarClick(i, e.shiftKey)}
              className={`flex-1 hover:opacity-80 ${FOCUS_RING}`}
              style={{
                height: `${6 + i * 1.5}px`,
                backgroundColor: inBand ? vibeToColor(i) : OFF_TICK,
              }}
              aria-label={`vibe ${i}`}
              title="click: punto · shift+click: extender"
            />
          )
        })}
      </div>
    </div>
  )
}
