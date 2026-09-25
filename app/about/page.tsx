import type { Metadata } from 'next'
import { Acerca } from '@/components/casa/Acerca'

export const metadata: Metadata = {
  title: 'Qué es Gradiente',
  description: 'Infraestructura y memoria para la escena underground de música y arte sonoro en México: calibración analógica, half-life, guías y no porteros.',
}

export default function AboutPage() {
  return <Acerca />
}
