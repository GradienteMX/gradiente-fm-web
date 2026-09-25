import fs from 'node:fs'
import path from 'node:path'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Taller } from '@/components/taller/Taller'

export const metadata: Metadata = {
  title: 'Taller',
  description: 'Tu mesa de trabajo en Gradiente: lo que publicas, lo que guardas y cómo se recibió.',
}

/** The seed flyer archive, listed from disk so the market's image picker offers only real files. */
function seedFlyers(): string[] {
  try {
    return fs
      .readdirSync(path.join(process.cwd(), 'public', 'flyers'))
      .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort()
      .map((f) => `/flyers/${f}`)
  } catch {
    return []
  }
}

export default function TallerPage() {
  return (
    <Suspense fallback={null}>
      <Taller flyers={seedFlyers()} />
    </Suspense>
  )
}
