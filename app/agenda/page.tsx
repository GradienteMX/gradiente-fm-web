import type { Metadata } from 'next'
import { AgendaBrowser } from '@/components/AgendaBrowser'
import { getItems } from '@/lib/data/items'
import { filterForCategory, isUpcoming } from '@/lib/utils'

export const metadata: Metadata = { title: 'Agenda' }
export const dynamic = 'force-dynamic'

export default async function AgendaPage() {
  const allItems = await getItems()
  const items = filterForCategory(allItems, 'evento')
  const upcomingCount = items.filter((i) => isUpcoming(i)).length

  return (
    <>
      <header className="mb-6 border-b border-ink pb-3">
        <h1 className="font-syne text-d28 font-extrabold text-ink">AGENDA</h1>
        <p className="mt-1 font-mono text-d11 uppercase tracking-widest text-ink-faint">
          {upcomingCount > 0
            ? `EVENTOS · ${upcomingCount} PRÓXIMOS · ARCHIVO BAJO DEMANDA`
            : 'EVENTOS · ARCHIVO BAJO DEMANDA'}
        </p>
      </header>

      <AgendaBrowser items={items} />
    </>
  )
}
