'use client'

import { useId, useState } from 'react'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import { TROPHY_CATALOG } from '@/lib/trophies'
import { TrophyGlyph } from '@/components/trophies/TrophyGlyphs'

/** Canonical glyphs remain visible; their conditions are inspectable in place. */
export function TrophyStrip({ compact = false }: { compact?: boolean }) {
  const { trophies } = useDashboardData()
  const [hovered, setHovered] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const descriptionId = useId()
  const active = TROPHY_CATALOG.find((t) => t.key === (hovered ?? focused))
  return (
    <div className={`relative flex min-w-0 flex-wrap items-center gap-3 ${compact ? '' : 'border-t border-ink pt-2'}`} onMouseLeave={() => setHovered(null)}>
      <span className="shrink-0 font-mono text-d11 font-bold tracking-widest text-ink-soft">TROFEOS</span>
      <div className="flex flex-wrap items-center gap-1">
        {TROPHY_CATALOG.map((t) => {
          const earned = trophies.has(t.key)
          return <button key={t.key} type="button"
            aria-label={`${earned ? 'Trofeo ganado' : 'Trofeo bloqueado'}: ${t.label}`}
            aria-describedby={active?.key === t.key ? descriptionId : undefined}
            onFocus={() => setFocused(t.key)} onBlur={() => setFocused(null)}
            onMouseEnter={() => setHovered(t.key)} onClick={() => setFocused(t.key)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setHovered(null); setFocused(null) } }}
            className={`flex h-6 w-6 items-center justify-center border border-ink ${earned ? 'bg-ink text-paper' : 'bg-transparent text-ink-faint'} ${FOCUS_RING}`}>
            <TrophyGlyph trophyKey={t.key} />
          </button>
        })}
      </div>
      {active && <div id={descriptionId} role="tooltip" className="absolute left-0 top-full z-40 mt-2 w-80 max-w-full border border-ink bg-paper-raised p-3 text-ink shadow-lift">
        <p className="font-mono text-d11 font-bold tracking-widest">{trophies.has(active.key) ? 'DESBLOQUEADO' : 'POR DESBLOQUEAR'} · {active.label}</p>
        <p className="mt-1 text-d13 leading-relaxed">{active.description}</p>
      </div>}
    </div>
  )
}
