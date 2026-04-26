'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '@/components/auth/useAuth'
import { badgeFor, getUserById, ROLE_LABEL, USER_CATEGORY_LABEL } from '@/lib/mockUsers'
import type { Role, UserCategory } from '@/lib/types'

// ── PostHeader ─────────────────────────────────────────────────────────────
//
// Imageboard-style post chrome: username, role/category badge, timestamp,
// post id. Used at the top of both the OP and each reply.

const ROLE_COLOR: Record<Role, string> = {
  admin: '#F97316',       // sys-orange
  moderator: '#E63329',   // sys-red
  collaborator: '#4ADE80',// sys-green
  user: '#9CA3AF',        // neutral
}

const USER_CATEGORY_COLOR: Record<UserCategory, string> = {
  og: '#A78BFA',          // violet
  insider: '#22D3EE',     // cyan
  normal: '#9CA3AF',      // neutral
}

interface PostHeaderProps {
  postId: string
  authorId: string
  createdAt: string
  // When set, scrolls into view and pulses on click. Used for >>id quote-link
  // navigation inside a thread.
  onIdClick?: () => void
}

export function PostHeader({ postId, authorId, createdAt, onIdClick }: PostHeaderProps) {
  const author = getUserById(authorId)
  const { currentUser } = useAuth()
  const isMe = currentUser?.id === authorId

  let badgeColor = '#9CA3AF'
  let badgeLabel = 'LECTOR'
  if (author) {
    badgeLabel = badgeFor(author)
    if (author.role === 'user' && author.userCategory) {
      badgeColor = USER_CATEGORY_COLOR[author.userCategory]
    } else {
      badgeColor = ROLE_COLOR[author.role]
    }
  }

  const created = parseISO(createdAt)

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[10px] tracking-widest">
      <span
        className="border px-1.5 py-0.5 text-[9px]"
        style={{ borderColor: badgeColor, color: badgeColor }}
      >
        {badgeLabel}
      </span>
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

// Light wrapper used by the catalog tile for inline role hints — avoids
// pulling in the full mockUsers map in the tile file. Kept small intentionally.
export function inlineRoleLabel(authorId: string): string {
  const author = getUserById(authorId)
  if (!author) return 'LECTOR'
  if (author.role === 'user' && author.userCategory) {
    return USER_CATEGORY_LABEL[author.userCategory]
  }
  return ROLE_LABEL[author.role]
}
