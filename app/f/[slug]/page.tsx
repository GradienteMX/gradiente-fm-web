import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getItemBySlug, getItemsByFranja } from '@/lib/data/items'
import { FranjaProfile } from '@/components/franja/FranjaProfile'

// Full franja profile page — the deep destination reached from the
// [ENTRAR AL PERFIL DE FRANJA] CTA in the rail overlay. Franjas are
// identity hubs (like /e/[slug] entities + /u/[username] profiles), so they
// get a real, shareable, indexable route. See project_franja_page_revamp.
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

  return <FranjaProfile franja={franja} attributedItems={attributedItems} />
}
