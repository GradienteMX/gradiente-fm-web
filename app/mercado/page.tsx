import type { Metadata } from 'next'
import { Mercado } from '@/components/mercado/Mercado'

export const metadata: Metadata = {
  title: 'Mercado',
  description: 'Discos, cintas, equipo y merch de las franjas del dial. Trato directo con quien vende: Gradiente no procesa pagos.',
}

/** /mercado — the franjas' crate. `?franja=<slug>` opens a Tienda, `&pieza=<id>` a listing. */
export default function MercadoPage() {
  return <Mercado />
}
