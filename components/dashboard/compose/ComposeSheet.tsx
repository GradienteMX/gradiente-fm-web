'use client'

// Full-page shell for the eight content composers. URL identity keys each
// workbench; ComposeLayout owns guarded exit and the shared publish review.
// Permission checks remain in the dashboard route and creation controls.

import { useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { CUT_IN_DURATION, stepEase } from '@/components/dashboard/grid/useGridDrag'
import {
  composeTypeLabel,
  type ComposeType,
} from '@/components/dashboard/widgets/cultivar/CrearZone'

import { MixCompose } from '@/components/dashboard/compose/types/MixCompose'
import { ListicleCompose } from '@/components/dashboard/compose/types/ListicleCompose'
import { ArticuloCompose } from '@/components/dashboard/compose/types/ArticuloCompose'
import { EventoCompose } from '@/components/dashboard/compose/types/EventoCompose'
import { ReviewCompose } from '@/components/dashboard/compose/types/ReviewCompose'
import { EditorialCompose } from '@/components/dashboard/compose/types/EditorialCompose'
import { OpinionCompose } from '@/components/dashboard/compose/types/OpinionCompose'
import { NoticiaCompose } from '@/components/dashboard/compose/types/NoticiaCompose'

// ── Compose-open signal (module scope — the garden-freeze subscribe) ────────
// Consumed via useSyncExternalStore:
//   useSyncExternalStore(subscribeComposeSheetOpen, isComposeSheetOpen, () => false)
// A mount counter (not a boolean) so StrictMode's double mount/unmount and
// any overlapping mount/unmount ordering can never strand the signal open.

let composeSheetMounts = 0
const composeOpenListeners = new Set<() => void>()

export function isComposeSheetOpen(): boolean {
  return composeSheetMounts > 0
}

export function subscribeComposeSheetOpen(listener: () => void): () => void {
  composeOpenListeners.add(listener)
  return () => {
    composeOpenListeners.delete(listener)
  }
}

function trackComposeMount(delta: 1 | -1): void {
  const wasOpen = composeSheetMounts > 0
  composeSheetMounts = Math.max(0, composeSheetMounts + delta)
  if ((composeSheetMounts > 0) !== wasOpen) {
    composeOpenListeners.forEach((listener) => listener())
  }
}

// ── The sheet ───────────────────────────────────────────────────────────────

export interface ComposeSheetProps {
  type: ComposeType
  // Present on `?type&edit=` deep links (resume / EDITAR). The forms derive
  // edit mode from the URL themselves — the shell does not consume it, but
  // the page-level callers keep passing it (prop contract unchanged).
  editingId: string | null
  // X / Esc → `router.push('/dashboard')` at the page level. On /lab/* the
  // sheet closes in place instead (see handleClose below) — this callback is
  // only invoked on the real /dashboard route.
  onClose: () => void
}

export function ComposeSheet({ type, onClose }: ComposeSheetProps) {
  const router = useRouter()
  const search = useSearchParams()
  const reducedMotion = useReducedMotion()
  const rootRef = useRef<HTMLElement | null>(null)

  // Broadcast the compose-open signal for exactly the mounted lifetime.
  useEffect(() => {
    trackComposeMount(1)
    return () => trackComposeMount(-1)
  }, [])

  // Close returns to the surface that OPENED the sheet. On the real page the
  // page-level onClose (→ router.push('/dashboard')) stands. But on the
  // /lab/* harness routes that hard push would dump lab users onto the
  // production dashboard — there we instead strip the compose params
  // (?type/?edit) off the CURRENT pathname (router.replace, same path), so
  // the sheet closes in place and the harness survives.
  const handleClose = useCallback(() => {
    if (
      typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/lab')
    ) {
      const params = new URLSearchParams(window.location.search)
      params.delete('type')
      params.delete('edit')
      params.delete('draft')
      const qs = params.toString()
      router.replace(
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      )
      return
    }
    onClose()
  }, [onClose, router])

  // Move focus into the dialog on open (the chip that opened it is gone —
  // the grid unmounted beneath us).
  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  return (
    // Stepped 4-frame opacity cut-in (house cut, no springs/fades/exits);
    // reduced-motion mounts settled. z-60: above the grid remnants and the
    // in-place overlay host (50), below HarvestConfirmModal (100).
    // `dash-shell` on the root keeps the pliego register (paper scrollbars,
    // ink-on-acid ::selection, deliberate :active states) even though the
    // surface is fixed — same scope class the dashboard layout carries.
    <motion.section
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Componiendo ${composeTypeLabel(type)}`}
      tabIndex={-1}
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ opacity: { duration: CUT_IN_DURATION, ease: stepEase } }}
      className="dash-shell fixed inset-0 z-[60] overflow-y-auto overflow-x-hidden bg-paper text-ink focus:outline-none"
    >
      <FormForType key={`${type}:${search?.get('edit') ?? search?.get('draft') ?? 'new'}`} type={type} onClose={handleClose} />
    </motion.section>
  )
}

// One switch over the 8 light composers. Each owns its own workbench, rail,
// and layout; the shell hands down only the lab-aware close.
function FormForType({
  type,
  onClose,
}: {
  type: ComposeType
  onClose: () => void
}) {
  switch (type) {
    case 'mix':
      return <MixCompose onClose={onClose} />
    case 'listicle':
      return <ListicleCompose onClose={onClose} />
    case 'articulo':
      return <ArticuloCompose onClose={onClose} />
    case 'evento':
      return <EventoCompose onClose={onClose} />
    case 'review':
      return <ReviewCompose onClose={onClose} />
    case 'editorial':
      return <EditorialCompose onClose={onClose} />
    case 'opinion':
      return <OpinionCompose onClose={onClose} />
    case 'noticia':
      return <NoticiaCompose onClose={onClose} />
  }
}
