'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Send } from 'lucide-react'
import { usePublishConfirm } from './usePublishConfirm'
import { getItemById, publishItem, type PublishResult } from '@/lib/drafts'
import { removeDraftLocal } from '@/lib/draftsCache'
import { setPublishedItemLocal } from '@/lib/publishedItemsCache'
import { categoryColor } from '@/lib/utils'

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

  const color = categoryColor(item.type)

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
            Una vez publicado, este ítem entra al feed con prominencia normal.
            Puedes editarlo más tarde desde el dashboard, pero no podrás
            «deshacer» la publicación silenciosamente.
          </p>

          {errorMsg && (
            <p
              role="alert"
              className="border border-dashed px-3 py-2 font-mono text-[11px] leading-relaxed"
              style={{ borderColor: '#E63329', color: '#E63329' }}
            >
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <button
              ref={cancelRef}
              type="button"
              onClick={closeConfirm}
              disabled={submitting}
              className="border border-border px-3 py-2 font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary disabled:opacity-50"
            >
              CANCELAR
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="flex items-center gap-2 border px-4 py-2 font-mono text-[11px] tracking-widest transition-colors disabled:opacity-60"
              style={{
                borderColor: '#F97316',
                color: '#F97316',
                backgroundColor: 'rgba(249,115,22,0.12)',
              }}
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
