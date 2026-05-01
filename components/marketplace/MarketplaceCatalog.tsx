'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { useMarketplaceEnabledPartners } from '@/lib/partnerOverrides'
import { MarketplaceCard } from './MarketplaceCard'
import { MarketplaceOverlay } from './MarketplaceOverlay'

// ── MarketplaceCatalog ─────────────────────────────────────────────────────
//
// Page body for `/marketplace`. Two surfaces:
//   - Grid of every marketplace-enabled partner (clicking a tile goes to
//     `?partner=<slug>` which opens the overlay on top).
//   - The overlay itself, mounted when the URL has the `partner` param.
//
// Same idiom as the foro catalog (`?thread=` URL-driven overlay).

export function MarketplaceCatalog() {
  const partners = useMarketplaceEnabledPartners()
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
    <div className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3 border-b border-border pb-3 font-mono text-[10px] tracking-widest text-muted">
        <div className="flex items-baseline gap-3">
          <span style={{ color: '#FBBF24' }}>//MERCADO·GRADIENTE</span>
          <span className="text-secondary">v1.0.3</span>
        </div>
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

      {partnerSlug && (
        <MarketplaceOverlay
          partnerSlug={partnerSlug}
          onClose={onCloseOverlay}
        />
      )}
    </div>
  )
}
