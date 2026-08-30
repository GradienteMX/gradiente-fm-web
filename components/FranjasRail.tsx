'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef } from 'react'
import { parseISO } from 'date-fns'
import type { ContentItem, FranjaKind } from '@/lib/types'
import { useOverlay } from '@/components/overlay/useOverlay'
import { recordItems } from '@/lib/itemsCache'
import { SmartImage } from '@/components/SmartImage'

// ── FRANJAS · IDENTIDADES — the paper right rail («EL PLIEGO» fase B) ───────
//
// Identity instrument: a 2-col grid of logo cells on an ink ground (every
// logo reads against bg-panel regardless of its own palette — one consistent
// cell ground instead of per-image guessing), each with a paper footer bar
// carrying the name + kind chip. Hover is the house fill inversion; the
// EXPLORAR footer links to /marketplace, today's closest franja index.

const FRANJA_LABEL: Record<FranjaKind, string> = {
  label: 'SELLO',
  promoter: 'PROMOTORA',
  venue: 'VENUE',
  plataforma: 'PLATAFORMA',
  dealer: 'DEALER',
  colectivo: 'COLECTIVO',
  festival: 'FESTIVAL',
  club: 'CLUB',
  medios: 'MEDIO',
  'mix-series': 'MIX SERIES',
}

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

function franjaTime(item: ContentItem): number {
  return parseISO(item.franjaLastUpdated ?? item.publishedAt).getTime()
}

function FranjaCard({ item }: { item: ContentItem }) {
  const kind = item.franjaKind ?? 'colectivo'
  const { open } = useOverlay()
  const ref = useRef<HTMLButtonElement>(null)

  const handleOpen = () => {
    const rect = ref.current?.getBoundingClientRect()
    open(
      item.slug,
      rect
        ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
        : undefined,
    )
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleOpen}
      className={`block w-full text-left ${FOCUS_RING}`}
      aria-label={`Abrir ${item.title}`}
    >
      <article className="group border border-ink">
        {/* Logo zone — ink ground so any logo (light or dark) reads. */}
        <div className="relative aspect-[4/3] overflow-hidden bg-panel">
          {item.imageUrl ? (
            <SmartImage
              src={item.imageUrl}
              alt={item.title}
              sizes="(max-width: 1023px) 40vw, 120px"
              className="object-contain p-2"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-mono text-d18 font-bold uppercase tracking-widest text-panel-text">
              {item.title.slice(0, 2)}
            </span>
          )}
        </div>
        {/* Footer bar on paper — name + kind chip. Hover = fill inversion. */}
        <div className="border-t border-ink bg-paper-raised px-1.5 py-1 transition-colors group-hover:bg-ink">
          <h3 className="truncate font-grotesk text-d13 font-bold text-ink transition-colors group-hover:text-paper">
            {item.title}
          </h3>
          <span className="mt-0.5 inline-block max-w-full truncate border border-ink px-1 font-mono text-d11 uppercase tracking-widest text-ink transition-colors group-hover:border-paper group-hover:text-paper">
            {FRANJA_LABEL[kind]}
          </span>
        </div>
      </article>
    </button>
  )
}

interface FranjasRailProps {
  items: ContentItem[]
  // 'rail' = the desktop right-column aside (default). 'drawer' = a bare 2-col
  // grid of cards for the mobile FranjasDrawer (no aside chrome / fixed width /
  // md gate — the drawer provides its own frame).
  variant?: 'rail' | 'drawer'
}

export function FranjasRail({ items, variant = 'rail' }: FranjasRailProps) {
  const franjas = useMemo(
    () =>
      items
        .filter((i) => i.type === 'franja')
        .sort((a, b) => franjaTime(b) - franjaTime(a)),
    [items],
  )

  // Franjas must be in the slug-keyed cache so OverlayRouter can resolve
  // `?item=<slug>` against them. ContentGrid handles non-franja items; this
  // rail is the only surface that streams franjas, so it owns the push.
  useEffect(() => {
    if (franjas.length > 0) recordItems(franjas)
  }, [franjas])

  if (franjas.length === 0) return null

  // Drawer variant — bare responsive grid; the FranjasDrawer owns the chrome.
  if (variant === 'drawer') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {franjas.map((item) => (
          <FranjaCard key={item.id} item={item} />
        ))}
      </div>
    )
  }

  return (
    <aside
      className="hidden w-[260px] shrink-0 md:block"
      aria-label="Franjas y venues"
    >
      <section className="border border-ink bg-paper-raised">
        <header className="border-b border-ink px-3 py-2">
          <h2 className="font-mono text-d11 font-bold uppercase tracking-widest text-ink">
            FRANJAS · IDENTIDADES
          </h2>
          {/* Count line — franjas.length > 0 is guaranteed here (early null). */}
          <p className="mt-0.5 font-mono text-d11 uppercase tracking-widest text-ink-soft tabular-nums">
            {franjas.length} · SELLOS · VENUES · PROMO
          </p>
        </header>

        <div className="grid grid-cols-2 gap-2 p-3">
          {franjas.map((item) => (
            <FranjaCard key={item.id} item={item} />
          ))}
        </div>

        {/* Real destination: /marketplace is today's closest franja index. */}
        <Link
          href="/marketplace"
          className={`flex min-h-11 items-center justify-between gap-2 border-t border-ink px-3 font-mono text-d11 font-bold uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
        >
          <span>EXPLORAR FRANJAS</span>
          <span aria-hidden>→</span>
        </Link>
      </section>
    </aside>
  )
}
