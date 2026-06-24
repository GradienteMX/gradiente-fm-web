'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { parseISO } from 'date-fns'
import type { ContentItem, MarketplaceListing } from '@/lib/types'
import { MarketplaceCard } from './MarketplaceCard'
import { MarketplaceListingCard } from './MarketplaceListingCard'
import { MarketplaceOverlay } from './MarketplaceOverlay'

// How many items show in the top feed before the store tiles.
const FEED_LIMIT = 20

// ── MarketplaceCatalog ─────────────────────────────────────────────────────
//
// Page body for `/marketplace`. Two surfaces:
//   - Grid of every marketplace-enabled partner (clicking a tile goes to
//     `?partner=<slug>` which opens the overlay on top).
//   - The overlay itself, mounted when the URL has the `partner` param.
//
// Receives partners from the /marketplace page server prefetch (real DB) so
// newly approved partners appear on the next render. Previously read from a
// sessionStorage-backed mock layer that couldn't see admin-created rows.
//
// Same idiom as the foro catalog (`?thread=` URL-driven overlay).

export function MarketplaceCatalog({ partners }: { partners: ContentItem[] }) {
  const search = useSearchParams()
  const router = useRouter()
  // basePath is auto-prepended by router.replace; usePathname() returns the
  // pathname WITHOUT basePath, which is what router expects. Reading
  // window.location.pathname instead would double the basePath on Pages.
  const pathname = usePathname()
  const partnerSlug = search?.get('partner') ?? null

  // Sort by listing count desc, then by partner title alphabetic. Keeps the
  // catalog reading "active" — partners with more inventory float up.
  const sorted = useMemo(
    () =>
      [...partners].sort((a, b) => {
        const ac = a.marketplaceListings?.length ?? 0
        const bc = b.marketplaceListings?.length ?? 0
        if (bc !== ac) return bc - ac
        return a.title.localeCompare(b.title)
      }),
    [partners],
  )

  // Flat item feed — every listing across every store, capped at FEED_LIMIT.
  // Buyers land on items, not stores (stores live below). Order is an invisible
  // HL blend: recency (a fresh item gets a bonus that decays over RECENCY_DAYS)
  // plus visit count. New items lead; popular older ones float back up. The
  // number is never shown — Gradiente's "size/position only" rule holds.
  const feed = useMemo(() => {
    const now = Date.now()
    const RECENCY_DAYS = 30
    const score = (l: MarketplaceListing) => {
      let ageDays = RECENCY_DAYS
      try {
        ageDays = (now - parseISO(l.publishedAt).getTime()) / 86_400_000
      } catch {
        /* unparseable date → treated as old */
      }
      const recency = Math.max(0, RECENCY_DAYS - ageDays)
      return (l.views ?? 0) + recency
    }
    const all: { listing: MarketplaceListing; partner: ContentItem }[] = []
    for (const p of partners) {
      for (const l of p.marketplaceListings ?? []) {
        all.push({ listing: l, partner: p })
      }
    }
    all.sort((a, b) => score(b.listing) - score(a.listing))
    return all.slice(0, FEED_LIMIT)
  }, [partners])

  // Open a specific listing detail — sets both params so the partner overlay
  // mounts and immediately surfaces the listing sub-overlay.
  const openListing = useCallback(
    (slug: string, listingId: string) => {
      const params = new URLSearchParams(search?.toString() ?? '')
      params.set('partner', slug)
      params.set('listing', listingId)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, search, pathname],
  )

  const onCloseOverlay = useCallback(() => {
    // Strip both `partner=` and `listing=` so closing the partner card
    // never leaves an orphaned listing param in the URL. The sub-overlay's
    // own close handler (in MarketplaceOverlay) only strips `listing=`.
    const params = new URLSearchParams(search?.toString() ?? '')
    params.delete('partner')
    params.delete('listing')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [router, search, pathname])

  return (
    <div className="flex flex-col gap-8">
      {/* ── Item feed — buyers see products first ── */}
      {feed.length > 0 && (
        <section className="flex flex-col gap-4">
          <header className="flex items-baseline justify-between gap-3 border-b border-border pb-3 font-mono text-[10px] tracking-widest text-muted">
            <span style={{ color: '#FBBF24' }}>MERCADO · GRADIENTE</span>
            <span className="tabular-nums">
              {feed.length} ITEM{feed.length === 1 ? '' : 'S'}
            </span>
          </header>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {feed.map(({ listing, partner }, i) => (
              <MarketplaceListingCard
                key={listing.id}
                listing={listing}
                partner={partner}
                index={i + 1}
                onClick={() => openListing(partner.slug, listing.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Stores ── */}
      <section className="flex flex-col gap-4">
        <header className="flex items-baseline justify-between gap-3 border-b border-border pb-3 font-mono text-[10px] tracking-widest text-muted">
          <span style={{ color: '#FBBF24' }}>TIENDAS</span>
          <span className="tabular-nums">
            {sorted.length} PARTNER{sorted.length === 1 ? '' : 'S'}
          </span>
        </header>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-start gap-2 border border-dashed border-border bg-elevated/30 p-6 font-mono text-[11px] text-muted">
            <span className="tracking-widest" style={{ color: '#3a3a3a' }}>
              //SIN·PARTNERS·ACTIVOS
            </span>
            <p>
              Aún ningún partner tiene marketplace habilitado. Vuelve cuando los
              primeros catálogos aparezcan — o si eres admin, activa uno desde{' '}
              <span className="text-secondary">Marketplace · Aprobaciones</span>{' '}
              en el dashboard.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((p) => (
              <MarketplaceCard key={p.id} partner={p} />
            ))}
          </div>
        )}
      </section>

      {partnerSlug && (
        <MarketplaceOverlay
          partnerSlug={partnerSlug}
          partner={sorted.find((p) => p.slug === partnerSlug) ?? null}
          onClose={onCloseOverlay}
        />
      )}
    </div>
  )
}
