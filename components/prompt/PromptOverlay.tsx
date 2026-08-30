'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { usePromptInternal } from './usePrompt'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

// ── PromptOverlay ──────────────────────────────────────────────────────────
//
// Mounts once at the layout root. Reads the active prompt state from
// [[usePrompt]] and renders one of three variants:
//   - confirm: title + body + CONFIRMAR / CANCELAR buttons
//   - input:   same chrome plus a single text field
//   - type-to-confirm: high-friction gate where the confirm button is
//     disabled until the user types a literal required string (e.g.
//     "BORRAR <franja name>") for destructive flows
//
// ESC + backdrop click resolve as cancel. Enter in input/type-to-confirm
// mode confirms when valid. The destructive flag flips the confirm fill
// (and the kicker) to sys-red-paper.
//
// Fase C sheet — DashPopup anatomy: ink/60 scrim, paper sheet with an ink
// hairline and the lift shadow, Syne title, grotesk body, mono controls.
// CONFIRMAR is an ink fill-block (sys-red-paper fill when destructive);
// hover is a straight fill inversion.

export function PromptOverlay() {
  const { state, resolveConfirm, resolveInput } = usePromptInternal()
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Reset when a new prompt opens — the controlled input needs a fresh
  // value per opening, not a stale leftover from the previous prompt.
  const [inputValue, setInputValue] = useState('')

  const isOpen = state !== null
  const isInput = state?.kind === 'input'
  const isTypeToConfirm = state?.kind === 'type-to-confirm'
  const hasInputField = isInput || isTypeToConfirm
  // Type-to-confirm is implicitly destructive (it's the high-friction gate).
  const destructive = !!state?.destructive || isTypeToConfirm

  // Re-seed the input when a new input prompt opens.
  useEffect(() => {
    if (state?.kind === 'input') {
      setInputValue(state.defaultValue ?? '')
    } else if (state?.kind === 'type-to-confirm') {
      setInputValue('')
    }
  }, [state])

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  // Focus the safer button on open for confirm; the input for input /
  // type-to-confirm prompts.
  useEffect(() => {
    if (!isOpen) return
    const t = setTimeout(() => {
      if (hasInputField) inputRef.current?.select()
      else cancelRef.current?.focus()
    }, 50)
    return () => clearTimeout(t)
  }, [isOpen, hasInputField])

  // ESC closes as cancel.
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!state) return null

  // Type-to-confirm gates the confirm action until the user types the
  // literal required string — case + whitespace sensitive.
  const matchOk = state.kind === 'type-to-confirm' ? inputValue === state.requiredText : true

  const cancel = () => {
    if (state.kind === 'confirm') resolveConfirm(false)
    else if (state.kind === 'input') resolveInput(null)
    else resolveConfirm(false)
  }
  const confirm = () => {
    if (state.kind === 'confirm') {
      resolveConfirm(true)
    } else if (state.kind === 'input') {
      resolveInput(inputValue.trim())
    } else {
      // type-to-confirm
      if (!matchOk) return
      resolveConfirm(true)
    }
  }

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirm()
    }
  }

  return (
    <div
      className="overlay-backdrop-in fixed inset-0 z-[80] flex items-center justify-center p-4"
      onClick={cancel}
    >
      <div className="absolute inset-0 bg-ink/60" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="overlay-panel-in relative z-10 flex w-full max-w-md flex-col border border-ink bg-paper text-ink shadow-lift"
        style={{ transformOrigin: 'center center' }}
        role="alertdialog"
        aria-labelledby="prompt-title"
        aria-describedby={state.body ? 'prompt-body' : undefined}
      >
        {/* Kicker strip */}
        <header className="flex items-center justify-between gap-3 border-b border-ink px-4 py-1.5 font-mono text-d11 tracking-widest">
          <span
            className={`font-bold ${
              destructive ? 'text-sys-red-paper' : 'text-ink'
            }`}
          >
            {state.kind === 'input'
              ? 'ENTRADA REQUERIDA'
              : state.kind === 'type-to-confirm'
                ? 'CONFIRMACIÓN DESTRUCTIVA'
                : 'CONFIRMACIÓN REQUERIDA'}
          </span>
          <button
            type="button"
            onClick={cancel}
            aria-label="Cerrar"
            className={`-my-1.5 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-ink-faint transition-colors hover:text-ink ${FOCUS_RING}`}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </header>

        {/* Body */}
        <div className="flex flex-col gap-3 p-5">
          <h2
            id="prompt-title"
            className="font-syne text-d18 font-bold uppercase leading-tight text-ink"
          >
            {state.title}
          </h2>
          {state.body && (
            <p
              id="prompt-body"
              className="font-grotesk text-d13 leading-snug text-ink-soft"
            >
              {state.body}
            </p>
          )}

          {state.kind === 'input' && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={onInputKey}
              placeholder={state.placeholder}
              className={`w-full border border-ink bg-paper-raised px-2.5 py-2 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
              aria-label={state.title}
            />
          )}

          {state.kind === 'type-to-confirm' && (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-d11 tracking-widest text-ink-faint">
                Para confirmar, escribí:{' '}
                <span className="border border-sys-red-paper bg-sys-red-paper/10 px-1.5 py-0.5 font-bold text-sys-red-paper">
                  {state.requiredText}
                </span>
              </p>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={onInputKey}
                placeholder={state.placeholder ?? state.requiredText}
                autoComplete="off"
                spellCheck={false}
                className={`w-full border bg-paper-raised px-2.5 py-2 font-mono text-d13 text-ink placeholder:text-ink-faint ${
                  matchOk ? 'border-ink' : 'border-sys-red-paper/50'
                } ${FOCUS_RING}`}
                aria-label={state.title}
              />
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center justify-end gap-2 border-t border-ink px-4 py-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={cancel}
            className={`min-h-11 border border-ink px-4 font-mono text-d13 tracking-widest text-ink transition-colors hover:bg-ink hover:text-panel-text ${FOCUS_RING}`}
          >
            {state.cancelLabel ?? 'CANCELAR'}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!matchOk}
            className={`min-h-11 border px-4 font-mono text-d13 font-bold tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
              destructive
                ? 'border-sys-red-paper bg-sys-red-paper text-panel-text hover:bg-paper hover:text-sys-red-paper'
                : 'border-ink bg-ink text-panel-text hover:bg-paper hover:text-ink'
            } ${FOCUS_RING}`}
          >
            {state.confirmLabel ?? 'CONFIRMAR'}
          </button>
        </div>
      </div>
    </div>
  )
}
