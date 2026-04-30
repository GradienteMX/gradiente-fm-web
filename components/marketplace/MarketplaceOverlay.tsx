'use client'

import { useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin, Share2, X } from 'lucide-react'
import type { ContentItem, MarketplaceListing } from '@/lib/types'
import { MOCK_ITEMS } from '@/lib/mockData'
import { useResolvedPartner } from '@/lib/partnerOverrides'
import { MarketplaceListingCard } from './MarketplaceListingCard'
import { MarketplaceListingDetail } from './MarketplaceListingDetail'

// ── MarketplaceOverlay ─────────────────────────────────────────────────────
//
// Per-partner marketplace card — full-screen overlay matching the
// reference screenshot. Layout:
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │ //MKT  ·  GRADIENTE MARKETPLACE v1.0.3       [GUARDAR] [×]  │
//   ├───────────────────────┬──────────────────────────────────────┤
//   │  IDENTITY PANEL       │  LISTINGS GRID                       │
//   │  • partner name       │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
//   │  • description        │  │ 01   │ │ 02   │ │ 03   │ │ 04   │ │
//   │  • totals row         │  │ …    │ │ …    │ │ …    │ │ …    │ │
//   │  • quick filters      │  └──────┘ └──────┘ └──────┘ └──────┘ │
//   │  • location / currency│  …                                   │
//   │  • help text          │                                      │
//   └───────────────────────┴──────────────────────────────────────┘
//
// Driven by `?partner=<slug>` URL param on `/marketplace`. ESC closes
// (route navigates back to `/marketplace`).

interface Props {
  partnerSlug: string
  onClose: () => void
}

export function MarketplaceOverlay({ partnerSlug, onClose }: Props) {
  // We resolve through the override layer so the partner-team's edits
  // (description / location / currency / listings) reflect live without a
  // page reload — same idiom as comments / foro tombstones.
  const partner = useResolvedPartnerBySlug(partnerSlug)
  const router = useRouter()
  const search = useSearchParams()
  const listingId = search?.get('listing') ?? null

  // The active listing — sub-overlay reads from this. Resolved off the
  // partner's listings so partnerOverrides edits propagate live.
  const activeListing = useMemo<
    { listing: MarketplaceListing; index: number } | null
  >(() => {
    if (!listingId || !partner) return null
    // sortedListings drives the index badge in the grid; we mirror that
    // ordering here so the sub-overlay's chrome shows the same number.
    const sorted = [...(partner.marketplaceListings ?? [])].sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    const idx = sorted.findIndex((l) => l.id === listingId)
    if (idx < 0) return null
    return { listing: sorted[idx], index: idx + 1 }
  }, [listingId, partner])

  const onCloseListing = () => {
    if (typeof window === 'undefined') return
    // Strip listing= only — partner= stays so we drop back into the partner
    // overlay, not the catalog grid.
    const url = new URL(window.location.href)
    url.searchParams.delete('listing')
    router.replace(url.pathname + url.search, { scroll: false })
  }

  // ESC: when the sub-overlay is up, ITS handler fires first (added later in
  // the effect chain). The partner overlay's ESC only runs when the
  // sub-overlay isn't mounted — guard against double-close just in case.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !listingId) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, listingId])

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (!partner) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-backdrop-in"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" aria-hidden />
        <div
          className="eva-box relative z-10 flex max-w-md flex-col items-start gap-2 bg-base p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="font-mono text-[11px] tracking-widest text-sys-red">
            //PARTNER·NO·ENCONTRADO
          </span>
          <p className="font-mono text-[10px] tracking-widest text-muted">
            slug: {partnerSlug}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest text-secondary transition-colors hover:border-white/60 hover:text-primary"
          >
            CERRAR
          </button>
        </div>
      </div>
    )
  }

  const listings = partner.marketplaceListings ?? []
  const enabled = partner.marketplaceEnabled === true

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 overlay-backdrop-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="eva-box eva-scanlines relative z-10 flex w-full max-w-6xl flex-col overflow-hidden bg-base overlay-panel-in"
        style={{ maxHeight: 'min(94vh, 980px)' }}
      >
        <Chrome partner={partner} listingCount={listings.length} onClose={onClose} />

        {!enabled ? (
          <DisabledState />
        ) : (
          <Body partner={partner} listings={listings} router={router} />
        )}
      </div>

      {activeListing && (
        <MarketplaceListingDetail
          listing={activeListing.listing}
          partner={partner}
          index={activeListing.index}
          onClose={onCloseListing}
        />
      )}
    </div>
  )
}

// ── Chrome (top status bar) ────────────────────────────────────────────────

function Chrome({
  partner,
  listingCount,
  onClose,
}: {
  partner: ContentItem
  listingCount: number
  onClose: () => void
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-base/95 px-4 py-2.5 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-3 font-mono text-[10px] tracking-widest">
        <span style={{ color: '#F97316' }}>//MKT</span>
        <span className="hidden sm:inline truncate text-muted">
          GRADIENTE MARKETPLACE v1.0.3
        </span>
        <span className="text-muted tabular-nums">
          R·{String(listingCount).padStart(2, '0')}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] tracking-widest text-muted">
        <span className="hidden items-center gap-1 sm:flex">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: '#4ADE80' }}
            aria-hidden
          />
          ONLINE
        </span>
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

