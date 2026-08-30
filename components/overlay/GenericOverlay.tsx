'use client'

import type { ContentItem } from '@/lib/types'
import { fmtDateFull } from '@/lib/utils'
import { getGenreById, getTagNames } from '@/lib/genres'
import { GenreChipButton } from '@/components/genre/GenreChipButton'
import { VibeFader } from '@/components/VibeFader'
import { VibeMeter } from '@/components/VibeMeter'
import { SmartImage } from '@/components/SmartImage'

interface Props {
  item: ContentItem
}

// Safety-net fallback for types without a dedicated overlay. Fase C paper
// translation in miniature: dark-in-frame 16:9 image plate (the dark VibeMeter
// stays ON the artwork), ink title/meta/body on paper, printed genre chips.
// Deliberately boring — each type eventually gets its own polished component.
export function GenericOverlay({ item }: Props) {
  const genres = item.genres.map((id) => ({
    id,
    name: getGenreById(id)?.name ?? id,
  }))
  const tags = getTagNames(item.tags)

  return (
    <article className="flex flex-col bg-paper text-ink">
      {item.imageUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-ink bg-panel">
          <SmartImage
            src={item.imageUrl}
            alt={item.title}
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover object-top"
          />
          <VibeMeter
            item={item}
            size="sm"
            className="absolute bottom-0 left-0"
          />
        </div>
      )}

      <div className="flex flex-col gap-4 p-5 md:p-7">
        <header className="flex flex-col gap-2">
          {item.editorial && (
            <span
              className="inline-flex w-fit items-center gap-1.5 bg-sys-red-paper px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-paper-raised"
              title="Selección editorial"
            >
              ★ EDITORIAL
            </span>
          )}
          <h1 className="font-syne text-3xl font-black leading-[1.05] text-ink md:text-4xl">
            {item.title}
          </h1>
          {item.subtitle && (
            <p className="font-grotesk text-d15 text-ink-soft md:text-d18">
              {item.subtitle}
            </p>
          )}
        </header>

        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-ink py-3 font-mono text-d13">
          {item.author && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                AUTOR
              </span>
              <span className="text-ink">{item.author}</span>
            </div>
          )}
          {item.publishedAt && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                PUBLICADO
              </span>
              <span className="text-ink-soft">{fmtDateFull(item.publishedAt)}</span>
            </div>
          )}
          {item.readTime && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                LECTURA
              </span>
              <span className="text-ink-soft">{item.readTime} min</span>
            </div>
          )}
          {item.duration && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                DURACIÓN
              </span>
              <span className="text-ink-soft">{item.duration}</span>
            </div>
          )}
          {/* VIBE — the fader is a dark-calibrated instrument: it keeps a
              bg-panel faceplate band on the paper sheet (component untouched). */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
              VIBE
            </span>
            <span className="flex items-center border border-ink bg-panel px-3 py-2">
              <VibeFader item={item} />
            </span>
          </div>
        </dl>

        {item.excerpt && (
          <p className="font-grotesk text-d15 leading-relaxed text-ink-soft">
            {item.excerpt}
          </p>
        )}

        {item.bodyPreview && (
          <div className="max-w-[65ch] font-grotesk text-d15 leading-relaxed text-ink">
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
                ground="paper"
                className="px-2 py-0.5 font-mono text-[10px] tracking-wide"
              >
                {name}
              </GenreChipButton>
            ))}
            {tags.map((t) => (
              <span
                key={t}
                className="border border-ink-faint px-2 py-0.5 font-mono text-[10px] text-ink-faint"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
