'use client'

import type { ContentItem } from '@/lib/types'
import { useComments } from '@/lib/comments'
import { CommentList } from './CommentList'
import { CommentComposer } from './CommentComposer'

// ── CommentsColumn ──────────────────────────────────────────────────────────
//
// Right-rail surface inside the overlay. Renders the threaded discussion for
// `item` plus a top-level composer at the bottom. The comment list itself is
// stateless — `useComments(item.id)` merges seed data (lib/mockComments) with
// session-authored comments (lib/comments). When the backend lands, swap the
// hook's storage layer; the UI doesn't change.

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
  const comments = useComments(item.id)
  const total = comments.length

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
          {total} {total === 1 ? 'COMENTARIO' : 'COMENTARIOS'}
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
