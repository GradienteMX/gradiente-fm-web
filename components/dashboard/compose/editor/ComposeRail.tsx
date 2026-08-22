'use client'

// ── ComposeRail — the pliego composer's right rail ──────────────────────────
//
// Three panels, all TRUE data (spec «EL PLIEGO DE COMPOSICIÓN v2»):
//
//   ESTADO DEL BORRADOR  autosave fact + commit flash + COMPLETITUD n/m with
//                        the slim acid-on-ink bar + the ✓/○ checklist (rows
//                        scroll to their field via onAnchor).
//   PUBLICACIÓN          only REAL rows — EDITORIAL (staff-gated) and
//                        VINCULAR A MI PROMOTORA (partner-team only). Hidden
//                        when ungated, never disabled decoration. The whole
//                        panel disappears when no row is real. (No
//                        «Visibilidad» select, no «Programar» — those don't
//                        exist in the system; deliberate omissions.)
//   ACCIONES             GUARDAR BORRADOR (ink-filled) · CONTINUAR DESPUÉS
//                        (outline) · PUBLICAR <TYPE> (acid fill-block,
//                        ≥44px). Required-incomplete HOLDS all three exactly
//                        like the dark SubmitFooter gates save+publish — but
//                        legibly: «FALTAN n CAMPOS» renders inline, never a
//                        silently dead control.
//
// PRESENTATIONAL: the owning form computes the checklist (requiredFields.ts)
// and hands down workbench outputs + callbacks. No publishedAt anywhere —
// the workbench stamps it on every save, so it is NOT an honest date.
//
// Mobile contract (shared with ComposeLayout): the root is `contents` below
// lg, so the panels stack as direct children of the layout's column wrapper
// after the section cards — which lets the ACCIONES panel `sticky bottom-0`
// against the whole form's extent (actions pinned while editing). On ≥lg the
// root is a real flex column inside the sticky w-80 rail slot.

import type { ReactNode } from 'react'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import type { CommitFlash } from '@/components/dashboard/forms/shared/Fields'
import type { PublishMode } from '@/lib/drafts'
import type { RequiredField } from '@/components/dashboard/compose/requiredFields'

export interface ComposeRailProps {
  // requiredFields(type, draft) — the single required-truth source.
  checklist: RequiredField[]
  // completeness(checklist) — «n/m campos obligatorios».
  completeness: { done: number; total: number }
  // errors.length === 0 (same gate the dark SubmitFooter applies).
  canSubmit: boolean
  // Workbench outputs (useDraftWorkbench — passed through untouched).
  flash: CommitFlash
  isPublished: boolean
  publishMode: PublishMode
  // Display label for the PUBLICAR button ('MIX', 'RESEÑA', …).
  typeLabel: string
  // EDITORIAL toggle — staff-gated by the caller; row hidden when false.
  showEditorial: boolean
  editorialValue: boolean
  onEditorialChange: (value: boolean) => void
  // VINCULAR A MI PROMOTORA — partner-team only; row hidden when false.
  showPartner: boolean
  partnerValue: boolean
  onPartnerChange: (value: boolean) => void
  // ACCIONES: saveDraft · save + close to dashboard · publish recipe
  // (requestPublish → PublishConfirmOverlay; the ONE confirm stays outside).
  onSave: () => void
  onSaveAndClose: () => void
  onPublish: () => void
  // Checklist row click — scroll the field with this DOM id into view.
  onAnchor: (anchorId: string) => void
}

// ── Panel chrome (widget-frame register: eyebrow header + hairline) ─────────

function RailPanel({
  title,
  className = '',
  children,
}: {
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`border border-ink bg-paper-raised ${className}`}>
      <h3 className="border-b border-ink px-4 py-1.5 font-mono text-d11 font-bold uppercase leading-8 tracking-widest text-ink-soft">
        {'// '}
        {title}
      </h3>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </section>
  )
}

