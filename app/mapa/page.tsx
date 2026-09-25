import type { Metadata } from 'next'
import { Territorio } from '@/components/territorio/Territorio'

export const metadata: Metadata = {
  title: 'Territorio',
  description:
    'El archivo completo de Gradiente como terreno: la afinidad es geografía, la vida media es área y el borde es energía. El mismo mapa para todos.',
}

type Search = Record<string, string | string[] | undefined>

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null

export default async function MapaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams
  return (
    <Territorio
      initialFoco={one(sp.foco) ?? one(sp.focus)}
      initialAfinidad={one(sp.afinidad) === '1'}
      initialOcultar={one(sp.ocultar)}
    />
  )
}
