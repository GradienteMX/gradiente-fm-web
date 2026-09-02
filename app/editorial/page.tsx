import type { Metadata } from 'next'
import { ContentGrid } from '@/components/ContentGrid'
import { getItems } from '@/lib/data/items'
import { filterForCategory } from '@/lib/utils'

export const metadata: Metadata = { title: 'Editorial' }
export const dynamic = 'force-dynamic'

export default async function EditorialPage() {
  const items = filterForCategory(await getItems(), 'editorial')
  return (
    <>
      <header className="mb-6 border-b border-ink pb-3">
        <h1 className="font-syne text-d28 font-extrabold text-ink">EDITORIAL</h1>
        <p className="mt-1 font-mono text-d11 uppercase tracking-widest text-ink-faint">
          {items.length > 0 ? `TEXTOS · ${items.length} ENTRADAS` : 'TEXTOS'}
        </p>
      </header>
      <ContentGrid items={items} mode="category" emptyLabel="SIN EDITORIALES EN ESTE RANGO" />
    </>
  )
}
