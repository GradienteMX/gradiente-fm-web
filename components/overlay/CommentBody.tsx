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
// Pure render — no client state, no hooks. Server-compatible.

interface CommentBodyProps {
  body: string
  className?: string
}

export function CommentBody({ body, className }: CommentBodyProps) {
  const tokenMap = getEmojiTokenMap()
  if (tokenMap.size === 0 || !body.includes(':')) {
    // Fast path: no tokens registered, or no colon in body → just text.
    return (
      <p className={className ?? 'whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-secondary'}>
        {body}
      </p>
    )
  }

  // Build a single regex from all registered tokens (escaped for safety).
  const tokens = Array.from(tokenMap.keys())
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'g')

  const parts = body.split(pattern)

  return (
    <p className={className ?? 'whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-secondary'}>
      {parts.map((part, i) => {
        const emoji = tokenMap.get(part)
        if (emoji) {
          return (
            <span
              key={i}
              className="inline-flex items-center justify-center px-1 font-syne font-black"
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
