import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContentGrid } from '@/components/ContentGrid'
import { getEntityBySlug } from '@/lib/data/entities'
import { getItemsByEntity } from '@/lib/data/items'
import type { EntityKind } from '@/lib/types'

// ── /e/[slug] — the printed FICHA of a scene entity (fase F) ────────────────
//
// The public page for an artist / label / venue / promoter — NOT events, and
// NOT a franja (franjas live at /f/[slug] and never enter a content grid).
// Converted from the dark terminal register (border-border/bg-surface header,
// sys-orange link chips, .nge-divider, .sys-label) to the house paper one: a
// compact document head over the existing <ContentGrid mode="category"> body.
// ContentGrid picks its paper branch off isPaperRoute(), so `/e` must be added
// to PAPER_ROUTES for the grid's sweep to match this ground.

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<EntityKind, string> = {
  artist: 'ARTISTA',
  label: 'LABEL',
  venue: 'VENUE',
  promoter: 'PROMOTORA',
}

const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

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
    <>
      <div className="flex flex-col gap-8">
        {/* ── FICHA — the document head ──────────────────────────────────── */}
        <header className="flex flex-col gap-3 border-b border-ink pb-6">
          <p className="font-mono text-d11 font-bold uppercase tracking-widest text-sys-red-paper">
            FICHA · /E/{entity.slug.toUpperCase()}
          </p>

          <h1 className="min-w-0 break-words font-syne text-display font-extrabold leading-none text-ink">
            {entity.name}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="inline-flex items-center border border-ink px-2 py-0.5 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
              {KIND_LABEL[entity.kind]}
            </span>
            {entity.city && (
              <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                ZONA · {entity.city.toUpperCase()}
              </span>
            )}
          </div>

          {entity.bio && (
            <p className="max-w-[58ch] font-grotesk text-d15 leading-relaxed text-ink-soft">
              {entity.bio}
            </p>
          )}

          {entity.links && entity.links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {entity.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex min-h-11 items-center border border-ink px-2.5 font-mono text-d11 font-bold uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
                >
                  {l.label} ↗
                </a>
              ))}
            </div>
          )}
        </header>

        {/* ── APARICIONES ───────────────────────────────────────────────── */}
        <section aria-labelledby="apariciones-head" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink pb-2">
            <h2
              id="apariciones-head"
              className="font-syne text-d28 font-extrabold text-ink"
            >
              Apariciones
            </h2>
            <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
              {items.length === 0
                ? 'SIN APARICIONES TODAVÍA'
                : `${items.length} ${items.length === 1 ? 'PIEZA' : 'PIEZAS'}`}
            </p>
          </div>
          {items.length > 0 && (
            <ContentGrid
              items={items}
              mode="category"
              emptyLabel="SIN APARICIONES EN ESTE RANGO DE VIBE"
            />
          )}
        </section>
      </div>
    </>
  )
}
