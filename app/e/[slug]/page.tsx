import type { Metadata } from 'next'
import { loadPublicWorld } from '@/lib/data/world'
import { collectEntities, KIND_LABEL } from '@/components/secciones/entities'
import { Ficha } from '@/components/secciones/Ficha'

type Params = Promise<{ slug: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const slug = decodeURIComponent((await params).slug)
  // The cached public world (the layout reads the same one): no extra query.
  const items = await loadPublicWorld()
    .then((w) => w.items)
    .catch(() => [])
  const ent = collectEntities(items).get(slug)
  if (!ent) return { title: 'Ficha' }
  return {
    title: ent.name,
    description: `${KIND_LABEL[ent.kind]} en Gradiente: sus noches, sus mixes y todo lo que la nombra.`,
  }
}

/**
 * An identity hub. Resolution happens client-side against the living world
 * (the server snapshot + what this session just did), so a piece published a
 * minute ago can already have its ficha; a slug nobody names renders the
 * empty frequency.
 */
export default async function EntityPage({ params }: { params: Params }) {
  const slug = decodeURIComponent((await params).slug)
  return <Ficha slug={slug} />
}
