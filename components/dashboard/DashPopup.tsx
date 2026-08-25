'use client'

// ── DashPopup — the panel's one popup surface (revision-2) ──────────────────
//
// Iker's revision-2 asks for in-panel popups (BORRADORES, the publications
// expand, the FRANJAS list). One shared primitive so they all photograph the
// same: full-screen ink scrim, paper sheet, big Syne title (the frame-header
// register), one CERRAR control. Esc and scrim-click both close.
//
// z-[55]: above the grid + MiniTransport (45) + DashOverlayHost notice (50),
// below the compose sheet (60) and the site overlay stack. Portal to <body>
// so no widget transform can trap it (the CRT-boot rect trap family).

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

export interface DashPopupProps {
  title: string
  // One true count beside the title (tabular) — omit when meaningless.
  count?: number
  onClose: () => void
  // max-w preset: 'md' (36rem — lists) / 'lg' (56rem — galleries).
  width?: 'md' | 'lg'
  children: ReactNode
}

export function DashPopup({ title, count, onClose, width = 'md', children }: DashPopupProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
      {/* Scrim — clicking it closes; a real button so it's keyboard-honest. */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/60"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[85vh] w-full flex-col border border-ink bg-paper ${
          width === 'lg' ? 'max-w-4xl' : 'max-w-xl'
        }`}
      >
        <header className="flex items-baseline gap-3 border-b border-ink px-5 py-1.5">
          <h2 className="min-w-0 truncate font-syne text-d28 font-bold uppercase leading-8 text-ink">
            {title}
          </h2>
          {typeof count === 'number' && (
            <span className="shrink-0 font-mono text-d13 tabular-nums text-ink">{count}</span>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            data-cue="latch"
            className={`shrink-0 border border-ink px-2 py-0.5 font-mono text-d13 tracking-widest text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
          >
            CERRAR
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
