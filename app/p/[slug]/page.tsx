import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getItemBySlug, getItemsByPartner } from '@/lib/data/items'
import { PartnerProfile } from '@/components/partner/PartnerProfile'

// Full partner profile page — the deep destination reached from the
// [ENTRAR AL PERFIL DE PARTNER] CTA in the rail overlay. Partners are
// identity hubs (like /e/[slug] entities + /u/[username] profiles), so they
// get a real, shareable, indexable route. See project_partner_page_revamp.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: { slug: string }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const partner = await getItemBySlug(decodeURIComponent(params.slug))
  if (!partner || partner.type !== 'partner') {
    return { title: 'Partner no encontrado' }
  }
  return {
    title: partner.title,
    description:
      partner.excerpt ??
      partner.marketplaceDescription ??
      `${partner.title} en Gradiente.`,
  }
}

export default async function PartnerProfilePage({ params }: PageProps) {
  const slug = decodeURIComponent(params.slug)
  const partner = await getItemBySlug(slug)
  if (!partner || partner.type !== 'partner') notFound()

  const attributedItems = await getItemsByPartner(partner.id)

  return <PartnerProfile partner={partner} attributedItems={attributedItems} />
}
