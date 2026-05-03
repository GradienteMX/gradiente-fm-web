'use client'

import { useRef, useState } from 'react'
import { useAuth } from '@/components/auth/useAuth'
import { invalidateComments } from '@/lib/hooks/useComments'

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
        onClick={openLogin}
        className="w-full border border-dashed px-3 py-2 text-left font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-white/40 hover:text-primary"
        style={{ borderColor: '#242424' }}
      >
        <span style={{ color: '#F97316' }}>[+]</span>{' '}
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
        className="font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
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
        <span className="text-muted">
          COMO <span className="text-primary">@{currentUser?.username}</span>
        </span>
      </div>
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={variant === 'root' ? 2 : 3}
        disabled={submitting}
        className="resize-y border bg-black px-3 py-2 font-mono text-[12px] leading-relaxed text-primary outline-none transition-colors focus:border-sys-orange disabled:opacity-60"
        style={{ borderColor: '#242424' }}
      />

      {error && (
        <div
          className="border px-2 py-1 font-mono text-[10px] tracking-widest"
          style={{
            borderColor: '#E63329',
            color: '#E63329',
            backgroundColor: '#E6332910',
          }}
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {variant === 'reply' && (
          <button
            type="button"
            onClick={cancel}
            disabled={submitting}
            className="font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary disabled:opacity-40"
          >
            CANCELAR
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={submitting || body.trim().length === 0}
          className="border px-3 py-1.5 font-mono text-[10px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: '#F97316',
            color: '#F97316',
            backgroundColor: 'rgba(249,115,22,0.08)',
          }}
        >
          {submitting ? '▶ ENVIANDO…' : '▶ ENVIAR'}
        </button>
      </div>
    </div>
  )
}
