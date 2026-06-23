import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContentGrid } from '@/components/ContentGrid'
import { getEntityBySlug } from '@/lib/data/entities'
import { getItemsByEntity } from '@/lib/data/items'
import type { EntityKind } from '@/lib/types'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<EntityKind, string> = {
  artist: 'ARTISTA',
  label: 'LABEL',
  venue: 'VENUE',
  promoter: 'PROMOTORA',
}

interface PageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const entity = await getEntityBySlug(decodeURIComponent(params.slug))
  if (!entity) return { title: 'Entidad no encontrada' }
  return {
    title: `${entity.name} — Gradiente`,
    description:
      entity.bio ?? `Todo lo que toca ${entity.name} en Gradiente.`,
  }
}

export default async function EntityPage({ params }: PageProps) {
  const slug = decodeURIComponent(params.slug)
  const entity = await getEntityBySlug(slug)
  if (!entity) notFound()

  const items = await getItemsByEntity(entity.id)

  return (
    <div className="flex flex-col gap-6">
      <header className="border border-border bg-surface p-4 lg:p-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] tracking-widest text-muted">
            {KIND_LABEL[entity.kind]}
            {entity.city ? ` · ${entity.city}` : ''}
          </span>
          <h1 className="font-syne text-3xl font-black text-primary lg:text-4xl">
            {entity.name}
          </h1>

          {entity.bio && (
            <p className="mt-2 max-w-prose font-grotesk text-sm leading-relaxed text-secondary">
              {entity.bio}
            </p>
          )}

          {entity.links && entity.links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {entity.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-border px-2 py-px font-mono text-[10px] tracking-widest text-sys-orange transition-colors hover:bg-white/[0.04]"
                >
                  {l.label} ↗
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <div className="nge-divider mb-1">
          <span className="font-mono text-xs tracking-widest text-primary">
            APARICIONES
          </span>
        </div>
        <p className="sys-label">
          {items.length === 0
            ? 'SIN APARICIONES TODAVÍA'
            : `${items.length} ${items.length === 1 ? 'PIEZA' : 'PIEZAS'}`}
        </p>
        {items.length > 0 && (
          <ContentGrid
            items={items}
            mode="category"
            emptyLabel="// SIN APARICIONES"
          />
        )}
      </section>
    </div>
  )
}
