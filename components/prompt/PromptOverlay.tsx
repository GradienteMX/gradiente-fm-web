'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { usePromptInternal } from './usePrompt'

// ── PromptOverlay ──────────────────────────────────────────────────────────
//
// Mounts once at the layout root. Reads the active prompt state from
// [[usePrompt]] and renders one of two variants:
//   - confirm: title + body + CONFIRMAR / CANCELAR buttons
//   - input:   same chrome plus a single text field
//
// ESC + backdrop click resolve as cancel. Enter in input mode confirms.
// The destructive flag styles confirm in sys-red.
//
// Visual idiom matches [[PublishConfirmOverlay]] — eva-box + scanlines,
// black backdrop with blur, NGE title chrome.

export function PromptOverlay() {
  const { state, resolveConfirm, resolveInput } = usePromptInternal()
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Reset when a new prompt opens — the controlled input needs a fresh
  // value per opening, not a stale leftover from the previous prompt.
  const [inputValue, setInputValue] = useState('')

  const isOpen = state !== null
  const isInput = state?.kind === 'input'
  const destructive = !!state?.destructive

  // Re-seed the input when a new input prompt opens.
  useEffect(() => {
    if (state?.kind === 'input') {
      setInputValue(state.defaultValue ?? '')
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

  // Focus the safer button on open for confirm; the input for input prompts.
  useEffect(() => {
    if (!isOpen) return
    const t = setTimeout(() => {
      if (isInput) inputRef.current?.select()
      else cancelRef.current?.focus()
    }, 50)
    return () => clearTimeout(t)
  }, [isOpen, isInput])

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

  const cancel = () => {
    if (state.kind === 'confirm') resolveConfirm(false)
    else resolveInput(null)
  }
  const confirm = () => {
    if (state.kind === 'confirm') resolveConfirm(true)
    else resolveInput(inputValue.trim())
  }

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirm()
    }
  }

  // Confirm-button colors — destructive flips orange → red.
  const confirmColor = destructive ? '#E63329' : '#F97316'

  return (
    <div
      className="overlay-backdrop-in fixed inset-0 z-[80] flex items-center justify-center p-4"
      onClick={cancel}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="eva-box eva-scanlines overlay-panel-in relative z-10 flex w-full max-w-md flex-col overflow-hidden bg-base"
        role="alertdialog"
        aria-labelledby="prompt-title"
        aria-describedby={state.body ? 'prompt-body' : undefined}
      >
        {/* Title strip */}
        <header className="flex items-center justify-between border-b border-border bg-elevated/60 px-3 py-2 font-mono text-[10px] tracking-widest text-secondary">
          <span className="flex items-center gap-2">
            <AlertTriangle
              size={12}
              strokeWidth={1.5}
              style={{ color: confirmColor }}
            />
            <span id="prompt-title">
              //{state.kind === 'input' ? 'ENTRADA·REQUERIDA' : 'CONFIRMACIÓN·REQUERIDA'}
            </span>
          </span>
          <button
            type="button"
            onClick={cancel}
            aria-label="Cerrar"
            className="text-muted transition-colors hover:text-primary"
          >
            <X size={12} strokeWidth={1.5} />
          </button>
        </header>

        {/* Body */}
        <div className="flex flex-col gap-3 p-4">
          <h2 className="font-syne text-base font-bold leading-tight text-primary">
            {state.title}
          </h2>
          {state.body && (
            <p
              id="prompt-body"
              className="font-mono text-[11px] leading-relaxed text-secondary"
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
              className="w-full border bg-black/40 px-2 py-1.5 font-mono text-[12px] text-primary placeholder:text-muted/60 focus:border-sys-orange focus:outline-none"
              style={{ borderColor: '#3a3a3a' }}
              aria-label={state.title}
            />
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-elevated/30 px-3 py-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={cancel}
            className="border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest text-secondary transition-colors hover:border-white/60 hover:text-primary"
          >
            {state.cancelLabel ?? 'CANCELAR'}
          </button>
          <button
            type="button"
            onClick={confirm}
            className="border px-3 py-1.5 font-mono text-[10px] tracking-widest transition-colors"
            style={{
              borderColor: confirmColor,
              color: confirmColor,
              backgroundColor: `${confirmColor}1a`,
            }}
          >
            {state.confirmLabel ?? 'CONFIRMAR'}
          </button>
        </div>
      </div>
    </div>
  )
}
