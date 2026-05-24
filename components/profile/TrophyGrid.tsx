import { TROPHY_CATALOG, trophyByKey } from '@/lib/trophies'

// ── TrophyGrid ─────────────────────────────────────────────────────────────
//
// Public surface on /u/[username]. Renders every trophy in the catalog —
// earned ones get full chrome (sigil + label + family color), locked ones
// render as silhouettes (dim glyph, no label, dashed border). Same grid
// shape regardless so users see "where they could go" without revealing
// numeric counters.
//
// Per [[project_user_hp_visibility]]: trophies ARE the visible progression
// signal. They replace what would otherwise be a leaderboard or score.
//
// Server component — no client state, no auth context. Earned trophies
// are passed in as a Set of keys. Ordering follows TROPHY_CATALOG so the
// layout is stable across users (a user with 3 trophies sees them in the
// same slots as a user with 10).

interface TrophyGridProps {
  earnedKeys: string[]
  earnedAtByKey?: Map<string, string>
}

export function TrophyGrid({ earnedKeys, earnedAtByKey }: TrophyGridProps) {
  const earnedSet = new Set(earnedKeys)

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
      {TROPHY_CATALOG.map((trophy) => {
        const earned = earnedSet.has(trophy.key)
        return earned ? (
          <EarnedTrophy
            key={trophy.key}
            label={trophy.label}
            description={trophy.description}
            sigil={trophy.sigil}
            color={trophy.color}
            earnedAt={earnedAtByKey?.get(trophy.key)}
          />
        ) : (
          <LockedTrophy key={trophy.key} sigil={trophy.sigil} />
        )
      })}
    </div>
  )
}

function EarnedTrophy({
  label,
  description,
  sigil,
  color,
  earnedAt,
}: {
  label: string
  description: string
  sigil: string
  color: string
  earnedAt?: string
}) {
  return (
    <div
      className="flex aspect-square flex-col items-center justify-center gap-1.5 border bg-surface p-3 text-center"
      style={{ borderColor: color }}
      title={earnedAt ? `${description} (${earnedAt.slice(0, 10)})` : description}
    >
      <span
        aria-hidden
        className="font-syne text-2xl font-black leading-none"
        style={{ color }}
      >
        {sigil}
      </span>
      <span
        className="font-mono text-[9px] leading-tight tracking-widest"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  )
}

function LockedTrophy({ sigil }: { sigil: string }) {
  return (
    <div
      className="flex aspect-square flex-col items-center justify-center gap-1.5 border border-dashed border-border/40 bg-base/30 p-3 text-center"
      title="Trofeo bloqueado"
    >
      <span
        aria-hidden
        className="font-syne text-2xl font-black leading-none text-muted/30"
      >
        {sigil}
      </span>
      <span className="font-mono text-[9px] leading-tight tracking-widest text-muted/30">
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
