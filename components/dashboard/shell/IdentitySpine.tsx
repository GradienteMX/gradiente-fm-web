'use client'

import { useAuth } from '@/components/auth/useAuth'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import type { User } from '@/lib/types'
import { SmartImage } from '@/components/SmartImage'
import { useUserRank } from '@/lib/hooks/useUserRank'
import { avatarFrameStyle, badgeFor } from '@/lib/mockUsers'
import { hlBracket } from '@/lib/dashboard/hl'
import { trophyByKey } from '@/lib/trophies'

// ── IdentitySpine — the page's center (FINAL_SPEC §3.0) ─────────────────────
//
// Chrome: not draggable, not removable, not a grid cell. Left: the page's
// ONE Syne display moment («Hola, @user») + earned flair only (live rank
// helpers, trophy count, firma — real data or absent). Right: the HL status
// block — THE only place the raw engagement scalar ever renders, framed
// PRIVADO · SOLO TÚ, sourced from the provider's single engagement poll.
// Bracket words come from lib/dashboard/hl.ts (the third-copy killer);
// trophy-progress math is ported from the legacy EngagementWidget.
//
// avatarFrameStyle/badgeFor return their colors as values (live helpers, by
// spec) — rendered as spread frame styles and an outlined graphic dot, never
// as text color on paper.

const PRESENCE_THRESHOLDS = [
  { key: 'presence_logged', target: 10 },
  { key: 'presence_deep', target: 25 },
  { key: 'presence_persistent', target: 50 },
  { key: 'presence_insider_track', target: 100 },
] as const

function presenceProgress(hp: number) {
  const next = PRESENCE_THRESHOLDS.find((t) => hp < t.target) ?? null
  let prev = 0
  for (const t of PRESENCE_THRESHOLDS) {
    if (hp >= t.target) prev = t.target
    else break
  }
  const target = next?.target ?? PRESENCE_THRESHOLDS[PRESENCE_THRESHOLDS.length - 1].target
  const pct = next
    ? Math.min(100, Math.max(0, ((hp - prev) / (target - prev)) * 100))
    : 100
  return { next, prev, target, pct }
}

// `userOverride` is the LAB-BOUNDARY injection (same door-discipline as the
// provider's initialSlices): only app/lab/dashboard passes it, so the shell
// renders rich states without auth. Production never sets it.
export function IdentitySpine({ userOverride }: { userOverride?: User } = {}) {
  const { currentUser: authedUser, username } = useAuth()
  const { engagement, trophies, errors } = useDashboardData()
  const currentUser = authedUser ?? userOverride ?? null
  const rank = useUserRank(currentUser?.id ?? '')

  if (!currentUser) return null

  const handle = (authedUser ? username : null) ?? currentUser.username
  const badge = badgeFor(currentUser, rank)
  const frame = avatarFrameStyle(currentUser, rank)
  const trophyCount = trophies.size

  const hp = engagement?.hp ?? null
  const progress = hp !== null ? presenceProgress(hp) : null
  const nextLabel = progress?.next ? trophyByKey(progress.next.key)?.label ?? '—' : null

  return (
    <section
      aria-label="Panel de usuario"
      className="flex flex-col gap-6 py-8 lg:flex-row lg:items-end lg:justify-between"
    >
      {/* ── Left: greeting + earned flair ─────────────────────────────────── */}
      <div className="flex min-w-0 flex-col gap-4">
        <span className="font-mono text-d11 tracking-widest text-ink-soft">
          {'// PANEL DE USUARIO'}
        </span>

        <div className="flex items-end gap-5">
          <div
            className="relative h-14 w-14 shrink-0 overflow-hidden border border-ink bg-paper-raised"
            style={frame}
          >
            {currentUser.avatarUrl ? (
              <SmartImage
                src={currentUser.avatarUrl}
                alt={`@${handle}`}
                className="object-cover"
                sizes="56px"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center font-syne text-d18 font-extrabold uppercase text-ink">
                {handle.slice(0, 1)}
              </span>
            )}
          </div>
          <h1 className="min-w-0 break-words font-syne text-display font-extrabold text-ink">
            Hola, @{handle}
          </h1>
        </div>

        {/* Earned flair only — nothing renders without real data behind it. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5 border border-ink px-2 py-0.5 font-mono text-d11 font-bold tracking-widest text-ink">
            <span
              aria-hidden
              className="h-2 w-2 border border-ink"
              style={{ backgroundColor: badge.color }}
            />
            {badge.label}
          </span>
          {trophyCount > 0 && (
            <span className="font-mono text-d13 tracking-widest text-ink-soft tabular-nums">
              {trophyCount} {trophyCount === 1 ? 'TROFEO' : 'TROFEOS'}
            </span>
          )}
          {currentUser.firma && (
            <span className="font-grotesk text-d15 italic text-ink-soft">
              {currentUser.firma}
            </span>
          )}
        </div>
      </div>

      {/* ── Right: HL status block — the ONLY raw scalar render ───────────── */}
      <div className="flex w-full max-w-sm shrink-0 flex-col gap-3 border border-ink bg-paper-raised p-5">
        <span className="font-mono text-d11 tracking-widest text-ink-soft">
          {'// PRESENCIA · PRIVADO · SOLO TÚ'}
        </span>

        <div className="flex items-baseline justify-between gap-3">
          <span className="font-grotesk text-d28 font-bold text-ink tabular-nums">
            {hp !== null ? hp.toFixed(1) : '—'}
          </span>
          {hp !== null && (
            <span className="font-mono text-d13 tracking-widest text-ink">
              ◇ {hlBracket(hp)}
            </span>
          )}
        </div>

        {errors.engagement && hp === null ? (
          <p className="font-mono text-d13 text-ink">
            SEÑAL INTERRUMPIDA — se reintenta con el próximo sondeo.
          </p>
        ) : progress && progress.next ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between font-mono text-d11 tracking-widest">
              <span className="text-ink-soft">PRÓXIMO HITO</span>
              <span className="text-ink">{nextLabel}</span>
            </div>
            <div className="h-1.5 w-full border border-ink bg-paper">
              <div className="h-full bg-ink" style={{ width: `${progress.pct}%` }} />
            </div>
            <div className="flex justify-between font-mono text-d11 text-ink-faint tabular-nums">
              <span>{progress.prev} ◇</span>
              <span>{progress.target} ◇</span>
            </div>
          </div>
        ) : progress ? (
          <p className="font-mono text-d13 text-ink-soft">
            TODOS LOS UMBRALES DE PRESENCIA CRUZADOS.
          </p>
        ) : null}
      </div>
    </section>
  )
}
