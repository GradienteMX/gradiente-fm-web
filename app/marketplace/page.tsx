import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MarketplaceCatalog } from '@/components/marketplace/MarketplaceCatalog'
import { getItems } from '@/lib/data/items'

export const metadata: Metadata = { title: 'Marketplace' }

// Server-fetched via cookies()-aware client → forces dynamic.
export const dynamic = 'force-dynamic'

// /marketplace — top-level destination listing every marketplace-enabled
// franja. Sorted by listing count desc, alphabetic tiebreaker. Click a
// franja tile → URL gains `?franja=<slug>` which mounts the per-franja
// overlay over the catalog. ESC / close button strips the param.
//
// Franjas are server-prefetched so newly admin-approved rows show up on
// the next request without waiting for client-side sync. MarketplaceCatalog
// reads `?franja=` via useSearchParams — wrap in Suspense so the static
// build doesn't bail.
//
// «EL PLIEGO» fase F — the body below is paper (ink hairlines, cream panels).
// The GROUND flip is still owed: '/marketplace' has to land in
// lib/chrome/paperRoutes.ts (Navigation reads that list to pick the paper
// the ground itself flips from lib/chrome/paperRoutes: <PaperGround /> is
// mounted ONCE in app/layout.tsx and drives itself off PAPER_ROUTES, so a
// route needs no mount of its own.
// the sheet. Until both are wired this page draws paper panels on charcoal.

export default async function MarketplacePage() {
  const items = await getItems()
  const franjas = items.filter(
    (i) => i.type === 'franja' && i.marketplaceEnabled,
  )

  return (
    <>
      <header className="mb-6 border-b border-ink pb-3">
        <h1 className="font-syne text-d28 font-extrabold text-ink">MERCADO</h1>
        <p className="mt-1 font-mono text-d11 uppercase tracking-widest text-ink-faint">
          CATÁLOGOS DE FRANJA · TRATO DIRECTO CON EL VENDEDOR
        </p>
      </header>
      <Suspense fallback={null}>
        <MarketplaceCatalog franjas={franjas} />
      </Suspense>
    </>
  )
}
