'use client'

import { useId } from 'react'
import { Plus, X } from 'lucide-react'
import type { ContentType, PollAttachment, PollKind } from '@/lib/types'
import { POLL_DEFAULT_PROMPT } from '@/lib/polls'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

// ── PollFieldsetL — pliego fork of forms/shared/PollFieldset ────────────────
//
// The dark original stays byte-untouched. Shared poll-authoring section for
// the light compose forms: `<PollFieldsetL type={draft.type} poll=…
// onChange=… />`. Logic verbatim; chrome pliego.
//
// Kind is derived from the parent's content type — `listicle` → from-list,
// `mix` → from-tracklist, `evento` → attendance, everything else →
// freeform. The editor doesn't pick the kind; they only opt in/out and
// author the prompt + (for freeform) the choices.
//
// All knobs live behind one toggle: "INCLUIR ENCUESTA". Off = no poll on
// the item. On = the prompt + per-kind UI surface.

interface Props {
  type: ContentType
  poll: PollAttachment | null | undefined
  onChange: (next: PollAttachment | null) => void
}

export function PollFieldsetL({ type, poll, onChange }: Props) {
  const kind = defaultPollKindForType(type)
  if (!kind) {
    // partner → no poll (rail item, not a feed item)
    return null
  }

  const enabled = poll !== null && poll !== undefined

  const enable = () => {
    if (enabled) return
    onChange(makeEmptyPoll(kind))
  }

  const disable = () => onChange(null)

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={enable}
        className={`flex min-h-11 items-center gap-2 self-start border border-dashed border-ink px-3 font-mono text-d11 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
      >
        <Plus size={11} strokeWidth={2} />
        INCLUIR ENCUESTA
      </button>
    )
  }

  return (
    <PollEditorL
      kind={kind}
      poll={poll}
      onChange={onChange}
      onRemove={disable}
    />
  )
}

// ── Editor body ────────────────────────────────────────────────────────────

function PollEditorL({
  kind,
  poll,
  onChange,
  onRemove,
}: {
  kind: PollKind
  poll: PollAttachment
  onChange: (next: PollAttachment) => void
  onRemove: () => void
}) {
  const promptId = useId()
  const closesId = useId()

  const patch = (p: Partial<PollAttachment>) => onChange({ ...poll, ...p })

  const addChoice = () => {
    const next = [
      ...(poll.choices ?? []),
      { id: `ch-${randId()}`, label: '' },
    ]
    patch({ choices: next })
  }

  const editChoice = (idx: number, label: string) => {
    const next = (poll.choices ?? []).map((c, i) =>
      i === idx ? { ...c, label } : c,
    )
    patch({ choices: next })
  }

  const removeChoice = (idx: number) => {
    const next = (poll.choices ?? []).filter((_, i) => i !== idx)
    patch({ choices: next })
  }

  return (
    <div className="flex flex-col gap-3 border border-ink bg-paper-raised p-3">
      <header className="flex items-center justify-between gap-2">
        <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink">
          {'//'}ENCUESTA · {kindLabel(kind)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar encuesta"
          className={`flex min-h-11 items-center gap-1 border border-ink px-2.5 font-mono text-d11 uppercase tracking-widest text-ink hover:border-sys-red-paper hover:bg-sys-red-paper hover:text-paper md:min-h-9 ${FOCUS_RING}`}
        >
          <X size={10} strokeWidth={2} />
          QUITAR
        </button>
      </header>

      <p className="font-mono text-d11 leading-relaxed text-ink-faint">
        {kindHelp(kind)}
      </p>

      {/* Prompt — always editable. Default per kind. */}
      <label className="flex flex-col gap-1">
        <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
          PREGUNTA
        </span>
        <input
          id={promptId}
          type="text"
          value={poll.prompt}
          onChange={(e) => patch({ prompt: e.target.value })}
          placeholder={POLL_DEFAULT_PROMPT[kind] || 'Pregunta'}
          className={`min-h-11 w-full border border-ink bg-paper-raised px-3 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
        />
      </label>

      {/* Choices — freeform only. Other kinds derive from the parent. */}
      {kind === 'freeform' && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
            OPCIONES
          </span>
          {(poll.choices ?? []).length === 0 && (
            <p className="font-mono text-d11 italic text-ink-faint">
              Aún no hay opciones. Agrega al menos dos.
            </p>
          )}
          {(poll.choices ?? []).map((c, i) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <span className="w-6 shrink-0 text-right font-mono text-d11 tabular-nums text-ink-faint">
                {i + 1}.
              </span>
              <input
                type="text"
                value={c.label}
                onChange={(e) => editChoice(i, e.target.value)}
                placeholder={`Opción ${i + 1}`}
                className={`min-h-11 min-w-0 flex-1 border border-ink bg-paper-raised px-3 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
              />
              <button
                type="button"
                onClick={() => removeChoice(i)}
                aria-label={`Quitar opción ${i + 1}`}
                className={`flex h-11 w-11 shrink-0 items-center justify-center border border-ink text-ink hover:border-sys-red-paper hover:bg-sys-red-paper hover:text-paper md:h-9 md:w-9 ${FOCUS_RING}`}
              >
                <X size={12} strokeWidth={2} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addChoice}
            className={`flex min-h-11 items-center gap-1.5 self-start border border-dashed border-ink px-3 font-mono text-d11 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
          >
            <Plus size={11} strokeWidth={2} />
            AGREGAR OPCIÓN
          </button>
        </div>
      )}

      {/* Close date — optional. Empty = open indefinitely. */}
      <label className="flex flex-col gap-1">
        <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
          CIERRA (OPCIONAL)
        </span>
        <input
          id={closesId}
          type="datetime-local"
          value={poll.closesAt ? poll.closesAt.slice(0, 16) : ''}
          onChange={(e) =>
            patch({ closesAt: e.target.value ? `${e.target.value}:00` : undefined })
          }
          className={`min-h-11 w-full border border-ink bg-paper-raised px-3 font-mono text-d13 text-ink ${FOCUS_RING}`}
        />
      </label>

      {/* Multi-choice toggle — defaults off; on lets the user pick more
          than one option. Useful for "any of the following you'd attend"
          style polls; rare for the typical single-favorite case. */}
      <label className="flex min-h-11 cursor-pointer items-center gap-2 font-mono text-d11 uppercase tracking-widest text-ink-soft md:min-h-0">
        <input
          type="checkbox"
          checked={!!poll.multiChoice}
          onChange={(e) => patch({ multiChoice: e.target.checked || undefined })}
          className={`h-4 w-4 accent-ink ${FOCUS_RING}`}
        />
        VOTO MÚLTIPLE
      </label>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function defaultPollKindForType(type: ContentType): PollKind | null {
  switch (type) {
    case 'listicle':
      return 'from-list'
    case 'mix':
      return 'from-tracklist'
    case 'evento':
      return 'attendance'
    case 'noticia':
    case 'review':
    case 'editorial':
    case 'opinion':
    case 'articulo':
      return 'freeform'
    case 'partner':
      return null
  }
}

function makeEmptyPoll(kind: PollKind): PollAttachment {
  return {
    id: `pl-${randId()}`,
    kind,
    prompt: POLL_DEFAULT_PROMPT[kind],
    choices: kind === 'freeform' ? [] : undefined,
    createdAt: new Date().toISOString(),
  }
}

function randId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function kindLabel(kind: PollKind): string {
  switch (kind) {
    case 'from-list':
      return 'TU FAVORITO'
    case 'from-tracklist':
      return 'MEJOR DEL SET'
    case 'attendance':
      return 'ASISTENCIA'
    case 'freeform':
      return 'LIBRE'
  }
}

function kindHelp(kind: PollKind): string {
  switch (kind) {
    case 'from-list':
      return 'Las opciones se generan automáticamente a partir de los tracks de la lista. Solo edita la pregunta.'
    case 'from-tracklist':
      return 'Las opciones se generan automáticamente a partir del tracklist del mix. Solo edita la pregunta.'
    case 'attendance':
      return 'Las opciones son fijas (VOY / TAL VEZ / NO PUEDO). Solo edita la pregunta.'
    case 'freeform':
      return 'Pregunta libre. Agrega entre 2 y N opciones que el lector pueda elegir.'
  }
}
