'use client'

import type { ContentItem } from '@/lib/types'
import { vibeToColor, categoryColor, fmtDateShort } from '@/lib/utils'
import { getGenreNames, getTagNames } from '@/lib/genres'
import { Clock, ArrowRight } from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'
import { useOverlay } from '@/components/overlay/useOverlay'

const TYPE_LABEL: Record<ContentItem['type'], string> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTICIA',
  review: 'REVIEW',
  editorial: 'EDITORIAL',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULO',
  partner: 'PARTNER',
}

interface HeroCardProps {
  item: ContentItem
}

export function HeroCard({ item }: HeroCardProps) {
  const vibeColor = vibeToColor(item.vibe)
  const genres = getGenreNames(item.genres)
  const tags = getTagNames(item.tags).slice(0, 3)
  const { open } = useOverlay()
  const ref = useRef<HTMLElement>(null)

  const handleOpen = () => {
    const rect = ref.current?.getBoundingClientRect()
    open(
      item.slug,
      rect
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : undefined,
    )
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleOpen()
    }
  }

  // Split bodyPreview into paragraphs for rendering
  const paragraphs = item.bodyPreview
    ? item.bodyPreview.split('\n\n').filter(Boolean)
    : item.excerpt
    ? [item.excerpt]
    : []

  return (
    <section
      ref={ref}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${item.title}`}
      className="group mb-6 cursor-pointer border border-border focus:outline-none focus-visible:ring-1 focus-visible:ring-sys-red"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-sys-red">//</span>
          <span className="sys-label">EN PORTADA</span>
          <span className="sys-label text-muted">· SE ACTUALIZA SEMANALMENTE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse bg-sys-green" />
          <span className="sys-label text-sys-green">PINNED</span>
        </div>
      </div>

      {/* Main body: image left, text right */}
      <div className="flex flex-col md:flex-row md:h-[360px] md:overflow-hidden" style={{ minHeight: 260 }}>

        {/* LEFT — image */}
        <div className="relative w-full overflow-hidden md:w-[45%]" style={{ minHeight: 260 }}>
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-elevated" />
          )}

          {/* Bottom gradient to blend with text panel */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30 md:to-black/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent md:hidden" />

          {/* Vibe accent — left edge */}
          <div
            className="absolute bottom-0 left-0 top-0 w-1"
            style={{ backgroundColor: vibeColor }}
          />

          {/* Type badge */}
          <div className="absolute left-4 top-4">
            <span
              className="bg-black/75 px-2 py-1 font-mono text-[10px] tracking-widest backdrop-blur-sm"
              style={{ color: categoryColor(item.type) }}
            >
              //{TYPE_LABEL[item.type]}
            </span>
          </div>

          {/* NGE bracket — bottom left corner */}
          <div className="absolute bottom-4 left-4">
            <div
              className="h-4 w-4 border-b border-l"
              style={{ borderColor: `${vibeColor}80` }}
            />
          </div>
        </div>

        {/* RIGHT — text */}
        <div className="flex flex-1 flex-col justify-between border-t border-border bg-surface p-6 md:border-l md:border-t-0">
          {/* Top: meta + title */}
          <div>
            {/* Meta row */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {item.author && (
                <span className="font-mono text-xs tracking-wide" style={{ color: vibeColor }}>
                  {item.author.toUpperCase()}
                </span>
              )}
              {item.publishedAt && (
                <span className="sys-label">{fmtDateShort(item.publishedAt)}</span>
              )}
              {item.readTime && (
                <span className="sys-label flex items-center gap-1">
                  <Clock size={9} />
                  {item.readTime} MIN LECTURA
                </span>
              )}
              {item.subtitle && (
                <span className="sys-label text-muted">{item.subtitle}</span>
              )}
            </div>

            {/* Title */}
            <h1 className="mb-5 font-syne text-3xl font-black leading-tight text-primary md:text-4xl">
              {item.title}
            </h1>

            {/* Body paragraphs */}
            <div className="space-y-3">
              {paragraphs.map((p, i) => (
                <p
                  key={i}
                  className={[
                    'font-grotesk leading-relaxed',
                    i === 0
                      ? 'text-base text-secondary'
                      : 'text-sm text-muted',
                    i >= 2 ? 'hidden md:block' : '',
                  ].join(' ')}
                >
                  {p}
                </p>
              ))}
            </div>
          </div>

          {/* Bottom: genres + CTA */}
          <div className="mt-6">
            {/* Genre + tag chips */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <span
                  key={g}
                  className="px-2 py-0.5 font-mono text-[9px] tracking-wide"
                  style={{ backgroundColor: `${vibeColor}18`, color: vibeColor }}
                >
                  {g}
                </span>
              ))}
              {tags.map((t) => (
                <span
                  key={t}
                  className="border border-border px-2 py-0.5 font-mono text-[9px] text-muted"
                >
                  {t}
                </span>
              ))}
            </div>

            {/* CTA */}
            <button className="group flex items-center gap-2 border border-border bg-elevated px-4 py-2.5 font-mono text-xs tracking-widest text-secondary transition-all hover:border-primary hover:text-primary">
              LEER COMPLETO
              <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

