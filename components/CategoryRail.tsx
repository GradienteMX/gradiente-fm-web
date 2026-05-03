'use client'

import { useEffect, useState } from 'react'
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

  // Wrap the filter setter so changing categories also resets the page
  // scroll. Without this, switching from a long category to a short one
  // (e.g. EVENTO → OPINIÓN) leaves the user scrolled past the new top
  // cards — a layout shift that reads as "the feed went crazy and
  // cropped the top cards" because the sticky header overlaps them.
  //
  // Scroll INSTANTLY (no smooth) and BEFORE setCategoryFilter so the page
  // is at top when ContentGrid's Framer Motion `layout` animations kick
  // in. Smooth-scrolling competes with the card reflow and visibly
  // crops cards mid-transit.
  const changeFilter = (next: ContentType | null) => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0 })
    }
    setCategoryFilter(next)
  }

  // Dynamic sticky top: pin the rail BELOW the VibeSlider's sticky chips
  // strip (data-vibe-strip), not on top of it. Strip height varies with
  // viewport width — chip wrapping changes the line count — so a static
  // `top-[105px]` either underlaps (rail covered by chips) or overlaps
  // (rail covers chips). Measure on mount + resize + after chip-list
  // mutations so the rail always sits cleanly below the strip.
  const [stickyTop, setStickyTop] = useState(105)
  useEffect(() => {
    const strip = document.querySelector<HTMLElement>('[data-vibe-strip]')
    if (!strip) return
    const update = () => {
      const cs = getComputedStyle(strip)
      const stripStickyTop = parseInt(cs.top, 10) || 76
      // 8px breathing room between strip's bottom and rail's top.
      setStickyTop(stripStickyTop + strip.offsetHeight + 8)
    }
    update()
    window.addEventListener('resize', update)
    // Genre chips wrap differently if the user toggles filters / picks
    // a vibe — observe size changes too.
    const ro = new ResizeObserver(update)
    ro.observe(strip)
    return () => {
      window.removeEventListener('resize', update)
      ro.disconnect()
    }
  }, [])

  return (
    <aside className="hidden min-h-screen w-[120px] shrink-0 lg:block">
      {/* `top` + `maxHeight` are dynamic (see useEffect above) so the
          rail always sits cleanly below the VibeSlider's variable-height
          chips strip. `overflow-y-auto` handles the (rare) case where
          SECCION + audio visualizer combined exceed the remaining
          viewport space. No bg-base / no high z — the rail and chips
          strip live in disjoint vertical bands. */}
      <div
        className="sticky flex flex-col gap-5 overflow-y-auto"
        style={{
          top: stickyTop,
          maxHeight: `calc(100vh - ${stickyTop + 16}px)`,
        }}
      >
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
                onClick={() => changeFilter(null)}
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
              onClick={() => changeFilter(null)}
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
                    changeFilter(isActive ? null : type)
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
