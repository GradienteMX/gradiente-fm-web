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
      <header className="mb-6 border-b border-ink pb-3">
        <h1 className="font-syne text-d28 font-extrabold text-ink">ARTÍCULOS</h1>
        <p className="mt-1 font-mono text-d11 uppercase tracking-widest text-ink-faint">
          {items.length > 0 ? `LONGFORM · ${items.length} ENTRADAS` : 'LONGFORM'}
        </p>
      </header>
      <ContentGrid items={items} mode="category" emptyLabel="SIN ARTÍCULOS EN ESTE RANGO" />
    </>
  )
}
