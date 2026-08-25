'use client'

// ── ComposeLayout — «EL PLIEGO DE COMPOSICIÓN v2» page chrome ───────────────
//
// The full-page light editor shell: breadcrumb + H1 + autosave head + CERRAR,
// then two columns on ≥lg (section cards flex-1, rail w-80 sticky) and a
// single column on mobile with the rail stacked after the sections. PURELY
// PRESENTATIONAL — the type form owns the workbench and passes truth in.
//
// Mobile sticky-ACCIONES contract (shared with ComposeRail): the rail slot is
// `contents` below lg, so ComposeRail's panels become direct children of the
// column wrapper. That makes the wrapper — which spans the whole form — the
// containing block for ComposeRail's `sticky bottom-0` ACCIONES panel, so the
// actions pin to the viewport bottom while the editor scrolls. On ≥lg the
// slot becomes a real block (sticky top rail) and ComposeRail lays its own
// panels out in a column.
//
// TRUE DATA ONLY: the autosave head renders a timestamp only when the
// workbench has actually saved (`lastSavedAt` from useDraftWorkbench — ms
// epoch, stamped on every sessionStorage autosave). Before the first save it
// states the fact («Se guarda solo») without a fake clock. Motion
// constitution: no springs, no fades, no exits — the only animation is the
// sanctioned step-end `blink` on the loading hairline.

import { useEffect, useState, type ReactNode } from 'react'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { scrollToDashWidget } from '@/components/dashboard/shell/StatusStrip'

export interface ComposeLayoutProps {
  // Display label for the composed type, sentence-case ('Mix', 'Reseña', … —
  // composeTypeDisplay). The H1 renders it as-is; the breadcrumb uppercases
  // it via CSS, so both registers come from the one prop.
  typeLabel: string
  // `?edit=` present → breadcrumb says BORRADORES and the H1 says «Editar».
  isEdit: boolean
  // ms epoch of the last workbench autosave; null until the first save AFTER
  // a user edit this session. The type form gates this on its dirty flag —
  // hydration alone must never surface a timestamp, or a never-touched draft
  // would claim «Guardado automático · ahora» (fabricated state).
  lastSavedAt: number | null
  // ?edit deep-link still waiting for the item cache — show the explicit
  // «CARGANDO BORRADOR…» hairline instead of empty fields.
  hydrating: boolean
  // Lab-aware close (ComposeSheet's handleClose) — powers CERRAR ✕ and the
  // breadcrumb links (DASHBOARD / BORRADORES both leave the composer).
  onClose: () => void
  // The numbered section cards, in order.
  children: ReactNode
  // The <ComposeRail /> instance.
  rail: ReactNode
}

// ── Autosave head ───────────────────────────────────────────────────────────
// «● Guardado automático · hace Ns» — live-ticking, coarse (seconds → minutes
// → hours). Acid dot (sanctioned dot-badge: ≥8px, 1px ink outline) while the
// save is ≤30s fresh; ink-faint dot once stale; no timestamp claim when
// nothing has saved yet.

function coarseAge(ageSec: number): string {
  if (ageSec < 5) return 'ahora'
  if (ageSec < 60) return `hace ${ageSec}s`
  if (ageSec < 3600) return `hace ${Math.floor(ageSec / 60)} min`
  return `hace ${Math.floor(ageSec / 3600)} h`
}

