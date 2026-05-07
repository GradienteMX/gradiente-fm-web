'use client'

import type { ContentItem } from '@/lib/types'
import { vibeToColor, vibeMid, vibeBandGradient, categoryColor, fmtDateShort, fmtDayNumber, fmtMonthShort, fmtDayName, fmtTime } from '@/lib/utils'
import { getGenreById, getTagNames } from '@/lib/genres'
import { Play, Clock, MapPin, Ticket } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useOverlay } from '@/components/overlay/useOverlay'
import { GenreChipButton } from '@/components/genre/GenreChipButton'
import { PollCardCanvas } from '@/components/poll/PollCardCanvas'
import { SavedBadge } from './SavedBadge'

// ── Fresh-published chrome ─────────────────────────────────────────────────
//
// Editor-composed items show a glitch chrome (border pulse, scanline sweep,
// cover flicker, [NUEVO] chip) for the first hour after publish so the new
// content is unmistakable in the feed. Excludes scraped events (source ===
// 'scraper:ra') so the Mon/Wed/Fri scrape batches don't all glitch at once.
const ONE_HOUR_MS = 60 * 60 * 1000
function freshAgeMs(item: ContentItem): number | null {
  if (item.source === 'scraper:ra') return null
  const ms = Date.parse(item.publishedAt)
  if (Number.isNaN(ms)) return null
  return Date.now() - ms
}

// Card-side helper — keeps ids + names paired for click-to-filter chips.
function genreEntries(ids: string[], limit: number) {
  return ids.slice(0, limit).map((id) => ({
    id,
    name: getGenreById(id)?.name ?? id,
  }))
}

export type CardSize = 'sm' | 'md' | 'lg'

const TYPE_LABEL: Record<ContentItem['type'], string> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTICIA',
  review: 'REVIEW',
  editorial: 'EDITORIAL',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULO',
  listicle: 'LISTA',
  partner: 'PARTNER',
}

interface ContentCardProps {
  item: ContentItem
  size?: CardSize
}

// ── Shared image layer ────────────────────────────────────────────────────────
function CardImage({
  item,
  size,
  isFresh,
}: {
  item: ContentItem
  size: CardSize
  isFresh: boolean
}) {
  const vibeColor = vibeToColor(vibeMid(item))
  // For ranges, the top strip becomes a gradient band so the card surfaces
  // the breadth of the item at a glance. Single-point items stay solid.
  const vibeBand = vibeBandGradient(item)
  const isDraftOnly = item._draftState === 'draft'
  const typeColor = categoryColor(item.type)

  return (
    <div className="absolute inset-0 overflow-hidden">
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.title}
          className={`h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105 ${
            isFresh ? 'fresh-cover-flicker' : ''
          }`}
          loading="lazy"
        />
      ) : (
        <div className="h-full w-full bg-elevated" />
      )}

      {/* Gradient: stronger at bottom where text lives */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />

      {/* Vibe band — top strip. Solid color for point items, gradient for
          ranges. Reads as the item's vibe signature at a glance. */}
      <div
        className="absolute right-0 top-0 h-1 w-full"
        style={{ background: vibeBand, opacity: 0.85 }}
      />

      {/* Saved indicator — top-right corner, only visible when bookmarked */}
      <div className="absolute right-3 top-3">
        <SavedBadge itemId={item.id} />
      </div>

      {/* Fresh-published scanline sweep — single thin line traversing
          top→bottom. Inherits the type color via the card-level CSS variable. */}
      {isFresh && <div className="fresh-scanline" aria-hidden />}

      {/* Type badge — top left */}
      <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
        <span
          className="bg-black/70 px-2 py-1 font-mono text-[10px] tracking-widest backdrop-blur-sm"
          style={{ color: typeColor }}
        >
          //{TYPE_LABEL[item.type]}
        </span>
        {item.editorial && (
          <span className="bg-sys-red/90 px-1.5 py-1 font-mono text-[10px] tracking-widest text-white backdrop-blur-sm">
            ★
          </span>
        )}
        {isFresh && (
          <span
            className="fresh-chip-flicker border bg-black/85 px-1.5 py-1 font-mono text-[10px] tracking-widest backdrop-blur-sm"
            style={{
              borderColor: typeColor,
              color: typeColor,
              boxShadow: `0 0 8px color-mix(in srgb, ${typeColor} 50%, transparent)`,
            }}
            title="Recién publicado"
          >
            [NUEVO]
          </span>
        )}
        {isDraftOnly && (
          <span
            className="border bg-black/80 px-1.5 py-1 font-mono text-[10px] tracking-widest backdrop-blur-sm"
            style={{
              borderColor: '#F97316',
              color: '#F97316',
            }}
            title="Borrador local — solo visible en esta sesión"
          >
            [DRAFT·SESIÓN]
          </span>
        )}
      </div>

      {/* NGE corner bracket — bottom right */}
      <div className="absolute bottom-3 right-3">
        <div
          className="h-3 w-3 border-b border-r"
          style={{ borderColor: `${vibeColor}60` }}
        />
      </div>

      {/* Poll affordance — chip when closed, full canvas when open. Lives
          inside the image container so the canvas borrows the image's real
          estate. See [[PollCardCanvas]]. */}
      <PollCardCanvas item={item} />
    </div>
  )
}

