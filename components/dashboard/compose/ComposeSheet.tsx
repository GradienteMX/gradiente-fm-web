'use client'

// ── ComposeSheet — «EL PLIEGO DE COMPOSICIÓN» (FINAL_SPEC §4) ───────────────
//
// The full-viewport compose sheet: an ink-black press bed matted on cream,
// sliding over the grid with the house stepped-opacity cut-in. The existing
// 8 dashboard forms (+ Fields.tsx + LivePreview + useDraftWorkbench) mount
// UNMODIFIED, dark, inside a 1px-ink panel with ≥24px cream mat — the
// deliberate "printing press" object per §1.7. `forms/shared` is imported by
// /admin too: rehosted here, never restyled.
//
// URL contract (§4.4): the sheet lives in the /dashboard URL context and the
// forms read `?edit=` THEMSELVES via useSearchParams — edit-mode derivation,
// sessionStorage slots, and the OverlayShell EDITAR deep link
// (`/dashboard?type=X&edit=<id>`) keep resolving. Role gates stay two-layered
// OUTSIDE this file: `canCreateContent` filters CrearZone's chips (layer 1)
// and app/dashboard/page.tsx's URL guard bounces unauthorized `?type=`
// (layer 2) — the page only mounts this sheet for an authorized type.
//
// The grid is UNMOUNTED beneath (A's model — the page renders this sheet
// INSTEAD of the grid branch, so grid rAF/observer work stops by
// construction). Belt-and-braces on top of that: this module exports a
// module-scope compose-open signal (subscribe pattern, useSyncExternalStore-
// compatible) that CultivarWidget forwards to the JARDÍN DE SEÑAL as its
// `frozen` prop (§4.3) — the garden freezes even in a future wiring where
// both trees mount at once. HarvestGarden itself never imports this module;
// the signal travels as a prop (WP5 contract).
//
// Publish stays exactly ONE confirm (§4.5): SubmitFooter «▶ PUBLICAR» →
// the shared PublishConfirmOverlay (app/layout.tsx mount, byte-untouched)
// → `/?fresh=<id>`. This file adds no confirm of its own; Close (X / Esc)
// returns to /dashboard with grid state intact — autosave already ran
// (useDraftWorkbench), and the running head says so.

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { usePublishConfirm } from '@/components/publish/usePublishConfirm'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { CUT_IN_DURATION, stepEase } from '@/components/dashboard/grid/useGridDrag'
import {
  composeTypeLabel,
  type ComposeType,
} from '@/components/dashboard/widgets/cultivar/CrearZone'

import { MixForm } from '@/components/dashboard/forms/MixForm'
import { ListicleForm } from '@/components/dashboard/forms/ListicleForm'
import { EventoForm } from '@/components/dashboard/forms/EventoForm'
import { ReviewForm } from '@/components/dashboard/forms/ReviewForm'
import { EditorialForm } from '@/components/dashboard/forms/EditorialForm'
import { OpinionForm } from '@/components/dashboard/forms/OpinionForm'
import { ArticuloForm } from '@/components/dashboard/forms/ArticuloForm'
import { NoticiaForm } from '@/components/dashboard/forms/NoticiaForm'

// ── Compose-open signal (module scope — WP5's garden-freeze subscribe) ──────
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

// ── Running head clock ──────────────────────────────────────────────────────
// «BORRADOR GUARDADO 12:03» from the provider's cache-reactive drafts slice
// (lib/drafts `_updatedAt` — stamped by the workbench's saveDraft/commit).
// TRUE data only: shown when the composed draft demonstrably exists in the
// store (the `?edit=` row, or a draft of this type committed after the sheet
// opened). Otherwise the head states the autosave fact without a fake clock.

