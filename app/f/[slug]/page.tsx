import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getItemBySlug, getItemsByFranja } from '@/lib/data/items'
import { FranjaProfile } from '@/components/franja/FranjaProfile'

// Full franja profile page — the deep destination reached from the
// [ENTRAR AL PERFIL DE FRANJA] CTA in the rail overlay. Franjas are
// identity hubs (like /e/[slug] entities + /u/[username] profiles), so they
// get a real, shareable, indexable route. See project_franja_page_revamp.
//
// Fase F flips this route to the paper ground: the body is the printed franja
// EXPEDIENTE (sibling of /u/[username]).
// the ground itself flips from lib/chrome/paperRoutes: <PaperGround /> is
// mounted ONCE in app/layout.tsx and drives itself off PAPER_ROUTES, so a
// route needs no mount of its own.
// PAPER_ROUTES in lib/chrome/paperRoutes.ts so Navigation picks the paper
// masthead here — that file is shared and is not edited by this pass.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: { slug: string }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const franja = await getItemBySlug(decodeURIComponent(params.slug))
  if (!franja || franja.type !== 'franja') {
    return { title: 'Franja no encontrado' }
  }
  return {
    title: franja.title,
    description:
      franja.excerpt ??
      franja.marketplaceDescription ??
      `${franja.title} en Gradiente.`,
  }
}

export default async function FranjaProfilePage({ params }: PageProps) {
  const slug = decodeURIComponent(params.slug)
  const franja = await getItemBySlug(slug)
  if (!franja || franja.type !== 'franja') notFound()

  const attributedItems = await getItemsByFranja(franja.id)

  return (
    <>
      <FranjaProfile franja={franja} attributedItems={attributedItems} />
    </>
  )
}
