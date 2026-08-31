'use client'

// EL CAMPO — the framed instrument window for the VibeFluid signal field.
// (EL PLIEGO · Fase B — instrument doctrine: dark hardware on the paper sheet)
//
// Fase A/B removed the full-viewport fluid veil behind the feed; the SAME
// stable-fluids simulation now lives inside this bezel in the left TIPO rail.
// The bezel is a 1px-ink hairline frame around a dark panel — the sim's
// near-black resting ground reads as the inside of the instrument, so the
// teletext display pass needed zero color re-mapping. The panel behaves as a
// MINIATURE of the viewport (a seismograph of the page): VibeFluid keeps
// mapping the window pointer and lib/heatField's hot-card sources from
// normalized viewport coords straight into sim space.
//
// This component owns the ONE copy of the mount gates that used to live inside
// VibeFluid (lg+ via matchMedia, pointer:fine, deviceMemory >= 4, idle-deferred
// start, dynamic ssr:false import of the canvas piece) so CategoryRail can
// mount <ElCampo /> unconditionally. When gated out it renders NOTHING (null)
// — mobile/small/low-memory surfaces never see a dead box. On capable surfaces
// the empty bezel renders immediately (so the rail's layout settles at
// hydration) and the fluid canvas — chunk download included — ignites only
// after the browser goes idle, exactly the old LCP-safe deferral.
//
// The caption for the instrument lives in CategoryRail, not here — inside the
// bezel there is only the field.

import { useEffect, useState } from 'react'
import nextDynamic from 'next/dynamic'

// Client-only (raw WebGL) — the chunk is fetched only once `ignited` flips
// true (after the idle callback), never during initial load.
const FluidCanvas = nextDynamic(() => import('@/components/fluid/VibeFluid'), {
  ssr: false,
})

export function ElCampo() {
  // Two-stage gate, both client-only:
  //   capable — synchronous capability check (viewport / pointer / memory).
  //             False → render null forever (no dead bezel on weak surfaces).
  //   ignited — flips after requestIdleCallback (or a 1.2s fallback timeout);
  //             mounts the heavy canvas piece inside the already-laid-out
  //             bezel so LCP is untouched.
  const [capable, setCapable] = useState(false)
  const [ignited, setIgnited] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Capability gate first (cheap, synchronous) — checked once at mount,
    // same snapshot semantics the old in-VibeFluid gate had.
    if (!window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches) {
      return
    }
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    if (typeof mem === 'number' && mem < 4) return
    setCapable(true)

    // Defer the sim (and its chunk) until the browser is idle.
    let idleHandle = 0
    let timeoutHandle = 0
    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void) => number
      }
    ).requestIdleCallback
    if (typeof ric === 'function') {
      idleHandle = ric(() => setIgnited(true))
    } else {
      timeoutHandle = window.setTimeout(() => setIgnited(true), 1200)
    }
    return () => {
      const cic = (
        window as Window & { cancelIdleCallback?: (h: number) => void }
      ).cancelIdleCallback
      if (idleHandle && typeof cic === 'function') cic(idleHandle)
      if (timeoutHandle) window.clearTimeout(timeoutHandle)
    }
  }, [])

  // Gated out → nothing at all. The rail simply has no instrument here.
  if (!capable) return null

  return (
    <div
      aria-hidden
      className="relative h-44 w-full overflow-hidden border border-ink bg-panel"
    >
      {/* Pre-ignition the bezel shows only the dark panel — the field rests
          near-black anyway, so the hand-off is seamless. No status copy. */}
      {ignited && <FluidCanvas />}
    </div>
  )
}
