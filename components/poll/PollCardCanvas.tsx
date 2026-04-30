'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import type { ContentItem, PollChoice } from '@/lib/types'
import { useAuth } from '@/components/auth/useAuth'
import { vibeToColor } from '@/lib/utils'
import {
  castVote,
  isPollClosed,
  resolvePollChoices,
  usePollResults,
  useUserVote,
} from '@/lib/polls'

// ── PollCardCanvas ─────────────────────────────────────────────────────────
//
// Card-level poll affordance. Lives absolute-positioned inside the card's
// image container. Two states:
//
//   closed: a small corner chip ("VOTAR" / "VAS?" / "VOTASTE") signals the
//           poll exists. Clicking it opens the canvas.
//
//   open:   the canvas takes over the image area. The image dims to a
//           scrim; the prompt + choices stack on top. Click a choice to
//           vote. After voting, the same surface reveals results as
//           horizontal vibe-colored bars (anonymous-until-vote — counts
//           are hidden until the viewer has cast their own vote).
//
// ESC / backdrop click / explicit close button all dismiss back to image.
// The card's title / badges / save mark stay put — the canvas only
// borrows the image's real estate, never the chrome.

interface Props {
  item: ContentItem
}

export function PollCardCanvas({ item }: Props) {
  const poll = item.poll
  const { currentUser, openLogin } = useAuth()
  const viewerId = currentUser?.id ?? null
  const [open, setOpen] = useState(false)

  // ESC closes when open.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Hooks must be called before any early return — keep them above the
  // null guard. usePollResults reads choices.length via a dep, so we
  // resolve choices regardless and pass an empty list when poll is null.
  const choices = poll ? resolvePollChoices(item, poll) : []
  const userVote = useUserVote(poll?.id ?? null, viewerId)
  const results = usePollResults(poll?.id ?? null, choices)
  const closed = poll ? isPollClosed(poll) : false

  if (!poll) return null

  const hasVoted = userVote !== null
  // Anonymous-until-vote: results hidden behind the gate.
  const showResults = hasVoted || closed

  const handleVote = (choiceId: string) => {
    if (!viewerId) {
      openLogin()
      return
    }
    if (closed) return
    castVote(poll.id, viewerId, [choiceId])
  }

  const chipLabel = chipLabelFor(poll.kind, hasVoted, closed)

  return (
    <>
      {/* Closed-state chip — always rendered when poll exists; hides when
          the canvas is open so it doesn't compete with the close button. */}
      {!open && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen(true)
          }}
          aria-label="Ver encuesta"
          className="absolute right-2 top-2 z-20 flex shrink-0 items-center gap-1 border bg-black/70 px-1.5 py-0.5 font-mono text-[9px] tracking-widest backdrop-blur-sm transition-colors hover:bg-black/90"
          style={{
            borderColor: hasVoted ? '#F97316' : '#FBBF24',
            color: hasVoted ? '#F97316' : '#FBBF24',
          }}
        >
          <span aria-hidden>{hasVoted ? '✓' : '?'}</span>
          <span>{chipLabel}</span>
        </button>
      )}

      {/* Open-state canvas — fills the image area. */}
      {open && (
        <div
          className="absolute inset-0 z-30 flex flex-col gap-2 p-3 overlay-backdrop-in"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
          }}
          // Don't bubble to the card click handler (which would open the
          // overlay). The poll lives separately from the read flow.
        >
          {/* Scrim that dims the image. */}
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" aria-hidden />

          {/* Inner — clicks stop propagation so users can interact without
              accidentally closing. */}
          <div
            className="relative z-10 flex flex-1 flex-col gap-2 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-2 font-mono text-[9px] tracking-widest text-secondary">
              <span style={{ color: '#FBBF24' }}>
                //ENCUESTA{closed ? ' · CERRADA' : ''}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar encuesta"
                className="text-muted transition-colors hover:text-primary"
              >
                <X size={12} strokeWidth={1.5} />
              </button>
            </header>

            <p className="font-syne text-sm font-bold leading-tight text-primary">
              {poll.prompt}
            </p>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {choices.length === 0 ? (
                <p className="font-mono text-[10px] leading-relaxed text-muted">
                  La encuesta no tiene opciones. {item.type === 'listicle'
                    ? 'Falta agregar tracks a la lista.'
                    : item.type === 'mix'
                      ? 'Falta agregar tracks al tracklist.'
                      : 'El editor no agregó opciones.'}
                </p>
              ) : (
                choices.map((c) => (
                  <ChoiceRow
                    key={c.id}
                    choice={c}
                    vibe={item.vibe}
                    showResults={showResults}
                    pickedByMe={userVote?.choiceIds.includes(c.id) ?? false}
                    count={results.perChoice[c.id] ?? 0}
                    total={results.totalVotes}
                    closed={closed}
                    onVote={() => handleVote(c.id)}
                  />
                ))
              )}
            </div>

            {showResults && results.totalVotes > 0 && (
              <p className="font-mono text-[9px] tracking-widest text-muted">
                {results.totalVotes} VOTO{results.totalVotes === 1 ? '' : 'S'}
              </p>
            )}
            {!showResults && (
              <p className="font-mono text-[9px] tracking-widest text-muted">
                LOS RESULTADOS APARECEN DESPUÉS DE VOTAR
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ── Choice row ─────────────────────────────────────────────────────────────

function ChoiceRow({
  choice,
  vibe,
  showResults,
  pickedByMe,
  count,
  total,
  closed,
  onVote,
}: {
  choice: PollChoice
  vibe: number
  showResults: boolean
  pickedByMe: boolean
  count: number
  total: number
  closed: boolean
  onVote: () => void
}) {
  const accent = vibeToColor(vibe)
  const pct = showResults && total > 0 ? Math.round((count / total) * 100) : 0
  const disabled = closed && !showResults
  return (
    <button
      type="button"
      onClick={onVote}
      disabled={closed}
      aria-pressed={pickedByMe}
      className="relative flex shrink-0 items-center justify-between border px-2 py-1.5 font-mono text-[10px] tracking-widest transition-colors disabled:cursor-default"
      style={{
        borderColor: pickedByMe ? accent : '#3a3a3a',
        backgroundColor: pickedByMe ? `${accent}1f` : 'rgba(0,0,0,0.4)',
        color: pickedByMe ? accent : '#9CA3AF',
      }}
    >
      {/* Result fill bar — only when results visible. Sits behind the text. */}
      {showResults && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 transition-[width]"
          style={{
            width: `${pct}%`,
            backgroundColor: pickedByMe ? `${accent}3a` : `${accent}14`,
          }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5 truncate">
        {pickedByMe && (
          <CheckCircle2
            size={10}
            strokeWidth={1.5}
            style={{ color: accent }}
            aria-hidden
          />
        )}
        <span className="truncate text-left">{choice.label}</span>
      </span>
      {showResults && (
        <span
          className="relative z-10 shrink-0 tabular-nums"
          style={{ color: pickedByMe ? accent : '#9CA3AF' }}
        >
          {pct}%
        </span>
      )}
    </button>
  )
}

// Per-kind chip copy. Spanish UI; tracks the difference between
// "you have a poll to look at" vs "you've already voted."
function chipLabelFor(
  kind: ContentItem['poll'] extends infer P
    ? P extends { kind: infer K }
      ? K
      : never
    : never,
  hasVoted: boolean,
  closed: boolean,
): string {
  if (closed) return 'CERRADA'
  if (hasVoted) return 'VOTASTE'
  switch (kind) {
    case 'attendance':
      return 'VAS?'
    case 'from-list':
      return 'VOTAR · FAV'
    case 'from-tracklist':
      return 'VOTAR · TRACK'
    case 'freeform':
      return 'VOTAR'
  }
  return 'VOTAR'
}
