import type { Metadata } from 'next'
import { Agenda } from '@/components/agenda/Agenda'

export const metadata: Metadata = {
  title: 'Agenda',
  description: 'Las noches de la escena underground de la CDMX, una por una: búsqueda, densidad del mes y archivo bajo demanda.',
}

export default function AgendaPage() {
  return <Agenda />
}
