import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MarketplaceCatalog } from '@/components/marketplace/MarketplaceCatalog'
import { getItems } from '@/lib/data/items'

export const metadata: Metadata = { title: 'Marketplace' }

// Server-fetched via cookies()-aware client → forces dynamic.
export const dynamic = 'force-dynamic'

// /marketplace — top-level destination listing every marketplace-enabled
// partner. Sorted by listing count desc, alphabetic tiebreaker. Click a
// partner tile → URL gains `?partner=<slug>` which mounts the per-partner
// overlay over the catalog. ESC / close button strips the param.
//
// Partners are server-prefetched so newly admin-approved rows show up on
// the next request without waiting for client-side sync. MarketplaceCatalog
// reads `?partner=` via useSearchParams — wrap in Suspense so the static
// build doesn't bail.

export default async function MarketplacePage() {
  const items = await getItems()
  const partners = items.filter(
    (i) => i.type === 'partner' && i.marketplaceEnabled,
  )

  return (
    <Suspense fallback={null}>
      <MarketplaceCatalog partners={partners} />
    </Suspense>
  )
}
