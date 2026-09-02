'use client'

import { useEffect, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { MapPin, Share2, X } from 'lucide-react'
import type { ContentItem, MarketplaceListing } from '@/lib/types'
import { MarketplaceListingCard } from './MarketplaceListingCard'
import { MarketplaceListingDetail } from './MarketplaceListingDetail'

// ── MarketplaceOverlay ─────────────────────────────────────────────────────
//
// Per-franja marketplace card — a paper sheet over an ink scrim, following
// the OverlayShell anatomy («EL PLIEGO» fase C/F). Layout:
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │ [MERCADO]  franja-slug  ·  NN ITEMS            [CERRAR ESC]  │
//   ├───────────────────────┬──────────────────────────────────────┤
//   │  IDENTITY PANEL       │  LISTINGS GRID                       │
//   │  • franja name        │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
//   │  • description        │  │ 01   │ │ 02   │ │ 03   │ │ 04   │ │
//   │  • totals ledger      │  │ …    │ │ …    │ │ …    │ │ …    │ │
//   │  • location / currency│  └──────┘ └──────┘ └──────┘ └──────┘ │
//   │  • note               │  …                                   │
//   └───────────────────────┴──────────────────────────────────────┘
//
// Driven by `?franja=<slug>` URL param on `/marketplace`. ESC closes
// (route navigates back to `/marketplace`). z-50 — the listing detail
// stacks above at z-[60].
//
// The old chrome carried a fake version string and a green ONLINE lamp;
// both are gone (nothing measured them). Counts are real, from the rows.

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

interface Props {
  franjaSlug: string
  franja: ContentItem | null
  onClose: () => void
}

export function MarketplaceOverlay({ franjaSlug, franja, onClose }: Props) {
  const router = useRouter()
  const search = useSearchParams()
  // usePathname returns the URL without basePath; router.replace re-applies
  // basePath itself — so we MUST pass basePath-stripped paths to it. Reading
  // window.location.pathname instead would double-apply basePath on Pages
  // (where basePath = '/gradiente-fm-web') and break navigation with a 404.
  const pathname = usePathname()
  const listingId = search?.get('listing') ?? null

  const activeListing = useMemo<
    { listing: MarketplaceListing; index: number } | null
  >(() => {
    if (!listingId || !franja) return null
    // sortedListings drives the index badge in the grid; we mirror that
    // ordering here so the sub-overlay's chrome shows the same number.
    const sorted = [...(franja.marketplaceListings ?? [])].sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    const idx = sorted.findIndex((l) => l.id === listingId)
    if (idx < 0) return null
    return { listing: sorted[idx], index: idx + 1 }
  }, [listingId, franja])

  const onCloseListing = () => {
    // Strip listing= only — franja= stays so we drop back into the franja
    // overlay, not the catalog grid.
    const params = new URLSearchParams(search?.toString() ?? '')
    params.delete('listing')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  // ESC: when the sub-overlay is up, ITS handler fires first (added later in
  // the effect chain). The franja overlay's ESC only runs when the
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

  if (!franja) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-backdrop-in"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-ink/60" aria-hidden />
        <div
          className="relative z-10 flex max-w-md flex-col items-start gap-2 border border-ink bg-paper p-6 text-ink"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper">
            FRANJA NO ENCONTRADA
          </span>
          <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
            slug: {franjaSlug}
          </p>
          <button
            type="button"
            onClick={onClose}
            className={`mt-2 flex min-h-11 items-center border border-ink px-3 font-mono text-d11 font-bold uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
          >
            CERRAR
          </button>
        </div>
      </div>
    )
  }

  const listings = franja.marketplaceListings ?? []
  const enabled = franja.marketplaceEnabled === true

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 overlay-backdrop-in"
      onClick={onClose}
    >
      {/* Ink scrim — flat, no blur (fase C anatomy). */}
      <div className="absolute inset-0 bg-ink/60" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex w-full max-w-6xl flex-col overflow-hidden border border-ink bg-paper text-ink overlay-panel-in"
        style={{ maxHeight: 'min(94vh, 980px)' }}
      >
        <Chrome franja={franja} listingCount={listings.length} onClose={onClose} />

        {!enabled ? (
          <DisabledState />
        ) : (
          <Body
            franja={franja}
            listings={listings}
            router={router}
            pathname={pathname}
            search={search}
          />
        )}
      </div>

      {activeListing && (
        <MarketplaceListingDetail
          listing={activeListing.listing}
          franja={franja}
          index={activeListing.index}
          onClose={onCloseListing}
        />
      )}
    </div>
  )
}

// ── Chrome (top band) ──────────────────────────────────────────────────────

function Chrome({
  franja,
  listingCount,
  onClose,
}: {
  franja: ContentItem
  listingCount: number
  onClose: () => void
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-ink bg-paper-raised px-4 py-2">
      <div className="flex min-w-0 items-center gap-3 font-mono text-d11 font-bold uppercase tracking-widest">
        <span className="shrink-0 bg-ink px-1.5 py-0.5 text-paper">MERCADO</span>
        <span className="hidden truncate text-ink-faint sm:inline">
          {franja.slug}
        </span>
        <span className="shrink-0 tabular-nums text-ink-soft">
          {String(listingCount).padStart(2, '0')} ITEMS
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className={`flex min-h-11 shrink-0 items-center gap-2 border border-ink bg-ink px-3 font-mono text-d11 font-bold uppercase tracking-widest text-paper transition-colors hover:bg-paper hover:text-ink ${FOCUS_RING}`}
      >
        <X size={12} className="sm:hidden" />
        <span>CERRAR</span>
        <span className="hidden sm:inline">ESC</span>
      </button>
    </header>
  )
}

function DisabledState() {
  return (
    <div className="flex flex-1 items-center justify-center p-12 text-center">
      <div className="flex max-w-md flex-col items-center gap-2">
        <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink">
          MARKETPLACE INACTIVO
        </span>
        <p className="font-grotesk text-d13 leading-relaxed text-ink-soft">
          Esta franja aún no tiene marketplace activo. Pídele al equipo de
          GRADIENTE que lo apruebe desde el panel de admin.
        </p>
      </div>
    </div>
  )
}

// ── Body — identity panel + listings grid ──────────────────────────────────

function Body({
  franja,
  listings,
  router,
  pathname,
  search,
}: {
  franja: ContentItem
  listings: MarketplaceListing[]
  router: ReturnType<typeof useRouter>
  pathname: string
  search: ReturnType<typeof useSearchParams>
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
      <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-ink bg-paper-raised p-4 md:w-[320px] md:border-b-0 md:border-r md:p-5">
        <span className="self-start bg-ink px-2 py-0.5 font-mono text-d11 font-bold uppercase tracking-widest text-paper">
          MERCADO
        </span>

        <h1 className="font-syne text-d28 font-extrabold uppercase leading-none text-ink">
          {franja.title.toUpperCase()}
        </h1>

        {franja.marketplaceDescription && (
          <p className="font-grotesk text-d15 leading-relaxed text-ink-soft">
            {franja.marketplaceDescription}
          </p>
        )}

        {/* Totals ledger — the DB status enum verbatim, nothing invented. */}
        <dl className="flex flex-col gap-1 border border-ink bg-paper p-3 font-mono text-d11">
          <StatRow label="TOTAL ITEMS" value={String(stats.total).padStart(3, '0')} />
          <StatRow
            label="DISPONIBLES"
            value={String(stats.available).padStart(2, '0')}
          />
          <StatRow
            label="RESERVADOS"
            value={String(stats.reserved).padStart(2, '0')}
          />
          <StatRow
            label="VENDIDOS"
            value={String(stats.sold).padStart(2, '0')}
          />
        </dl>

        <dl className="flex flex-col gap-1 border border-ink bg-paper p-3 font-mono text-d11">
          {franja.marketplaceLocation && (
            <StatRow
              label="UBICACIÓN"
              value={franja.marketplaceLocation}
              icon={<MapPin size={10} strokeWidth={1.5} />}
            />
          )}
          <StatRow
            label="MONEDA"
            value={franja.marketplaceCurrency ?? '—'}
          />
          {franja.franjaUrl && (
            <StatRow
              label="WEB"
              value={franja.franjaUrl.replace(/^https?:\/\//, '')}
              icon={<Share2 size={10} strokeWidth={1.5} />}
            />
          )}
        </dl>

        <p className="border-t border-ink pt-3 font-grotesk text-d13 leading-relaxed text-ink-faint">
          Los precios y la disponibilidad los actualiza el equipo de la franja.
          Si te interesa un item, escríbeles por su web o redes; GRADIENTE no
          procesa pagos.
        </p>
      </aside>

      {/* Listings grid — right */}
      <section className="flex-1 p-4 md:p-5">
        <header className="mb-3 border-b border-ink pb-2 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
          LISTADOS RECIENTES
        </header>

        {sortedListings.length === 0 ? (
          <div className="flex flex-col items-start gap-2 border border-dashed border-ink bg-paper-raised p-6">
            <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink">
              SIN LISTADOS
            </span>
            <p className="font-grotesk text-d13 leading-relaxed text-ink-soft">
              Esta franja aún no agregó items al marketplace. Vuelve más tarde o
              síguela en sus redes.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {sortedListings.map((l, i) => (
              <MarketplaceListingCard
                key={l.id}
                listing={l}
                franja={franja}
                index={i + 1}
                onClick={() => {
                  const params = new URLSearchParams(search?.toString() ?? '')
                  params.set('listing', l.id)
                  router.replace(`${pathname}?${params.toString()}`, {
                    scroll: false,
                  })
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
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
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex items-center gap-1.5 uppercase tracking-widest text-ink-faint">
        {icon}
        <span>{label}</span>
      </dt>
      <dd className="truncate tabular-nums text-ink">{value}</dd>
    </div>
  )
}
