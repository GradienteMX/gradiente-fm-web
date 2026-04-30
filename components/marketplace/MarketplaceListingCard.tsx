'use client'

import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type {
  ContentItem,
  MarketplaceListing,
  MarketplaceListingStatus,
} from '@/lib/types'

// ── MarketplaceListingCard ─────────────────────────────────────────────────
//
// Single listing tile inside the [[MarketplaceOverlay]] grid. Mirrors the
// reference screenshot: numbered top corner, image, title + category line,
// price in vibe-color, meta rows (condition / vendor / published-ago) and
// a colored status pill at the bottom.

const CATEGORY_LABEL: Record<string, string> = {
  vinyl: '12" VINYL',
  cassette: 'CASSETTE',
  cd: 'CD',
  synth: 'SYNTHESIZER',
  'drum-machine': 'DRUM MACHINE',
  turntable: 'TURNTABLE',
  mixer: 'DJ MIXER',
  outboard: 'OUTBOARD',
  merch: 'MERCH',
  other: 'OTRO',
}

const STATUS_LABEL: Record<MarketplaceListingStatus, string> = {
  available: 'AVAILABLE',
  reserved: 'RESERVED',
  sold: 'SOLD',
}

const STATUS_COLOR: Record<MarketplaceListingStatus, string> = {
  available: '#4ADE80',
  reserved: '#FBBF24',
  sold: '#9CA3AF',
}

interface Props {
  listing: MarketplaceListing
  partner: ContentItem
  // 1-based index for the corner number badge ("01", "02", ...).
  index: number
  // When set, the whole card becomes a button — opens the listing-detail
  // sub-overlay. Omitted in non-clickable contexts (e.g. the dashboard
  // composer's GRID preview pane).
  onClick?: () => void
}

export function MarketplaceListingCard({
  listing,
  partner,
  index,
  onClick,
}: Props) {
  const status = listing.status
  const statusColor = STATUS_COLOR[status]
  const currency = partner.marketplaceCurrency ?? ''
  const ago = (() => {
    try {
      return formatDistanceToNowStrict(parseISO(listing.publishedAt), {
        locale: es,
        addSuffix: false,
      }).toUpperCase()
    } catch {
      return '—'
    }
  })()
  const interactiveClass = onClick
    ? 'cursor-pointer text-left transition-colors hover:border-sys-orange focus:border-sys-orange focus:outline-none'
    : ''
  const wrapperClassName = `flex flex-col border border-border bg-elevated/30 ${interactiveClass}`
  // SWC won't take a string-literal-union JSX tag, so we render two branches.
  // The body is identical between them; differs only in element type.
  if (onClick) {
    return (
      <button
        type="button"
        className={wrapperClassName}
        data-listing-id={listing.id}
        onClick={onClick}
        aria-label={`Ver detalle de ${listing.title}`}
      >
        <CardBody
          listing={listing}
          partner={partner}
          index={index}
          status={status}
          statusColor={statusColor}
          currency={currency}
          ago={ago}
        />
      </button>
    )
  }
  return (
    <article
      className={wrapperClassName}
      data-listing-id={listing.id}
    >
      <CardBody
        listing={listing}
        partner={partner}
        index={index}
        status={status}
        statusColor={statusColor}
        currency={currency}
        ago={ago}
      />
    </article>
  )
}

function CardBody({
  listing,
  partner,
  index,
  status,
  statusColor,
  currency,
  ago,
}: {
  listing: MarketplaceListing
  partner: ContentItem
  index: number
  status: MarketplaceListingStatus
  statusColor: string
  currency: string
  ago: string
}) {
  return (
    <>
      {/* Top: number + image */}
      <div className="relative aspect-[4/3] overflow-hidden border-b border-border/60 bg-base">
        <span
          className="absolute left-2 top-2 z-10 bg-black/75 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-secondary backdrop-blur-sm"
          aria-hidden
        >
          {String(index).padStart(2, '0')}
        </span>
        {listing.images[0] ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[10px] tracking-widest text-muted">
            //{CATEGORY_LABEL[listing.category] ?? listing.category.toUpperCase()}
          </div>
        )}
      </div>

      {/* Middle: title + category */}
      <div className="flex flex-col gap-0.5 px-3 pt-2">
        <h3 className="font-syne text-sm font-bold leading-tight text-primary line-clamp-2">
          {listing.title || '[sin título]'}
        </h3>
        <span
          className="font-mono text-[9px] tracking-widest"
          style={{ color: '#F97316' }}
        >
          {CATEGORY_LABEL[listing.category] ?? listing.category.toUpperCase()}
        </span>
      </div>

      {/* Price */}
      <div className="px-3 pt-1.5 font-syne text-base font-bold text-primary">
        ${listing.price.toLocaleString('es-MX')} {currency}
      </div>

      {/* Meta rows */}
      <dl className="flex flex-col gap-0.5 px-3 pt-2 pb-2 font-mono text-[9px] leading-relaxed">
        <Meta label="CONDICIÓN" value={listing.condition} />
        <Meta label="VENDEDOR" value={partner.title} />
        <Meta label="PUBLICADO" value={ago} />
      </dl>

      {/* Status pill */}
      <div
        className="flex items-center justify-between border-t border-border/60 px-3 py-1.5 font-mono text-[10px] tracking-widest"
        style={{ color: statusColor }}
      >
        <span>{STATUS_LABEL[status]}</span>
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: statusColor }}
          aria-hidden
        />
      </div>
    </>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-baseline gap-2">
      <dt className="tracking-widest text-muted">{label}</dt>
      <dd className="truncate text-secondary">{value}</dd>
    </div>
  )
}
