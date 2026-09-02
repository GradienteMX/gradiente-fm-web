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
//
// Fase F chrome: flat ink scrim (no blur), paper controls with ink hairlines,
// and the plate itself framed as paper — the image reads as a print laid on
// the sheet rather than a lightbox on black.

// House focus grammar — 2px ink outline, offset 2. Rendered against the ink
// scrim here, where the paper chips give it a light ground to sit on.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

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
      <div className="absolute inset-0 bg-ink/90" aria-hidden />

      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className={`absolute right-3 top-3 z-10 flex min-h-11 items-center gap-1.5 border border-ink bg-paper px-3 font-mono text-d11 font-bold tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
      >
        <X size={14} />
        <span className="hidden sm:inline">CERRAR</span>
      </button>

      {/* Counter */}
      {count > 1 && (
        <span className="absolute left-3 top-3 z-10 border border-ink bg-paper px-2 py-1 font-mono text-d11 font-bold tabular-nums tracking-widest text-ink">
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
            className={`absolute left-2 z-10 flex h-11 w-11 items-center justify-center border border-ink bg-paper text-ink transition-colors hover:bg-ink hover:text-paper sm:left-4 ${FOCUS_RING}`}
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
            className={`absolute right-2 z-10 flex h-11 w-11 items-center justify-center border border-ink bg-paper text-ink transition-colors hover:bg-ink hover:text-paper sm:right-4 ${FOCUS_RING}`}
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      <img
        src={src}
        alt={`imagen ${index + 1}`}
        onClick={(e) => e.stopPropagation()}
        className="relative z-[1] max-h-full max-w-full border border-ink bg-paper object-contain p-1.5"
      />
    </div>
  )
}
