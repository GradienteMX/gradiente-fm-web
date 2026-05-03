import type { Metadata } from 'next'
import { ContentGrid } from '@/components/ContentGrid'
import { getItems } from '@/lib/data/items'
import { filterForCategory } from '@/lib/utils'

export const metadata: Metadata = { title: 'Opinión' }
export const dynamic = 'force-dynamic'

export default async function OpinionPage() {
  const items = filterForCategory(await getItems(), 'opinion')
  return (
    <>
      <div className="mb-4">
        <div className="nge-divider mb-1">
          <span className="font-mono text-xs tracking-widest text-primary">OPINIÓN</span>
        </div>
        <p className="sys-label">COLUMNAS · {items.length} ENTRADAS</p>
      </div>
      <ContentGrid items={items} mode="category" emptyLabel="// SIN OPINIONES EN ESTE RANGO" />
    </>
  )
}
