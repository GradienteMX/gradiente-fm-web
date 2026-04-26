'use client'

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ForoThread } from '@/lib/types'
import { getUserById } from '@/lib/mockUsers'
import { useReplyCount } from '@/lib/foro'
import { getGenreById, vibeForGenre } from '@/lib/genres'
import { vibeToColor } from '@/lib/utils'

// ── ThreadTile ─────────────────────────────────────────────────────────────
//
// Single tile in the catalog grid. Imageboard convention: image-forward,
// subject below. Reply count is the only signal beyond bump/date order
// (per the foro spec — no likes, no reactions).

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
      className="group flex flex-col border bg-black transition-colors hover:border-sys-orange"
      style={{ borderColor: '#242424' }}
    >
      {/* Image — square aspect, image-forward */}
      <div className="relative aspect-square overflow-hidden border-b border-border bg-elevated">
        <img
          src={thread.imageUrl}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />

        {/* Reply count chip — top-left, the only ranking signal allowed */}
        <div
          className="absolute left-1 top-1 flex items-center gap-1 border bg-black/85 px-1.5 py-0.5 font-mono text-[10px] tabular-nums tracking-widest backdrop-blur-sm"
          style={{ borderColor: replyCount > 0 ? '#F97316' : '#242424', color: replyCount > 0 ? '#F97316' : '#9CA3AF' }}
          aria-label={`${replyCount} respuestas`}
        >
          R·{String(replyCount).padStart(2, '0')}
        </div>

        {/* Session-thread badge */}
        {isSession && (
          <div
            className="absolute right-1 top-1 border bg-black/85 px-1.5 py-0.5 font-mono text-[9px] tracking-widest backdrop-blur-sm"
            style={{ borderColor: '#4ADE80', color: '#4ADE80' }}
          >
            SESIÓN
          </div>
        )}

        {/* Thread id chip — bottom-left */}
        <div className="absolute bottom-1 left-1 border border-border/60 bg-black/85 px-1 py-0.5 font-mono text-[9px] tracking-widest text-muted backdrop-blur-sm">
          //{thread.id.toUpperCase()}
        </div>
      </div>

      {/* Subject + meta */}
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <h3 className="line-clamp-2 font-syne text-[13px] font-bold leading-tight text-primary transition-colors group-hover:text-sys-orange">
          {thread.subject}
        </h3>
        <p className="line-clamp-2 font-mono text-[10px] leading-relaxed text-secondary/80">
          {thread.body}
        </p>

        {/* Genre chips — first 2; +N indicator if more. Color matches the
            genre's vibe so the band of color also signals the thread's
            position on the spectrum. */}
        {thread.genres.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {thread.genres.slice(0, 2).map((id) => {
              const g = getGenreById(id)
              const v = vibeForGenre(id)
              const accent = v !== null ? vibeToColor(v) : '#9CA3AF'
              return (
                <span
                  key={id}
                  className="border px-1 py-px font-mono text-[8px] tracking-widest"
                  style={{
                    borderColor: accent,
                    color: accent,
                    backgroundColor: `${accent}15`,
                  }}
                >
                  {(g?.name ?? id).toUpperCase()}
                </span>
              )
            })}
            {thread.genres.length > 2 && (
              <span className="font-mono text-[8px] tracking-widest text-muted">
                +{thread.genres.length - 2}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1 font-mono text-[9px] tracking-widest text-muted">
          <span className="truncate">@{author?.username ?? 'desconocido'}</span>
          <span className="tabular-nums">
            {format(bumped, 'dd MMM · HH:mm', { locale: es })}
          </span>
        </div>
      </div>
    </Link>
  )
}
