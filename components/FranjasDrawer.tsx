'use client'

import { useEffect, useRef, useState } from 'react'
import type { ContentItem } from '@/lib/types'
import { FranjasRail } from './FranjasRail'

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// Mobile/tablet franja access. Below `lg` the franjas right column is hidden
// (the feed takes the full width), so franjas live here: a slim always-visible
// right-edge tab (discoverable affordance — not a hidden-only gesture) that
// opens a panel sliding in from the right. A left-swipe from the screen edge
// also opens it, and a right-swipe / backdrop tap / CERRAR / ESC closes it.
//
// «EL PLIEGO» fase B: reskin only — the tab is an ink tab, the panel is paper
// with a hairline frame. All gesture/lock/close behavior is unchanged.
//
// Desktop (`lg+`) renders nothing — the inline FranjasRail handles it there.
export function FranjasDrawer({ franjas }: { franjas: ContentItem[] }) {
  const [open, setOpen] = useState(false)

  // Body-scroll lock while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // ESC closes.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Edge-swipe to OPEN — a left drag that begins within 28px of the right edge.
  // Gated to coarse pointers / small viewports so it never competes with desktop.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 1023px)').matches) return
    let startX = 0
    let startY = 0
    let tracking = false
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (t && t.clientX >= window.innerWidth - 28) {
        startX = t.clientX
        startY = t.clientY
        tracking = true
      } else {
        tracking = false
      }
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const t = e.touches[0]
      if (!t) return
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      if (dx < -45 && Math.abs(dx) > Math.abs(dy)) {
        setOpen(true)
        tracking = false
      }
    }
    const onEnd = () => {
      tracking = false
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [])

  // Right-swipe on the panel to CLOSE.
  const swipe = useRef({ x: 0, y: 0, active: false })
  const onPanelTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    swipe.current = { x: t.clientX, y: t.clientY, active: true }
  }
  const onPanelTouchMove = (e: React.TouchEvent) => {
    if (!swipe.current.active) return
    const t = e.touches[0]
    const dx = t.clientX - swipe.current.x
    const dy = t.clientY - swipe.current.y
    if (dx > 55 && Math.abs(dx) > Math.abs(dy)) {
      setOpen(false)
      swipe.current.active = false
    }
  }

  if (franjas.length === 0) return null

  return (
    <div className="lg:hidden">
      {/* Right-edge tab — the discoverable handle. Ink tab in the print
          register; the ::before extension pads the tap area to the 44px floor
          (it matches the 28px edge-swipe zone, so the strip is already
          gesture territory). */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ver franjas"
          className={`fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center border border-r-0 border-ink bg-panel py-3.5 pl-2 pr-1.5 text-panel-text transition-colors before:absolute before:-inset-y-2 before:-left-4 before:right-0 before:content-[''] hover:bg-paper hover:text-ink ${FOCUS_RING}`}
        >
          <span className="font-mono text-d11 tracking-[0.3em] [writing-mode:vertical-rl]">
            FRANJAS
          </span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[70]"
          role="dialog"
          aria-modal="true"
          aria-label="Franjas y venues"
        >
          <div
            className="overlay-backdrop-in absolute inset-0 bg-ink/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            onTouchStart={onPanelTouchStart}
            onTouchMove={onPanelTouchMove}
            className="absolute right-0 top-0 flex h-[100dvh] w-[82vw] max-w-xs flex-col border-l border-ink bg-paper"
            style={{ paddingRight: 'env(safe-area-inset-right)', paddingTop: 'env(safe-area-inset-top)' }}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-ink px-4 py-3">
              <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink">
                FRANJAS
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`min-h-11 border border-ink px-3 font-mono text-d11 font-bold uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
              >
                CERRAR
              </button>
            </header>
            {/* Tapping a franja opens its overlay AND closes the drawer (the
                click bubbles up from the FranjaCard button). */}
            <div
              className="min-h-0 flex-1 overflow-y-auto p-4"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
              onClick={() => setOpen(false)}
            >
              <p className="mb-3 font-mono text-d11 uppercase tracking-widest text-ink-soft tabular-nums">
                {franjas.length} · SELLOS · VENUES · PROMO
              </p>
              <FranjasRail items={franjas} variant="drawer" />
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
