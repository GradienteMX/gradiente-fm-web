'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { ContentItem } from '@/lib/types'
import { setRealUsers } from '@/lib/userOverrides'
import { CommentList } from './CommentList'
import { CommentComposer } from './CommentComposer'
import { useOverlayShell } from './OverlayShell'

// ── CommentsColumn ──────────────────────────────────────────────────────────
//
// Right-rail surface inside the overlay. Reads the comment list from the
// shared OverlayShell context (which calls useComments(item.id) at the
// shell level so the rail button can show a live count). Pushes author
// profiles into the global `realUserCache` (lib/userOverrides) so the
// existing `useResolvedUser` calls inside CommentList / Tombstone resolve
// without prop drilling.
//
// Fase C: the column is a paper-raised sheet with an ink hairline spine —
// it reads as a sibling sheet clipped to the article, not a dark terminal.

// House focus grammar — 2px ink outline, offset 2.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

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
  const {
    comments,
    commentsUsersById: usersById,
    commentsLoading: loading,
  } = useOverlayShell()
  const total = comments.length

  // Push fetched users into the global cache so the existing
  // useResolvedUser(authorId) calls inside CommentList resolve correctly.
  useEffect(() => {
    if (usersById.size > 0) setRealUsers(usersById.values())
  }, [usersById])

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-ink bg-paper-raised text-ink">
      {/* Chrome header — mirrors OverlayShell's header rhythm but with its
          own COMENTARIOS stamp so the column reads as a sibling subsystem,
          not a child of the article. */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-ink px-4 py-2.5">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="shrink-0 font-mono text-d11 font-bold tracking-widest text-ink">
            COMENTARIOS
          </span>
          <span className="hidden truncate font-mono text-d11 tracking-wide text-ink-faint lg:inline">
            discusión · {item.slug}
          </span>
        </div>
        {/* Close. On mobile the comments are a full-screen sheet with no
            backdrop, so this is the ONLY way out — a bordered ink chip at
            full 44px target. Collapses to the plain "OCULTAR ›" inline link
            on desktop where it sits in the split. */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar comentarios"
          className={`flex min-h-11 shrink-0 items-center gap-1.5 border border-ink px-3 font-mono text-d11 tracking-widest text-ink transition-colors active:bg-ink active:text-paper sm:min-h-0 sm:border-0 sm:px-0 sm:text-[10px] sm:text-ink-faint sm:hover:text-ink ${FOCUS_RING}`}
        >
          <X size={14} className="sm:hidden" />
          <span>OCULTAR</span>
          <span aria-hidden className="hidden sm:inline">›</span>
        </button>
      </div>

      {/* Status strip — count + sort order on one hairline mono line.
          Rendered only while loading or when there is something to count
          (counts only when > 0; the empty state below already speaks). */}
      {(loading || total > 0) && (
        <div className="flex shrink-0 items-center border-b border-ink px-4 py-2 font-mono text-[10px] tracking-widest text-ink-faint">
          {loading ? (
            <>
              <span
                aria-hidden
                className="h-px w-12 bg-ink motion-safe:animate-blink"
              />
              <span className="sr-only">Cargando comentarios</span>
            </>
          ) : (
            <span>
              {total} {total === 1 ? 'COMENTARIO' : 'COMENTARIOS'} · ORDEN
              ACTIVIDAD
            </span>
          )}
        </div>
      )}

      {/* Threaded comment list */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        <CommentList comments={comments} focusedCommentId={focusedCommentId} />
      </div>

      {/* Top-level composer pinned to the bottom — most-recent context for
          a new top-level comment is the article above, not the deep thread. */}
      <div className="shrink-0 border-t border-ink px-4 py-3">
        <CommentComposer itemId={item.id} parentId={null} variant="root" />
      </div>
    </div>
  )
}
