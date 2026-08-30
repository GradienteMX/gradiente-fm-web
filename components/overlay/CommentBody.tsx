import { Fragment } from 'react'
import { getEmojiTokenMap } from '@/lib/trophies'

// ── CommentBody ────────────────────────────────────────────────────────────
//
// Renders a comment body string, replacing trophy-unlocked emoji tokens
// (e.g. `:detonador:`, `:enigma:`) with styled glyph spans. Anyone can
// READ these — the unlock only gates the ability to WRITE them in the
// composer. Tokens posted by users without the unlock get rendered the
// same as anyone else's (the cost was paid by the writer's earning the
// trophy, not by the reader's earning anything).
//
// Paper note (fase C): the catalog's emoji colors (#F87171 / #A78BFA) fail
// contrast on cream (~2.3:1), so each glyph renders inside a tiny ink chip —
// a black panel where any hue is legal and both colors clear 6.5:1. The
// color map itself stays untouched (it's shared with dark surfaces).
//
// Pure render — no client state, no hooks. Server-compatible.

interface CommentBodyProps {
  body: string
  className?: string
}

const BODY_CLASS =
  'whitespace-pre-wrap font-grotesk text-d13 leading-relaxed text-ink-soft'

export function CommentBody({ body, className }: CommentBodyProps) {
  const tokenMap = getEmojiTokenMap()
  if (tokenMap.size === 0 || !body.includes(':')) {
    // Fast path: no tokens registered, or no colon in body → just text.
    return <p className={className ?? BODY_CLASS}>{body}</p>
  }

  // Build a single regex from all registered tokens (escaped for safety).
  const tokens = Array.from(tokenMap.keys())
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'g')

  const parts = body.split(pattern)

  return (
    <p className={className ?? BODY_CLASS}>
      {parts.map((part, i) => {
        const emoji = tokenMap.get(part)
        if (emoji) {
          return (
            <span
              key={i}
              className="mx-0.5 inline-flex min-w-[1.2em] items-center justify-center bg-ink px-1 align-baseline font-syne font-black leading-snug"
              style={{ color: emoji.color }}
              title={part}
            >
              {emoji.glyph}
            </span>
          )
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </p>
  )
}
