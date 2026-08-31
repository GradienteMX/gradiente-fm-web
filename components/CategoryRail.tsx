'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ContentItem, ContentType } from '@/lib/types'
import { categoryColorOnLight, TYPE_DISPLAY_LABELS } from '@/lib/dashboard/palette'
import { useVibe } from '@/context/VibeContext'
import { QueueSeeder } from './audio/QueueSeeder'
import { ElCampo } from '@/components/fluid/ElCampo'

// Rail order — editorial axis first after eventos/mixes; labels come from the
// canonical TYPE_DISPLAY_LABELS vocabulary (lib/dashboard/palette).
const CATEGORIES: ContentType[] = [
  'evento',
  'mix',
  'review',
  'editorial',
  'articulo',
  'listicle',
  'noticia',
  'opinion',
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
    <aside className="hidden min-h-screen w-[150px] shrink-0 lg:block">
      {/* `top` + `maxHeight` are dynamic (see useEffect above) so the
          rail always sits cleanly below the VibeSlider's variable-height
          chips strip. `overflow-y-auto` handles the (rare) case where
          TIPO + EL CAMPO exceed the remaining viewport space. No bg / no
          high z — the rail and chips strip live in disjoint vertical bands. */}
      <div
        className="sticky flex flex-col gap-5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          top: stickyTop,
          maxHeight: `calc(100vh - ${stickyTop + 16}px)`,
        }}
      >
        <div>
          <div className="mb-3 flex items-center justify-between border-b border-ink pb-1">
            <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
              TIPO
            </span>
            {filterActive && (
              <button
                type="button"
                onClick={() => changeFilter(null)}
                aria-label="Limpiar filtro"
                title="Limpiar filtro · ver todo"
                className="px-2 font-mono text-d11 tracking-widest text-sys-red-paper transition-colors hover:text-ink"
              >
                ×
              </button>
            )}
          </div>

          <nav className="flex flex-col gap-0" aria-label="Filtrar por tipo">
            {/* TODO — pseudo-row, active when no filter set */}
            <button
              type="button"
              onClick={() => changeFilter(null)}
              aria-pressed={!filterActive}
              className={`flex min-h-11 items-center justify-between gap-2 border-b border-ink px-1 text-left font-mono text-d11 uppercase tracking-widest transition-colors ${
                !filterActive
                  ? 'bg-ink text-paper'
                  : 'text-ink hover:bg-ink hover:text-paper'
              }`}
            >
              <span className="font-bold">TODO</span>
              {total > 0 && <span>{total}</span>}
            </button>

            {CATEGORIES.map((type) => {
              const count = counts[type] ?? 0
              const color = categoryColorOnLight(type)
              const isActive = categoryFilter === type
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => changeFilter(isActive ? null : type)}
                  aria-pressed={isActive}
                  className={`group flex min-h-11 items-center gap-2 border-b border-ink px-1 text-left font-mono text-d11 uppercase tracking-widest transition-colors ${
                    isActive
                      ? 'bg-ink text-paper'
                      : 'text-ink hover:bg-ink hover:text-paper'
                  }`}
                >
                  {/* Swatch square — always paired with the printed label,
                      never the only signal. Outline flips to paper on the
                      ink fill so the square stays legible. */}
                  <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 border ${
                      isActive
                        ? 'border-paper'
                        : 'border-ink group-hover:border-paper'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {TYPE_DISPLAY_LABELS[type]}
                  </span>
                  {count > 0 && <span>{count}</span>}
                </button>
              )
            })}
          </nav>
        </div>

        {/* EL CAMPO — the feed's signal field, re-housed from the old
            full-viewport background into a framed rail panel (package B5,
            components/fluid/ElCampo). Self-gating: renders nothing on
            incapable surfaces, so the caption + panel simply collapse. */}
        <div>
          <p className="mb-1 font-mono text-d11 uppercase tracking-widest text-ink-faint">
            EL CAMPO · SEÑAL DEL FEED
          </p>
          <ElCampo />
        </div>

        {/* Real route out — the map is a full standalone surface. */}
        <Link
          href="/mapa"
          className="flex min-h-11 items-center justify-between gap-2 border border-ink px-2 font-mono text-d11 uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span>EXPLORAR MAPA</span>
          <span aria-hidden>→</span>
        </Link>

        {/* ── Queue seeding — invisible (renders null): registers the feed's
             playable mixes as the ambient skip-queue and cues one on load.
             The visible transport lives in the bottom GlobalPlayerBar now. ── */}
        <QueueSeeder items={items} />
      </div>
    </aside>
  )
}
