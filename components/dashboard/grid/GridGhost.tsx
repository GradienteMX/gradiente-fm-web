'use client'

// ── GridGhost — the landing-slot marker (§2.2) ──────────────────────────────
// A hairline dashed ink rectangle occupying the dragged widget's packed
// candidate slot. Pure marker: no fill, no motion, no pointer surface.
// z-10 — above resting widgets, under the dragged widget (§7.6).

import type { LayoutEntry } from '@/lib/dashboard/layout'

export function GridGhost({ entry }: { entry: LayoutEntry }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none z-10 border border-dashed border-ink"
      style={{
        gridColumn: `${entry.x + 1} / span ${entry.w}`,
        gridRow: `${entry.y + 1} / span ${entry.h}`,
      }}
    />
  )
}
