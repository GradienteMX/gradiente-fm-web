'use client'

import { useEffect, useState } from 'react'

// Single shared "expanded visualizer" slot.
//
// The expanded player (MixOverlay's AudioPlayer3D, and /lab/audio) claims this
// slot while its ParticleField3D is mounted; the persistent home NowPlayingHud
// YIELDS its own WebGL ParticleField3D context while the claim is held. So the
// home page never runs two particle-field contexts at once:
//   CRTShader (layout) + VibeFluid (page) + exactly ONE ParticleField3D = 3 max.
// Previously, opening a MixOverlay with a track loaded reached 4 (HUD field +
// overlay field). Safari caps WebGL contexts (~16) and DROPS them on tab
// backgrounding — staying well under budget keeps the showpieces alive. See the
// optimization brief §4.3 / §6-A.

let claims = 0
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

// Claim the slot; returns an idempotent release. Call from the expanded player
// for the lifetime of its mounted field (useEffect with the return as cleanup).
export function claimExpandedVisualizer(): () => void {
  claims += 1
  notify()
  let released = false
  return () => {
    if (released) return
    released = true
    claims = Math.max(0, claims - 1)
    notify()
  }
}

export function isExpandedVisualizerActive(): boolean {
  return claims > 0
}

export function subscribeVisualizerSlot(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

// True while an expanded visualizer holds the slot — the HUD reads this to drop
// its redundant WebGL context.
export function useExpandedVisualizerActive(): boolean {
  const [active, setActive] = useState(isExpandedVisualizerActive)
  useEffect(() => {
    const refresh = () => setActive(isExpandedVisualizerActive())
    refresh()
    return subscribeVisualizerSlot(refresh)
  }, [])
  return active
}
