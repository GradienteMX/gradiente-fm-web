import type { Metadata } from 'next'
import { Lecturas } from '@/components/secciones/Lecturas'
import { TIPO_LABEL, parseTipo } from '@/components/secciones/tipos'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const tipo = parseTipo((await searchParams).tipo)
  return {
    title: tipo ? `${TIPO_LABEL[tipo]} · Lecturas` : 'Lecturas',
    description: 'Editoriales, reseñas, opinión, artículos, listas y noticias de la escena underground de México.',
  }
}

export default async function LecturasPage({ searchParams }: { searchParams: SearchParams }) {
  const tipo = parseTipo((await searchParams).tipo)
  return <Lecturas initial={tipo} />
}
