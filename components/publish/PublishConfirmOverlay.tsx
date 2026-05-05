'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Send } from 'lucide-react'
import { usePublishConfirm } from './usePublishConfirm'
import { getItemById, publishItem } from '@/lib/drafts'
import { removeDraftLocal } from '@/lib/draftsCache'
import { categoryColor } from '@/lib/utils'

// Globally-mounted confirmation modal for publishing a draft. Opens when
// usePublishConfirm.confirmingId is set; closed by ESC, backdrop click, or
// either of its buttons.
//
// On confirm: flips the draft's `_draftState` to 'published' (visible cleanly
// in the feed) and clears the `?pending` URL param.
// On cancel: just clears the modal state — the draft + pending URL param
// stay so the editor can come back to it.
export function PublishConfirmOverlay() {
  const { confirmingId, closeConfirm } = usePublishConfirm()
  const router = useRouter()
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Lock body scroll while open.
  useEffect(() => {
    if (!confirmingId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [confirmingId])

  // ESC closes.
  useEffect(() => {
    if (!confirmingId) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [confirmingId, closeConfirm])

  // Auto-focus the safer (cancel) button on open.
  useEffect(() => {
    if (confirmingId) {
      const t = setTimeout(() => cancelRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [confirmingId])

  if (!confirmingId) return null
  const item = getItemById(confirmingId)
  if (!item) return null

  const color = categoryColor(item.type)

  const handleConfirm = async () => {
    // Close + clear ?pending first so the modal dismisses via its own state
    // (not via the cache mutation below pulling `item` out from under the
    // memoized render). Capture the publish payload locally — closure keeps
    // it alive for the awaited fetch.
    const payload = item
    closeConfirm()
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('pending')
      router.replace(url.pathname + url.search, { scroll: false })
    }
    // Optimistic: drop from drafts cache so the dashboard drafts list
    // reflects the publish before the API round-trip completes.
    removeDraftLocal(payload.id)
    // Await the publish before refreshing server components so the
    // re-fetched home/type-page lists actually include the new row.
    const { ok } = await publishItem(payload)
    if (ok) {
      // Wipe the per-type composer's autosaved sessionStorage so the next
      // navigation to "new <type>" starts with an empty form. Without this,
      // useDraftWorkbench's hydration would re-populate the composer with
      // the just-published item's data. Key convention is shared across
      // every dashboard form (see gradiente:dashboard:<type>-draft).
      try {
        sessionStorage.removeItem(`gradiente:dashboard:${payload.type}-draft`)
      } catch {}
      router.refresh()
    }
  }

  return (
    <div
      className="overlay-backdrop-in fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={closeConfirm}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="eva-box eva-scanlines overlay-panel-in relative z-10 flex w-full max-w-md flex-col overflow-hidden bg-base"
        style={{ transformOrigin: 'center center' }}
        role="alertdialog"
        aria-labelledby="publish-confirm-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-border bg-base/95 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span
              className="shrink-0 font-mono text-[10px] tracking-widest"
              style={{ color: '#F97316' }}
            >
              //CONFIRMAR·PUBLICACIÓN
            </span>
          </div>
          <button
            onClick={closeConfirm}
            aria-label="Cerrar"
            className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
          >
            <span className="hidden sm:inline">[ESC]</span>
            <X size={14} className="sm:hidden" />
            <span>CERRAR</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 p-6">
          <header className="flex flex-col gap-2">
            <span
              className="inline-flex w-fit items-center gap-2 border px-2 py-0.5 font-mono text-[10px] tracking-widest"
              style={{ borderColor: '#E63329', color: '#E63329' }}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-red" />
              ÚLTIMA VERIFICACIÓN
            </span>
            <h1
              id="publish-confirm-title"
              className="font-syne text-2xl font-black leading-tight text-primary"
            >
              ¿PUBLICAR EN EL FEED?
            </h1>
          </header>

          <div className="border border-dashed border-border bg-black/40 p-3">
            <div className="mb-1 flex items-center gap-2 font-mono text-[10px] tracking-widest">
              <span style={{ color }}>//{item.type.toUpperCase()}</span>
              <span className="text-muted">·</span>
              <span className="truncate text-muted">{item.slug}</span>
            </div>
            <p className="font-syne text-base font-black leading-tight text-primary">
              {item.title || '[sin título]'}
            </p>
            {item.subtitle && (
              <p className="mt-1 font-grotesk text-sm text-secondary">
                {item.subtitle}
              </p>
            )}
          </div>

          <p className="font-mono text-[11px] leading-relaxed text-secondary">
            Una vez publicado, este ítem entra al feed con prominencia normal y
            deja de mostrarse como pendiente. Puedes editarlo más tarde desde el
            dashboard, pero no podrás «deshacer» la publicación silenciosamente.
          </p>

          <p className="font-mono text-[10px] leading-relaxed text-muted">
            <span className="text-secondary">[PROTOTIPO VISUAL]</span> en este
            modo nada se persiste fuera de tu sesión. Cuando llegue el backend,
            esta acción será definitiva.
          </p>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <button
              ref={cancelRef}
              type="button"
              onClick={closeConfirm}
              className="border border-border px-3 py-2 font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
            >
              CANCELAR
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-2 border px-4 py-2 font-mono text-[11px] tracking-widest transition-colors"
              style={{
                borderColor: '#F97316',
                color: '#F97316',
                backgroundColor: 'rgba(249,115,22,0.12)',
              }}
            >
              <Send size={11} />
              ▶ PUBLICAR DEFINITIVAMENTE
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
