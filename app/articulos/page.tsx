import type { Metadata } from 'next'
import { ContentGrid } from '@/components/ContentGrid'
import { getItems } from '@/lib/data/items'
import { filterForCategory } from '@/lib/utils'

export const metadata: Metadata = { title: 'Artículos' }
export const dynamic = 'force-dynamic'

export default async function ArticulosPage() {
  const items = filterForCategory(await getItems(), 'articulo')
  return (
    <>
      <div className="mb-4">
        <div className="nge-divider mb-1">
          <span className="font-mono text-xs tracking-widest text-primary">ARTÍCULOS</span>
        </div>
        <p className="sys-label">LONGFORM · {items.length} ENTRADAS</p>
      </div>
      <ContentGrid items={items} mode="category" emptyLabel="// SIN ARTÍCULOS EN ESTE RANGO" />
    </>
  )
}