function AutosaveHead({ lastSavedAt }: { lastSavedAt: number | null }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (lastSavedAt === null) return
    const id = setInterval(() => setTick((t) => t + 1), 5000)
    return () => clearInterval(id)
  }, [lastSavedAt])

  const ageSec =
    lastSavedAt === null ? null : Math.max(0, Math.floor((Date.now() - lastSavedAt) / 1000))
  const fresh = ageSec !== null && ageSec <= 30

  return (
    <p className="flex shrink-0 items-center gap-2 font-mono text-d11 tracking-wide text-ink-faint">
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 rounded-full ${
          fresh ? 'border border-ink bg-acid' : 'bg-ink-faint'
        }`}
      />
      {ageSec === null ? (
        <span>Se guarda solo</span>
      ) : (
        <span>Guardado automático · {coarseAge(ageSec)}</span>
      )}
    </p>
  )
}

// ── Breadcrumb ──────────────────────────────────────────────────────────────
// DASHBOARD ◂ / BORRADORES|NUEVO / <TYPE>. DASHBOARD and BORRADORES are real
// onClose-powered links (both leave the composer — the lab-aware close keeps
// them safe on /lab/*); NUEVO and the type crumb are position, not links.
// BORRADORES additionally lands the reader AT the drafts: after closing it
// scrolls to the CULTIVAR widget (retry-driven, so it waits out the grid
// remount) — guarded by the same /lab pathname check the shell's handleClose
// uses, because on /lab/* the sheet closes in place and there is no
// production dashboard grid to scroll.

function Crumb({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-cue="tick"
      className={`relative shrink-0 whitespace-nowrap underline-offset-4 before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] hover:underline ${FOCUS_RING}`}
    >
      {label}
    </button>
  )
}

function Breadcrumb({
  typeLabel,
  isEdit,
  onClose,
}: {
  typeLabel: string
  isEdit: boolean
  onClose: () => void
}) {
  return (
    <nav
      aria-label="Ruta de composición"
      className="flex min-w-0 items-center gap-2 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft"
    >
      <Crumb label="DASHBOARD ◂" onClick={onClose} />
      <span aria-hidden className="shrink-0 text-ink-faint">
        /
      </span>
      {isEdit ? (
        <Crumb
          label="BORRADORES"
          onClick={() => {
            onClose()
            // Same lab guard as ComposeSheet.handleClose: on /lab/* the close
            // is in-place — just close, nothing to scroll to.
            if (
              typeof window !== 'undefined' &&
              window.location.pathname.startsWith('/lab')
            ) {
              return
            }
            scrollToDashWidget('cultivar')
          }}
        />
      ) : (
        <span className="shrink-0">NUEVO</span>
      )}
      <span aria-hidden className="shrink-0 text-ink-faint">
        /
      </span>
      <span aria-current="page" className="min-w-0 truncate text-ink">
        {typeLabel}
      </span>
    </nav>
  )
}

// ── The layout ──────────────────────────────────────────────────────────────

export function ComposeLayout({
  typeLabel,
  isEdit,
  lastSavedAt,
  hydrating,
  onClose,
  children,
  rail,
}: ComposeLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-8">
      <header className="mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <Breadcrumb typeLabel={typeLabel} isEdit={isEdit} onClose={onClose} />
          <button
            type="button"
            onClick={onClose}
            data-cue="tick"
            className={`min-h-11 shrink-0 border border-ink px-3 py-1 font-mono text-d13 tracking-widest text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
          >
            CERRAR ✕
          </button>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="min-w-0 break-words font-syne text-d28 font-extrabold text-ink">
            {isEdit ? 'Editar borrador' : 'Nuevo borrador'}
            <span className="text-ink-faint"> / </span>
            {typeLabel}
          </h1>
          <AutosaveHead lastSavedAt={lastSavedAt} />
        </div>
      </header>

      {hydrating ? (
        // ?edit deep-link before the draft/published caches land — an honest
        // hairline state (§2.6 register: one blink bar, never skeleton
        // theater), stilled under prefers-reduced-motion.
        <div
          role="status"
          className="flex items-center gap-4 border border-ink bg-paper-raised px-5 py-4"
        >
          <span className="shrink-0 font-mono text-d13 font-bold tracking-widest text-ink-soft">
            CARGANDO BORRADOR…
          </span>
          <div
            aria-hidden
            className="h-0.5 w-1/3 animate-blink bg-ink motion-reduce:animate-none"
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          {/* Main column — numbered section cards, 16px rhythm. */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
          {/* Rail slot — `contents` below lg (see the sticky-ACCIONES contract
              in the header comment); real sticky block at ≥lg. */}
          <div className="contents lg:sticky lg:top-6 lg:block lg:w-80 lg:shrink-0">
            {rail}
          </div>
        </div>
      )}
    </div>
  )
}
