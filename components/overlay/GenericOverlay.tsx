'use client'

import type { ContentItem } from '@/lib/types'
import { fmtDateFull, vibeToColor, vibeMid, vibeRangeLabel } from '@/lib/utils'
import { getGenreById, getTagNames } from '@/lib/genres'
import { GenreChipButton } from '@/components/genre/GenreChipButton'

interface Props {
  item: ContentItem
}

// Placeholder for types without a dedicated overlay yet (mix, review, editorial, opinion, noticia).
// Each of these will get its own polished component — this is the fallback during MVP build-out.
export function GenericOverlay({ item }: Props) {
  const vibeColor = vibeToColor(vibeMid(item))
  const genres = item.genres.map((id) => ({
    id,
    name: getGenreById(id)?.name ?? id,
  }))
  const tags = getTagNames(item.tags)

  return (
    <article className="flex flex-col">
      {item.imageUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-elevated">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover"
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ backgroundColor: vibeColor }}
          />
        </div>
      )}

      <div className="flex flex-col gap-4 p-5 md:p-7">
        <header className="flex flex-col gap-2">
          {item.editorial && (
            <span className="inline-flex w-fit items-center gap-1.5 border border-sys-red/40 bg-sys-red/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-sys-red">
              ★ EDITORIAL
            </span>
          )}
          <h1 className="font-syne text-3xl font-black leading-[1.05] text-white md:text-4xl">
            {item.title}
          </h1>
          {item.subtitle && (
            <p className="font-grotesk text-sm text-secondary md:text-base">
              {item.subtitle}
            </p>
          )}
        </header>

        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-3 font-mono text-xs">
          {item.author && (
            <div className="flex items-center gap-2">
              <span className="sys-label">AUTOR</span>
              <span className="text-primary">{item.author}</span>
            </div>
          )}
          {item.publishedAt && (
            <div className="flex items-center gap-2">
              <span className="sys-label">PUBLICADO</span>
              <span className="text-secondary">{fmtDateFull(item.publishedAt)}</span>
            </div>
          )}
          {item.readTime && (
            <div className="flex items-center gap-2">
              <span className="sys-label">LECTURA</span>
              <span className="text-secondary">{item.readTime} min</span>
            </div>
          )}
          {item.duration && (
            <div className="flex items-center gap-2">
              <span className="sys-label">DURACIÓN</span>
              <span className="text-secondary">{item.duration}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="sys-label">VIBE</span>
            <div className="h-2 w-8" style={{ backgroundColor: vibeColor }} aria-hidden />
            <span style={{ color: vibeColor }}>
              {vibeRangeLabel(item)}
            </span>
          </div>
        </dl>

        {item.excerpt && (
          <p className="font-grotesk text-base leading-relaxed text-secondary">
            {item.excerpt}
          </p>
        )}

        {item.bodyPreview && (
          <div className="font-grotesk text-base leading-relaxed text-primary">
            {item.bodyPreview.split('\n').map((p, i) => (
              <p key={i} className="mb-4">
                {p}
              </p>
            ))}
          </div>
        )}

        {(genres.length > 0 || tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {genres.map(({ id, name }) => (
              <GenreChipButton
                key={id}
                genreId={id}
                className="px-2 py-0.5 font-mono text-[10px] tracking-wide"
                style={{ backgroundColor: `${vibeColor}22`, color: vibeColor }}
              >
                {name}
              </GenreChipButton>
            ))}
            {tags.map((t) => (
              <span
                key={t}
                className="border border-white/10 px-2 py-0.5 font-mono text-[10px] text-muted"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 border-t border-dashed border-border pt-3">
          <p className="sys-label text-muted">
            OVERLAY GENÉRICO · {item.type.toUpperCase()} · PENDIENTE DE VISUAL DEDICADO
          </p>
        </div>
      </div>
    </article>
  )
}
