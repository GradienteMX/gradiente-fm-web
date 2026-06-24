'use client'

import { useCallback, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

// ── ForoLightbox ───────────────────────────────────────────────────────────
//
// Fullscreen image viewer for foro post galleries. Opened by clicking any
// image in a PostBody. Sits above the thread/compose overlays (z-[70]).
//
// Key handling runs in the CAPTURE phase and stops propagation so ESC/arrows
// are swallowed here and never reach the ThreadOverlay's own window-level ESC
// handler (which would otherwise close the whole thread underneath).

interface ForoLightboxProps {
  images: string[]
  index: number
  onIndex: (next: number) => void
  onClose: () => void
}

export function ForoLightbox({ images, index, onIndex, onClose }: ForoLightboxProps) {
  const count = images.length
  const go = useCallback(
    (delta: number) => {
      if (count <= 1) return
      onIndex((index + delta + count) % count)
    },
    [count, index, onIndex],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      } else if (e.key === 'ArrowRight') {
        e.stopPropagation()
        go(1)
      } else if (e.key === 'ArrowLeft') {
        e.stopPropagation()
        go(-1)
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [go, onClose])

  const src = images[index]
  if (!src) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8 overlay-backdrop-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Imagen ampliada"
    >
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" aria-hidden />

      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-3 top-3 z-10 flex items-center gap-1.5 border border-border/70 bg-black px-3 py-2 font-mono text-[10px] tracking-widest text-secondary transition-colors hover:border-white/60 hover:text-primary"
      >
        <X size={14} />
        <span className="hidden sm:inline">CERRAR</span>
      </button>

      {/* Counter */}
      {count > 1 && (
        <span className="absolute left-3 top-3 z-10 border border-border/70 bg-black/85 px-2 py-1 font-mono text-[10px] tabular-nums tracking-widest text-muted">
          {index + 1}/{count}
        </span>
      )}

      {/* Prev / next */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              go(-1)
            }}
            aria-label="Anterior"
            className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center border border-border/70 bg-black/85 text-secondary transition-colors hover:border-white/60 hover:text-primary sm:left-4"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              go(1)
            }}
            aria-label="Siguiente"
            className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center border border-border/70 bg-black/85 text-secondary transition-colors hover:border-white/60 hover:text-primary sm:right-4"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      <img
        src={src}
        alt={`imagen ${index + 1}`}
        onClick={(e) => e.stopPropagation()}
        className="relative z-[1] max-h-full max-w-full object-contain"
      />
    </div>
  )
}
