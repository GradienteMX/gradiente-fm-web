'use client'

import { CheckCircle2 } from 'lucide-react'
import type { ContentItem, PollChoice } from '@/lib/types'
import { useAuth } from '@/components/auth/useAuth'
import { categoryColorOnLight } from '@/lib/dashboard/palette'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import {
  castVote,
  isPollClosed,
  resolvePollChoices,
  usePollResults,
  useUserVote,
} from '@/lib/polls'

// ── PollSection ────────────────────────────────────────────────────────────
//
// Permanent poll surface inside an overlay — the printed ballot, sibling of
// [[PollCardCanvas]] (same data model, same anonymous-until-vote rule) but
// laid out as a full section instead of a temporary canvas. Mounts in
// [[ListicleOverlay]], [[MixOverlay]], [[EventoOverlay]], [[ReaderOverlay]],
// [[ArticuloOverlay]] — wherever the parent content has a `poll` attachment.
//
// Fase C register: a paper-raised sheet with ink hairlines. Choice rows are
// bordered ink rows (fill inversion on hover while votable); once results
// show, each row carries a category-ink fill bar at low alpha plus the bold
// mono % — the viewer's own pick inverts to a full ink fill with an inline
// check. Category hue is never the sole signal: the % + (n) text carries
// the value.

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

  // Result bars carry the item's category ink at reduced opacity — the
  // on-cream palette, same as PollCardCanvas.
  const accent = categoryColorOnLight(item.type)

  return (
    <section
      className={
        'flex flex-col gap-3 border border-ink bg-paper-raised p-4 text-ink ' +
        className
      }
      aria-label="Encuesta"
    >
      <header className="flex items-center justify-between gap-2 font-mono text-d11 tracking-widest">
        <span className="font-bold text-sys-red-paper">
          ENCUESTA
          {closed && <span className="text-ink-faint"> · CERRADA</span>}
        </span>
        {showResults && results.totalVotes > 0 && (
          <span className="tabular-nums text-ink-faint">
            {results.totalVotes} VOTO{results.totalVotes === 1 ? '' : 'S'}
          </span>
        )}
      </header>

      <h3 className="font-syne text-d18 font-bold leading-tight text-ink">
        {poll.prompt}
      </h3>

      <div className="flex flex-col gap-1.5">
        {choices.length === 0 ? (
          <p className="font-mono text-d11 leading-relaxed text-ink-faint">
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
        <p className="font-mono text-d11 leading-relaxed text-ink-faint">
          ANÓNIMO HASTA VOTAR — los resultados aparecen cuando emitas tu
          voto. {!viewerId && 'Inicia sesión para participar.'}
        </p>
      )}
    </section>
  )
}

// ── Choice row ─────────────────────────────────────────────────────────────
//
// Same shape as PollCardCanvas's row, but at overlay scale (min-h-11 target,
// d13 mono). While votable the row is a plain bordered ink row with a fill
// inversion on hover. Once results show, the row reads as data — a fill bar
// in the item's category ink at low alpha plus the bold mono % and (n); the
// viewer's own pick wears a full ink fill with an inline check instead.

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
      className={`relative flex min-h-11 items-center justify-between gap-2 overflow-hidden border border-ink px-3 py-2 font-mono text-d13 tracking-widest transition-colors disabled:cursor-default ${
        pickedByMe
          ? 'bg-ink text-panel-text'
          : votable
            ? 'text-ink hover:bg-ink hover:text-panel-text'
            : 'text-ink'
      } ${FOCUS_RING}`}
    >
      {/* Result fill bar — category ink at low alpha, behind the text. The
          picked row is already a full ink fill, so it skips the bar. */}
      {showResults && !pickedByMe && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 transition-[width]"
          style={{
            width: `${pct}%`,
            backgroundColor: `${accent}26`,
          }}
        />
      )}
      <span className="relative z-10 flex min-w-0 items-center gap-2">
        {pickedByMe && (
          <CheckCircle2 size={12} strokeWidth={1.5} aria-hidden />
        )}
        <span className="truncate text-left">{choice.label}</span>
      </span>
      {showResults && (
        <span className="relative z-10 shrink-0 font-bold tabular-nums">
          {pct}%
          <span
            className={`ml-2 font-normal ${
              pickedByMe ? 'opacity-70' : 'text-ink-faint'
            }`}
          >
            ({count})
          </span>
        </span>
      )}
    </button>
  )
}
