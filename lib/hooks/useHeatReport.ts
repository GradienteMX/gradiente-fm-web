'use client'

import { useEffect } from 'react'
import { setHeatSource, removeHeatSource } from '@/lib/heatField'

// useHeatReport — the card-side producer for the thermal card↔fluid coupling
// (redesign 2026). A hot card publishes its live viewport-center + heat to the
// shared heatField; VibeFluid polls that set each frame and injects a faint
// warm glow at those positions, so the signal field warms in the gutters around
// prominent hot content.
//
// Cost discipline: only cards whose heat clears the threshold register or attach
// listeners at all — cold cards are a no-op. And the whole thing is gated to the
// same desktop surface the fluid mounts on (lg + fine pointer), so phones/tablets
// (where the fluid never mounts) pay nothing. Coordinates are TOP-DOWN normalized
// viewport [0,1] per the heatField contract — VibeFluid does the y-flip to its
// bottom-left sim origin, so we must NOT pre-flip here.

// Below this the card is "cool enough" that it warms nothing — matches VibeFluid's
// HEAT_INJECT_THRESHOLD so we don't register sources the fluid would ignore.
const HEAT_REPORT_THRESHOLD = 0.35

// Card fully outside this normalized-Y band is offscreen → drop its source so the
// fluid doesn't warm a region the user can't see. Generous margin (one viewport).
const OFFSCREEN_MARGIN = 0.3

export function useHeatReport(
  ref: React.RefObject<HTMLElement | null>,
  id: string,
  heat: number,
): void {
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Cold card → never register, never listen.
    if (heat < HEAT_REPORT_THRESHOLD) {
      removeHeatSource(id)
      return
    }
    // Match the fluid's mount gate so mobile attaches nothing (the fluid won't
    // be there to read it anyway).
    if (!window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches) {
      return
    }

    let raf = 0
    const report = () => {
      raf = 0
      const el = ref.current
      if (!el) return
      // Cards live outside the overlay transform, so gBCR is correct here (the
      // near-zero-box trap is overlay-only).
      const r = el.getBoundingClientRect()
      const x = (r.left + r.width / 2) / window.innerWidth
      const y = (r.top + r.height / 2) / window.innerHeight
      if (y < -OFFSCREEN_MARGIN || y > 1 + OFFSCREEN_MARGIN) {
        removeHeatSource(id)
        return
      }
      setHeatSource(id, x, y, heat)
    }
    // Coalesce scroll/resize bursts into one read per frame.
    const schedule = () => {
      if (raf === 0) raf = window.requestAnimationFrame(report)
    }

    report() // initial position
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      removeHeatSource(id)
    }
  }, [ref, id, heat])
}
