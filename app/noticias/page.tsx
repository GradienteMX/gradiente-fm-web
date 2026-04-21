import type { Metadata } from 'next'
import { ContentGrid } from '@/components/ContentGrid'
import { MOCK_ITEMS } from '@/lib/mockData'
import { filterForCategory } from '@/lib/utils'

export const metadata: Metadata = { title: 'Noticias' }

export default function NoticiasPage() {
  const items = filterForCategory(MOCK_ITEMS, 'noticia')
  return (
    <>
      <div className="mb-4">
        <div className="nge-divider mb-1">
          <span className="font-mono text-xs tracking-widest text-primary">NOTICIAS</span>
        </div>
        <p className="sys-label">NOTICIAS · {items.length} ENTRADAS</p>
      </div>
      <ContentGrid items={items} mode="category" emptyLabel="// SIN NOTICIAS EN ESTE RANGO" />
    </>
  )
}
