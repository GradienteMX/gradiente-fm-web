import { readdirSync } from 'node:fs'
import path from 'node:path'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Mesa } from '@/components/mesa/Mesa'

export const metadata: Metadata = {
  title: 'La mesa',
  description: 'El taller de escritura de Gradiente: ocho formatos, una sola mesa.',
}

/** The seed collection the portada picker offers (there is no upload backend). */
function flyers(): string[] {
  try {
    return readdirSync(path.join(process.cwd(), 'public', 'flyers'))
      .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort()
  } catch {
    return []
  }
}

export default function MesaPage() {
  return (
    <Suspense fallback={null}>
      <Mesa flyers={flyers()} />
    </Suspense>
  )
}
