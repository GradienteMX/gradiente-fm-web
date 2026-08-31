import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { TROPHY_CATALOG, trophyByKey, type TrophyKey } from '@/lib/trophies'
import { TrophyGlyph } from '@/components/trophies/TrophyGlyphs'

// ── TrophyGrid — expediente cells (fase E) ─────────────────────────────────
//
// Public surface on /u/[username], printed in the pliego register. Renders
// every trophy in the catalog as a paper cell: earned ones carry the
// pictograph on an ink block, the mono label, and the earned date as
// visible text; locked ones render as dashed silhouettes with the label
// redacted («▒▒▒▒▒»). Same grid shape regardless so users see "where they
// could go" without revealing numeric counters.
//
// Per [[project_user_hp_visibility]]: trophies ARE the visible progression
// signal. They replace what would otherwise be a leaderboard or score.
// Earned dates are public by RLS design (user_trophies, migration 0019).
//
// Pictographs come from components/trophies/TrophyGlyphs — the one trophy
// iconography site-wide (shared with the dashboard's TrophyStrip). The
// ASCII sigils in lib/trophies.ts no longer render here.
//
// Server component — no client state, no auth context. Ordering follows
// TROPHY_CATALOG so the layout is stable across users (a user with 3
// trophies sees them in the same slots as a user with 10).

interface TrophyGridProps {
  earnedKeys: string[]
  earnedAtByKey?: Map<string, string>
}

export function TrophyGrid({ earnedKeys, earnedAtByKey }: TrophyGridProps) {
  const earnedSet = new Set(earnedKeys)

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
      {TROPHY_CATALOG.map((trophy) => {
        const earned = earnedSet.has(trophy.key)
        return earned ? (
          <EarnedTrophy
            key={trophy.key}
            trophyKey={trophy.key}
            label={trophy.label}
            description={trophy.description}
            earnedAt={earnedAtByKey?.get(trophy.key)}
          />
        ) : (
          <LockedTrophy
            key={trophy.key}
            trophyKey={trophy.key}
            label={trophy.label}
            description={trophy.description}
          />
        )
      })}
    </div>
  )
}

// «AGO 2026» — printed month stamp, date-fns es locale.
function earnedDateLabel(earnedAt: string): string {
  return format(parseISO(earnedAt), 'MMM yyyy', { locale: es }).toUpperCase()
}

function EarnedTrophy({
  trophyKey,
  label,
  description,
  earnedAt,
}: {
  trophyKey: TrophyKey
  label: string
  description: string
  earnedAt?: string
}) {
  const dateLabel = earnedAt ? earnedDateLabel(earnedAt) : null
  const aria = dateLabel
    ? `Trofeo ganado: ${label} — ${description} Desbloqueado ${dateLabel}.`
    : `Trofeo ganado: ${label} — ${description}`

  return (
    <div
      role="group"
      aria-label={aria}
      title={dateLabel ? `${description} (${dateLabel})` : description}
      className="flex flex-col items-center justify-center gap-1.5 border border-ink bg-paper-raised p-3 text-center"
    >
      <span aria-hidden className="flex h-10 w-10 items-center justify-center bg-ink text-paper">
        <TrophyGlyph trophyKey={trophyKey} size={22} />
      </span>
      <span
        aria-hidden
        className="font-mono text-d11 font-bold leading-tight tracking-widest text-ink"
      >
        {label}
      </span>
      {dateLabel && (
        <span
          aria-hidden
          className="font-mono text-d11 leading-tight tracking-widest text-ink-faint"
        >
          {dateLabel}
        </span>
      )}
    </div>
  )
}

function LockedTrophy({
  trophyKey,
  label,
  description,
}: {
  trophyKey: TrophyKey
  label: string
  description: string
}) {
  // The strip's contract: locked = the NAMED condition in title/aria — no
  // counters, no «próximamente». Visually the label stays redacted.
  const named = `${label} — ${description}`

  return (
    <div
      role="group"
      aria-label={`Trofeo bloqueado: ${named}`}
      title={`BLOQUEADO — ${named}`}
      className="flex flex-col items-center justify-center gap-1.5 border border-ink bg-paper-raised p-3 text-center"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center border border-dashed border-ink-faint text-ink-faint"
      >
        <TrophyGlyph trophyKey={trophyKey} size={22} />
      </span>
      <span
        aria-hidden
        className="font-mono text-d11 font-bold leading-tight tracking-widest text-ink-faint"
      >
        ▒▒▒▒▒
      </span>
    </div>
  )
}

// Convenience for callers that want a count chip (e.g. "3 / 10").
export function trophyCountLine(earnedKeys: string[]): string {
  return `${earnedKeys.length} / ${TROPHY_CATALOG.length}`
}

// Type-guard for the consumers that want to filter unknown keys defensively.
export { trophyByKey }
