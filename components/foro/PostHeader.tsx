'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
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
// timestamp, post id. Used at the top of both the OP and each reply.

interface PostHeaderProps {
  postId: string
  authorId: string
  createdAt: string
  // When set, scrolls into view and pulses on click. Used for >>id quote-link
  // navigation inside a thread.
  onIdClick?: () => void
}

export function PostHeader({ postId, authorId, createdAt, onIdClick }: PostHeaderProps) {
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
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[10px] tracking-widest">
      <span
        className="border px-1.5 py-0.5 text-[9px]"
        style={{ borderColor: primary.color, color: primary.color }}
      >
        {primary.label}
      </span>
      {flags.map((flag) => (
        <span
          key={flag}
          className="border px-1.5 py-0.5 text-[9px]"
          style={{ borderColor: FLAG_COLOR[flag], color: FLAG_COLOR[flag] }}
        >
          {FLAG_LABEL[flag]}
        </span>
      ))}
      <span className="text-primary">@{author?.username ?? 'desconocido'}</span>
      {isMe && <span style={{ color: '#F97316' }}>[TÚ]</span>}
      <span className="tabular-nums text-muted">
        {format(created, "dd MMM yyyy · HH:mm", { locale: es })}
      </span>
      <button
        type="button"
        onClick={onIdClick}
        className="ml-auto tabular-nums text-muted transition-colors hover:text-sys-orange"
        aria-label={`Anclar a ${postId}`}
      >
        &gt;&gt;{postId}
      </button>
    </div>
  )
}
