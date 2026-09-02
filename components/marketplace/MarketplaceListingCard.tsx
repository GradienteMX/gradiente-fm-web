'use client'

import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { SmartImage } from '@/components/SmartImage'
import type {
  ContentItem,
  MarketplaceListing,
  MarketplaceListingStatus,
} from '@/lib/types'

// ── MarketplaceListingCard ─────────────────────────────────────────────────
//
// Single listing tile: numbered corner stamp, art plate, title + category,
// price, meta rows (condition / vendor / published-ago) and a status band.
//
// «EL PLIEGO» fase F. Four hosts render this card — MarketplaceCatalog,
// MarketplaceOverlay, FranjaOverlay and FranjaProfile — so the ground is a
//
//   paper (default) — the house sheet: paper-raised frame, ink hairlines.
//   dark            — the same anatomy inverted onto an ink panel, for a
//                     host whose ground is deliberately dark (/mapa's
//                     terrain void). NOT the retired EVA chrome: same
//                     hairlines, same type scale, no glow, no scanlines.
//
// Precedent: components/overlay/ShareButton.tsx. Every current call site
// is a paper surface (the public catalog, the marketplace overlay, and both
// franja dossiers), so this card carries ONE skin. Only the listing DETAIL
// keeps a dark variant, because /mapa really does render it over the dark
// terrain void.
//
// Art goes through SmartImage — this grid was one of the last raw-<img>
// surfaces feeding Supabase egress.

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

// The DB enum is exactly available | reserved | sold — nothing else exists.
const STATUS_LABEL: Record<MarketplaceListingStatus, string> = {
  available: 'DISPONIBLE',
  reserved: 'RESERVADO',
  sold: 'VENDIDO',
}

// Widest render is the catalog feed's lg:grid-cols-4 inside max-w-screen-2xl
// (~340px); the overlay/profile grids are narrower. One hint per image.
const ART_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 340px'

interface Skin {
  frame: string
  hover: string
  focus: string
  art: string
  artFallback: string
  indexStamp: string
  title: string
  category: string
  price: string
  metaLabel: string
  metaValue: string
  // Status is never hue-only: the word carries the state, the band's weight
  // and the dot's fill are the second and third channels.
  statusBand: Record<MarketplaceListingStatus, string>
}

const SKINS: Record<'paper', Skin> = {
  paper: {
    frame: 'border border-ink bg-paper-raised',
    hover: 'hover:bg-paper',
    focus: 'focus-visible:outline-ink',
    art: 'border-b border-ink bg-panel',
    artFallback: 'text-panel-text',
    indexStamp: 'bg-ink text-paper',
    title: 'text-ink',
    category: 'text-ink-faint',
    price: 'text-ink',
    metaLabel: 'text-ink-faint',
    metaValue: 'text-ink',
    statusBand: {
      available: 'border-ink text-ink',
      reserved: 'border-ink text-ink-soft',
      sold: 'border-ink bg-sys-red-paper text-paper',
    },
  },

}

interface Props {
  listing: MarketplaceListing
  franja: ContentItem
  // 1-based index for the corner number badge ("01", "02", ...).
  index: number
  // When set, the whole card becomes a button — opens the listing-detail
  // sub-overlay. Omitted in non-clickable contexts (e.g. the dashboard
  // composer's GRID preview pane).
  onClick?: () => void
  // Ground the card sits on. Defaults to the house paper sheet.
}

export function MarketplaceListingCard({
  listing,
  franja,
  index,
  onClick,
}: Props) {
  const skin = SKINS.paper
  const status = listing.status
  const currency = franja.marketplaceCurrency ?? ''
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
    ? `cursor-pointer text-left transition-colors ${skin.hover} focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${skin.focus}`
    : ''
  const wrapperClassName = `flex flex-col ${skin.frame} ${interactiveClass}`
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
          franja={franja}
          index={index}
          status={status}
          skin={skin}
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
        franja={franja}
        index={index}
        status={status}
        skin={skin}
        currency={currency}
        ago={ago}
      />
    </article>
  )
}

function CardBody({
  listing,
  franja,
  index,
  status,
  skin,
  currency,
  ago,
}: {
  listing: MarketplaceListing
  franja: ContentItem
  index: number
  status: MarketplaceListingStatus
  skin: Skin
  currency: string
  ago: string
}) {
  return (
    <>
      {/* Top: numbered stamp + art plate */}
      <div className={`relative aspect-[4/3] overflow-hidden ${skin.art}`}>
        <span
          className={`absolute left-0 top-0 z-10 px-1.5 py-0.5 font-mono text-d11 font-bold tabular-nums tracking-widest ${skin.indexStamp}`}
          aria-hidden
        >
          {String(index).padStart(2, '0')}
        </span>
        {listing.images[0] ? (
          <SmartImage
            src={listing.images[0]}
            alt=""
            sizes={ART_SIZES}
            className="object-cover object-top"
          />
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center px-2 text-center font-mono text-d11 uppercase tracking-widest ${skin.artFallback}`}
          >
            {CATEGORY_LABEL[listing.category] ?? listing.category.toUpperCase()}
          </span>
        )}
      </div>

      {/* Middle: title + category */}
      <div className="flex flex-col gap-0.5 px-3 pt-2">
        <h3
          className={`font-syne text-d15 font-extrabold leading-tight line-clamp-2 ${skin.title}`}
        >
          {listing.title || '[sin título]'}
        </h3>
        <span
          className={`font-mono text-d11 uppercase tracking-widest ${skin.category}`}
        >
          {CATEGORY_LABEL[listing.category] ?? listing.category.toUpperCase()}
        </span>
      </div>

      {/* Price */}
      <div
        className={`px-3 pt-1.5 font-syne text-d18 font-extrabold tabular-nums ${skin.price}`}
      >
        ${listing.price.toLocaleString('es-MX')} {currency}
      </div>

      {/* Meta rows — mt-auto keeps the status bands aligned across a grid row */}
      <dl className="mt-auto flex flex-col gap-0.5 px-3 pb-2 pt-2 font-mono text-d11">
        <Meta label="CONDICIÓN" value={listing.condition} skin={skin} />
        <Meta label="VENDEDOR" value={franja.title} skin={skin} />
        <Meta label="PUBLICADO" value={ago} skin={skin} />
      </dl>

      {/* Status band — word first, dot second (solid = settled, hollow = held) */}
      <div
        className={`flex items-center justify-between border-t px-3 py-1.5 font-mono text-d11 font-bold uppercase tracking-widest ${skin.statusBand[status]}`}
      >
        <span>{STATUS_LABEL[status]}</span>
        <span
          className={`h-2 w-2 shrink-0 border border-current ${
            status === 'reserved' ? '' : 'bg-current'
          }`}
          aria-hidden
        />
      </div>
    </>
  )
}

function Meta({
  label,
  value,
  skin,
}: {
  label: string
  value: string
  skin: Skin
}) {
  return (
    <div className="grid grid-cols-[84px_1fr] items-baseline gap-2">
      <dt className={`uppercase tracking-widest ${skin.metaLabel}`}>{label}</dt>
      <dd className={`truncate ${skin.metaValue}`}>{value}</dd>
    </div>
  )
}
