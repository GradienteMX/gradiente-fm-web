'use client'

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'

// ── usePrompt ──────────────────────────────────────────────────────────────
//
// Globally-mounted NGE-styled replacement for `window.confirm()` and
// `window.prompt()`. Consumers call `confirm(opts)` or `input(opts)` and
// await the user's response — Promise resolves with the result, or
// `false` / `null` on cancel/dismiss.
//
// The visual sits in [[PromptOverlay]] and is mounted once at the layout
// root. ESC + backdrop click both resolve as cancel. Enter in input mode
// confirms. The destructive flag styles the confirm button in sys-red so
// "delete" gestures read as the heavier action they are.

export interface BasePromptOptions {
  /** Short heading shown in the title strip (small-caps mono). */
  title: string
  /** Optional longer description rendered below the title. Supports plain text. */
  body?: string
  /** Confirm button label. Default: CONFIRMAR. */
  confirmLabel?: string
  /** Cancel button label. Default: CANCELAR. */
  cancelLabel?: string
  /** Styles confirm in sys-red — for delete / destructive flows. */
  destructive?: boolean
}

export type ConfirmOptions = BasePromptOptions

export interface InputOptions extends BasePromptOptions {
  /** Placeholder text for the input field. */
  placeholder?: string
  /** Pre-filled value. */
  defaultValue?: string
}

// What the overlay reads to render the active prompt. Internal — consumers
// only see `confirm` / `input` from the hook.
export type PromptState =
  | null
  | ({ kind: 'confirm' } & ConfirmOptions)
  | ({ kind: 'input' } & InputOptions)

interface PromptContextValue {
  state: PromptState
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  input: (opts: InputOptions) => Promise<string | null>
  // Called by the overlay when user clicks confirm / cancel / presses ESC.
  // The overlay also passes the input value when in input mode.
  resolveConfirm: (ok: boolean) => void
  resolveInput: (value: string | null) => void
}

const Ctx = createContext<PromptContextValue | null>(null)

export function PromptProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PromptState>(null)
  // The pending resolver — typed loosely because it's either a boolean
  // (confirm) or string|null (input) resolver. A small prop-of-state would
  // type it better but the union complicates everything else; the writers
  // below preserve invariants.
  const pending = useRef<((value: unknown) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      pending.current = resolve as (value: unknown) => void
      setState({ kind: 'confirm', ...opts })
    })
  }, [])

  const input = useCallback((opts: InputOptions): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      pending.current = resolve as (value: unknown) => void
      setState({ kind: 'input', ...opts })
    })
  }, [])

  const resolveConfirm = useCallback((ok: boolean) => {
    const r = pending.current
    pending.current = null
    setState(null)
    r?.(ok)
  }, [])

  const resolveInput = useCallback((value: string | null) => {
    const r = pending.current
    pending.current = null
    setState(null)
    r?.(value)
  }, [])

  const value: PromptContextValue = {
    state,
    confirm,
    input,
    resolveConfirm,
    resolveInput,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePrompt(): {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  input: (opts: InputOptions) => Promise<string | null>
} {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePrompt must be used inside <PromptProvider>')
  return { confirm: ctx.confirm, input: ctx.input }
}

// Internal — consumed only by [[PromptOverlay]] to read the active state.
export function usePromptInternal(): PromptContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePromptInternal must be used inside <PromptProvider>')
  return ctx
}
