'use client'

import type { ContentItem } from '@/lib/types'
import { effectiveVibeBand, fmtDateFull, fmtDateShort } from '@/lib/utils'
import { VibeMeterLight } from '@/components/dashboard/widgets/shared/VibeMeterLight'
import { getGenreById, getTagNames } from '@/lib/genres'
import { GenreChipButton } from '@/components/genre/GenreChipButton'
import { PollCardCanvas } from '@/components/poll/PollCardCanvas'
import { SavedBadge } from '@/components/cards/SavedBadge'
import { SmartImage } from '@/components/SmartImage'
import {
  categoryColorOnLight,
  typeCode,
  typeDisplayLabel,
} from '@/lib/dashboard/palette'
import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from 'react'
import { useOverlay } from '@/components/overlay/useOverlay'
import { PortadaToggle } from '@/components/portada/PortadaToggle'
import { recordItems } from '@/lib/itemsCache'

// Carousel seat — present when the hero is one slide among several
// (HeroCarousel). All handlers stop propagation: the whole card opens the
// overlay on click.
export interface HeroSlot {
  index: number
  total: number
  paused: boolean
  autoRotates: boolean
  onPrev: () => void
  onNext: () => void
  onTogglePause: () => void
}

interface HeroCardProps {
  item: ContentItem
  slot?: HeroSlot
  // False for slides currently off-screen in the carousel track: they keep
  // their layout but drop out of the tab order so keyboard users are not
  // walked through invisible cards.
  live?: boolean
}

// PORTADA — the pinned hero rendered as the paper's front page («EL PLIEGO»
// fase B). Selection stays upstream (getPinnedHero in app/page.tsx); this
// component renders whatever arrives. Split frame: text page | artwork plate.
// Dark art inside the paper frame is intentional — the flyer is where ink
// bleeds through; the frame itself stays paper.
const KEY =
  'flex h-8 min-w-8 items-center justify-center border border-ink bg-paper px-2 font-mono text-d13 leading-none text-ink transition-colors hover:bg-ink hover:text-paper focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
const stop = (e: MouseEvent) => { e.stopPropagation(); e.preventDefault() }
const stopKeys = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }

