'use client'

import { Calendar, Clock, MapPin, Ticket, ExternalLink } from 'lucide-react'
import type { ContentItem } from '@/lib/types'
import {
  fmtDateFull,
  fmtDayName,
  fmtDayNumber,
  fmtMonthShort,
  fmtTime,
  vibeToColor,
  vibeMid,
} from '@/lib/utils'
import { getGenreById, getTagNames } from '@/lib/genres'
import { GenreChipButton } from '@/components/genre/GenreChipButton'
import { PollSection } from '@/components/poll/PollSection'
import { VibeFader } from '@/components/VibeFader'

interface Props {
  item: ContentItem
}

export function EventoOverlay({ item }: Props) {
  const vibeColor = vibeToColor(vibeMid(item))
  const genres = item.genres.map((id) => ({
    id,
    name: getGenreById(id)?.name ?? id,
  }))
  const tags = getTagNames(item.tags)

  return (
    <article className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Flyer column */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-elevated md:aspect-auto md:h-full md:min-h-[520px]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-mono text-xs text-muted">SIN IMAGEN</span>
          </div>
        )}

        {/* Date block — top right on flyer */}
        {item.date && (
          <div className="absolute right-4 top-4 flex flex-col items-center border border-white/25 bg-black/75 px-3 py-2 backdrop-blur-sm">
            <span className="font-mono text-[10px] tracking-widest text-muted">
              {fmtMonthShort(item.date)}
            </span>
            <span className="font-syne text-4xl font-black leading-none text-white">
              {fmtDayNumber(item.date)}
            </span>
            <span className="font-mono text-[10px] tracking-widest text-muted">
              {fmtDayName(item.date)}
            </span>
          </div>
        )}

        {/* Vibe stripe */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ backgroundColor: vibeColor }}
        />
      </div>

      {/* Info column */}
      <div className="flex flex-col gap-5 p-5 md:p-7">
        {/* Header */}
        <header className="flex flex-col gap-3">
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

        {/* Meta grid */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 border-y border-border py-4">
          {item.date && (
            <>
              <dt className="sys-label flex items-center gap-1.5">
                <Calendar size={11} />
                FECHA
              </dt>
              <dd className="font-grotesk text-sm text-primary">
                {fmtDateFull(item.date)}
                {item.endDate && ` → ${fmtDateFull(item.endDate)}`}
              </dd>
            </>
          )}

          {item.date && (
            <>
              <dt className="sys-label flex items-center gap-1.5">
                <Clock size={11} />
                HORA
              </dt>
              <dd className="font-mono text-sm text-primary">
                {fmtTime(item.date)}
                {item.endDate && ` – ${fmtTime(item.endDate)}`}
              </dd>
            </>
          )}

          {item.venue && (
            <>
              <dt className="sys-label flex items-center gap-1.5">
                <MapPin size={11} />
                LUGAR
              </dt>
              <dd className="font-grotesk text-sm text-primary">
                {item.venue}
                {item.venueCity && (
                  <span className="block font-mono text-xs text-muted">
                    {item.venueCity}
                  </span>
                )}
              </dd>
            </>
          )}

          {item.price && (
            <>
              <dt className="sys-label flex items-center gap-1.5">
                <Ticket size={11} />
                PRECIO
              </dt>
              <dd className="font-mono text-sm text-primary">{item.price}</dd>
            </>
          )}

          <dt className="sys-label">VIBE</dt>
          <dd>
            <VibeFader item={item} />
          </dd>
        </dl>

        {/* Artists */}
        {item.artists && item.artists.length > 0 && (
          <section>
            <h2 className="sys-label mb-2">LINE-UP</h2>
            <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
              {item.artists.map((a) => (
                <li
                  key={a}
                  className="font-syne text-sm font-bold tracking-wide text-primary"
                >
                  {a}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Excerpt / body */}
        {item.excerpt && (
          <p className="font-grotesk text-sm leading-relaxed text-secondary">
            {item.excerpt}
          </p>
        )}

        {/* Genres + tags */}
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

        {/* Poll — attendance variant for events. Sits above the tickets
            CTA so the social signal precedes the commercial one. */}
        {item.poll && <PollSection item={item} />}

        {/* Tickets CTA — external escape hatch */}
        {item.ticketUrl && (
          <a
            href={item.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center justify-center gap-2 border border-sys-red/60 bg-sys-red/10 px-4 py-3 font-mono text-xs tracking-widest text-sys-red transition-colors hover:bg-sys-red/20"
          >
            <Ticket size={14} />
            COMPRAR BOLETOS
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </article>
  )
}
