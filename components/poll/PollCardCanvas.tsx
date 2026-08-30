'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import type { ContentItem, PollChoice } from '@/lib/types'
import { useAuth } from '@/components/auth/useAuth'
import { categoryColorOnLight } from '@/lib/dashboard/palette'
import {
  castVote,
  isPollClosed,
  resolvePollChoices,
  usePollResults,
  useUserVote,
} from '@/lib/polls'

// ── PollCardCanvas ─────────────────────────────────────────────────────────
//
// Card-level poll affordance. Lives absolute-positioned inside the card
// frame. Two states:
//
//   closed: a small corner chip ("VOTAR" / "VAS?" / "VOTASTE") signals the
//           poll exists. Clicking it opens the ballot.
//
//   open:   the printed ballot — a paper-raised sheet takes over the card
//           (inset-0, ink hairline; no scrims, no blur). The prompt +
//           choices stack on the sheet. Click a choice to vote. After
//           voting, the same rows reveal results as category-colored fill
//           bars (anonymous-until-vote — counts are hidden until the viewer
//           has cast their own vote).
//
// ESC / backdrop click / explicit close button all dismiss back to the card.

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
  // Result bars carry the item's category ink at reduced opacity. The bar is
  // never the only signal — the mono % beside it carries the value.
  const accent = categoryColorOnLight(item.type)

  return (
    <>
      {/* Closed-state chip — always rendered when poll exists; hides when
          the ballot is open so it doesn't compete with the close button.
          A live (votable) poll wears the sys-red-paper active accent; voted
          / closed settles to plain ink. */}
      {!open && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen(true)
          }}
          aria-label="Ver encuesta"
          className={`absolute right-2 top-2 z-20 flex shrink-0 items-center gap-1 border border-ink bg-paper-raised px-1.5 py-0.5 font-mono text-[9px] tracking-widest transition-colors hover:bg-ink hover:text-panel-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 ${
            hasVoted || closed ? 'text-ink' : 'text-sys-red-paper'
          }`}
        >
          <span aria-hidden>{hasVoted ? '✓' : '?'}</span>
          <span>{chipLabel}</span>
        </button>
      )}

      {/* Open-state ballot — a paper-raised sheet over the card. Cuts in
          (no fade/scale entrance per the motion constitution). */}
      {open && (
        <div
          className="absolute inset-0 z-30 flex flex-col gap-2 border border-ink bg-paper-raised p-3"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
          }}
          // Don't bubble to the card click handler (which would open the
          // overlay). The poll lives separately from the read flow.
        >
          {/* Inner — clicks stop propagation so users can interact without
              accidentally closing. */}
          <div
            className="relative flex flex-1 flex-col gap-2 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-2 font-mono text-[9px] tracking-widest">
              <span className="font-bold text-sys-red-paper">
                ENCUESTA{closed ? ' · CERRADA' : ''}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar encuesta"
                className="text-ink-faint transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"
              >
                <X size={12} strokeWidth={1.5} />
              </button>
            </header>

            <p className="font-syne text-sm font-bold leading-tight text-ink">
              {poll.prompt}
            </p>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {choices.length === 0 ? (
                <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
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
                    accent={accent}
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
              <p className="font-mono text-[9px] tracking-widest text-ink-faint">
                {results.totalVotes} VOTO{results.totalVotes === 1 ? '' : 'S'}
              </p>
            )}
            {!showResults && (
              <p className="font-mono text-[9px] tracking-widest text-ink-faint">
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
//
// Bordered ink row on the ballot sheet. While voting, hover is a straight
// fill inversion; once results show, the row reads as data — a fill bar in
// the item's category ink at reduced opacity plus the mono percentage.

function ChoiceRow({
  choice,
  accent,
  showResults,
  pickedByMe,
  count,
  total,
  closed,
  onVote,
}: {
  choice: PollChoice
  accent: string
  showResults: boolean
  pickedByMe: boolean
  count: number
  total: number
  closed: boolean
  onVote: () => void
}) {
  const pct = showResults && total > 0 ? Math.round((count / total) * 100) : 0
  const votable = !closed && !showResults
  return (
    <button
      type="button"
      onClick={onVote}
      disabled={closed}
      aria-pressed={pickedByMe}
      className={`relative flex shrink-0 items-center justify-between gap-2 overflow-hidden border border-ink px-2 py-1.5 font-mono text-[10px] tracking-widest text-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 disabled:cursor-default ${
        votable ? 'hover:bg-ink hover:text-panel-text' : ''
      }`}
    >
      {/* Result fill bar — only when results visible. Sits behind the text.
          '4D' ≈ 30% for the viewer's own pick, '26' ≈ 15% for the rest. */}
      {showResults && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 transition-[width]"
          style={{
            width: `${pct}%`,
            backgroundColor: `${accent}${pickedByMe ? '4D' : '26'}`,
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
        <span className="relative z-10 shrink-0 font-bold tabular-nums">
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
