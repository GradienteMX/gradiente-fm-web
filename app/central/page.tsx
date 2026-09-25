import type { Metadata } from 'next'
import { Suspense } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { Central } from '@/components/central/Central'
import { Libros } from '@/components/central/Libros'
import { loadAdminWorld } from '@/lib/data/world'
import type { AdminWorld } from '@/lib/store/snapshot'

export const metadata: Metadata = {
  title: 'Central',
  description: 'El instrumento de administración de Gradiente: el único lugar con números.',
  robots: { index: false, follow: false },
}

const IMAGE = /\.(jpe?g|png|webp|avif|gif|svg)$/i

/** The art Central can offer in its pickers — whatever is actually on disk. */
function listPublic(dir: string): string[] {
  try {
    return readdirSync(path.join(process.cwd(), 'public', dir))
      .filter((f) => IMAGE.test(f))
      .sort()
      .map((f) => `/${dir}/${f}`)
  } catch {
    return []
  }
}

/**
 * Central's ledgers (the HL ledger, everyone's presence, save counts, the
 * waitlist and the code book) are read here, for admins only, and laid into
 * the world while the page is open (Libros) — not by the root layout on
 * every page. Anyone else gets null (Central itself says who may enter).
 */
export default async function CentralPage() {
  const admin: AdminWorld | null = await loadAdminWorld().catch((err: unknown) => {
    // Next's own signals (this page is dynamic: it reads cookies) must pass through.
    unstable_rethrow(err)
    console.error('[central] no se pudieron leer los libros:', err)
    return null
  })
  return (
    <Suspense fallback={null}>
      <Libros admin={admin} />
      <Central flyers={listPublic('flyers')} logos={listPublic('franjas')} />
    </Suspense>
  )
}
