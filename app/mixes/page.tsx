import type { Metadata } from 'next'
import { ContentGrid } from '@/components/ContentGrid'
import { getItems } from '@/lib/data/items'
import { filterForCategory } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mixes' }
export const dynamic = 'force-dynamic'

export default async function MixesPage() {
  const items = filterForCategory(await getItems(), 'mix')
  return (
    <>
      <div className="mb-4">
        <div className="nge-divider mb-1">
          <span className="font-mono text-xs tracking-widest text-primary">MIXES</span>
        </div>
        <p className="sys-label">MIXES & RADIO · {items.length} ENTRADAS</p>
      </div>
      <ContentGrid items={items} mode="category" emptyLabel="// SIN MIXES EN ESTE RANGO" />
    </>
  )
}
