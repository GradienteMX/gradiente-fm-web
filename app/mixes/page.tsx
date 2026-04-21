import type { Metadata } from 'next'
import { ContentGrid } from '@/components/ContentGrid'
import { MOCK_ITEMS } from '@/lib/mockData'
import { filterForCategory } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mixes' }

export default function MixesPage() {
  const items = filterForCategory(MOCK_ITEMS, 'mix')
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
