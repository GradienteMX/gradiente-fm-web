import type { Metadata } from 'next'
import { Manifiesto } from '@/components/casa/Manifiesto'

export const metadata: Metadata = {
  title: 'Manifiesto',
  description: 'Guías, no porteros: la declaración editorial de Gradiente, en borrador.',
}

export default function ManifestoPage() {
  return <Manifiesto />
}
