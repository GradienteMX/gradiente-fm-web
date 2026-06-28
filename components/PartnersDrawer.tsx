'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { ContentItem } from '@/lib/types'
import { PartnersRail } from './PartnersRail'

// Mobile/tablet partner access. Below `lg` the partners right column is hidden
// (the feed takes the full width), so partners live here: a slim always-visible
// right-edge tab (discoverable affordance — not a hidden-only gesture) that
// opens a panel sliding in from the right. A left-swipe from the screen edge
// also opens it, and a right-swipe / backdrop tap / ✕ / ESC closes it.
//
// Desktop (`lg+`) renders nothing — the inline PartnersRail handles it there.
export function PartnersDrawer({ partners }: { partners: ContentItem[] }) {
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

  if (partners.length === 0) return null

  return (
    <div className="lg:hidden">
      {/* Right-edge tab — the discoverable handle. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ver partners"
          className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 items-center border border-r-0 border-sys-orange/50 bg-base/90 py-3.5 pl-1.5 pr-1 backdrop-blur-sm transition-colors hover:bg-sys-orange/10"
        >
          <span className="font-mono text-[10px] tracking-[0.3em] text-sys-orange [writing-mode:vertical-rl]">
            PARTNERS
          </span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[70]"
          role="dialog"
          aria-modal="true"
          aria-label="Partners y venues"
        >
          <div
            className="overlay-backdrop-in absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            onTouchStart={onPanelTouchStart}
            onTouchMove={onPanelTouchMove}
            className="absolute right-0 top-0 flex h-[100dvh] w-[82vw] max-w-xs flex-col border-l border-sys-orange/40 bg-base"
            style={{ paddingRight: 'env(safe-area-inset-right)', paddingTop: 'env(safe-area-inset-top)' }}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <span className="font-mono text-[11px] tracking-widest text-sys-orange">
                //PARTNERS
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="text-muted transition-colors hover:text-primary"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </header>
            {/* Tapping a partner opens its overlay AND closes the drawer (the
                click bubbles up from the PartnerCard button). */}
            <div
              className="min-h-0 flex-1 overflow-y-auto p-4"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
              onClick={() => setOpen(false)}
            >
              <p className="sys-label mb-3">
                {partners.length} · SELLOS · VENUES · PROMO
              </p>
              <PartnersRail items={partners} variant="drawer" />
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
