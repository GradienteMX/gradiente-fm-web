import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ForoCatalog } from '@/components/foro/ForoCatalog'

export const metadata: Metadata = { title: 'Foro' }

// /foro — imageboard-style discussion catalog. Threads sorted by bumpedAt
// desc with a hard cap of 30 visible. Click a thread tile → overlay; click
// NUEVO HILO → compose overlay (login-gated, image-required OP).
//
// Fase F: the surface runs on the «EL PLIEGO» paper ground.
// the ground itself flips from lib/chrome/paperRoutes: <PaperGround /> is
// mounted ONCE in app/layout.tsx and drives itself off PAPER_ROUTES, so a
// route needs no mount of its own.
// must also be listed in lib/chrome/paperRoutes.ts so Navigation stamps
// its paper masthead here.
//
// ForoCatalog reads ?thread= and ?compose= from the URL via
// useSearchParams() — wrap it in Suspense so static export doesn't bail.

export default function ForoPage() {
  return (
    <>
      <Suspense fallback={null}>
        <ForoCatalog />
      </Suspense>
    </>
  )
}
