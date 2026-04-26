'use client'

interface Stat {
  label: string
  value: string
  valueColor?: string
}

interface Props {
  draftCount: number
  publishedCount: number
  savedCount: number
  /** ISO timestamp of the most recent edit, if any. */
  lastEditedAt: string | null
  /** Soft cap — sessionStorage prototype caps at 50, real backend is TBD. */
  quotaUsed: number
  quotaTotal: number
}

/**
 * "ESTADO DE LA UNIDAD" panel — sits under the sidebar. Shows real counts
 * (drafts, publicados, guardados) plus a soft quota that hints at the future
 * limits a real backend will impose. Replaces the original decorative
 * "48.7 GB / 120 GB" gauge that didn't mean anything.
 */
export function ExplorerStorage({
  draftCount,
  publishedCount,
  savedCount,
  lastEditedAt,
  quotaUsed,
  quotaTotal,
}: Props) {
  const pct = Math.max(0, Math.min(1, quotaTotal > 0 ? quotaUsed / quotaTotal : 0)) * 100
  const stats: Stat[] = [
    { label: 'DRAFTS', value: String(draftCount), valueColor: '#F97316' },
    { label: 'PUBLICADOS', value: String(publishedCount), valueColor: '#4ADE80' },
    { label: 'GUARDADOS', value: String(savedCount), valueColor: '#22D3EE' },
    { label: 'ÚLT. EDIT', value: lastEditedAt ? timeAgo(lastEditedAt) : '—' },
  ]
  return (
    <aside className="flex w-full flex-col border border-border bg-surface md:w-[240px] md:flex-shrink-0">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 font-mono text-[10px] tracking-widest text-muted">
        <span>ESTADO DE LA UNIDAD</span>
      </div>
      <div className="flex flex-col gap-2 p-3 font-mono text-[10px]">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <dt className="tracking-widest text-muted">{s.label}</dt>
              <dd
                className="tabular-nums"
                style={{ color: s.valueColor ?? '#F0F0F0' }}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex items-center justify-between pt-2 text-muted">
          <span className="tracking-widest">CUOTA</span>
          <span className="text-secondary">
            {quotaUsed} / {quotaTotal}
          </span>
        </div>
        <div className="h-1.5 w-full border border-border">
          <div
            className="h-full"
            style={{
              width: `${pct}%`,
              background:
                'repeating-linear-gradient(-45deg, #F97316 0 4px, #C2410C 4px 8px)',
            }}
          />
        </div>
        <p className="text-[9px] leading-snug text-muted">
          Local. Cuando la unidad se conecte al backend, la cuota será real.
        </p>
      </div>
    </aside>
  )
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`
  return `${Math.floor(sec / 86400)}d`
}
