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

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/components/auth/useAuth'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

export interface DashPopupProps {
  title: string
  // One true count beside the title (tabular) — omit when meaningless.
  count?: number
  onClose: () => void
  // max-w preset: 'md' (36rem — lists) / 'lg' (56rem — galleries).
  width?: 'md' | 'lg' | 'xl'
  closeLabel?: string
  footer?: ReactNode
  children: ReactNode
}

export function DashPopup({ title, count, onClose, width = 'md', closeLabel = 'CERRAR', footer, children }: DashPopupProps) {
  const { loginOpen } = useAuth()
  const loginOpenRef = useRef(loginOpen)
  loginOpenRef.current = loginOpen
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement
    const dialog = dialogRef.current
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]') ?? []).filter((el) => el.getClientRects().length > 0)
    focusable()[0]?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      // Sign-in sits above this sheet and owns keyboard focus while open.
      if (loginOpenRef.current) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
      } else if (event.key === 'Tab') {
        const nodes = focusable()
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])

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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[85vh] w-full flex-col border border-ink bg-paper text-ink shadow-lift ${
          width === 'xl' ? 'max-w-6xl' : width === 'lg' ? 'max-w-4xl' : 'max-w-xl'
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
            {closeLabel}
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="shrink-0 border-t border-ink p-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