function DisabledState() {
  return (
    <div className="flex flex-1 items-center justify-center p-12 text-center">
      <div className="flex max-w-md flex-col items-center gap-2 font-mono text-[11px] leading-relaxed text-muted">
        <span className="tracking-widest" style={{ color: '#3a3a3a' }}>
          //MARKETPLACE·INACTIVO
        </span>
        <p>
          Este partner aún no tiene marketplace activo. Pídele al equipo de
          GRADIENTE FM que lo apruebe desde el panel de admin.
        </p>
      </div>
    </div>
  )
}

// ── Body — identity panel + listings grid ──────────────────────────────────

function Body({
  partner,
  listings,
  router,
}: {
  partner: ContentItem
  listings: MarketplaceListing[]
  router: ReturnType<typeof useRouter>
}) {
  const stats = useMemo(() => deriveStats(listings), [listings])
  const sortedListings = useMemo(
    () =>
      [...listings].sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      ),
    [listings],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row">
      {/* Identity panel — left */}
      <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-border bg-elevated/20 p-4 md:w-[320px] md:border-b-0 md:border-r md:p-5">
        <span
          className="self-start border px-2 py-0.5 font-mono text-[9px] tracking-widest"
          style={{ borderColor: '#FBBF24', color: '#FBBF24' }}
        >
          ★ MARKET
        </span>

        <h1 className="font-syne text-3xl font-black leading-none text-primary">
          {partner.title.toUpperCase()}
        </h1>

        {partner.marketplaceDescription && (
          <p className="font-mono text-[11px] leading-relaxed text-secondary">
            {partner.marketplaceDescription}
          </p>
        )}

        <dl className="flex flex-col gap-1 border border-border/60 bg-black/30 p-3 font-mono text-[10px]">
          <StatRow label="TOTAL ITEMS" value={String(stats.total).padStart(3, '0')} />
          <StatRow
            label="DISPONIBLES"
            value={String(stats.available).padStart(2, '0')}
            valueColor="#4ADE80"
          />
          <StatRow
            label="RESERVADOS"
            value={String(stats.reserved).padStart(2, '0')}
            valueColor="#FBBF24"
          />
          <StatRow
            label="VENDIDOS"
            value={String(stats.sold).padStart(2, '0')}
          />
        </dl>

        <dl className="flex flex-col gap-1 border border-border/60 bg-black/30 p-3 font-mono text-[10px]">
          {partner.marketplaceLocation && (
            <StatRow
              label="UBICACIÓN"
              value={partner.marketplaceLocation}
              icon={<MapPin size={10} strokeWidth={1.5} />}
            />
          )}
          <StatRow
            label="MONEDA"
            value={partner.marketplaceCurrency ?? '—'}
          />
          {partner.partnerUrl && (
            <StatRow
              label="WEB"
              value={partner.partnerUrl.replace(/^https?:\/\//, '')}
              icon={<Share2 size={10} strokeWidth={1.5} />}
            />
          )}
        </dl>

        <p className="font-mono text-[9px] leading-relaxed text-muted">
          //CONSEJO — los precios y la disponibilidad se actualizan
          directamente desde el equipo del partner. Si te interesa un item,
          escríbele al partner por su web o redes; GRADIENTE FM no procesa
          pagos.
        </p>
      </aside>

      {/* Listings grid — right */}
      <section className="flex-1 p-4 md:p-5">
        <header className="mb-3 flex items-center justify-between gap-3 font-mono text-[10px] tracking-widest text-muted">
          <span>LISTADOS RECIENTES</span>
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: '#4ADE80' }}
            aria-hidden
          />
        </header>

        {sortedListings.length === 0 ? (
          <div className="flex flex-col items-start gap-2 border border-dashed border-border bg-elevated/30 p-6 font-mono text-[11px] text-muted">
            <span className="tracking-widest" style={{ color: '#3a3a3a' }}>
              //SIN·LISTINGS
            </span>
            <p>
              Este partner aún no agregó items al marketplace. Vuelve más
              tarde o sigue al partner en sus redes.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {sortedListings.map((l, i) => (
              <MarketplaceListingCard
                key={l.id}
                listing={l}
                partner={partner}
                index={i + 1}
                onClick={() => {
                  if (typeof window === 'undefined') return
                  const url = new URL(window.location.href)
                  url.searchParams.set('listing', l.id)
                  router.replace(url.pathname + url.search, { scroll: false })
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Slug-based partner resolver ────────────────────────────────────────────
//
// `useResolvedPartner` from [[partnerOverrides]] takes an id; the URL drives
// a slug. Resolve the slug → seed-id from the immutable MOCK_ITEMS (slug
// can't be overridden), then hand the id to the override-aware hook so the
// overlay re-renders when partner-team edits land.

function useResolvedPartnerBySlug(slug: string): ContentItem | undefined {
  const seed = MOCK_ITEMS.find((i) => i.type === 'partner' && i.slug === slug)
  return useResolvedPartner(seed?.id ?? null)
}

// ── Stat row helpers ───────────────────────────────────────────────────────

function deriveStats(listings: MarketplaceListing[]) {
  let available = 0
  let reserved = 0
  let sold = 0
  for (const l of listings) {
    if (l.status === 'available') available++
    else if (l.status === 'reserved') reserved++
    else if (l.status === 'sold') sold++
  }
  return { total: listings.length, available, reserved, sold }
}

function StatRow({
  label,
  value,
  valueColor,
  icon,
}: {
  label: string
  value: string
  valueColor?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex items-center gap-1.5 tracking-widest text-muted">
        {icon}
        <span>{label}</span>
      </dt>
      <dd
        className="tabular-nums text-secondary"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </dd>
    </div>
  )
}
