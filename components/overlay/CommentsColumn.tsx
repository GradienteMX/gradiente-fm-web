'use client'

import { useEffect } from 'react'
import type { ContentItem } from '@/lib/types'
import { useComments } from '@/lib/hooks/useComments'
import { setRealUsers } from '@/lib/userOverrides'
import { CommentList } from './CommentList'
import { CommentComposer } from './CommentComposer'

// ── CommentsColumn ──────────────────────────────────────────────────────────
//
// Right-rail surface inside the overlay. Fetches comments + author profiles
// from Supabase via `useComments(item.id)`. Author profiles are pushed into
// the global `realUserCache` (lib/userOverrides) so the existing
// `useResolvedUser` calls inside CommentList / Tombstone resolve to real
// rows without any prop drilling.
//
// Reactions, tombstones, and saves are still on the sessionStorage layer
// (lib/comments) — chunk 3 follow-up turn migrates those.

interface CommentsColumnProps {
  item: ContentItem
  onClose: () => void
  // When set, the matching comment scrolls into view + briefly flashes.
  // Drives the "deep-link from saved-comments dashboard" UX.
  focusedCommentId?: string | null
}

export function CommentsColumn({
  item,
  onClose,
  focusedCommentId = null,
}: CommentsColumnProps) {
  const { comments, usersById, loading } = useComments(item.id)
  const total = comments.length

  // Push fetched users into the global cache so the existing
  // useResolvedUser(authorId) calls inside CommentList resolve correctly.
  useEffect(() => {
    if (usersById.size > 0) setRealUsers(usersById.values())
  }, [usersById])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Chrome header — mirrors OverlayShell's header rhythm but with its own
          //COMENTARIOS label so the column reads as a sibling subsystem, not
          a child of the article. */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-base/95 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="shrink-0 font-mono text-[10px] tracking-widest"
            style={{ color: '#F97316' }}
          >
            //COMENTARIOS
          </span>
          <span className="sys-label hidden truncate uppercase text-muted lg:inline">
            discusión·{item.slug}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar comentarios"
          className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
        >
          <span>OCULTAR</span>
          <span aria-hidden>›</span>
        </button>
      </div>

      {/* Status strip — count + sort label */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-dashed border-border bg-base/60 px-4 py-2 font-mono text-[10px] tracking-widest text-muted">
        <span>
          {loading
            ? 'CARGANDO…'
            : `${total} ${total === 1 ? 'COMENTARIO' : 'COMENTARIOS'}`}
        </span>
        <span className="text-secondary">ORDEN · ACTIVIDAD</span>
      </div>

      {/* Threaded comment list */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        <CommentList comments={comments} focusedCommentId={focusedCommentId} />
      </div>

      {/* Top-level composer pinned to the bottom — most-recent context for
          a new top-level comment is the article above, not the deep thread. */}
      <div className="shrink-0 border-t border-border bg-base/95 px-4 py-3 backdrop-blur-sm">
        <CommentComposer itemId={item.id} parentId={null} variant="root" />
      </div>
    </div>
  )
}
