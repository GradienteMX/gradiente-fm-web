import type { Metadata } from 'next'
import { Espera } from '@/components/espera/Espera'

export const metadata: Metadata = {
  title: 'La espera',
  description: 'Gradiente se abre por invitación, en olas. Deja una señal y te escribimos cuando llegue tu turno.',
}

/** /espera — the public waitlist and the queue toward La Puerta. */
export default function EsperaPage() {
  return <Espera />
}
