'use client'

import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Package,
  Truck,
  X,
} from 'lucide-react'
import type {
  ContentItem,
  MarketplaceListing,
  MarketplaceListingStatus,
  MarketplaceShippingMode,
} from '@/lib/types'
import { PLATFORM_LABELS } from '@/components/embed/platforms'

// ── MarketplaceListingDetail ───────────────────────────────────────────────
//
// Sub-overlay opened from [[MarketplaceOverlay]] when the URL has both
// `?partner=<slug>&listing=<id>`. Stacks above the partner overlay (z-60 vs
// z-50). ESC / [× CERRAR] strips `listing` only — `partner` stays so the
// closer drops back into the partner card overlay, not the catalog grid.
//
// Layout:
//
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │ //LIST · NAAFI/01    [← VOLVER A NAAFI]              [ESC] CERRAR   │
//   ├──────────────────────────────┬───────────────────────────────────────┤
//   │ IMAGE GALLERY                │ DETAIL META                            │
//   │ ┌────────────────────────┐   │ ★ MARKET · NAAFI                       │
//   │ │     MAIN IMG           │   │ TITLE                                  │
//   │ │                        │   │ CATEGORY · SUBCAT                      │
//   │ └────────────────────────┘   │ $450 MXN                               │
//   │ ┌──┐ ┌──┐ ┌──┐ ┌──┐         │ ┌────────────────────────────────────┐ │
//   │ │t1│ │t2│ │t3│ │t4│         │ │ CONDIC NM │ STATUS pill            │ │
//   │ └──┘ └──┘ └──┘ └──┘         │ └────────────────────────────────────┘ │
//   │                              │ //FUENTES (if embeds)                  │
//   │                              │ [SOUNDCLOUD ↗] [YOUTUBE ↗]             │
//   │                              │ //DESCRIPCIÓN  Lorem…                  │
//   │                              │ //ETIQUETAS    #foo #bar                │
//   │                              │ //ENTREGA      ENVÍO O RECOGIDA         │
//   │                              │ //VENDEDOR     N.A.A.F.I. ↗            │
//   └──────────────────────────────┴───────────────────────────────────────┘

const CATEGORY_LABEL: Record<string, string> = {
  vinyl: 'VINYL',
  cassette: 'CASSETTE',
  cd: 'CD',
  synth: 'SYNTH',
  'drum-machine': 'DRUM MACHINE',
  turntable: 'TURNTABLE',
  mixer: 'MIXER',
  outboard: 'OUTBOARD',
  merch: 'MERCH',
  other: 'OTRO',
}

const STATUS_LABEL: Record<MarketplaceListingStatus, string> = {
  available: 'DISPONIBLE',
  reserved: 'RESERVADO',
  sold: 'VENDIDO',
}

const STATUS_COLOR: Record<MarketplaceListingStatus, string> = {
  available: '#4ADE80',
  reserved: '#FBBF24',
  sold: '#E63329',
}

const SHIPPING_LABEL: Record<MarketplaceShippingMode, string> = {
  shipping: 'ENVÍO DIRECTO',
  local: 'RECOGIDA LOCAL',
  both: 'ENVÍO O RECOGIDA',
}

const SHIPPING_ICON: Record<MarketplaceShippingMode, typeof Truck> = {
  shipping: Truck,
  local: MapPin,
  both: Package,
}

interface Props {
  listing: MarketplaceListing
  partner: ContentItem
  // 1-based numbered position inside the partner's listings (matches the card
  // grid badge). Used in the chrome strip header.
  index: number
  onClose: () => void
}

