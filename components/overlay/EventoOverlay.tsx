'use client'

import { Calendar, Clock, MapPin, Ticket } from 'lucide-react'
import type { ContentItem } from '@/lib/types'
import { SmartImage } from '@/components/SmartImage'
import {
  effectiveVibeBand,
  fmtDateFull,
  fmtDayName,
  fmtDayNumber,
  fmtMonthShort,
  fmtTime,
} from '@/lib/utils'
import { getGenreById, getTagNames } from '@/lib/genres'
import { GenreChipButton } from '@/components/genre/GenreChipButton'
import { PollSection } from '@/components/poll/PollSection'
import { VibeFader } from '@/components/VibeFader'
import { VibeMeterLight } from '@/components/dashboard/widgets/shared/VibeMeterLight'
import { OverlayLinks } from './OverlayLinks'
import { OverlayEntities } from './OverlayEntities'

// ── EventoOverlay — the printed flyer dossier (fase C, «EL PLIEGO») ─────────
//
// Left: the flyer plate — artwork ink-framed, kept clean (no scrims, no
// blur); the date block is the printed gig-poster sticker (mono MES / Syne
// day / mono DÍA on paper-raised with an ink hairline). The vibe readout
// moved OFF the artwork onto a paper base strip below the plate
// (VibeMeterLight — the 11-slot plate calibrated for cream), matching the
// fase-B feed-card law that chrome lives in the caption zone, not on art.
//
// Right: the dossier — ★ EDITORIAL ink chip, Syne title, meta dl on
// hairlines, the VibeFader on its black faceplate seat (the fader's grips
// and meter are dark-ground instruments — instrument doctrine, same seat as
// the dashboard ReproductorWidget), entities/links, LINE-UP as mono rows,
// and the sys-red-paper COMPRAR BOLETOS fill block (the red CTA is the
// event register; external anchor kept).

interface Props {
  item: ContentItem
}

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2'

