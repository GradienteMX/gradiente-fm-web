'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

// ── ReportOverlay ──────────────────────────────────────────────────────────
//
// The reader's half of moderation. MODERACIÓN in /admin reads a queue that,
// before this sheet existed, nothing could write to: prod's whole moderation
// history is one action across four months, and every "reporte" count was
// therefore a number with no substrate. This is the gesture that fills it.
//
// Anatomy is the house sheet — the same one [[PromptOverlay]] and
// [[DashPopup]] draw: flat ink/60 scrim, paper panel on an ink hairline,
// mono kicker strip, Syne title, action row on a top rule. It is NOT a
// PromptOverlay variant because usePrompt only models confirm / input /
// type-to-confirm, and a report needs a required single-choice motive plus
// an optional note — a third field shape that would distort that contract.
//
// Portaled to <body> for the CRT-boot rect trap: this sheet opens from inside
// ThreadOverlay and from the comments column of the item overlay, and a
// transformed ancestor anywhere in that chain would make `fixed` resolve
// against the ancestor instead of the viewport. DashPopup portals for the
// same reason.
//
// ENVIAR REPORTE is sys-red-paper, never acid. Acid is the block colour for
// the one generative action on a surface; filing a report is a consequence
// aimed at another person's post, and it should read with that weight.
//
// Nothing here notifies, hides, or scores. The route deliberately has no
// auto-consequence and the copy says so — promising the user an outcome the
// system does not deliver would be the worst kind of decorative chrome.

export type ReportTargetType = 'item' | 'comment' | 'foro_thread' | 'foro_reply' | 'listing'

export type ReportReason =
  | 'spam'
  | 'acoso'
  | 'odio'
  | 'sexual'
  | 'violencia'
  | 'enganoso'
  | 'copyright'
  | 'otro'

// Mirrors the CHECK constraint on reports.reason (0049 §7) and the REASONS
// tuple in app/api/reports/route.ts. Order is the order of the sheet: the
// three commonest motives first, COPYRIGHT and OTRO last.
export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'spam', label: 'SPAM' },
  { id: 'acoso', label: 'ACOSO' },
  { id: 'odio', label: 'ODIO' },
  { id: 'sexual', label: 'CONTENIDO SEXUAL' },
  { id: 'violencia', label: 'VIOLENCIA' },
  { id: 'enganoso', label: 'ENGAÑOSO' },
  { id: 'copyright', label: 'COPYRIGHT' },
  { id: 'otro', label: 'OTRO' },
]

// What the sheet calls the thing being reported. `item` and `listing` have no
// gesture wired yet (see ReportButton) but the labels exist so the sheet is
// complete the day they do.
const TARGET_LABEL: Record<ReportTargetType, string> = {
  item: 'publicación',
  comment: 'comentario',
  foro_thread: 'hilo',
  foro_reply: 'respuesta',
  listing: 'anuncio',
}

// Matches the `note text check (char_length(note) <= 1000)` column and the
// server-side slice. Enforced here too so the counter is the truth, not a
// decoration that lets the user write 1200 characters and lose 200.
const NOTE_MAX = 1000

export interface ReportOverlayProps {
  targetType: ReportTargetType
  targetId: string
  onClose: () => void
  /** Fired after the row is on disk. `duplicate` = the API matched the
   *  one-report-per-person unique index, which is a success, not a failure. */
  onFiled: (duplicate: boolean) => void
}

