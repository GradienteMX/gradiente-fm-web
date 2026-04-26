'use client'

import type { ContentItem, ContentType } from '@/lib/types'
import { categoryColor } from '@/lib/utils'
import { useVibe } from '@/context/VibeContext'
import { NowPlayingHud } from './audio/NowPlayingHud'

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

        {/* ── NOW PLAYING — persistent track + transport + matrix viz.
             Only transport surface visible when no overlay is open. ── */}
        <NowPlayingHud />
      </div>
    </aside>
  )
}
