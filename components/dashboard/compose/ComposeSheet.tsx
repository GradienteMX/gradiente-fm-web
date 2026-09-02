'use client'

// ── ComposeSheet — «EL PLIEGO DE COMPOSICIÓN v2» (light full-page editor) ───
//
// The full-viewport compose surface: the pliego light editor ON paper — no
// press bed, no LivePreview, no dark forms on this path (the dark originals
// under components/dashboard/forms/** were DELETED in fase F — they had no
// mount left; /admin uses the pliego forks now).
// The body is a typed switch over the 8 light composers in ./types/*, each of
// which owns its workbench (useDraftWorkbench — the reuse seam) and renders
// itself inside ComposeLayout (breadcrumb / H1 / autosave head / CERRAR /
// rail) — this file owns only the shell contracts:
//
// URL contract: the sheet lives in the /dashboard URL context and the forms
// read `?edit=` THEMSELVES via useSearchParams — edit-mode derivation,
// sessionStorage slots, and the OverlayShell EDITAR deep link
// (`/dashboard?type=X&edit=<id>`) keep resolving. Role gates stay two-layered
// OUTSIDE this file: `canCreateContent` filters CrearZone's chips (layer 1)
// and app/dashboard/page.tsx's URL guard bounces unauthorized `?type=`
// (layer 2) — the page only mounts this sheet for an authorized type.
//
// The grid is UNMOUNTED beneath (the page renders this sheet INSTEAD of the
// grid branch, so grid rAF/observer work stops by construction).
// Belt-and-braces on top of that: this module exports a module-scope
// compose-open signal (subscribe pattern, useSyncExternalStore-compatible)
// that CultivarWidget forwards to the JARDÍN DE SEÑAL as its `frozen` prop —
// the garden freezes even in a future wiring where both trees mount at once.
// HarvestGarden itself never imports this module; the signal travels as a
// prop.
//
// Publish stays exactly ONE confirm: the rail's «PUBLICAR» → the shared
// PublishConfirmOverlay (app/layout.tsx mount, byte-untouched) →
// `/?fresh=<id>`. This file adds no confirm of its own; Close (X / Esc)
// returns to /dashboard with grid state intact — autosave already ran
// (useDraftWorkbench), and the layout's autosave head says so.

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { usePublishConfirm } from '@/components/publish/usePublishConfirm'
import { CUT_IN_DURATION, stepEase } from '@/components/dashboard/grid/useGridDrag'
import {
  composeTypeLabel,
  type ComposeType,
} from '@/components/dashboard/widgets/cultivar/CrearZone'

import { MixCompose } from './types/MixCompose'
import { ListicleCompose } from './types/ListicleCompose'
import { ArticuloCompose } from './types/ArticuloCompose'
import { EventoCompose } from './types/EventoCompose'
import { ReviewCompose } from './types/ReviewCompose'
import { EditorialCompose } from './types/EditorialCompose'
import { OpinionCompose } from './types/OpinionCompose'
import { NoticiaCompose } from './types/NoticiaCompose'

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
  // The shared PublishConfirmOverlay (byte-untouched, layout-level) closes on
  // Escape via its own window listener — while it is open, Esc belongs to it
  // alone. Without this guard one keypress would dismiss the confirm AND
  // eject the composer (unmounting the form mid-publish).
  const { confirmingId } = usePublishConfirm()
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
      const qs = params.toString()
      router.replace(
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
      )
      return
    }
    onClose()
  }, [onClose, router])

  // Esc closes. Autosave already ran — closing is consequence-free.
  // Suspended while the publish confirm holds the keyboard (see above).
  useEffect(() => {
    if (confirmingId) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose, confirmingId])

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
      <FormForType type={type} onClose={handleClose} />
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
