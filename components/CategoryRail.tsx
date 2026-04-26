'use client'

import type { ContentItem, ContentType } from '@/lib/types'
import { categoryColor } from '@/lib/utils'
import { useVibe } from '@/context/VibeContext'
import { Waveform } from './Waveform'

const CATEGORIES: { type: ContentType; label: string }[] = [
  { type: 'evento',    label: 'EVENTO' },
  { type: 'mix',       label: 'MIX' },
  { type: 'review',    label: 'REVIEW' },
  { type: 'editorial', label: 'EDITORIAL' },
  { type: 'articulo',  label: 'ARTÍCULO' },
  { type: 'listicle',  label: 'LISTA' },
  { type: 'noticia',   label: 'NOTICIA' },
  { type: 'opinion',   label: 'OPINIÓN' },
]

interface CategoryRailProps {
  items: ContentItem[]
}

export function CategoryRail({ items }: CategoryRailProps) {
  const { categoryFilter, setCategoryFilter } = useVibe()
  const counts = items.reduce<Partial<Record<ContentType, number>>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1
    return acc
  }, {})
  const total = items.length
  const filterActive = categoryFilter !== null

  return (
    <aside className="hidden w-[120px] shrink-0 lg:block">
      <div className="sticky top-[105px] flex flex-col gap-5">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="nge-divider">
              <span className="font-mono text-[9px] tracking-widest text-muted">
                SECCIÓN
              </span>
            </div>
            {filterActive && (
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                aria-label="Limpiar filtro"
                title="Limpiar filtro · ver todo"
                className="font-mono text-[9px] tracking-widest transition-colors"
                style={{ color: '#F97316' }}
              >
                ×
              </button>
            )}
          </div>

          <nav className="flex flex-col gap-0">
            {/* TODOS — pseudo-row, active when no filter set */}
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              aria-pressed={!filterActive}
              className="group flex items-center justify-between border-b border-border/40 py-2 transition-colors hover:bg-surface"
              style={{
                backgroundColor: !filterActive ? 'rgba(249,115,22,0.08)' : undefined,
              }}
            >
              <span
                className="font-mono text-[9px] tracking-widest transition-colors"
                style={{ color: !filterActive ? '#F97316' : '#888888' }}
              >
                //TODOS
              </span>
              <span
                className="font-mono text-[9px] transition-colors"
                style={{
                  color: !filterActive ? '#F97316' : '#444444',
                }}
              >
                {total}
              </span>
            </button>

            {CATEGORIES.map(({ type, label }) => {
              const count = counts[type] ?? 0
              const color = categoryColor(type)
              const isActive = categoryFilter === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setCategoryFilter(isActive ? null : type)
                  }
                  aria-pressed={isActive}
                  className="group flex items-center justify-between border-b border-border/40 py-2 transition-colors hover:bg-surface"
                  style={{
                    backgroundColor: isActive ? `${color}14` : undefined,
                  }}
                >
                  <span
                    className="font-mono text-[9px] tracking-widest transition-colors"
                    style={{
                      color,
                      // Subtle dim when another category is active
                      opacity: !filterActive || isActive ? 1 : 0.4,
                    }}
                  >
                    //{label}
                  </span>
                  <span
                    className="font-mono text-[9px] transition-colors"
                    style={{
                      color: isActive ? color : '#444444',
                      opacity: !filterActive || isActive ? 1 : 0.5,
                    }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* ── Waveform HUD — idle trace today, reactive when audio lands ── */}
        <div className="border border-border/60 bg-black/40 p-2">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-mono text-[8px] tracking-widest text-sys-orange/70">
              WAVEFORM·10-A
            </span>
            <span className="font-mono text-[7px] tabular-nums text-muted">78.6 Hz</span>
          </div>
          <span className="font-mono text-[7px] tracking-[0.2em] text-muted">
            SUB·FRECUENCIA
          </span>
          <Waveform height={64} className="mt-1" />
          <div className="mt-1 flex items-center justify-between">
            <span className="font-mono text-[7px] text-muted">●○</span>
            <span className="font-mono text-[7px] tabular-nums text-muted">10·F</span>
          </div>
        </div>

        {/* ── ANALIZANDO ESPECTRO — idle subsystem block ── */}
        <div className="border border-border/60 bg-black/40 p-2">
          <span className="font-mono text-[8px] tracking-widest text-sys-orange/70">
            ANALIZANDO·ESPECTRO
          </span>
          <div className="mt-2 h-[40px] relative overflow-hidden">
            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full">
              <path
                d="M0,22 C18,10 32,30 50,18 S82,28 100,14"
                fill="none"
                stroke="rgba(255, 102, 0, 0.55)"
                strokeWidth="0.5"
              />
              <path
                d="M0,28 C22,22 40,34 58,24 S86,20 100,26"
                fill="none"
                stroke="rgba(255, 153, 0, 0.25)"
                strokeWidth="0.4"
              />
            </svg>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="font-mono text-[7px] text-muted">▶</span>
            <span className="font-mono text-[7px] tabular-nums text-muted">1·0</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
