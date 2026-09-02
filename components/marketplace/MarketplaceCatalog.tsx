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
//   - Grid of every marketplace-enabled franja (clicking a tile goes to
//     `?franja=<slug>` which opens the overlay on top).
//   - The overlay itself, mounted when the URL has the `franja` param.
//
// Receives franjas from the /marketplace page server prefetch (real DB) so
// newly approved franjas appear on the next render. Previously read from a
// sessionStorage-backed mock layer that couldn't see admin-created rows.
//
// Same idiom as the foro catalog (`?thread=` URL-driven overlay).
//
// «EL PLIEGO» fase F: paper ground. Section headers are ink-ruled mono
// bands; the tiles below carry their own frames. No EVA chrome, no amber.

export function MarketplaceCatalog({ franjas }: { franjas: ContentItem[] }) {
  const search = useSearchParams()
  const router = useRouter()
  // basePath is auto-prepended by router.replace; usePathname() returns the
  // pathname WITHOUT basePath, which is what router expects. Reading
  // window.location.pathname instead would double the basePath on Pages.
  const pathname = usePathname()
  const franjaSlug = search?.get('franja') ?? null

  // Sort by listing count desc, then by franja title alphabetic. Keeps the
  // catalog reading "active" — franjas with more inventory float up.
  const sorted = useMemo(
    () =>
      [...franjas].sort((a, b) => {
        const ac = a.marketplaceListings?.length ?? 0
        const bc = b.marketplaceListings?.length ?? 0
        if (bc !== ac) return bc - ac
        return a.title.localeCompare(b.title)
      }),
    [franjas],
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
      // Popularity uses a diminishing (log) curve capped at the fresh-item
      // recency bonus, so a listing with inflated views can at most TIE a brand
      // new item — it can never permanently dominate the feed. Raw views used
      // to add linearly and unbounded, so scripting the (anon, unauthenticated)
      // view endpoint pinned a listing to the top (#27).
      const popularity = Math.min(RECENCY_DAYS, Math.log1p(l.views ?? 0) * 4)
      return recency + popularity
    }
    const all: { listing: MarketplaceListing; franja: ContentItem }[] = []
    for (const p of franjas) {
      for (const l of p.marketplaceListings ?? []) {
        all.push({ listing: l, franja: p })
      }
    }
    all.sort((a, b) => score(b.listing) - score(a.listing))
    return all.slice(0, FEED_LIMIT)
  }, [franjas])

  // Open a specific listing detail — sets both params so the franja overlay
  // mounts and immediately surfaces the listing sub-overlay.
  const openListing = useCallback(
    (slug: string, listingId: string) => {
      const params = new URLSearchParams(search?.toString() ?? '')
      params.set('franja', slug)
      params.set('listing', listingId)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, search, pathname],
  )

  const onCloseOverlay = useCallback(() => {
    // Strip both `franja=` and `listing=` so closing the franja card
    // never leaves an orphaned listing param in the URL. The sub-overlay's
    // own close handler (in MarketplaceOverlay) only strips `listing=`.
    const params = new URLSearchParams(search?.toString() ?? '')
    params.delete('franja')
    params.delete('listing')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [router, search, pathname])

  return (
    <div className="flex flex-col gap-8">
      {/* ── Item feed — buyers see products first ── */}
      {feed.length > 0 && (
        <section className="flex flex-col gap-4">
          <header className="flex items-baseline justify-between gap-3 border-b border-ink pb-2 font-mono text-d11 font-bold uppercase tracking-widest">
            <span className="text-ink">PIEZAS</span>
            <span className="tabular-nums text-ink-soft">
              {feed.length} ITEM{feed.length === 1 ? '' : 'S'}
            </span>
          </header>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {feed.map(({ listing, franja }, i) => (
              <MarketplaceListingCard
                key={listing.id}
                listing={listing}
                franja={franja}
                index={i + 1}
                onClick={() => openListing(franja.slug, listing.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Stores ── */}
      <section className="flex flex-col gap-4">
        <header className="flex items-baseline justify-between gap-3 border-b border-ink pb-2 font-mono text-d11 font-bold uppercase tracking-widest">
          <span className="text-ink">TIENDAS</span>
          <span className="tabular-nums text-ink-soft">
            {sorted.length} FRANJA{sorted.length === 1 ? '' : 'S'}
          </span>
        </header>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-start gap-2 border border-dashed border-ink bg-paper-raised p-6">
            <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink">
              SIN FRANJAS ACTIVAS
            </span>
            <p className="font-grotesk text-d13 leading-relaxed text-ink-soft">
              Aún ninguna franja tiene marketplace habilitado. Vuelve cuando los
              primeros catálogos aparezcan — o si eres admin, activa uno desde{' '}
              <span className="font-bold text-ink">Marketplace · Aprobaciones</span>{' '}
              en el dashboard.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((p) => (
              <MarketplaceCard key={p.id} franja={p} />
            ))}
          </div>
        )}
      </section>

      {franjaSlug && (
        <MarketplaceOverlay
          franjaSlug={franjaSlug}
          franja={sorted.find((p) => p.slug === franjaSlug) ?? null}
          onClose={onCloseOverlay}
        />
      )}
    </div>
  )
}
