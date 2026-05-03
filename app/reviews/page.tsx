import type { Metadata } from 'next'
import { ContentGrid } from '@/components/ContentGrid'
import { getItems } from '@/lib/data/items'
import { filterForCategory } from '@/lib/utils'

export const metadata: Metadata = { title: 'Reviews' }
export const dynamic = 'force-dynamic'

export default async function ReviewsPage() {
  const items = filterForCategory(await getItems(), 'review')
  return (
    <>
      <div className="mb-4">
        <div className="nge-divider mb-1">
          <span className="font-mono text-xs tracking-widest text-primary">REVIEWS</span>
        </div>
        <p className="sys-label">RESEÑAS · {items.length} ENTRADAS</p>
      </div>
      <ContentGrid items={items} mode="category" emptyLabel="// SIN REVIEWS EN ESTE RANGO" />
    </>
  )
}
