'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Send } from 'lucide-react'
import { usePublishConfirm } from './usePublishConfirm'
import { getItemById, publishItem, type PublishResult } from '@/lib/drafts'
import { removeDraftLocal } from '@/lib/draftsCache'
import { setPublishedItemLocal } from '@/lib/publishedItemsCache'
import {
  categoryColorOnLight,
  TYPE_CODES,
  TYPE_DISPLAY_LABELS,
} from '@/lib/dashboard/palette'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

// User-facing copy for a failed publish. Keeps the draft intact (nothing is
// dropped optimistically) and tells the editor what to do next.
function publishErrorMessage(res: PublishResult): string {
  if (res.status === 403)
    return 'No tienes permiso para editar este ítem. Puede pertenecer a otra persona.'
  if (res.status === 409)
    return 'No se pudo crear el ítem por un conflicto de id. Vuelve a intentarlo.'
  if (res.status === 0)
    return 'Sin conexión con el servidor. Tu borrador sigue guardado; vuelve a intentarlo.'
  return 'No se pudo publicar. Tu borrador sigue guardado; vuelve a intentarlo.'
}

// Globally-mounted confirmation modal for publishing a draft. Opens when
// usePublishConfirm.confirmingId is set (triggered from the dashboard form's
// `▶ PUBLICAR` button or from a draft overlay's `▶ PUBLICAR AHORA`). Closed
// by ESC, backdrop click, or either of its buttons.
//
// On confirm: flips the draft's `_draftState` to 'published' AND navigates
// the user to `/` so they see the new card surface in the feed (with its
// fresh-published chrome — see ContentCard `isFresh`).
// On cancel: just clears the modal state — the draft stays in storage so
// the editor can come back to it from the dashboard.
//
// Fase C sheet — DashPopup anatomy: ink/60 scrim, paper sheet with ink
// hairline + lift shadow. PUBLICAR is the acid fill-block (own-action
// accent, ink text); the item preview pairs the category hue with its
// 2-letter type code so hue is never the sole signal.
export function PublishConfirmOverlay() {
  const { confirmingId, confirmingMode, closeConfirm } = usePublishConfirm()
  const router = useRouter()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Reset transient submit/error state whenever the modal opens for a new item.
  useEffect(() => {
    setSubmitting(false)
    setErrorMsg(null)
  }, [confirmingId])

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

  const color = categoryColorOnLight(item.type)

  const handleConfirm = async () => {
    if (submitting) return
    // Capture the payload locally — closure keeps it alive for the awaited
    // fetch even as the memoized render changes.
    const payload = item
    setErrorMsg(null)
    setSubmitting(true)
    // Await the publish BEFORE mutating any local state or navigating. Nothing
    // is dropped optimistically, so a failure (403/409/offline) leaves the
    // draft exactly where it was and we can surface a clear error in-place
    // instead of the old silent-swallow that made a failed publish look done.
    const res = await publishItem(payload, confirmingMode)
    if (!res.ok) {
      setSubmitting(false)
      setErrorMsg(publishErrorMessage(res))
      return
    }
    // Success — now it's safe to prune local state. Drop the draft from cache
    // so the dashboard drafts list updates.
    removeDraftLocal(payload.id)
    // Reflect the published version in the published-items cache under the id
    // it actually landed under, so re-opening it to edit hydrates THIS version
    // (not the stale pre-edit snapshot) without waiting for a refetch.
    setPublishedItemLocal({ ...payload, id: res.itemId })
    // Wipe the composer's autosaved sessionStorage so the next navigation to
    // "new <type>" starts empty. Only clear the new-compose slot if it actually
    // holds THIS item (otherwise we'd destroy an unrelated in-progress compose
    // of the same type — finding #22); always clear this item's edit slot.
    try {
      const newKey = `gradiente:dashboard:${payload.type}-draft`
      const raw = sessionStorage.getItem(newKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.committedId === payload.id || parsed?.draft?.id === payload.id) {
          sessionStorage.removeItem(newKey)
        }
      }
      sessionStorage.removeItem(
        `gradiente:dashboard:${payload.type}-draft:edit:${payload.id}`
      )
    } catch {}
    closeConfirm()
    // Land the user on the feed so they see their card live with the
    // fresh-published chrome. Use the id the item ACTUALLY published under
    // (a 'create' collision re-keys to a fresh id) so the `?fresh=<id>`
    // scroll targets the right card.
    router.push(`/?fresh=${encodeURIComponent(res.itemId)}`)
  }

  return (
    <div
      className="overlay-backdrop-in fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={closeConfirm}
    >
      <div className="absolute inset-0 bg-ink/60" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="overlay-panel-in relative z-10 flex w-full max-w-md flex-col border border-ink bg-paper text-ink shadow-lift"
        style={{ transformOrigin: 'center center' }}
        role="alertdialog"
        aria-labelledby="publish-confirm-title"
      >
        {/* Kicker strip */}
        <div className="flex items-center justify-between gap-4 border-b border-ink px-4 py-1.5">
          <span className="shrink-0 font-mono text-d11 font-bold tracking-widest text-ink">
            CONFIRMAR PUBLICACIÓN
          </span>
          <button
            onClick={closeConfirm}
            aria-label="Cerrar"
            className={`-my-1.5 -mr-2 flex min-h-11 items-center gap-2 px-2 font-mono text-d11 tracking-widest text-ink-faint transition-colors hover:text-ink ${FOCUS_RING}`}
          >
            <span className="hidden sm:inline">ESC</span>
            <X size={14} className="sm:hidden" />
            <span>CERRAR</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 p-6">
          <header className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-2 border border-sys-red-paper px-2 py-0.5 font-mono text-d11 tracking-widest text-sys-red-paper">
              ÚLTIMA VERIFICACIÓN
            </span>
            <h1
              id="publish-confirm-title"
              className="font-syne text-d28 font-black uppercase leading-tight text-ink"
            >
              ¿Publicar en el feed?
            </h1>
          </header>

          <div className="border border-ink bg-paper-raised p-3">
            <div className="mb-1 flex items-center gap-2 font-mono text-d11 tracking-widest">
              <span className="font-bold" style={{ color }}>
                {TYPE_CODES[item.type]}
              </span>
              <span className="text-ink">{TYPE_DISPLAY_LABELS[item.type]}</span>
              <span className="text-ink-faint">·</span>
              <span className="truncate text-ink-faint">{item.slug}</span>
            </div>
            <p className="font-syne text-d18 font-black leading-tight text-ink">
              {item.title || 'Sin título'}
            </p>
            {item.subtitle && (
              <p className="mt-1 font-grotesk text-d13 text-ink-soft">
                {item.subtitle}
              </p>
            )}
          </div>

          <p className="font-grotesk text-d13 leading-snug text-ink-soft">
            Una vez publicado, este ítem entra al feed con prominencia normal.
            Puedes editarlo más tarde desde el dashboard, pero no podrás
            «deshacer» la publicación silenciosamente.
          </p>

          {errorMsg && (
            <p
              role="alert"
              className="border border-sys-red-paper bg-sys-red-paper/10 px-3 py-2 font-mono text-d11 leading-relaxed text-sys-red-paper"
            >
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-ink pt-3">
            <button
              ref={cancelRef}
              type="button"
              onClick={closeConfirm}
              disabled={submitting}
              className={`min-h-11 border border-ink px-4 font-mono text-d13 tracking-widest text-ink transition-colors hover:bg-ink hover:text-panel-text disabled:opacity-50 ${FOCUS_RING}`}
            >
              CANCELAR
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className={`flex min-h-11 items-center gap-2 border border-ink bg-acid px-4 font-mono text-d13 font-bold tracking-widest text-ink transition-colors hover:bg-ink hover:text-acid disabled:opacity-60 ${FOCUS_RING}`}
            >
              <Send size={11} />
              {submitting ? 'PUBLICANDO…' : errorMsg ? '▶ REINTENTAR' : '▶ PUBLICAR DEFINITIVAMENTE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
