import type { Metadata } from 'next'
import { ContentGrid } from '@/components/ContentGrid'
import { MOCK_ITEMS } from '@/lib/mockData'
import { filterForCategory } from '@/lib/utils'

export const metadata: Metadata = { title: 'Editorial' }

export default function EditorialPage() {
  const items = filterForCategory(MOCK_ITEMS, 'editorial')
  return (
    <>
      <div className="mb-4">
        <div className="nge-divider mb-1">
          <span className="font-mono text-xs tracking-widest text-primary">EDITORIAL</span>
        </div>
        <p className="sys-label">TEXTOS · {items.length} ENTRADAS</p>
      </div>
      <ContentGrid items={items} mode="category" emptyLabel="// SIN EDITORIALES EN ESTE RANGO" />
    </>
  )
}
