'use client'

import { CheckCircle2 } from 'lucide-react'
import type { ContentItem, PollChoice } from '@/lib/types'
import { useAuth } from '@/components/auth/useAuth'
import { vibeToColor, vibeMid } from '@/lib/utils'
import {
  castVote,
  isPollClosed,
  resolvePollChoices,
  usePollResults,
  useUserVote,
} from '@/lib/polls'

// ── PollSection ────────────────────────────────────────────────────────────
//
// Permanent poll surface inside an overlay. Sibling of [[PollCardCanvas]]
// (same data model, same anonymous-until-vote rule) but laid out as a full
// section instead of a temporary canvas. Mounts in [[ListicleOverlay]],
// [[MixOverlay]], [[EventoOverlay]], [[ReaderOverlay]], [[ArticuloOverlay]]
// — wherever the parent content has a `poll` attachment.

interface Props {
  item: ContentItem
  className?: string
}

export function PollSection({ item, className = '' }: Props) {
  const poll = item.poll
  const { currentUser, openLogin } = useAuth()
  const viewerId = currentUser?.id ?? null

  const choices = poll ? resolvePollChoices(item, poll) : []
  const userVote = useUserVote(poll?.id ?? null, viewerId)
  const results = usePollResults(poll?.id ?? null, choices)
  const closed = poll ? isPollClosed(poll) : false

  if (!poll) return null

  const hasVoted = userVote !== null
  const showResults = hasVoted || closed

  const handleVote = (choiceId: string) => {
    if (!viewerId) {
      openLogin()
      return
    }
    if (closed) return
    castVote(poll.id, viewerId, [choiceId])
  }

  const accent = vibeToColor(vibeMid(item))

  return (
    <section
      className={
        'flex flex-col gap-3 border bg-elevated/30 p-4 ' + className
      }
      style={{ borderColor: '#3a3a3a' }}
      aria-label="Encuesta"
    >
      <header className="flex items-center justify-between gap-2 font-mono text-[10px] tracking-widest">
        <span style={{ color: '#FBBF24' }}>
          //ENCUESTA{closed ? ' · CERRADA' : ''}
        </span>
        {showResults && (
          <span className="tabular-nums text-muted">
            {results.totalVotes} VOTO{results.totalVotes === 1 ? '' : 'S'}
          </span>
        )}
      </header>

      <h3 className="font-syne text-lg font-bold leading-tight text-primary">
        {poll.prompt}
      </h3>

      <div className="flex flex-col gap-1.5">
        {choices.length === 0 ? (
          <p className="font-mono text-[11px] leading-relaxed text-muted">
            La encuesta no tiene opciones.
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

      {!showResults && (
        <p className="font-mono text-[10px] leading-relaxed text-muted">
          //ANÓNIMO·HASTA·VOTAR — los resultados aparecen cuando emitas tu
          voto. {!viewerId && 'Inicia sesión para participar.'}
        </p>
      )}
    </section>
  )
}

// ── Choice row ─────────────────────────────────────────────────────────────
//
// Same shape as PollCardCanvas's row, but with the section's larger padding
// and font sizes so it reads at overlay-level rather than card-level. Could
// be merged later into a shared primitive if both surfaces need to stay
// pixel-identical; for now they have their own copies because the visual
// constraints differ (card = pinch in 1×1 image area; overlay = roomy).

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
  return (
    <button
      type="button"
      onClick={onVote}
      disabled={closed}
      aria-pressed={pickedByMe}
      className="relative flex items-center justify-between border px-3 py-2 font-mono text-[11px] tracking-widest transition-colors disabled:cursor-default"
      style={{
        borderColor: pickedByMe ? accent : '#3a3a3a',
        backgroundColor: pickedByMe ? `${accent}1f` : 'transparent',
        color: pickedByMe ? accent : '#9CA3AF',
      }}
    >
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
      <span className="relative z-10 flex min-w-0 items-center gap-2">
        {pickedByMe && (
          <CheckCircle2 size={11} strokeWidth={1.5} style={{ color: accent }} aria-hidden />
        )}
        <span className="truncate text-left">{choice.label}</span>
      </span>
      {showResults && (
        <span
          className="relative z-10 shrink-0 tabular-nums"
          style={{ color: pickedByMe ? accent : '#9CA3AF' }}
        >
          {pct}%
          <span className="ml-2 text-muted">
            ({count})
          </span>
        </span>
      )}
    </button>
  )
}
