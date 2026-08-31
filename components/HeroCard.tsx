'use client'

import type { ContentItem } from '@/lib/types'
import { effectiveVibeBand, fmtDateShort } from '@/lib/utils'
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
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useOverlay } from '@/components/overlay/useOverlay'
import { useVibe } from '@/context/VibeContext'
import { recordItems } from '@/lib/itemsCache'

interface HeroCardProps {
  item: ContentItem
}

// PORTADA — the pinned hero rendered as the paper's front page («EL PLIEGO»
// fase B). Selection stays upstream (getPinnedHero in app/page.tsx); this
// component renders whatever arrives. Split frame: text page | artwork plate.
// Dark art inside the paper frame is intentional — the flyer is where ink
// bleeds through; the frame itself stays paper.
export function HeroCard({ item }: HeroCardProps) {
  const typeColor = categoryColorOnLight(item.type)
  const genres = item.genres.map((id) => ({
    id,
    name: getGenreById(id)?.name ?? id,
  }))
  const tags = getTagNames(item.tags).slice(0, 3)
  const { open } = useOverlay()
  const { categoryFilter } = useVibe()
  const ref = useRef<HTMLElement>(null)

  // The hero is excluded from the main grid (see app/page.tsx), so ContentGrid
  // never records it. Push it into the slug-keyed cache ourselves so the
  // OverlayRouter can resolve `?item=<hero-slug>` when the hero is clicked.
  useEffect(() => {
    recordItems([item])
  }, [item])

  // When the category filter is active and doesn't match this hero's type,
  // hide it — the rest of the home grid filters in place.
  if (categoryFilter && item.type !== categoryFilter) return null

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
  const paragraphs = item.bodyPreview
    ? item.bodyPreview.split(/\n+/).map((p) => p.trim()).filter(Boolean)
    : item.excerpt
    ? [item.excerpt]
    : []

  const bylineParts = [
    item.author ? `POR ${item.author.toUpperCase()}` : null,
    item.readTime ? `LECTURA ${item.readTime} MIN` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section
      ref={ref}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${item.title}`}
      className="group mb-6 cursor-pointer border border-ink bg-paper-raised focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {/* Kicker row — red PORTADA fill chip + pinned fact. Printed, not live:
          no dot, no pulse. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink px-4 py-2">
        <span className="bg-sys-red-paper px-2 py-0.5 font-mono text-d11 font-bold uppercase tracking-widest text-paper-raised">
          PORTADA
        </span>
        <span className="font-mono text-d11 uppercase tracking-widest text-sys-red-paper">
          ⌖ FIJADA · SE ACTUALIZA SEMANALMENTE
        </span>
      </div>

      {/* Split body: text page left, artwork plate right */}
      <div className="flex flex-col md:min-h-[360px] md:flex-row">
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
              className="mb-5 font-syne text-d28 font-black leading-none text-ink md:text-[clamp(34px,3.4vw,52px)] [text-wrap:balance]"
            >
              {item.title}
            </h1>

            {/* Dek */}
            <div className="space-y-3">
              {paragraphs.map((p, i) => (
                <p
                  key={i}
                  className={[
                    'font-grotesk',
                    i === 0 ? 'text-d15 text-ink-soft' : 'text-d13 text-ink-faint',
                    i >= 2 ? 'hidden md:block' : '',
                  ].join(' ')}
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
                LEER COMPLETO →
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
