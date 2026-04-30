'use client'

import Link from 'next/link'
import { ArrowRight, ShoppingBag } from 'lucide-react'
import { useMarketplaceEnabledPartners } from '@/lib/partnerOverrides'

// ── MarketplaceRail ────────────────────────────────────────────────────────
//
// Home-page entry point for the marketplace, mounted directly below the
// [[PartnersRail]] in the right column. Two pieces:
//
//   - Up to 3 small partner thumbnails (linking to `?partner=<slug>`)
//   - "EXPLORAR MARKETPLACE" CTA linking to `/marketplace`
//
// Per the design call: "Spanish UI but `marketplace` stays as the loanword".

const MAX_RAIL = 3

export function MarketplaceRail() {
  const partners = useMarketplaceEnabledPartners()
  // Render nothing until at least one partner is approved — keeps the home
  // page from showing an empty rail in the bare seed state.
  if (partners.length === 0) return null

  // Pick the most-stocked partners for the rail; full catalog is one click
  // away via the CTA. Sort matches MarketplaceCatalog default.
  const rail = [...partners]
    .sort((a, b) => {
      const ac = a.marketplaceListings?.length ?? 0
      const bc = b.marketplaceListings?.length ?? 0
      if (bc !== ac) return bc - ac
      return a.title.localeCompare(b.title)
    })
    .slice(0, MAX_RAIL)

  return (
    <section
      className="flex flex-col gap-2"
      aria-label="Marketplace"
    >
      <header className="flex items-center justify-between gap-2 font-mono text-[10px] tracking-widest text-muted">
        <span className="flex items-center gap-1.5" style={{ color: '#FBBF24' }}>
          <ShoppingBag size={11} strokeWidth={1.5} />
          //MARKETPLACE
        </span>
        <span className="tabular-nums">
          {String(partners.length).padStart(2, '0')} ACTIVOS
        </span>
      </header>

      <ul className="flex flex-col gap-1.5">
        {rail.map((p) => {
          const listingCount = p.marketplaceListings?.length ?? 0
          const available =
            p.marketplaceListings?.filter((l) => l.status === 'available').length ?? 0
          return (
            <li key={p.id}>
              <Link
                href={`/marketplace?partner=${encodeURIComponent(p.slug)}`}
                className="group flex items-center gap-2 border border-border bg-elevated/30 p-2 transition-colors hover:border-white/30"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-border/40 bg-base">
                  {p.imageUrl && (
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-syne text-xs font-bold text-primary">
                    {p.title}
                  </span>
                  <span className="font-mono text-[9px] tracking-widest text-muted">
                    {String(available).padStart(2, '0')}/{String(listingCount).padStart(2, '0')} DISP
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* CTA — full-width orange chip linking to the catalog index. */}
      <Link
        href="/marketplace"
        className="flex items-center justify-between gap-2 border px-3 py-2 font-mono text-[10px] tracking-widest transition-colors hover:bg-white/[0.02]"
        style={{ borderColor: '#F97316', color: '#F97316' }}
      >
        <span>EXPLORAR MARKETPLACE</span>
        <ArrowRight size={11} strokeWidth={1.5} />
      </Link>
    </section>
  )
}
