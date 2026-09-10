'use client'

// Permission-gated attribution controls, shown during publication review.
// The layout consumes the form validation and action props.

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
  canSave: boolean
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
  // FIJAR EN PORTADA — staff-gated AND hero-eligible types only (editorial /
  // review / noticia / opinion — see getPinnedHero). Exactly one item holds
  // the portada: the publish route unpins every other row when this is set.
  showPin?: boolean
  pinValue?: boolean
  onPinChange?: (value: boolean) => void
  // VINCULAR A MI PROMOTORA — franja-team only; row hidden when false.
  showFranja: boolean
  franjaValue: boolean
  onFranjaChange: (value: boolean) => void
  // ACCIONES: saveDraft · save + close to dashboard · publish recipe
  // (requestPublish → PublishConfirmOverlay; the ONE confirm stays outside).
  onSave: () => void
  onSaveAndClose: () => void
  onPublish: () => void
  // Checklist row click — scroll the field with this DOM id into view.
  onAnchor: (anchorId: string) => void
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

export function ComposeRail({ showEditorial, editorialValue, onEditorialChange,
  showPin = false, pinValue = false, onPinChange,
  showFranja, franjaValue, onFranjaChange }: ComposeRailProps) {
  if (!showEditorial && !showFranja && !showPin) return null
  return <div className="mt-5 border-y border-ink/20 py-3">
    <p className="mb-2 font-mono text-d11 uppercase tracking-widest">Publicación y firma</p>
    {showEditorial && <ToggleRow label="Selección editorial" hint="Identifica esta pieza como una selección de redacción." value={editorialValue} onChange={onEditorialChange} />}
    {showPin && onPinChange && <ToggleRow label="Fijar en portada" hint="Ocupa el único hueco de portada al publicar; la pieza fijada hasta ahora lo deja." value={pinValue} onChange={onPinChange} />}
    {showFranja && <ToggleRow label="Publicar con mi franja" hint="La publicación mostrará la atribución de tu equipo." value={franjaValue} onChange={onFranjaChange} />}
  </div>
}
