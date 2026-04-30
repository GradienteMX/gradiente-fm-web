'use client'

import { useId } from 'react'
import { Plus, X } from 'lucide-react'
import type {
  ContentType,
  PollAttachment,
  PollChoice,
  PollKind,
} from '@/lib/types'
import { POLL_DEFAULT_PROMPT } from '@/lib/polls'

// ── PollFieldset ───────────────────────────────────────────────────────────
//
// Shared poll-authoring section for every content compose form. Drop into
// any [[Dashboard Forms]] form as `<PollFieldset type={draft.type} poll=…
// onChange=… />`.
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

export function PollFieldset({ type, poll, onChange }: Props) {
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
        className="flex items-center gap-2 self-start border border-dashed px-3 py-1.5 font-mono text-[10px] tracking-widest transition-colors hover:bg-white/[0.02]"
        style={{ borderColor: '#FBBF24', color: '#FBBF24' }}
      >
        <Plus size={11} strokeWidth={1.5} />
        INCLUIR ENCUESTA
      </button>
    )
  }

  return (
    <PollEditor
      kind={kind}
      poll={poll}
      onChange={onChange}
      onRemove={disable}
    />
  )
}

// ── Editor body ────────────────────────────────────────────────────────────

function PollEditor({
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
    <div className="flex flex-col gap-3 border bg-elevated/30 p-3" style={{ borderColor: '#3a3a3a' }}>
      <header className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-widest" style={{ color: '#FBBF24' }}>
          //ENCUESTA · {kindLabel(kind)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1 border border-border px-2 py-0.5 font-mono text-[9px] tracking-widest text-muted transition-colors hover:border-sys-red hover:text-sys-red"
          aria-label="Quitar encuesta"
        >
          <X size={9} strokeWidth={1.5} />
          QUITAR
        </button>
      </header>

      <p className="font-mono text-[10px] leading-relaxed text-muted">
        {kindHelp(kind)}
      </p>

      {/* Prompt — always editable. Default per kind. */}
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted">
          PREGUNTA
        </span>
        <input
          id={promptId}
          type="text"
          value={poll.prompt}
          onChange={(e) => patch({ prompt: e.target.value })}
          placeholder={POLL_DEFAULT_PROMPT[kind] || 'Pregunta'}
          className="w-full border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none"
        />
      </label>

      {/* Choices — freeform only. Other kinds derive from the parent. */}
      {kind === 'freeform' && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] tracking-widest text-muted">
            OPCIONES
          </span>
          {(poll.choices ?? []).length === 0 && (
            <p className="font-mono text-[10px] italic text-muted">
              Aún no hay opciones. Agrega al menos dos.
            </p>
          )}
          {(poll.choices ?? []).map((c, i) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <span className="w-6 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted">
                {i + 1}.
              </span>
              <input
                type="text"
                value={c.label}
                onChange={(e) => editChoice(i, e.target.value)}
                placeholder={`Opción ${i + 1}`}
                className="flex-1 border border-border bg-base px-2 py-1 font-mono text-[11px] text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeChoice(i)}
                aria-label={`Quitar opción ${i + 1}`}
                className="shrink-0 text-muted transition-colors hover:text-sys-red"
              >
                <X size={11} strokeWidth={1.5} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addChoice}
            className="self-start border border-dashed border-border px-2 py-0.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-orange hover:text-sys-orange"
          >
            <Plus size={9} strokeWidth={1.5} className="mr-1 inline" />
            AGREGAR OPCIÓN
          </button>
        </div>
      )}

      {/* Close date — optional. Empty = open indefinitely. */}
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted">
          CIERRA (opcional)
        </span>
        <input
          id={closesId}
          type="datetime-local"
          value={poll.closesAt ? poll.closesAt.slice(0, 16) : ''}
          onChange={(e) =>
            patch({ closesAt: e.target.value ? `${e.target.value}:00` : undefined })
          }
          className="w-full border border-border bg-base px-2 py-1.5 font-mono text-[11px] text-primary focus:border-sys-orange focus:outline-none"
        />
      </label>

      {/* Multi-choice toggle — defaults off; on lets the user pick more
          than one option. Useful for "any of the following you'd attend"
          style polls; rare for the typical single-favorite case. */}
      <label className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-muted">
        <input
          type="checkbox"
          checked={!!poll.multiChoice}
          onChange={(e) => patch({ multiChoice: e.target.checked || undefined })}
          className="accent-sys-orange"
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
