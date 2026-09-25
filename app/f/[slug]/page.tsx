import type { Metadata } from 'next'
import { loadPublicWorld } from '@/lib/data/world'
import { FranjaPage } from '@/components/franja/FranjaPage'

/**
 * /f/[slug] — a franja's dossier. Franjas are identity hubs (like /u/ and
 * /e/), so they get a real, shareable route; the page itself is a client
 * surface over the world store (the server snapshot + what this session
 * just did).
 */

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const s = decodeURIComponent(slug)
  // The cached public world (the layout reads the same one): no extra query.
  const franja = await loadPublicWorld()
    .then((w) => w.items.find((i) => i.type === 'franja' && i.slug === s) ?? null)
    .catch(() => null)
  if (!franja) return { title: 'Franja' }
  return {
    title: franja.title,
    description: franja.excerpt ?? franja.marketplaceDescription ?? `${franja.title} en el dial de Gradiente: su catálogo, su archivo y su tienda.`,
  }
}

export default async function Page({ params }: Props) {
  const { slug } = await params
  return <FranjaPage slug={decodeURIComponent(slug)} />
}
