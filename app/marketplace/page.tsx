import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MarketplaceCatalog } from '@/components/marketplace/MarketplaceCatalog'

export const metadata: Metadata = { title: 'Marketplace' }

// /marketplace — top-level destination listing every marketplace-enabled
// partner. Sorted by listing count desc, alphabetic tiebreaker. Click a
// partner tile → URL gains `?partner=<slug>` which mounts the per-partner
// overlay over the catalog. ESC / close button strips the param.
//
// MarketplaceCatalog reads `?partner=` via useSearchParams — wrap in
// Suspense so static export doesn't bail.

export default function MarketplacePage() {
  return (
    <Suspense fallback={null}>
      <MarketplaceCatalog />
    </Suspense>
  )
}
