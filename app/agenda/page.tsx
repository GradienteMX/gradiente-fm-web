import type { Metadata } from 'next'
import { CalendarSidebar } from '@/components/CalendarSidebar'
import { ContentGrid } from '@/components/ContentGrid'
import { getItems } from '@/lib/data/items'
import { filterForCategory, getEventDates } from '@/lib/utils'

export const metadata: Metadata = { title: 'Agenda' }
export const dynamic = 'force-dynamic'

export default async function AgendaPage() {
  const allItems = await getItems()
  const items = filterForCategory(allItems, 'evento')
  const eventDates = getEventDates(allItems)

  return (
    <>
      <CalendarSidebar eventDates={eventDates} />

      <div className="mb-4">
        <div className="nge-divider mb-1">
          <span className="font-mono text-xs tracking-widest text-primary">AGENDA</span>
        </div>
        <p className="sys-label">EVENTOS · {items.length} ENTRADAS · PRÓXIMOS · ARCHIVO ABAJO</p>
      </div>

      <ContentGrid items={items} mode="agenda" emptyLabel="// SIN EVENTOS EN ESTE RANGO" />
    </>
  )
}