export function HeroCard({ item, slot, live = true }: HeroCardProps) {
  const typeColor = categoryColorOnLight(item.type)
  const genres = item.genres.map((id) => ({
    id,
    name: getGenreById(id)?.name ?? id,
  }))
  const tags = getTagNames(item.tags).slice(0, 3)
  const { open } = useOverlay()
  const ref = useRef<HTMLElement>(null)

  // The hero is excluded from the main grid (see app/page.tsx), so ContentGrid
  // never records it. Push it into the slug-keyed cache ourselves so the
  // OverlayRouter can resolve `?item=<hero-slug>` when the hero is clicked.
  useEffect(() => {
    recordItems([item])
  }, [item])

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

  // Split bodyPreview into paragraphs for rendering. Match any run of
  // newlines so a single Enter in the composer also renders as a break.
  // The dek is a TEASER, not the body: two paragraphs at most, line-clamped,
  // so a piece with a long bodyPreview cannot stretch the front page (every
  // slide in the carousel track takes the tallest slide's height).
  const paragraphs = (item.bodyPreview
    ? item.bodyPreview.split(/\n+/).map((p) => p.trim()).filter(Boolean)
    : item.excerpt
    ? [item.excerpt]
    : []
  ).slice(0, 2)

  // Display size bends to the longest word: Syne Black at 52px puts an
  // all-caps «BIENVENIDO» past the column edge, and break-words is banned
  // here (it splits mid-word with no hyphen). Whole words always fit instead.
  const longestWord = item.title.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0)
  const titleMaxPx = longestWord > 12 ? 32 : longestWord > 9 ? 40 : 52

  // Byline adapts to the slide's type now that any type can hold the front
  // page: events print date + venue, mixes print series/duration, text
  // pieces keep author + reading time.
  const bylineParts = [
    item.type === 'evento' && item.date ? fmtDateFull(item.date).toUpperCase() : null,
    item.type === 'evento' && item.venue ? item.venue.toUpperCase() : null,
    item.type === 'mix' && item.mixSeries ? item.mixSeries.toUpperCase() : null,
    item.type === 'mix' && item.duration ? item.duration : null,
    item.author ? `POR ${item.author.toUpperCase()}` : null,
    item.readTime && item.type !== 'evento' && item.type !== 'mix' ? `LECTURA ${item.readTime} MIN` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section
      ref={ref}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={live ? 0 : -1}
      aria-label={`Abrir ${item.title}`}
      className="group flex h-full cursor-pointer flex-col border border-ink bg-paper-raised focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {/* Kicker row — red PORTADA fill chip + pinned fact. Printed, not live:
          no dot, no pulse. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink px-4 py-2">
        <span className="bg-sys-red-paper px-2 py-0.5 font-mono text-d11 font-bold uppercase tracking-widest text-paper-raised">
          PORTADA
        </span>
        <span className="font-mono text-d11 uppercase tracking-widest text-sys-red-paper">
          {slot && slot.total > 1 ? `⌖ EN PORTADA · ${slot.index + 1}/${slot.total}` : '⌖ EN PORTADA'}
        </span>
        {/* Carousel transport — printed keys, no autoplay dots. Every handler
            stops propagation so the keys never open the overlay. */}
        {slot && slot.total > 1 && (
          <span className="ml-auto flex items-center gap-1" onClick={stop} onKeyDown={stopKeys}>
            <button type="button" onClick={(e) => { stop(e); slot.onPrev() }} aria-label="Anterior en portada" className={KEY}>‹</button>
            <button type="button" onClick={(e) => { stop(e); slot.onNext() }} aria-label="Siguiente en portada" className={KEY}>›</button>
            {slot.autoRotates && (
              <button type="button" onClick={(e) => { stop(e); slot.onTogglePause() }} aria-pressed={slot.paused} aria-label={slot.paused ? 'Reanudar rotación' : 'Pausar rotación'} title={slot.paused ? 'Reanudar rotación' : 'Pausar rotación'} className={KEY}>
                {slot.paused ? '▶' : '❚❚'}
              </button>
            )}
          </span>
        )}
        <span className={slot && slot.total > 1 ? '' : 'ml-auto'}>
          <PortadaToggle item={item} variant="hero" />
        </span>
      </div>

      {/* Split body: text page left, artwork plate right */}
      <div className="flex flex-1 flex-col md:min-h-[360px] md:flex-row">
        {/* LEFT — text page */}
        <div className="flex min-w-0 flex-1 flex-col justify-between p-6">
          <div>
            {/* Meta row — type swatch pairs with the 2-letter code (color is
                never the only signal), then date + optional subtitle. */}
            <div className="mb-4 flex flex-wrap items-center gap-2 font-mono text-d11 uppercase tracking-widest text-ink-soft">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 border border-ink"
                style={{ backgroundColor: typeColor }}
              />
              <span className="font-bold" style={{ color: typeColor }}>
                {typeCode(item.type)}
              </span>
              <span>{typeDisplayLabel(item.type)}</span>
              {item.publishedAt && (
                <>
                  <span className="text-ink-faint">·</span>
                  <span className="text-ink-faint">
                    {fmtDateShort(item.publishedAt)}
                  </span>
                </>
              )}
              {item.subtitle && (
                <>
                  <span className="text-ink-faint">·</span>
                  <span className="text-ink-faint">{item.subtitle}</span>
                </>
              )}
            </div>

            {/* Headline — balanced wrap at a size that keeps whole words in
                the column. break-words is banned here: it splits mid-word with
                no hyphen («Venezue/la»); the clamp guarantees fit instead. */}
            <h1
              lang="es"
              style={{ fontSize: `clamp(28px, 3.4vw, ${titleMaxPx}px)` }}
              className="mb-5 font-syne font-black leading-none text-ink [text-wrap:balance]"
            >
              {item.title}
            </h1>

            {/* Dek */}
            <div className="space-y-3">
              {paragraphs.map((p, i) => (
                <p
                  key={i}
                  className={
                    i === 0
                      ? 'line-clamp-4 font-grotesk text-d15 text-ink-soft'
                      : 'hidden font-grotesk text-d13 text-ink-faint md:line-clamp-3 md:[display:-webkit-box]'
                  }
                >
                  {p}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-6">
            {/* Genre + tag chips — paper ground */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {genres.map(({ id, name }) => (
                <GenreChipButton
                  key={id}
                  genreId={id}
                  className="border border-ink bg-paper px-2 py-0.5 font-mono text-d11 uppercase tracking-widest text-ink"
                >
                  {name}
                </GenreChipButton>
              ))}
              {tags.map((t) => (
                <span
                  key={t}
                  className="border border-ink px-2 py-0.5 font-mono text-d11 uppercase tracking-widest text-ink-faint"
                >
                  {t}
                </span>
              ))}
            </div>

            {/* Byline row on a hairline. The whole card opens the overlay, so
                LEER COMPLETO is a printed pointer, not a nested control. */}
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-ink pt-3 font-mono text-d11 uppercase tracking-widest">
              <span className="text-ink-soft">{bylineParts}</span>
              <span className="px-1 font-bold text-ink transition-colors group-hover:bg-ink group-hover:text-paper">
                {item.type === 'evento' ? 'VER EVENTO →' : item.type === 'mix' ? 'ESCUCHAR →' : 'LEER COMPLETO →'}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT — artwork plate. Fill image, so the wrapper is positioned and
            sized (aspect box on mobile, stretched column on md+). */}
        <div className="relative aspect-[4/3] w-full overflow-hidden border-t border-ink md:aspect-auto md:w-[45%] md:border-l md:border-t-0">
          {item.imageUrl ? (
            <SmartImage
              src={item.imageUrl}
              alt={item.title}
              priority
              sizes="(max-width: 768px) 100vw, 45vw"
              className="object-cover object-top"
            />
          ) : (
            <div className="absolute inset-0 bg-ink" />
          )}

          {/* Saved indicator — top-right corner, only when bookmarked */}
          <div className="absolute right-4 top-4">
            <SavedBadge itemId={item.id} />
          </div>

          {/* Vibe reading — words-only calibrated plate seated on the art's
              bottom edge (aria-label speaks VIBE_SLOT_NAMES, never numbers). */}
          <VibeMeterLight
            band={effectiveVibeBand(item)}
            className="absolute inset-x-0 bottom-0"
          />

          {/* Poll affordance — chip when closed, full canvas when open. */}
          <PollCardCanvas item={item} />
        </div>
      </div>
    </section>
  )
}
