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

export default async function MarketplacePage() {
  const items = await getItems()
  const franjas = items.filter(
    (i) => i.type === 'franja' && i.marketplaceEnabled,
  )

  return (
    <Suspense fallback={null}>
      <MarketplaceCatalog franjas={franjas} />
    </Suspense>
  )
}