function clockHHMM(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── The sheet ───────────────────────────────────────────────────────────────

export interface ComposeSheetProps {
  type: ComposeType
  // Present on `?type&edit=` deep links (resume / EDITAR). The forms derive
  // edit mode from the URL themselves — this prop only feeds the running head.
  editingId: string | null
  // X / Esc → `router.push('/dashboard')` at the page level (§4.6). On
  // /lab/* the sheet closes in place instead (see handleClose below) —
  // this callback is only invoked on the real /dashboard route.
  onClose: () => void
}

export function ComposeSheet({ type, editingId, onClose }: ComposeSheetProps) {
  const { drafts } = useDashboardData()
  const router = useRouter()
  // The shared PublishConfirmOverlay (byte-untouched, layout-level) closes on
  // Escape via its own window listener — while it is open, Esc belongs to it
  // alone. Without this guard one keypress would dismiss the confirm AND
  // eject the composer (unmounting the form mid-publish).
  const { confirmingId } = usePublishConfirm()
  const reducedMotion = useReducedMotion()
  const rootRef = useRef<HTMLElement | null>(null)
  const mountMsRef = useRef<number>(Date.now())

  // Broadcast the compose-open signal for exactly the mounted lifetime.
  useEffect(() => {
    trackComposeMount(1)
    return () => trackComposeMount(-1)
  }, [])

  // Close returns to the surface that OPENED the sheet. On the real page the
  // page-level onClose (§4.6 → router.push('/dashboard')) stands. But on the
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

  // Esc closes (§4.6). Autosave already ran — closing is consequence-free.
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

  const lastSavedIso = useMemo(() => {
    if (editingId) {
      return drafts.find((d) => d.id === editingId)?._updatedAt ?? null
    }
    // New compose: only a draft of this type committed AFTER the sheet
    // opened can be this session's draft — never claim an older row.
    let newest: string | null = null
    for (const d of drafts) {
      if (d.type !== type || d._draftState !== 'draft') continue
      if (new Date(d._updatedAt).getTime() < mountMsRef.current) continue
      if (newest === null || d._updatedAt > newest) newest = d._updatedAt
    }
    return newest
  }, [drafts, editingId, type])

  const runningHead = [
    `// COMPONIENDO — ${composeTypeLabel(type)}`,
    ...(editingId ? ['EDITANDO'] : []),
    lastSavedIso ? `BORRADOR GUARDADO ${clockHHMM(lastSavedIso)}` : 'SE GUARDA SOLO',
  ].join(' · ')

  return (
    // Stepped 4-frame opacity cut-in (§6) — no springs, no exits, no fades;
    // reduced-motion mounts settled. z-60: above the grid remnants and the
    // in-place overlay host (50), below HarvestConfirmModal (100).
    <motion.section
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Componiendo ${composeTypeLabel(type)}`}
      tabIndex={-1}
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ opacity: { duration: CUT_IN_DURATION, ease: stepEase } }}
      className="fixed inset-0 z-[60] overflow-y-auto bg-paper focus:outline-none"
    >
      {/* ≥24px cream mat on every side of the press bed (§4.2). */}
      <div className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8">
        <header className="mb-3 flex items-center justify-between gap-4">
          <span className="min-w-0 truncate font-mono text-d11 font-bold tracking-widest text-ink-soft">
            {runningHead}
          </span>
          <button
            type="button"
            onClick={handleClose}
            data-cue="tick"
            className={`min-h-[44px] shrink-0 border border-ink px-3 py-1 font-mono text-d13 tracking-widest text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
          >
            CERRAR ✕
          </button>
        </header>

        {/* The press bed: the dark composer as a printed object on paper
            (§1.7) — 1px ink border, existing forms byte-unmodified inside.
            `dash-press` scopes the globals.css reskin block that re-inks the
            forms' legacy dark/orange chrome to the pliego register (warm-ink
            ground, paper text, acid accent) — the ONLY mount with this
            ancestor; /admin and the dark site render the forms untouched. */}
        <div className="dash-press border border-ink p-6">
          <FormForType type={type} />
        </div>
      </div>
    </motion.section>
  )
}

// One switch, owned by the sheet (the page's interim ComposePanel and its
// twin switch are deleted at Stage-3 wiring — WP10).
function FormForType({ type }: { type: ComposeType }) {
  switch (type) {
    case 'mix':
      return <MixForm />
    case 'listicle':
      return <ListicleForm />
    case 'articulo':
      return <ArticuloForm />
    case 'evento':
      return <EventoForm />
    case 'review':
      return <ReviewForm />
    case 'editorial':
      return <EditorialForm />
    case 'opinion':
      return <OpinionForm />
    case 'noticia':
      return <NoticiaForm />
  }
}
