import type { Metadata } from 'next'
import { Mixes } from '@/components/secciones/Mixes'

export const metadata: Metadata = {
  title: 'Mixes',
  description: 'Sets, sesiones y programas de radio de la escena, ordenados por fecha y filtrados por energía, no por género.',
}

export default function MixesPage() {
  return <Mixes />
}
