import type { Metadata } from 'next'
import { CalendarSidebar } from '@/components/CalendarSidebar'
import { ContentGrid } from '@/components/ContentGrid'
import { MOCK_ITEMS } from '@/lib/mockData'
import { filterForCategory, getEventDates } from '@/lib/utils'

export const metadata: Metadata = { title: 'Agenda' }

export default function AgendaPage() {
  const items = filterForCategory(MOCK_ITEMS, 'evento')
  const eventDates = getEventDates(MOCK_ITEMS)

  return (
    <>
      <CalendarSidebar eventDates={eventDates} />

      <div className="mb-4">
        <div className="nge-divider mb-1">
          <span className="font-mono text-xs tracking-widest text-primary">AGENDA</span>
        </div>
        <p className="sys-label">EVENTOS · {items.length} ENTRADAS · HOY → PASADO</p>
      </div>

      <ContentGrid items={items} mode="category" emptyLabel="// SIN EVENTOS EN ESTE RANGO" />
    </>
  )
}
