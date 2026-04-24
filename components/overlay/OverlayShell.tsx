'use client'

import { X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { ContentItem } from '@/lib/types'
import { categoryColor } from '@/lib/utils'
import { useOverlay } from './useOverlay'

const TYPE_LABEL: Record<ContentItem['type'], string> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTICIA',
  review: 'REVIEW',
  editorial: 'EDITORIAL',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULO',
  partner: 'PARTNER',
}

interface OverlayShellProps {
  item: ContentItem
  exiting: boolean
  onExited: () => void
  children: ReactNode
}

export function OverlayShell({
  item,
  exiting,
  onExited,
  children,
}: OverlayShellProps) {
  const { close, originRect } = useOverlay()

  // Compute transform-origin from click rect so the CRT boot-in grows
  // from roughly where the card was.
  const [transformOrigin] = useState<string>(() => {
    if (typeof window === 'undefined' || !originRect) return 'center center'
    const cardCx = originRect.x + originRect.width / 2
    const cardCy = originRect.y + originRect.height / 2
    return `${cardCx}px ${cardCy}px`
  })

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ESC to close.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 ${
        exiting ? 'overlay-backdrop-out' : 'overlay-backdrop-in'
      }`}
      onClick={close}
      onAnimationEnd={(e) => {
        // Only fire onExited once the backdrop finishes its OUT animation.
        if (exiting && e.animationName === 'overlay-backdrop-out') {
          onExited()
        }
      }}
    >
      {/* Backdrop — dim + blur */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        aria-hidden
      />

      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`eva-box eva-scanlines relative z-10 flex w-full max-w-5xl flex-col overflow-hidden bg-base ${
          exiting ? 'overlay-panel-out' : 'overlay-panel-in'
        }`}
        style={{ maxHeight: 'min(92vh, 900px)', transformOrigin }}
      >
        {/* Chrome / header — terminal session bar */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-base/95 px-4 py-2.5 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="shrink-0 font-mono text-[10px] tracking-widest"
              style={{ color: categoryColor(item.type) }}
            >
              //{TYPE_LABEL[item.type]}
            </span>
            <span className="sys-label hidden truncate uppercase text-muted sm:inline">
              {item.slug}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span className="sys-label hidden items-center gap-1.5 text-sys-green sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-green" />
              ONLINE
            </span>
            <button
              onClick={close}
              aria-label="Cerrar"
              className="flex items-center gap-1.5 border border-border/70 bg-black px-3 py-2 font-mono text-[10px] tracking-widest text-secondary transition-colors hover:border-white/60 hover:text-primary sm:gap-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-muted"
            >
              <span className="hidden sm:inline">[ESC]</span>
              <X size={14} className="sm:hidden" />
              <span>CERRAR</span>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">{children}</div>

        {/* Mobile-only bottom dismiss bar — thumb-reach close affordance.
            Hidden on sm+ where the top-right chip is within easy reach. */}
        <button
          onClick={close}
          aria-label="Cerrar"
          className="flex shrink-0 items-center justify-center gap-2 border-t border-border bg-base/95 px-4 py-3 font-mono text-[11px] tracking-widest text-primary backdrop-blur-sm transition-colors active:bg-elevated sm:hidden"
        >
          <X size={14} />
          <span>CERRAR</span>
        </button>

        {/* Phosphor warm-up flash — one-shot, only on enter */}
        {!exiting && (
          <div
            className="overlay-phosphor-in pointer-events-none absolute inset-0 z-20"
            style={{
              background:
                'radial-gradient(circle at center, rgba(255,140,0,0.38) 0%, transparent 60%)',
            }}
          />
        )}
      </div>
    </div>
  )
}
