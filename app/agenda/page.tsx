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
      <div className="mb-4">
        <div className="nge-divider mb-1">
          <span className="font-mono text-xs tracking-widest text-primary">AGENDA</span>
        </div>
        <p className="sys-label">
          EVENTOS · {upcomingCount} PRÓXIMOS · ARCHIVO BAJO DEMANDA
        </p>
      </div>

      <AgendaBrowser items={items} />
    </>
  )
}