// ── SM card — 1×1 ────────────────────────────────────────────────────────────
function SmCard({ item, isFresh }: { item: ContentItem; isFresh: boolean }) {
  const vibeColor = vibeToColor(vibeMid(item))
  const genres = genreEntries(item.genres, 2)

  return (
    <article className="group relative h-full overflow-hidden border border-border cursor-pointer">
      <CardImage item={item} size="sm" isFresh={isFresh} />

      {item.type === 'evento' && item.date && (
        <div className="absolute right-2 top-3 flex flex-col items-center border border-white/20 bg-black/70 px-2 py-1 backdrop-blur-sm">
          <span className="font-mono text-[8px] font-bold tracking-widest text-white">{fmtMonthShort(item.date)}</span>
          <span className="font-syne text-2xl font-black leading-none text-white">{fmtDayNumber(item.date)}</span>
          <span className="font-mono text-[8px] font-bold tracking-widest text-white">{fmtDayName(item.date)}</span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h2 className="mb-1 font-syne text-sm font-black leading-tight text-white line-clamp-2">
          {item.title}
        </h2>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {item.date && (
            <span className="font-mono text-[9px] tracking-wide text-secondary">
              {fmtDateShort(item.date ?? item.publishedAt)}
            </span>
          )}
          {item.venue && (
            <span className="font-mono text-[9px] text-muted">{item.venue}</span>
          )}
          {item.author && (
            <span className="font-mono text-[9px] text-muted">{item.author}</span>
          )}
        </div>

        {genres.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {genres.map(({ id, name }) => (
              <GenreChipButton
                key={id}
                genreId={id}
                className="font-mono text-[9px]"
                style={{ color: vibeColor }}
              >
                [{name}]
              </GenreChipButton>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

// ── MD card — 2×1 (wide) or 1×2 (tall) ──────────────────────────────────────
function MdCard({ item, isFresh }: { item: ContentItem; isFresh: boolean }) {
  const vibeColor = vibeToColor(vibeMid(item))
  const genres = genreEntries(item.genres, 3)
  const tags = getTagNames(item.tags).slice(0, 3)
  const time = item.date ? fmtTime(item.date) : ''
  const isMix = item.type === 'mix'

  return (
    <article className="group relative h-full overflow-hidden border border-border cursor-pointer">
      <CardImage item={item} size="md" isFresh={isFresh} />

      {item.type === 'evento' && item.date && (
        <div className="absolute right-2 top-3 flex flex-col items-center border border-white/20 bg-black/70 px-2 py-1.5 backdrop-blur-sm">
          <span className="font-mono text-[8px] font-bold tracking-widest text-white">{fmtMonthShort(item.date)}</span>
          <span className="font-syne text-3xl font-black leading-none text-white">{fmtDayNumber(item.date)}</span>
          <span className="font-mono text-[8px] font-bold tracking-widest text-white">{fmtDayName(item.date)}</span>
          {time && <span className="mt-0.5 font-mono text-[9px] text-secondary">{time}</span>}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-4">
        {/* Artists row for events */}
        {item.artists && item.artists.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-x-2">
            {item.artists.slice(0, 3).map((a) => (
              <span key={a} className="font-mono text-[10px] tracking-wide text-secondary">
                {a}
              </span>
            ))}
          </div>
        )}

        <h2 className="mb-1.5 font-syne text-lg font-black leading-tight text-white line-clamp-2">
          {item.title}
        </h2>

        {item.subtitle && (
          <p className="mb-1.5 font-grotesk text-xs text-secondary line-clamp-1">{item.subtitle}</p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {item.date && !isMix && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-secondary">
              <MapPin size={9} />
              {item.venue}
              {time && ` · ${time}`}
            </span>
          )}
          {isMix && item.duration && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-secondary">
              <Play size={9} />
              {item.duration}
            </span>
          )}
          {item.readTime && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-muted">
              <Clock size={9} />
              {item.readTime} min
            </span>
          )}
          {genres.slice(0, 2).map(({ id, name }) => (
            <GenreChipButton
              key={id}
              genreId={id}
              className="font-mono text-[9px] transition-colors hover:text-white"
              style={{ color: vibeColor }}
            >
              [{name}]
            </GenreChipButton>
          ))}
          {item.price && (
            <span className="ml-auto flex items-center gap-1 font-mono text-[9px] text-secondary">
              <Ticket size={9} />
              {item.price}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

// ── LG card — 2×2 (big featured) ─────────────────────────────────────────────
function LgCard({ item, isFresh }: { item: ContentItem; isFresh: boolean }) {
  const vibeColor = vibeToColor(vibeMid(item))
  const genres = genreEntries(item.genres, 4)
  const tags = getTagNames(item.tags).slice(0, 4)
  const time = item.date ? fmtTime(item.date) : ''

  return (
    <article className="group relative h-full overflow-hidden border border-border cursor-pointer">
      <CardImage item={item} size="lg" isFresh={isFresh} />

      {/* Date block for events — top right inside image */}
      {item.type === 'evento' && item.date && (
        <div className="absolute right-3 top-10 mt-2 flex flex-col items-center border border-white/20 bg-black/70 px-3 py-2 backdrop-blur-sm">
          <span className="font-mono text-[9px] font-bold tracking-widest text-white">
            {fmtMonthShort(item.date)}
          </span>
          <span className="font-syne text-4xl font-black leading-none text-white">
            {fmtDayNumber(item.date)}
          </span>
          <span className="font-mono text-[9px] font-bold tracking-widest text-white">
            {fmtDayName(item.date)}
          </span>
          {time && (
            <span className="mt-1 font-mono text-[10px] text-secondary">{time}</span>
          )}
        </div>
      )}

      {/* Bottom content area */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        {/* Artists */}
        {item.artists && item.artists.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
            {item.artists.slice(0, 4).map((a) => (
              <span key={a} className="font-mono text-xs tracking-wide text-secondary">
                {a}
              </span>
            ))}
          </div>
        )}

        <h2 className="mb-2 font-syne text-2xl font-black leading-tight text-white md:text-3xl">
          {item.title}
        </h2>

        {item.subtitle && (
          <p className="mb-2 font-mono text-xs text-secondary">{item.subtitle}</p>
        )}

        {item.excerpt && (
          <p className="mb-3 font-grotesk text-sm leading-relaxed text-secondary line-clamp-2 md:line-clamp-3">
            {item.excerpt}
          </p>
        )}

        {/* Genres + tags */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {genres.map(({ id, name }) => (
            <GenreChipButton
              key={id}
              genreId={id}
              className="px-2 py-0.5 font-mono text-[9px] tracking-wide"
              style={{ backgroundColor: `${vibeColor}20`, color: vibeColor }}
            >
              {name}
            </GenreChipButton>
          ))}
          {tags.map((t) => (
            <span key={t} className="border border-white/10 px-2 py-0.5 font-mono text-[9px] text-muted">
              {t}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {item.venue && (
              <span className="flex items-center gap-1 font-mono text-[10px] text-muted">
                <MapPin size={10} />
                {item.venue}
                {item.venueCity && ` · ${item.venueCity}`}
              </span>
            )}
            {item.price && (
              <span className="flex items-center gap-1 font-mono text-[10px] text-secondary">
                <Ticket size={10} />
                {item.price}
              </span>
            )}
            {item.type === 'mix' && item.duration && (
              <span className="flex items-center gap-1 font-mono text-[10px] text-secondary">
                <Play size={10} />
                {item.duration}
              </span>
            )}
            {item.author && (
              <span className="font-mono text-[10px] text-muted">by {item.author}</span>
            )}
            {item.readTime && (
              <span className="flex items-center gap-1 font-mono text-[10px] text-muted">
                <Clock size={10} />
                {item.readTime} min
              </span>
            )}
          </div>
          {item.ticketUrl && (
            <a
              href={item.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/20 px-3 py-1.5 font-mono text-[10px] tracking-widest text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              TICKETS →
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export function ContentCard({ item, size = 'sm' }: ContentCardProps) {
  const { open } = useOverlay()
  const ref = useRef<HTMLDivElement>(null)

  // Compute initial fresh state from the item's age. Editor-composed items
  // (source !== 'scraper:ra') glitch for the first hour after publish.
  const initialAge = freshAgeMs(item)
  const initialFresh =
    initialAge !== null && initialAge >= 0 && initialAge < ONE_HOUR_MS
  const [isFresh, setIsFresh] = useState(initialFresh)

  // Per-card timer flips fresh → stale exactly at the 1-hour mark so
  // long-lived sessions don't keep glitching past the boundary. No
  // setInterval — one shot at `(publishedAt + 1hr) - now` ms, then we're
  // done.
  useEffect(() => {
    if (!initialFresh || initialAge === null) return
    const remaining = ONE_HOUR_MS - initialAge
    if (remaining <= 0) {
      setIsFresh(false)
      return
    }
    const timer = window.setTimeout(() => setIsFresh(false), remaining)
    return () => window.clearTimeout(timer)
  }, [initialFresh, initialAge])

  const handleOpen = () => {
    const rect = ref.current?.getBoundingClientRect()
    open(
      item.slug,
      rect
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : undefined,
    )
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleOpen()
    }
  }

  const Inner = size === 'lg' ? LgCard : size === 'md' ? MdCard : SmCard
  // Set the type color as a CSS custom property so the keyframe animations
  // (border pulse, scanline, chip glow) inherit it without needing a
  // per-instance class.
  const wrapperStyle: CSSProperties | undefined = isFresh
    ? ({ borderWidth: 1, '--glitch-color': categoryColor(item.type) } as CSSProperties)
    : undefined

  return (
    <div
      ref={ref}
      data-card-id={item.id}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Abrir ${item.title}`}
      className={`relative h-full focus:outline-none focus-visible:ring-1 focus-visible:ring-sys-red ${
        isFresh ? 'fresh-glitch border' : ''
      }`}
      style={wrapperStyle}
    >
      <Inner item={item} isFresh={isFresh} />
    </div>
  )
}