// ── Toggle row (light switch — role=switch, 44px, no transitions) ───────────

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      data-cue="tick"
      className={`flex min-h-11 w-full items-center justify-between gap-3 text-left ${FOCUS_RING}`}
    >
      <span className="min-w-0">
        <span className="block font-mono text-d13 font-bold tracking-widest text-ink">
          {label}
        </span>
        {hint && (
          <span className="block font-mono text-d11 tracking-wide text-ink-faint">{hint}</span>
        )}
      </span>
      {/* Track: ink panel when ON (acid knob = sanctioned on-panel use). */}
      <span
        aria-hidden
        className={`flex h-5 w-9 shrink-0 items-center border border-ink px-0.5 ${
          value ? 'justify-end bg-ink' : 'justify-start bg-paper-raised'
        }`}
      >
        <span className={`h-3.5 w-3.5 ${value ? 'bg-acid' : 'bg-ink'}`} />
      </span>
    </button>
  )
}

// ── The rail ────────────────────────────────────────────────────────────────

export function ComposeRail({
  checklist,
  completeness,
  canSubmit,
  flash,
  isPublished,
  publishMode,
  typeLabel,
  showEditorial,
  editorialValue,
  onEditorialChange,
  showPartner,
  partnerValue,
  onPartnerChange,
  onSave,
  onSaveAndClose,
  onPublish,
  onAnchor,
}: ComposeRailProps) {
  const pending = completeness.total - completeness.done
  const pct =
    completeness.total === 0
      ? 100
      : Math.round((completeness.done / completeness.total) * 100)
  const faltanLabel = `FALTAN ${pending} ${pending === 1 ? 'CAMPO' : 'CAMPOS'}`

  // Held (not silently dead): aria-disabled + guarded click keep the controls
  // focusable so the inline FALTAN reason is readable by everyone. Same gate
  // as the dark SubmitFooter (save AND publish require canSubmit).
  const guard = (fn: () => void) => () => {
    if (canSubmit) fn()
  }

  return (
    <div className="contents lg:flex lg:flex-col lg:gap-4">
      {/* ── ESTADO DEL BORRADOR ─────────────────────────────────────────── */}
      <RailPanel title="ESTADO DEL BORRADOR">
        {/* Autosave fact — the timestamp lives in the layout head; here the
            rail states the mechanism + the transient commit flashes. */}
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            AUTOGUARDADO
          </span>
          <span className="flex items-center gap-1.5 font-mono text-d13 tracking-widest text-ink">
            <span aria-hidden className="h-2 w-2 rounded-full border border-ink bg-acid" />
            ACTIVO
          </span>
        </div>
        {flash === 'draft' && (
          <p className="font-mono text-d11 font-bold tracking-widest text-ink" role="status">
            ◉ BORRADOR GUARDADO
          </p>
        )}
        {flash === 'published' && (
          <p className="font-mono text-d11 font-bold tracking-widest text-ink" role="status">
            ◉ PUBLICADO EN FEED
          </p>
        )}
        {isPublished && flash !== 'published' && (
          <p className="flex items-center gap-1.5 font-mono text-d11 tracking-widest text-ink-soft">
            <span aria-hidden className="h-2 w-2 rounded-full border border-ink bg-acid" />
            ESTADO: PUBLICADO
          </p>
        )}

        {/* COMPLETITUD n/m + slim acid-on-ink bar. */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
              COMPLETITUD
            </span>
            <span className="font-mono text-d13 tabular-nums tracking-widest text-ink">
              {completeness.done}/{completeness.total} OBLIGATORIOS
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Campos obligatorios completos"
            aria-valuemin={0}
            aria-valuemax={completeness.total}
            aria-valuenow={completeness.done}
            className="mt-1.5 h-2 w-full border border-ink bg-ink"
          >
            <div className="h-full bg-acid" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Checklist — one row per required field; click scrolls to it. */}
        <ul className="flex flex-col">
          {checklist.map((f) => (
            <li key={f.key}>
              <button
                type="button"
                onClick={() => onAnchor(f.anchorId)}
                data-cue="tick"
                aria-label={`Ir a ${f.label} — ${f.done ? 'completo' : 'pendiente'}`}
                className={`flex min-h-11 w-full items-center gap-2.5 text-left font-mono text-d13 tracking-widest underline-offset-4 hover:underline lg:min-h-9 ${
                  f.done ? 'text-ink' : 'text-ink-soft'
                } ${FOCUS_RING}`}
              >
                <span aria-hidden className="w-4 shrink-0 text-center">
                  {f.done ? '✓' : '○'}
                </span>
                <span className="min-w-0 flex-1 truncate">{f.label}</span>
                {!f.done && (
                  <span className="shrink-0 font-bold text-sys-red-paper">FALTA</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </RailPanel>

      {/* ── PUBLICACIÓN — only when at least one REAL row exists ─────────── */}
      {(showEditorial || showPartner) && (
        <RailPanel title="PUBLICACIÓN">
          {showEditorial && (
            <ToggleRow
              label="EDITORIAL"
              hint="BOOSTEA HP INICIAL"
              value={editorialValue}
              onChange={onEditorialChange}
            />
          )}
          {showPartner && (
            <ToggleRow
              label="VINCULAR A MI PROMOTORA"
              value={partnerValue}
              onChange={onPartnerChange}
            />
          )}
        </RailPanel>
      )}

      {/* ── ACCIONES — sticky at the viewport bottom on mobile ───────────── */}
      <RailPanel title="ACCIONES" className="sticky bottom-0 z-20 lg:static">
        <button
          type="button"
          onClick={guard(onSave)}
          aria-disabled={!canSubmit}
          data-cue="tick"
          className={`flex min-h-11 w-full flex-col items-center justify-center border px-4 py-1.5 font-mono text-d13 font-bold tracking-widest ${
            canSubmit
              ? 'border-ink bg-ink text-panel-text hover:bg-ink-soft'
              : 'cursor-not-allowed border-ink-faint bg-paper-raised text-ink-faint'
          } ${FOCUS_RING}`}
        >
          <span>▣ GUARDAR BORRADOR</span>
          {!canSubmit && (
            <span className="font-mono text-d11 font-bold tracking-widest text-sys-red-paper">
              ⚠ {faltanLabel}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={guard(onSaveAndClose)}
          aria-disabled={!canSubmit}
          title={canSubmit ? undefined : faltanLabel}
          data-cue="tick"
          className={`flex min-h-11 w-full items-center justify-center border px-4 py-1.5 font-mono text-d13 tracking-widest ${
            canSubmit
              ? 'border-ink text-ink hover:bg-ink hover:text-paper'
              : 'cursor-not-allowed border-ink-faint text-ink-faint'
          } ${FOCUS_RING}`}
        >
          CONTINUAR DESPUÉS
        </button>

        <div>
          <button
            type="button"
            onClick={guard(onPublish)}
            aria-disabled={!canSubmit}
            data-cue="tick"
            className={`flex min-h-12 w-full flex-col items-center justify-center border px-4 py-2 font-mono text-d15 font-bold tracking-widest ${
              canSubmit
                ? 'border-ink bg-acid text-ink hover:bg-ink hover:text-acid'
                : 'cursor-not-allowed border-ink-faint bg-paper-raised text-ink-faint'
            } ${FOCUS_RING}`}
          >
            <span>▶ PUBLICAR {typeLabel}</span>
            {!canSubmit && (
              <span className="font-mono text-d11 font-bold tracking-widest text-sys-red-paper">
                ⚠ {faltanLabel}
              </span>
            )}
          </button>
          {publishMode === 'edit' && (
            <p className="mt-1.5 font-mono text-d11 tracking-wide text-ink-faint">
              Publicar actualiza la pieza existente.
            </p>
          )}
        </div>
      </RailPanel>
    </div>
  )
}
