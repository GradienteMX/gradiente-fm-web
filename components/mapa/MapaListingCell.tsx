'use client'

// Spatial Identity Canvas — marketplace listing node.
// A listing is a content node inside its partner's focus cluster (spec
// § Marketplace behavior): product photo, //MERCADO chip, price + status as
// minimal metadata. Rim uses the spec's warm-sand marketplace direction —
// marketplace has no ContentType, so `categoryColor` can't provide it
// (recorded decision, pending the [[Color System]] palette pass).

import { memo, type KeyboardEvent } from 'react'
import type { MarketplaceListing, MarketplaceListingStatus } from '@/lib/types'
import type { ListingPlacement } from '@/lib/mapa/focus'

export const MARKETPLACE_RIM = '#D6B37A' // warm sand (spec § Rim color system)

const STATUS_LABEL: Record<MarketplaceListingStatus, string> = {
  available: 'DISPONIBLE',
  reserved: 'RESERVADO',
  sold: 'VENDIDO',
}

export interface MapaListingCellProps {
  placement: ListingPlacement
  currency: string
  onOpen: (listing: MarketplaceListing) => void
}

export const MapaListingCell = memo(function MapaListingCell({
  placement,
  currency,
  onOpen,
}: MapaListingCellProps) {
  const { listing, box, outline } = placement
  const meta = `$${listing.price} ${currency} · ${STATUS_LABEL[listing.status]}`

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(listing)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`MERCADO: ${listing.title}. ${meta}`}
      onClick={() => onOpen(listing)}
      onKeyDown={handleKeyDown}
      className="animate-fade-in group/listing absolute cursor-pointer outline-none [contain:layout_style]"
      style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
    >
      <div
        className="absolute inset-0"
        style={{ clipPath: `path('${outline}')` }}
      >
        {listing.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.images[0]}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-surface" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/75" />
        <div className="absolute inset-0 bg-white/0 transition-colors duration-150 group-hover/listing:bg-white/10 group-focus-visible/listing:bg-white/10" />
      </div>

      <svg
        width={box.width}
        height={box.height}
        viewBox={`0 0 ${box.width} ${box.height}`}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <path
          d={outline}
          fill="none"
          stroke={MARKETPLACE_RIM}
          strokeOpacity={0.9}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </svg>

      <div className="mapa-cell-text pointer-events-none absolute inset-0 flex flex-col justify-between px-[16%] pb-[11%] pt-[9%]">
        <span
          className="mapa-cell-label inline-flex w-fit items-center border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.14em]"
          style={{
            color: MARKETPLACE_RIM,
            borderColor: `${MARKETPLACE_RIM}99`,
            backgroundColor: '#0D0D0DB8',
          }}
        >
          {'//'}MERCADO
        </span>
        <div className="min-w-0">
          <h3 className="mapa-cell-title font-syne text-[15px] font-bold leading-[1.05] text-primary">
            <span className="line-clamp-2">{listing.title}</span>
          </h3>
          <p className="mapa-cell-meta mt-1 truncate font-mono text-[10px] tracking-wide text-primary/60">
            {meta}
          </p>
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -inset-1 hidden border-2 border-primary group-focus-visible/listing:block"
      />
    </div>
  )
})
