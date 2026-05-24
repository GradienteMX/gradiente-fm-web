'use client'

import { useEffect, useState } from 'react'
import { Activity } from 'lucide-react'
import { TROPHY_CATALOG } from '@/lib/trophies'

// ── EngagementWidget ───────────────────────────────────────────────────────
//
// Private dashboard widget. Shows the user their own engagement_hp scalar
// + progress toward the next presence trophy threshold. PRIVATE by design
// (per [[project_user_hp_visibility]]) — anyone else loading /u/<this-user>
// never sees the number, only the trophies that have been earned.
//
// The four presence trophies define the threshold ladder:
//   presence_logged       — 10 ◇
//   presence_deep         — 25 ◇
//   presence_persistent   — 50 ◇
//   presence_insider_track— 100 ◇
//
// Data freshness: the scalar updates every 5 min via pg_cron (apply_user_hp_
// rollup chained with apply_trophy_unlocks). The widget re-fetches every
// 60s when mounted so the user sees post-rollup changes without a reload.

const PRESENCE_THRESHOLDS = [
  { key: 'presence_logged', target: 10 },
  { key: 'presence_deep', target: 25 },
  { key: 'presence_persistent', target: 50 },
  { key: 'presence_insider_track', target: 100 },
] as const

interface EngagementResponse {
  engagement_hp: number
  engagement_hp_last_updated_at: string | null
}

function nextThreshold(hp: number) {
  for (const t of PRESENCE_THRESHOLDS) {
    if (hp < t.target) return t
  }
  return null
}

function thresholdLabel(key: string): string {
  return TROPHY_CATALOG.find((t) => t.key === key)?.label ?? '—'
}

export function EngagementWidget() {
  const [data, setData] = useState<EngagementResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    const load = async () => {
      try {
        const res = await fetch('/api/users/me/engagement')
        if (!res.ok) {
          if (!cancelled) setError(`HTTP ${res.status}`)
          return
        }
        const body = (await res.json()) as EngagementResponse
        if (!cancelled) {
          setData(body)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'fetch failed')
      }
    }

    void load()
    timer = window.setInterval(() => void load(), 60_000)

    return () => {
      cancelled = true
      if (timer !== null) window.clearInterval(timer)
    }
  }, [])

  const hp = data?.engagement_hp ?? 0
  const next = nextThreshold(hp)
  const allUnlocked = next === null
  // Progress against the most recent SOURCE threshold (so the bar measures
  // the gap from the previous level, not from 0).
  const prevTarget = (() => {
    let prev = 0
    for (const t of PRESENCE_THRESHOLDS) {
      if (hp >= t.target) prev = t.target
      else break
    }
    return prev
  })()
  const target = next?.target ?? PRESENCE_THRESHOLDS[PRESENCE_THRESHOLDS.length - 1].target
  const pct = allUnlocked
    ? 100
    : Math.min(100, Math.max(0, ((hp - prevTarget) / (target - prevTarget)) * 100))

  return (
    <div className="flex flex-col gap-3 border border-border bg-surface p-4">
      <header className="flex items-center justify-between border-b border-dashed border-border/60 pb-2 font-mono text-[10px] tracking-widest">
        <span className="flex items-center gap-1.5 text-secondary">
          <Activity size={11} strokeWidth={1.5} />
          // PRESENCIA
        </span>
        <span className="text-muted">PRIVADO · SOLO TÚ</span>
      </header>

      {error ? (
        <p className="font-mono text-[10px] text-sys-red">⚠ {error}</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <span className="font-syne text-3xl font-black text-sys-orange">
              {hp.toFixed(1)}
            </span>
            <span className="font-mono text-[10px] tracking-widest text-muted">
              ◇ ACUMULADOS
            </span>
          </div>

          {allUnlocked ? (
            <p className="font-mono text-[10px] leading-relaxed text-secondary">
              Has cruzado todos los umbrales de presencia. Las nuevas insignias vendrán a través de tu actividad — sigue construyendo.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between font-mono text-[10px]">
                <span className="text-muted">PRÓXIMO HITO</span>
                <span className="text-secondary">{thresholdLabel(next.key)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden border border-border bg-base">
                <div
                  className="h-full bg-sys-orange transition-[width] duration-700 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between font-mono text-[9px] text-muted">
                <span>{prevTarget} ◇</span>
                <span>{target} ◇</span>
              </div>
            </div>
          )}

          <p className="font-mono text-[10px] leading-relaxed text-muted">
            La presencia decae lentamente — vida media de 60 días. Sigue interactuando para mantenerla.
          </p>
        </>
      )}
    </div>
  )
}
