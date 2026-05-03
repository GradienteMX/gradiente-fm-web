import type { ContentItem } from '@/lib/types'
import { vibeToColor, vibeMid, fmtDayNumber, fmtMonthShort, fmtDayName, fmtTime } from '@/lib/utils'
import { getGenreNames, getTagNames } from '@/lib/genres'
import { MapPin, Ticket } from 'lucide-react'

interface EventCardProps {
  item: ContentItem
}

export function EventCard({ item }: EventCardProps) {
  const vibeColor = vibeToColor(vibeMid(item))
  const genres = getGenreNames(item.genres).slice(0, 3)
  const tags = getTagNames(item.tags).slice(0, 4)
  const time = item.date ? fmtTime(item.date) : ''

  return (
    <article
      className="group relative flex border-b border-border transition-colors hover:bg-elevated"
      style={{ borderLeftColor: vibeColor, borderLeftWidth: 2 }}
    >
      {/* Date column */}
      {item.date ? (
        <div className="flex w-16 flex-shrink-0 flex-col items-center justify-center gap-0 border-r border-border py-4 text-center">
          <span className="font-mono text-[9px] tracking-widest text-muted">
            {fmtMonthShort(item.date)}
          </span>
          <span className="font-syne text-3xl font-black leading-none text-primary">
            {fmtDayNumber(item.date)}
          </span>
          <span className="font-mono text-[9px] tracking-widest text-muted">
            {fmtDayName(item.date)}
          </span>
          {time && (
            <span className="mt-1 font-mono text-[9px] text-secondary">{time}</span>
          )}
        </div>
      ) : (
        <div className="w-4 flex-shrink-0 border-r border-border" />
      )}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 px-4 py-3">
        {/* Type + badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="sys-label" style={{ color: vibeColor }}>//EVENTO</span>
          {item.editorial && (
            <span className="sys-label border border-sys-red/40 px-1.5 py-0.5 text-sys-red">
              //EDITORIAL
            </span>
          )}
          {item.tags.includes('lgbtq') && (
            <span className="sys-label border border-vibe-warm/40 px-1.5 py-0.5 text-vibe-warm">
              LGBTQ+
            </span>
          )}
          {item.tags.includes('free') && (
            <span className="sys-label border border-sys-green/40 px-1.5 py-0.5 text-sys-green">
              ENTRADA LIBRE
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="font-syne text-xl font-black leading-tight text-primary transition-colors group-hover:text-white">
          {item.title}
        </h2>
        {item.subtitle && (
          <p className="font-grotesk text-sm leading-snug text-secondary">{item.subtitle}</p>
        )}

        {/* Artists */}
        {item.artists && item.artists.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {item.artists.map((a) => (
              <span key={a} className="font-mono text-xs text-secondary">
                {a}
              </span>
            ))}
          </div>
        )}

        {/* Excerpt */}
        {item.excerpt && (
          <p className="font-grotesk text-sm leading-relaxed text-muted line-clamp-2 md:line-clamp-1">
            {item.excerpt}
          </p>
        )}

        {/* Bottom row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {/* Venue */}
          {item.venue && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-muted">
              <MapPin size={10} />
              {item.venue}
              {item.venueCity && ` · ${item.venueCity}`}
            </span>
          )}

          {/* Genres */}
          {genres.map((g) => (
            <span
              key={g}
              className="font-mono text-[9px] tracking-wide"
              style={{ color: vibeColor }}
            >
              [{g}]
            </span>
          ))}

          {/* Tags */}
          {tags
            .filter((t) => t !== 'LGBTQ+' && t !== 'Entrada Libre')
            .map((t) => (
              <span key={t} className="sys-label border border-border px-1 py-0.5">
                {t}
              </span>
            ))}

          {/* Price + ticket link */}
          <div className="ml-auto flex items-center gap-3">
            {item.price && (
              <span className="flex items-center gap-1 font-mono text-[10px] text-secondary">
                <Ticket size={10} />
                {item.price}
              </span>
            )}
            {item.ticketUrl && (
              <a
                href={item.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="sys-label border border-border px-2 py-0.5 text-muted transition-colors hover:border-primary hover:text-primary"
              >
                TICKETS →
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Hazard stripe — shows when ANY part of the vibe range hits FUEGO+. */}
      {item.vibeMax >= 9 && (
        <div className="w-1.5 flex-shrink-0 hazard-stripe opacity-60" />
      )}
    </article>
  )
}
