'use client'

import Link from 'next/link'
import type { ContentItem } from '@/lib/types'
import { SmartImage } from '@/components/SmartImage'

// ── MarketplaceCard ────────────────────────────────────────────────────────
//
// Single franja tile in the [[MarketplaceCatalog]] grid. Clicking opens
// the overlay via `?franja=<slug>`.
//
// «EL PLIEGO» fase F: the tile is a paper card — full-bleed art plate over an
// ink hairline frame, syne title, mono meta footer (total listings, available
// count, zone). The old NGE chrome (gradient scrim, amber stamp, green count)
// is gone; availability reads as a number, never as a hue.
//
// Art goes through SmartImage (next/image where the host is allow-listed) —
// this grid was one of the last raw-<img> surfaces feeding Supabase egress.

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// Grid is 1 / sm:2 / lg:3 inside the max-w-screen-2xl main column, so the
// widest a tile ever renders is ~480px. One hint per rendered image.
const ART_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 480px'

interface Props {
  franja: ContentItem
}

export function MarketplaceCard({ franja }: Props) {
  const listings = franja.marketplaceListings ?? []
  const available = listings.filter((l) => l.status === 'available').length

  return (
    <Link
      href={`/marketplace?franja=${encodeURIComponent(franja.slug)}`}
      className={`group flex flex-col border border-ink bg-paper-raised transition-colors hover:bg-paper ${FOCUS_RING}`}
      aria-label={`Abrir marketplace de ${franja.title}`}
    >
      {/* Art plate — ink ground behind the franja's own image. */}
      <div className="relative aspect-[5/3] overflow-hidden border-b border-ink bg-panel">
        {franja.imageUrl ? (
          <SmartImage
            src={franja.imageUrl}
            alt=""
            sizes={ART_SIZES}
            className="object-cover object-top"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-syne text-d28 font-extrabold uppercase text-panel-text">
            {franja.title.slice(0, 2)}
          </span>
        )}
        {/* Stamp — ink fill block, flush to the corner (no floating pill). */}
        <span className="absolute left-0 top-0 z-10 bg-ink px-1.5 py-0.5 font-mono text-d11 font-bold uppercase tracking-widest text-paper">
          MERCADO
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="font-syne text-d18 font-extrabold uppercase leading-tight text-ink line-clamp-2">
          {franja.title}
        </h3>
        {franja.subtitle && (
          <p className="font-grotesk text-d13 text-ink-soft line-clamp-1">
            {franja.subtitle}
          </p>
        )}
      </div>

      {/* Meta footer — counts + zone */}
      <dl className="grid grid-cols-3 gap-2 border-t border-ink px-3 py-2 font-mono text-d11 uppercase tracking-widest">
        <Stat label="ITEMS" value={String(listings.length).padStart(2, '0')} />
        <Stat label="DISPONIBLES" value={String(available).padStart(2, '0')} />
        <Stat label="ZONA" value={franja.marketplaceLocation ?? '—'} />
      </dl>
    </Link>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="truncate tabular-nums text-ink">{value}</dd>
    </div>
  )
}
