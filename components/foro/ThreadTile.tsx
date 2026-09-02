'use client'

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ForoThread } from '@/lib/types'
import { getUserById } from '@/lib/mockUsers'
import { useReplyCount } from '@/lib/foro'
import { getGenreById, tagLabel, vibeForGenre } from '@/lib/genres'
import { vibeToColor } from '@/lib/utils'
import { SmartImage } from '@/components/SmartImage'

// ── ThreadTile ─────────────────────────────────────────────────────────────
//
// Single tile in the catalog grid. Imageboard convention: image-forward,
// subject below. Reply count is the only signal beyond bump/date order
// (per the foro spec — no likes, no reactions).
//
// Fase F chrome: a printed tile — art dominant on top, caption on paper
// beneath, the whole cell framed by a 1px ink hairline. Every chip is an
// ink hairline chip; the genre's vibe hue survives only as a small
// ink-outlined swatch square (hue is never the sole signal, and the dark-
// ground vibe ramp can't be read as type on #EDEBE3).

// House focus grammar — 2px ink outline, offset 2.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

interface ThreadTileProps {
  thread: ForoThread
}

export function ThreadTile({ thread }: ThreadTileProps) {
  const author = getUserById(thread.authorId)
  const replyCount = useReplyCount(thread.id)
  const bumped = parseISO(thread.bumpedAt)
  const isSession = thread.id.startsWith('fr-session-')

  return (
    <Link
      href={`/foro?thread=${thread.id}`}
      className={`group flex flex-col border border-ink bg-paper-raised text-ink transition-colors hover:bg-paper ${FOCUS_RING}`}
    >
      {/* Art plate — square aspect, image-forward */}
      <div className="relative aspect-square overflow-hidden border-b border-ink bg-paper">
        <SmartImage
          src={thread.imageUrl}
          alt=""
          sizes="(max-width: 768px) 50vw, 220px"
          className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
        />

        {/* Reply count chip — top-left, the only ranking signal allowed.
            Ink hairline on a solid paper ground so it stays legible over
            any artwork (no blur, no translucency). */}
        <div
          className="absolute left-1 top-1 border border-ink bg-paper px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums tracking-widest text-ink"
          aria-label={`${replyCount} respuestas`}
        >
          R·{String(replyCount).padStart(2, '0')}
        </div>

        {/* Session-thread badge — local, session-only thread. Acid dot
            (≥8px, 1px ink outline) is the house marker for "yours / this
            session"; the word stays ink. */}
        {isSession && (
          <div className="absolute right-1 top-1 flex items-center gap-1 border border-ink bg-paper px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-widest text-ink">
            <span aria-hidden className="h-2 w-2 shrink-0 border border-ink bg-acid" />
            SESIÓN
          </div>
        )}
      </div>

      {/* Caption plate — subject + meta on paper */}
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <h3 className="line-clamp-2 font-syne text-[13px] font-extrabold leading-tight text-ink group-hover:underline">
          {thread.subject}
        </h3>
        <p className="line-clamp-2 font-grotesk text-xs leading-relaxed text-ink-soft">
          {thread.body}
        </p>

        {/* Genre chips — first 2; +N indicator if more. The genre's vibe hue
            rides in the swatch square, so the band of color still signals the
            thread's position on the spectrum without becoming paper type. */}
        {thread.genres.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {thread.genres.slice(0, 2).map((id) => {
              const g = getGenreById(id)
              const v = vibeForGenre(id)
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 border border-ink px-1 py-px font-mono text-[9px] tracking-widest text-ink"
                >
                  {v !== null && (
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 border border-ink"
                      style={{ backgroundColor: vibeToColor(v) }}
                    />
                  )}
                  {(g?.name ?? id).toUpperCase()}
                </span>
              )
            })}
            {thread.genres.length > 2 && (
              <span className="font-mono text-[9px] tracking-widest text-ink-faint">
                +{thread.genres.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Metadata tags — first 2, dashed hairline (distinct axis from the
            solid-framed genre chips) */}
        {thread.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {thread.tags.slice(0, 2).map((id) => {
              return (
                <span
                  key={id}
                  className="border border-dashed border-ink-faint px-1 py-px font-mono text-[9px] tracking-widest text-ink-faint"
                >
                  #{tagLabel(id).toUpperCase()}
                </span>
              )
            })}
            {thread.tags.length > 2 && (
              <span className="font-mono text-[9px] tracking-widest text-ink-faint">
                +{thread.tags.length - 2}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink-faint/40 pt-1 font-mono text-[9px] tracking-widest text-ink-faint">
          <span className="truncate">@{author?.username ?? 'desconocido'}</span>
          <span className="tabular-nums">
            {format(bumped, 'dd MMM · HH:mm', { locale: es })}
          </span>
        </div>
      </div>
    </Link>
  )
}
