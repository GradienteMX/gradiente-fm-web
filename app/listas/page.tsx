import type { Metadata } from 'next'
import { Lecturas } from '@/components/secciones/Lecturas'

/** Legacy address: same Lecturas surface, with this format set. The URL stays. */
export const metadata: Metadata = { title: 'Listas' }

export default function Page() {
  return <Lecturas initial="listicle" />
}
