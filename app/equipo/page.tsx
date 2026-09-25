import type { Metadata } from 'next'
import { Equipo } from '@/components/casa/Equipo'

export const metadata: Metadata = {
  title: 'Equipo',
  description: 'Quién escribe esto: gente que va, escucha, escribe y a veces toca.',
}

export default function EquipoPage() {
  return <Equipo />
}
