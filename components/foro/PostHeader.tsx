'use client'

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Reply } from 'lucide-react'
import { useAuth } from '@/components/auth/useAuth'
import { useUserRank } from '@/lib/hooks/useUserRank'
import { useResolvedUser } from '@/lib/userOverrides'
import {
  badgeFor,
  flagsFor,
  FLAG_COLOR,
  FLAG_LABEL,
} from '@/lib/mockUsers'

// ── PostHeader ─────────────────────────────────────────────────────────────
//
// Imageboard-style post chrome: username, role/rank chip + mod/og flags,
// timestamp, and a CITAR action. Used at the top of both the OP and each
// reply. The raw post UUID is no longer shown — it was noise; the citing
// action it used to back is now a labeled button.
//
// Fase F chrome: the paper spine pattern shared with the comments column —
// every chip is ink-bordered with an ink label, and the role/rank/flag hue
// from lib/mockUsers (tuned for the dark ground: #22D3EE, #C084FC, #FBBF24…)
// survives ONLY as a small ink-outlined swatch square. The word carries the
// meaning; the hue never has to pass contrast as type on #EDEBE3.

// House focus grammar — 2px ink outline, offset 2.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

interface PostHeaderProps {
  authorId: string
  createdAt: string
  // Quote this post into the composer. Rendered as a CITAR button.
  onIdClick?: () => void
}

export function PostHeader({ authorId, createdAt, onIdClick }: PostHeaderProps) {
  const author = useResolvedUser(authorId)
  const { currentUser } = useAuth()
  const rank = useUserRank(authorId)
  const isMe = currentUser?.id === authorId

  const primary = author
    ? badgeFor(author, rank)
    : { label: 'LECTOR', color: '#9CA3AF' }
  const flags = author ? flagsFor(author) : []

  const created = parseISO(createdAt)

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] tracking-widest text-ink">
      <span className="inline-flex items-center gap-1 border border-ink px-1.5 py-px text-[9px] text-ink">
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 border border-ink"
          style={{ backgroundColor: primary.color }}
        />
        {primary.label}
      </span>
      {flags.map((flag) => (
        <span
          key={flag}
          className="inline-flex items-center gap-1 border border-ink px-1.5 py-px text-[9px] text-ink"
        >
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 border border-ink"
            style={{ backgroundColor: FLAG_COLOR[flag] }}
          />
          {FLAG_LABEL[flag]}
        </span>
      ))}
      {/* Fase E door: @username links to /u/[username]. Guarded — seed/anon
          posts without a username keep the plain span. stopPropagation so the
          link doesn't also trigger any post-level interaction. */}
      {author?.username ? (
        <Link
          href={`/u/${author.username}`}
          onClick={(e) => e.stopPropagation()}
          className={`font-bold text-ink underline-offset-2 transition-colors hover:text-sys-red-paper hover:underline ${FOCUS_RING}`}
        >
          @{author.username}
        </Link>
      ) : (
        <span className="font-bold text-ink">@{author?.username ?? 'desconocido'}</span>
      )}
      {isMe && (
        <span className="inline-flex items-center gap-1 border border-ink px-1.5 py-px text-[9px] font-bold text-ink">
          <span aria-hidden className="h-2 w-2 shrink-0 border border-ink bg-acid" />
          TÚ
        </span>
      )}
      <span className="tabular-nums text-ink-faint">
        {format(created, "dd MMM yyyy · HH:mm", { locale: es })}
      </span>
      {onIdClick && (
        <button
          type="button"
          onClick={onIdClick}
          className={`ml-auto flex min-h-11 shrink-0 items-center gap-1 border border-ink px-2 text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
          aria-label="Citar este post"
          title="Citar"
        >
          <Reply size={11} strokeWidth={1.5} />
          <span>CITAR</span>
        </button>
      )}
    </div>
  )
}
