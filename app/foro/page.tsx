import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Muro } from '@/components/foro/Muro'

export const metadata: Metadata = {
  title: 'Foro',
  description: 'El muro: treinta lugares para conversar, ordenados por el último movimiento.',
}

export default function ForoPage() {
  // The Muro reads ?hilo= and ?nuevo= from the URL.
  return (
    <Suspense fallback={null}>
      <Muro />
    </Suspense>
  )
}
