// heatField — the shared bridge between the DOM card grid and the VibeFluid
// signal field (redesign 2026). Hot cards (high vibe temperature) register a
// viewport-space heat source here; VibeFluid reads the live set each frame and
// injects faint ambient dye/heat at those positions, so the fluid visibly
// "warms" in the gutters around prominent hot content. Cold cards register
// little or nothing.
//
// Deliberately a bare module-scoped registry (no React, no listener bus): the
// fluid already runs a rAF loop and just polls getHeatSources() per frame, and
// cards push their state imperatively on mount / scroll / unmount. This mirrors
// the codebase's other module-scoped caches but needs no subscription since the
// only consumer is an animation loop.
//
// Coordinates are NORMALIZED viewport space: x,y in [0,1] = (clientX/innerWidth,
// clientY/innerHeight) of the card's center. Cards live OUTSIDE the overlay
// transform, so getBoundingClientRect is correct here (the gBCR-near-zero-box
// trap is overlay-only). `heat` is 0..1 — the card's vibe temperature (and/or
// prominence); the fluid scales its injection by it. When the fluid is disabled
// (mobile / low-mem / no idle-mount) nothing reads this and the cost is one Map
// write per card — effectively free.

export interface HeatSource {
  /** Stable card id. */
  id: string
  /** Card center X in normalized viewport space [0,1]. */
  x: number
  /** Card center Y in normalized viewport space [0,1]. */
  y: number
  /** 0..1 — the card's vibe temperature (hot = toward volcán). */
  heat: number
}

const sources = new Map<string, HeatSource>()

/** Register or update a card's heat source. Call on mount + throttled on scroll/resize. */
export function setHeatSource(id: string, x: number, y: number, heat: number): void {
  sources.set(id, { id, x, y, heat })
}

/** Drop a card's heat source. Call on unmount or when the card scrolls fully offscreen. */
export function removeHeatSource(id: string): void {
  sources.delete(id)
}

/** Snapshot of the live heat sources — the fluid calls this once per frame. */
export function getHeatSources(): HeatSource[] {
  return Array.from(sources.values())
}