export function EventoOverlay({ item }: Props) {
  const genres = item.genres.map((id) => ({
    id,
    name: getGenreById(id)?.name ?? id,
  }))
  const tags = getTagNames(item.tags)

  return (
    <article className="grid gap-0 bg-paper text-ink md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Flyer column — plate + paper vibe strip */}
      <div className="flex flex-col border-b border-ink md:border-b-0 md:border-r">
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-ink/10 md:aspect-auto md:min-h-[520px] md:flex-1">
          {item.imageUrl ? (
            <SmartImage
              src={item.imageUrl}
              alt={item.title}
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover object-top"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-mono text-xs text-ink-faint">SIN IMAGEN</span>
            </div>
          )}

          {/* Date block — the printed sticker, top right on the flyer */}
          {item.date && (
            <div className="absolute right-4 top-4 flex flex-col items-center border border-ink bg-paper-raised px-3 py-2">
              <span className="font-mono text-[10px] font-bold tracking-widest text-ink">
                {fmtMonthShort(item.date)}
              </span>
              <span className="font-syne text-4xl font-black leading-none text-ink">
                {fmtDayNumber(item.date)}
              </span>
              <span className="font-mono text-[10px] font-bold tracking-widest text-ink">
                {fmtDayName(item.date)}
              </span>
            </div>
          )}
        </div>

        {/* Vibe strip — the flyer's base edge, ON PAPER (not over the art) */}
        <div className="border-t border-ink px-4 py-2.5">
          <VibeMeterLight band={effectiveVibeBand(item)} size="sm" />
        </div>
      </div>

      {/* Info column — the dossier */}
      <div className="flex flex-col gap-5 p-5 md:p-7">
        {/* Header */}
        <header className="flex flex-col gap-3">
          {item.editorial && (
            <span
              className="inline-flex w-fit items-center gap-1.5 bg-ink px-2 py-0.5 font-mono text-[10px] tracking-widest text-paper-raised"
              title="Selección editorial"
            >
              ★ EDITORIAL
            </span>
          )}

          <h1 className="font-syne text-3xl font-black leading-[1.05] text-ink md:text-4xl">
            {item.title}
          </h1>

          {item.subtitle && (
            <p className="font-grotesk text-sm text-ink-soft md:text-base">
              {item.subtitle}
            </p>
          )}
        </header>

        {/* Meta dl — spec-sheet rows on hairlines */}
        <dl className="flex flex-col divide-y divide-ink-faint border-y border-ink">
          {item.date && (
            <div className="grid grid-cols-[96px_1fr] items-baseline gap-x-4 py-2.5">
              <dt className="flex items-center gap-1.5 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                <Calendar size={11} />
                FECHA
              </dt>
              <dd className="font-grotesk text-sm text-ink">
                {fmtDateFull(item.date)}
                {item.endDate && ` → ${fmtDateFull(item.endDate)}`}
              </dd>
            </div>
          )}

          {item.date && (
            <div className="grid grid-cols-[96px_1fr] items-baseline gap-x-4 py-2.5">
              <dt className="flex items-center gap-1.5 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                <Clock size={11} />
                HORA
              </dt>
              <dd className="font-mono text-sm text-ink">
                {fmtTime(item.date)}
                {item.endDate && ` – ${fmtTime(item.endDate)}`}
              </dd>
            </div>
          )}

          {item.venue && (
            <div className="grid grid-cols-[96px_1fr] items-baseline gap-x-4 py-2.5">
              <dt className="flex items-center gap-1.5 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                <MapPin size={11} />
                LUGAR
              </dt>
              <dd className="font-grotesk text-sm text-ink">
                {item.venue}
                {item.venueCity && (
                  <span className="block font-mono text-xs text-ink-faint">
                    {item.venueCity}
                  </span>
                )}
              </dd>
            </div>
          )}

          {item.price && (
            <div className="grid grid-cols-[96px_1fr] items-baseline gap-x-4 py-2.5">
              <dt className="flex items-center gap-1.5 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                <Ticket size={11} />
                PRECIO
              </dt>
              <dd className="font-mono text-sm text-ink">{item.price}</dd>
            </div>
          )}
        </dl>

        {/* Vibe fader — the REAL fader, byte-untouched, on its black
            faceplate seat (its grips/meter are calibrated for dark grounds). */}
        <div className="flex items-center gap-3 border border-ink bg-panel px-3 py-2">
          <span className="shrink-0 font-mono text-d11 font-bold tracking-widest text-panel-text">
            VIBE
          </span>
          <VibeFader item={item} />
        </div>

        <OverlayEntities entities={item.entities} />
        <OverlayLinks links={item.links} />

        {/* Artists */}
        {item.artists && item.artists.length > 0 && (
          <section>
            <h2 className="border-b border-ink pb-1 font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
              LINE-UP
            </h2>
            <ul className="flex flex-col divide-y divide-ink-faint">
              {item.artists.map((a) => (
                <li key={a} className="py-1.5 font-mono text-d13 text-ink">
                  {a}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Excerpt / body */}
        {item.excerpt && (
          <p className="whitespace-pre-line font-grotesk text-sm leading-relaxed text-ink-soft">
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
                ground="paper"
                className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide"
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

        {/* Poll — attendance variant for events. Sits above the tickets
            CTA so the social signal precedes the commercial one. */}
        {item.poll && <PollSection item={item} />}

        {/* Tickets CTA — the red fill block. External escape hatch. */}
        {item.ticketUrl && (
          <a
            href={item.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-auto inline-flex min-h-11 items-center justify-center gap-2 border border-sys-red-paper bg-sys-red-paper px-4 py-3 font-mono text-xs font-bold tracking-widest text-paper-raised transition-colors hover:bg-paper hover:text-sys-red-paper ${FOCUS}`}
          >
            <Ticket size={14} />
            COMPRAR BOLETOS →
          </a>
        )}
      </div>
    </article>
  )
}