export function MarketplaceListingDetail({
  listing,
  partner,
  index,
  onClose,
}: Props) {
  const [activeImage, setActiveImage] = useState(0)

  // ESC closes (strips ?listing= via the parent's onClose).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Reset gallery selection when the listing changes (deep-link revisit).
  useEffect(() => {
    setActiveImage(0)
  }, [listing.id])

  // Clamp activeImage if the partner team trimmed the gallery while open.
  const safeActive = Math.min(activeImage, Math.max(0, listing.images.length - 1))

  const status = listing.status
  const statusColor = STATUS_COLOR[status]
  const currency = partner.marketplaceCurrency ?? ''
  const Tag = listing.shippingMode ? SHIPPING_ICON[listing.shippingMode] : null

  return (
    <div
      // z-60 stacks above MarketplaceOverlay (z-50) so the partner overlay
      // stays visible under the backdrop — closing this returns there.
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-6 overlay-backdrop-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-detail-title"
    >
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        aria-hidden
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="eva-box eva-scanlines relative z-10 flex w-full max-w-5xl flex-col overflow-hidden bg-base overlay-panel-in"
        style={{ maxHeight: 'min(94vh, 920px)' }}
      >
        <Chrome
          partner={partner}
          listing={listing}
          index={index}
          onClose={onClose}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row">
          {/* LEFT — gallery */}
          <section className="flex w-full shrink-0 flex-col gap-3 border-b border-border bg-elevated/20 p-4 md:w-[55%] md:border-b-0 md:border-r md:p-5">
            <ImageGallery
              listing={listing}
              activeIndex={safeActive}
              onSelect={setActiveImage}
            />
          </section>

          {/* RIGHT — detail meta */}
          <section className="flex flex-1 flex-col gap-4 p-4 md:p-5">
            <span
              className="self-start border px-2 py-0.5 font-mono text-[9px] tracking-widest"
              style={{ borderColor: '#FBBF24', color: '#FBBF24' }}
            >
              ★ MARKET · {partner.title.toUpperCase()}
            </span>

            <div className="flex flex-col gap-1">
              <h1
                id="listing-detail-title"
                className="font-syne text-2xl font-black leading-tight text-primary sm:text-3xl"
              >
                {listing.title || '[sin título]'}
              </h1>
              <span
                className="font-mono text-[10px] tracking-widest"
                style={{ color: '#F97316' }}
              >
                {CATEGORY_LABEL[listing.category] ??
                  listing.category.toUpperCase()}
                {listing.subcategory ? ` · ${listing.subcategory}` : ''}
              </span>
            </div>

            <span className="font-syne text-3xl font-black text-primary">
              ${listing.price.toLocaleString('es-MX')} {currency}
            </span>

            <div className="flex items-center justify-between gap-3 border border-border/60 bg-black/30 px-3 py-2 font-mono text-[10px] tracking-widest">
              <div className="flex items-baseline gap-2">
                <span className="text-muted">CONDICIÓN</span>
                <span className="text-secondary">{listing.condition}</span>
              </div>
              <span
                className="inline-flex items-center gap-1.5"
                style={{ color: statusColor }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: statusColor }}
                  aria-hidden
                />
                {STATUS_LABEL[status]}
              </span>
            </div>

            {/* Embeds — link-out chips, mirrors the [[Embed Primitive]]
                idiom used in [[ArticuloOverlay]]. Sits above description so
                a buyer sees the SoundCloud preview first when present. */}
            {listing.embeds && listing.embeds.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[9px] tracking-widest text-muted">
                  //FUENTES
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {listing.embeds.map((e) => (
                    <a
                      key={`${e.platform}-${e.url}`}
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] tracking-widest transition-colors hover:bg-elevated hover:text-primary"
                      style={{ borderColor: '#242424', color: '#888888' }}
                    >
                      {PLATFORM_LABELS[e.platform]}
                      <ExternalLink size={10} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {listing.description && (
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[9px] tracking-widest text-muted">
                  //DESCRIPCIÓN
                </span>
                <p className="font-mono text-[11px] leading-relaxed text-secondary">
                  {listing.description}
                </p>
              </div>
            )}

            {listing.tags && listing.tags.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[9px] tracking-widest text-muted">
                  //ETIQUETAS
                </span>
                <div className="flex flex-wrap gap-1">
                  {listing.tags.map((t) => (
                    <span
                      key={t}
                      className="border border-border bg-elevated/50 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-muted"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {listing.shippingMode && Tag && (
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[9px] tracking-widest text-muted">
                  //ENTREGA
                </span>
                <div
                  className="inline-flex w-fit items-center gap-2 border px-2 py-1 font-mono text-[10px] tracking-widest"
                  style={{ borderColor: '#242424', color: '#9CA3AF' }}
                >
                  <Tag size={12} strokeWidth={1.5} />
                  {SHIPPING_LABEL[listing.shippingMode]}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] tracking-widest text-muted">
                //VENDEDOR
              </span>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex w-fit items-center gap-2 border border-border bg-elevated/30 px-3 py-1.5 font-mono text-[10px] tracking-widest text-secondary transition-colors hover:border-sys-orange hover:text-sys-orange"
              >
                <ArrowLeft size={11} strokeWidth={1.5} />
                {partner.title.toUpperCase()}
              </button>
              {partner.partnerUrl && (
                <a
                  href={partner.partnerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 font-mono text-[9px] tracking-widest text-muted transition-colors hover:text-sys-orange"
                >
                  {partner.partnerUrl.replace(/^https?:\/\//, '')}
                  <ExternalLink size={9} />
                </a>
              )}
            </div>

            <p className="border-t border-border/40 pt-3 font-mono text-[9px] leading-relaxed text-muted">
              //CONSEJO — escríbele al partner por su web o redes para
              comprar. GRADIENTE FM no procesa pagos ni envíos.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

// ── Chrome (top status bar) ────────────────────────────────────────────────

function Chrome({
  partner,
  listing,
  index,
  onClose,
}: {
  partner: ContentItem
  listing: MarketplaceListing
  index: number
  onClose: () => void
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-base/95 px-4 py-2.5 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-3 font-mono text-[10px] tracking-widest">
        <span style={{ color: '#F97316' }}>//LIST</span>
        <span className="hidden sm:inline truncate text-muted">
          {partner.slug.toUpperCase()}/{String(index).padStart(2, '0')}
        </span>
        <span className="text-muted tabular-nums">
          ID·{listing.id.slice(-8).toUpperCase()}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] tracking-widest text-muted">
        <button
          type="button"
          onClick={onClose}
          className="hidden items-center gap-1.5 border border-border/70 bg-black/40 px-2.5 py-1 transition-colors hover:border-sys-orange hover:text-sys-orange sm:flex"
          aria-label={`Volver a ${partner.title}`}
        >
          <ArrowLeft size={11} strokeWidth={1.5} />
          VOLVER
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex items-center gap-1.5 border border-border/70 bg-black px-3 py-2 text-secondary transition-colors hover:border-white/60 hover:text-primary sm:gap-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-muted"
        >
          <span className="hidden sm:inline">[ESC]</span>
          <X size={14} className="sm:hidden" />
          <span>CERRAR</span>
        </button>
      </div>
    </header>
  )
}

// ── ImageGallery (large main + thumbnail strip) ───────────────────────────

function ImageGallery({
  listing,
  activeIndex,
  onSelect,
}: {
  listing: MarketplaceListing
  activeIndex: number
  onSelect: (i: number) => void
}) {
  const hasImages = listing.images.length > 0

  return (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden border border-border bg-base">
        {hasImages ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={listing.images[activeIndex]}
            alt={listing.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[12px] tracking-widest text-muted">
            //{CATEGORY_LABEL[listing.category] ?? listing.category.toUpperCase()}
          </div>
        )}
      </div>

      {listing.images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {listing.images.map((src, i) => {
            const active = i === activeIndex
            return (
              <button
                key={`${i}-${src.slice(0, 16)}`}
                type="button"
                onClick={() => onSelect(i)}
                aria-label={`Ver imagen ${i + 1} de ${listing.images.length}`}
                aria-pressed={active}
                className="relative h-16 w-16 shrink-0 overflow-hidden border transition-colors"
                style={{
                  borderColor: active ? '#F97316' : '#242424',
                  opacity: active ? 1 : 0.7,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {i === 0 && (
                  <span
                    className="absolute left-0.5 top-0.5 bg-black/75 px-1 py-px font-mono text-[7px] tracking-widest backdrop-blur-sm"
                    style={{ color: '#F97316' }}
                  >
                    PORTADA
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}
