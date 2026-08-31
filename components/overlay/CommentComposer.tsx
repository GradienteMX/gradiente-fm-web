'use client'

import { useRef, useState } from 'react'
import { useAuth } from '@/components/auth/useAuth'
import { invalidateComments } from '@/lib/hooks/useComments'
import { recordHpEvent } from '@/lib/hpEvents'
import { useMyTrophies } from '@/lib/hooks/useMyTrophies'
import { unlockedEmojisFor } from '@/lib/trophies'

// ── CommentComposer ────────────────────────────────────────────────────────
//
// Two surface variants:
//   - root: pinned at the bottom of the comments column, always visible.
//           Posts a top-level comment (parentId === null).
//   - reply: collapsed by default below an existing comment. Click the
//            trigger to expand the textarea, post or cancel.
//
// Login-gated. Logged-out viewers see a one-click prompt that opens the
// LoginOverlay; the rest of the comments stay readable.
//
// Posts via POST /api/comments (which uses the SSR client, so RLS gates
// to authenticated only — `comments_authenticated_insert` policy). After
// success, `invalidateComments(itemId)` re-fetches the column.

// House focus grammar — 2px ink outline, offset 2.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

interface CommentComposerProps {
  itemId: string
  parentId: string | null
  variant: 'root' | 'reply'
  // Reply variant only: collapses the composer back to its trigger after
  // posting or canceling.
  onDone?: () => void
}

export function CommentComposer({
  itemId,
  parentId,
  variant,
  onDone,
}: CommentComposerProps) {
  const { currentUser, isAuthed, openLogin } = useAuth()
  // Reply composer collapses the textarea behind a "RESPONDER" trigger.
  // Root composer is always expanded (it's the column's primary action).
  const [expanded, setExpanded] = useState(variant === 'root')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const placeholder =
    variant === 'root'
      ? 'añadir comentario · enter para enviar, shift+enter para salto de línea'
      : 'responder a este comentario'

  // ── Logged-out path ─────────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <button
        type="button"
        onClick={() => openLogin()}
        className={`min-h-11 w-full border border-dashed border-ink px-3 py-2 text-left font-mono text-[10px] tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
      >
        {variant === 'root'
          ? 'INICIA SESIÓN PARA COMENTAR'
          : 'INICIA SESIÓN PARA RESPONDER'}
      </button>
    )
  }

  // ── Reply variant, collapsed ────────────────────────────────────────────
  if (variant === 'reply' && !expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          setExpanded(true)
          // Focus the textarea after it mounts.
          setTimeout(() => textareaRef.current?.focus(), 0)
        }}
        className={`font-mono text-[10px] tracking-widest text-ink-faint transition-colors hover:text-ink ${FOCUS_RING}`}
      >
        ↳ RESPONDER
      </button>
    )
  }

  const submit = async () => {
    if (!currentUser) return
    const trimmed = body.trim()
    if (trimmed.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemId, parentId, body: trimmed }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Failed' }))
        setError(json.error?.toString().toUpperCase() ?? 'FAILED')
        return
      }
      recordHpEvent(itemId, 'comment')
      setBody('')
      invalidateComments(itemId)
      if (variant === 'reply') {
        setExpanded(false)
        onDone?.()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const cancel = () => {
    setBody('')
    setExpanded(false)
    setError(null)
    onDone?.()
  }

  // Enter posts; shift+enter inserts newline.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
    if (e.key === 'Escape' && variant === 'reply') {
      cancel()
    }
  }

  // ── Logged-in, expanded form ────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-baseline justify-between gap-2 font-mono text-[10px] tracking-widest"
        aria-hidden
      >
        <span className="text-ink-faint">
          COMO <span className="font-bold text-ink">@{currentUser?.username}</span>
        </span>
      </div>
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label={variant === 'root' ? 'Escribe un comentario' : 'Escribe una respuesta'}
        placeholder={placeholder}
        rows={variant === 'root' ? 2 : 3}
        disabled={submitting}
        className={`resize-y border border-ink bg-paper-raised px-3 py-2 font-grotesk text-d15 text-ink transition-colors placeholder:text-ink-faint focus:bg-white disabled:opacity-60 ${FOCUS_RING}`}
      />

      <EmojiAffordance
        onInsert={(token) => {
          // Insert at the current cursor position; fall back to append.
          const el = textareaRef.current
          if (!el) {
            setBody((prev) => prev + token)
            return
          }
          const start = el.selectionStart ?? body.length
          const end = el.selectionEnd ?? body.length
          const next = body.slice(0, start) + token + body.slice(end)
          setBody(next)
          // Restore focus + cursor after the inserted token.
          requestAnimationFrame(() => {
            el.focus()
            const newPos = start + token.length
            el.setSelectionRange(newPos, newPos)
          })
        }}
      />

      {error && (
        <div className="border border-sys-red-paper px-2 py-1 font-mono text-[10px] tracking-widest text-sys-red-paper">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {variant === 'reply' && (
          <button
            type="button"
            onClick={cancel}
            disabled={submitting}
            className={`min-h-11 px-2 font-mono text-[10px] tracking-widest text-ink-faint transition-colors hover:text-ink disabled:opacity-40 ${FOCUS_RING}`}
          >
            CANCELAR
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={submitting || body.trim().length === 0}
          className={`min-h-11 border border-ink bg-ink px-4 font-mono text-[10px] tracking-widest text-paper transition-colors enabled:hover:bg-paper-raised enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
        >
          {submitting ? '▶ ENVIANDO…' : '▶ ENVIAR'}
        </button>
      </div>
    </div>
  )
}

// ── EmojiAffordance ────────────────────────────────────────────────────────
//
// Row of inline-emoji insert buttons. Only renders when the current user
// has earned at least one trophy with an associated unlockable emoji
// (e.g. signal_caster → :detonador:). Click inserts the token at the
// textarea cursor; the body renderer (CommentBody) swaps tokens for the
// styled glyph on read. The button list silently shrinks/expands as the
// user earns more trophies.
//
// Paper chips: ink border + ink token label; the trophy hue only appears on
// the glyph inside a tiny ink swatch (black-panel legality — the catalog
// colors fail contrast directly on cream).
function EmojiAffordance({ onInsert }: { onInsert: (token: string) => void }) {
  const earnedKeys = useMyTrophies()
  const unlocked = unlockedEmojisFor(earnedKeys).filter(
    (e): e is NonNullable<typeof e> => !!e,
  )
  if (unlocked.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[9px] tracking-widest text-ink-faint">
        DESBLOQUEADOS:
      </span>
      {unlocked.map((emoji) => (
        <button
          key={emoji.token}
          type="button"
          onClick={() => onInsert(emoji.token)}
          className={`flex items-center gap-1 border border-ink px-1.5 py-px font-mono text-[10px] tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
          title={`Insertar ${emoji.token}`}
        >
          <span
            aria-hidden
            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center bg-ink font-syne text-[10px] font-black leading-none"
            style={{ color: emoji.color }}
          >
            {emoji.glyph}
          </span>
          <span className="text-[9px]">{emoji.token}</span>
        </button>
      ))}
    </div>
  )
}