export function ReportOverlay({
  targetType,
  targetId,
  onClose,
  onFiled,
}: ReportOverlayProps) {
  const groupName = useId()
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstRadioRef = useRef<HTMLInputElement>(null)

  // Lock body scroll. The host overlay has usually already locked it; saving
  // and restoring the previous value keeps the two nested locks from fighting
  // when this sheet closes first.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ESC closes. Capture phase + stopPropagation so the key doesn't also reach
  // ThreadOverlay's handler and close the thread underneath this sheet.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (!sending) onClose()
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose, sending])

  useEffect(() => {
    const t = setTimeout(() => firstRadioRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  const submit = async () => {
    if (!reason || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason,
          note: note.trim() || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        duplicate?: boolean
        error?: string
      }
      if (!res.ok) {
        // 503 is the honest one: migration 0049 §7 has not been applied to
        // this database, so there is no table to write to. Say that the
        // report was NOT saved — the route's own message alone could be read
        // as "queued for later".
        if (res.status === 503) {
          setError(
            'El sistema de reportes todavía no está activo en este servidor. Tu reporte no se guardó.',
          )
        } else if (res.status === 401) {
          setError('Tu sesión expiró. Volvé a iniciar sesión para reportar.')
        } else {
          setError(data.error ?? 'No se pudo enviar el reporte.')
        }
        setSending(false)
        return
      }
      onFiled(!!data.duplicate)
    } catch {
      // Network-level failure — the request never got an answer, so we know
      // nothing about whether it landed. Say only what is true.
      setError('No hubo respuesta del servidor. Revisá tu conexión e intentá de nuevo.')
      setSending(false)
    }
  }

  return createPortal(
    <div
      className="overlay-backdrop-in fixed inset-0 z-[80] flex items-center justify-center p-4"
      onClick={() => {
        if (!sending) onClose()
      }}
    >
      <div className="absolute inset-0 bg-ink/60" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="overlay-panel-in relative z-10 flex max-h-[85vh] w-full max-w-md flex-col border border-ink bg-paper text-ink"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${groupName}-title`}
      >
        {/* Kicker strip */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-ink px-4 py-1.5 font-mono text-d11 tracking-widest">
          <span className="font-bold text-sys-red-paper">REPORTAR</span>
          <span className="text-ink-faint">{TARGET_LABEL[targetType].toUpperCase()}</span>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
          <h2
            id={`${groupName}-title`}
            className="font-syne text-d18 font-bold uppercase leading-tight text-ink"
          >
            Reportar {TARGET_LABEL[targetType]}
          </h2>
          <p className="font-grotesk text-d13 leading-snug text-ink-soft">
            Un reporte es una señal para que una persona del equipo lo revise. No
            oculta el contenido ni avisa a quien lo publicó.
          </p>

          <fieldset className="flex flex-col gap-1 border-0 p-0">
            <legend className="mb-1 font-mono text-d11 uppercase tracking-widest text-ink-faint">
              Motivo
            </legend>
            {REPORT_REASONS.map((r, i) => {
              const active = reason === r.id
              return (
                <label
                  key={r.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-2.5 border px-2.5 font-mono text-d11 uppercase tracking-widest transition-colors ${
                    active
                      ? 'border-ink bg-paper-raised font-bold text-ink'
                      : 'border-ink/15 text-ink-soft hover:border-ink hover:text-ink'
                  }`}
                >
                  {/* appearance-none keeps the control square: the house has
                      no radius anywhere, and a native radio is the one widget
                      the browser rounds for you. Semantics stay native. */}
                  <input
                    ref={i === 0 ? firstRadioRef : undefined}
                    type="radio"
                    name={groupName}
                    value={r.id}
                    checked={active}
                    onChange={() => setReason(r.id)}
                    disabled={sending}
                    className={`h-3 w-3 shrink-0 appearance-none border border-ink bg-paper checked:bg-ink ${FOCUS_RING}`}
                  />
                  {r.label}
                </label>
              )
            })}
          </fieldset>

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${groupName}-note`}
              className="font-mono text-d11 uppercase tracking-widest text-ink-faint"
            >
              Nota (opcional)
            </label>
            <textarea
              id={`${groupName}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              maxLength={NOTE_MAX}
              rows={3}
              disabled={sending}
              placeholder="Contexto que ayude a entender el reporte."
              className={`w-full resize-y border border-ink bg-paper-raised px-2.5 py-2 font-grotesk text-d13 leading-snug text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
            />
            <span className="self-end font-mono text-d11 tabular-nums tracking-widest text-ink-faint">
              {note.length}/{NOTE_MAX}
            </span>
          </div>

          {error && (
            <p
              role="alert"
              className="border border-sys-red-paper px-2.5 py-2 font-mono text-d11 leading-relaxed tracking-widest text-sys-red-paper"
            >
              {error}
            </p>
          )}
        </div>

        {/* Action row */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-ink px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className={`min-h-11 border border-ink px-4 font-mono text-d13 tracking-widest text-ink transition-colors hover:bg-ink hover:text-panel-text disabled:cursor-not-allowed disabled:opacity-30 ${FOCUS_RING}`}
          >
            CANCELAR
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!reason || sending}
            className={`min-h-11 border border-sys-red-paper bg-sys-red-paper px-4 font-mono text-d13 font-bold tracking-widest text-panel-text transition-colors hover:bg-paper hover:text-sys-red-paper disabled:cursor-not-allowed disabled:opacity-30 ${FOCUS_RING}`}
          >
            {sending ? 'ENVIANDO…' : 'ENVIAR REPORTE'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
