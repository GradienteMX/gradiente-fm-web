'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  toggleSavedComment,
  useUserRank,
} from '@/lib/comments'
import { useSavedComments } from '@/lib/hooks/useSavedComments'
import { useResolvedUser } from '@/lib/userOverrides'
import { badgeFor } from '@/lib/mockUsers'
import { categoryColor } from '@/lib/utils'
import { DraggableCanvas } from '../DraggableCanvas'
import type { Comment, ContentItem } from '@/lib/types'

// ── SavedCommentsSection ───────────────────────────────────────────────────
//
// Two-level draggable file-explorer surface:
//   1. Folder view (default): one folder per publication with saved comments.
//      Folder displays the article thumbnail, title, and comment count.
//   2. File view (drilled in): one tile per saved comment. Click expands
//      inline to reveal the full body plus ABRIR / QUITAR actions.
//
// Both levels use the shared DraggableCanvas primitive, so tiles can be
// positioned freely just like in DraftsSection / Publicados. Positions are
// session-scoped, namespaced per view (`saved-comments:folders` vs
// `saved-comments:files:<articleId>`).

const FOLDER_TILE_W = 156
const FOLDER_TILE_H = 178
const FILE_TILE_W = 220
const FILE_TILE_H = 96
// Expanded comment tile is taller — gives the full body room without
// overlapping siblings. The canvas grows its own height to compensate.
const FILE_TILE_H_EXPANDED = 220

export function SavedCommentsSection() {
  const { comments: saved, itemsById } = useSavedComments()
  const [openArticleId, setOpenArticleId] = useState<string | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null)

  // Group saved comments by their parent article.
  const groups = useMemo(() => {
    const map = new Map<string, Comment[]>()
    for (const c of saved) {
      const list = map.get(c.contentItemId) ?? []
      list.push(c)
      map.set(c.contentItemId, list)
    }
    return map
  }, [saved])

  if (saved.length === 0) {
    return <EmptyState />
  }

  if (openArticleId) {
    const item = itemsById.get(openArticleId) ?? null
    const comments = groups.get(openArticleId) ?? []
    return (
      <ArticleCommentsView
        item={item}
        articleId={openArticleId}
        comments={comments}
        selectedId={selectedFileId}
        onSelect={setSelectedFileId}
        expandedId={expandedFileId}
        onToggleExpanded={(id) =>
          setExpandedFileId((cur) => (cur === id ? null : id))
        }
        onBack={() => {
          setOpenArticleId(null)
          setSelectedFileId(null)
          setExpandedFileId(null)
        }}
      />
    )
  }

  return (
    <FolderGridView
      groups={groups}
      itemsById={itemsById}
      selectedFolderId={selectedFolderId}
      onSelectFolder={setSelectedFolderId}
      onOpenFolder={(id) => {
        setOpenArticleId(id)
        setSelectedFolderId(null)
      }}
    />
  )
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 border border-dashed border-border/60 p-8 text-center">
      <MessageSquare size={32} strokeWidth={1} style={{ color: '#22D3EE' }} />
      <span
        className="font-mono text-[10px] tracking-widest"
        style={{ color: '#22D3EE' }}
      >
        // BANDEJA DE COMENTARIOS GUARDADOS · VACÍA
      </span>
      <p className="max-w-md font-mono text-[11px] leading-relaxed text-secondary">
        Cuando marques con <span style={{ color: '#F97316' }}>★ GUARDAR</span>{' '}
        un comentario en cualquier overlay, aparecerá aquí. Útil para volver a
        un hilo sin tener que rebuscar el artículo.
      </p>
    </div>
  )
}

// ── Folder grid (level 1) ──────────────────────────────────────────────────

interface FolderItem {
  articleId: string
  item: ContentItem | null
  count: number
}

function FolderGridView({
  groups,
  itemsById,
  selectedFolderId,
  onSelectFolder,
  onOpenFolder,
}: {
  groups: Map<string, Comment[]>
  itemsById: Map<string, ContentItem>
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  onOpenFolder: (articleId: string) => void
}) {
  const folders: FolderItem[] = useMemo(() => {
    const out: FolderItem[] = []
    // forEach instead of for-of-Map to avoid `--downlevelIteration` requirement
    // under the project's tsconfig target.
    groups.forEach((comments, articleId) => {
      const item = itemsById.get(articleId) ?? null
      out.push({ articleId, item, count: comments.length })
    })
    return out
  }, [groups, itemsById])

  const total = folders.reduce((s, f) => s + f.count, 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-border/60 pb-2 font-mono text-[10px] tracking-widest text-muted">
        <span>
          {folders.length}{' '}
          {folders.length === 1 ? 'PUBLICACIÓN' : 'PUBLICACIONES'} · {total}{' '}
          {total === 1 ? 'COMENTARIO' : 'COMENTARIOS'}
        </span>
        <span className="text-secondary">CLIC PARA ABRIR · ARRASTRA PARA REORGANIZAR</span>
      </div>

      <DraggableCanvas
        namespace="saved-comments:folders"
        items={folders}
        getId={(f) => f.articleId}
        tileWidth={FOLDER_TILE_W}
        tileHeight={FOLDER_TILE_H}
        selectedId={selectedFolderId}
        onSelect={onSelectFolder}
        onClickItem={(f) => onOpenFolder(f.articleId)}
        onDoubleClickItem={(f) => onOpenFolder(f.articleId)}
        renderTile={({ item: folder, selected }) => (
          <FolderTile folder={folder} selected={selected} />
        )}
      />
    </div>
  )
}

function FolderTile({
  folder,
  selected,
}: {
  folder: FolderItem
  selected: boolean
}) {
  const { item, count, articleId } = folder
  const color = item ? categoryColor(item.type) : '#9CA3AF'
  return (
    <div
      className="flex h-full w-full flex-col gap-2 border bg-surface p-2"
      style={{
        borderColor: selected ? color : '#3a3a3a4d',
        backgroundColor: selected ? '#0d0d0d' : undefined,
      }}
    >
      {/* Thumbnail box */}
      <div
        className="relative aspect-[4/3] w-full overflow-hidden border bg-base"
        style={{ borderColor: '#242424' }}
      >
        {item?.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt=""
            fill
            sizes="160px"
            className="object-cover opacity-90"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center font-mono text-[10px] tracking-widest text-muted">
            sin·portada
          </div>
        )}
        <span
          className="absolute left-1 top-1 inline-flex items-center gap-1 border bg-base/90 px-1.5 py-0.5 font-mono text-[9px] tracking-widest backdrop-blur-sm"
          style={{ borderColor: color, color }}
        >
          <FolderGlyph color={color} />
          <span>{count}</span>
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <span
          className="font-mono text-[9px] tracking-widest"
          style={{ color }}
        >
          //{item ? item.type.toUpperCase() : 'FUENTE'}
        </span>
        <span className="line-clamp-2 font-syne text-[11px] font-bold leading-tight text-primary">
          {item?.title ?? `[fuente · ${articleId}]`}
        </span>
      </div>
    </div>
  )
}

function FolderGlyph({ color }: { color: string }) {
  return (
    <svg width={11} height={9} viewBox="0 0 11 9" aria-hidden>
      <path
        d="M 0.5 1.5 L 4 1.5 L 5 2.5 L 10.5 2.5 L 10.5 8.5 L 0.5 8.5 Z"
        fill="transparent"
        stroke={color}
        strokeWidth={1}
      />
    </svg>
  )
}

// ── File view (level 2) ────────────────────────────────────────────────────

function ArticleCommentsView({
  item,
  articleId,
  comments,
  selectedId,
  onSelect,
  expandedId,
  onToggleExpanded,
  onBack,
}: {
  item: ContentItem | null
  articleId: string
  comments: Comment[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  expandedId: string | null
  onToggleExpanded: (id: string) => void
  onBack: () => void
}) {
  const color = item ? categoryColor(item.type) : '#9CA3AF'

  // Most-recently-saved-first within the folder.
  const ordered = useMemo(() => [...comments].reverse(), [comments])

  return (
    <div className="flex flex-col gap-3">
      {/* Breadcrumb-style header */}
      <div className="flex items-center justify-between gap-3 border-b border-dashed border-border/60 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft size={11} strokeWidth={1.5} aria-hidden />
          <span>VOLVER · GUARDADOS</span>
        </button>
        <span className="font-mono text-[10px] tracking-widest" style={{ color }}>
          {comments.length}{' '}
          {comments.length === 1 ? 'COMENTARIO' : 'COMENTARIOS'}
        </span>
      </div>

      {/* Article context card — name + thumbnail + jump-to-overlay link */}
      {item && (
        <Link
          href={`/?item=${encodeURIComponent(item.slug)}`}
          className="group flex items-center gap-3 border border-border/60 bg-surface p-2 transition-colors hover:border-[--folder-color]"
          style={{ ['--folder-color' as string]: color }}
        >
          <div
            className="relative h-12 w-16 shrink-0 overflow-hidden border"
            style={{ borderColor: '#242424' }}
          >
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt=""
                fill
                sizes="64px"
                className="object-cover opacity-90"
                draggable={false}
              />
            ) : null}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span
              className="font-mono text-[9px] tracking-widest"
              style={{ color }}
            >
              //{item.type.toUpperCase()}
            </span>
            <span className="truncate font-syne text-[12px] font-bold text-primary">
              {item.title}
            </span>
          </div>
          <span
            className="shrink-0 font-mono text-[10px] tracking-widest transition-colors group-hover:text-primary"
            style={{ color }}
          >
            ABRIR ›
          </span>
        </Link>
      )}

      {/* Draggable file canvas — comment "files" can be repositioned. The
          tile height swaps to expanded when a comment is open so the canvas
          can grow vertically without the tile clipping. Heights are
          per-item via the canvas's defaultPosition + custom render. */}
      <DraggableCanvas
        namespace={`saved-comments:files:${articleId}`}
        items={ordered}
        getId={(c) => c.id}
        tileWidth={FILE_TILE_W}
        tileHeight={
          // If any tile is expanded, give the canvas room. Each tile renders
          // its own actual height; the canvas only uses tileHeight for the
          // default-grid placement and bottom-padding.
          expandedId !== null ? FILE_TILE_H_EXPANDED : FILE_TILE_H
        }
        selectedId={selectedId}
        onSelect={onSelect}
        onClickItem={(c) => onToggleExpanded(c.id)}
        renderTile={({ item: c, selected }) => (
          <CommentFileTile
            comment={c}
            articleSlug={item?.slug ?? null}
            expanded={expandedId === c.id}
            selected={selected}
            tileWidth={FILE_TILE_W}
            collapsedHeight={FILE_TILE_H}
            expandedHeight={FILE_TILE_H_EXPANDED}
          />
        )}
      />
    </div>
  )
}

function CommentFileTile({
  comment,
  articleSlug,
  expanded,
  selected,
  tileWidth,
  collapsedHeight,
  expandedHeight,
}: {
  comment: Comment
  articleSlug: string | null
  expanded: boolean
  selected: boolean
  tileWidth: number
  collapsedHeight: number
  expandedHeight: number
}) {
  const author = useResolvedUser(comment.authorId)
  const rank = useUserRank(comment.authorId)
  const created = formatDistanceToNowStrict(parseISO(comment.createdAt), {
    locale: es,
    addSuffix: true,
  })
  // Tile shows the primary chip only — flag chips (mod/og) are kept off the
  // saved-comments tile to keep it scannable; users see them in the full
  // comment view inside the overlay.
  const authorBadge = author ? badgeFor(author, rank).label : null

  const isTombstone = !!comment.deletion
  // Self-deletes have no reason; mod-deletes do. Match the in-overlay
  // [[CommentList]] Tombstone branch so both surfaces tell the same story.
  const isSelfDelete =
    isTombstone && comment.deletion!.moderatorId === comment.authorId
  const previewBody = isTombstone
    ? isSelfDelete
      ? '[eliminado por autor]'
      : `[eliminado · ${comment.deletion!.reason}]`
    : comment.body

  // The tile owns its own height — the canvas's tileHeight is just a hint
  // for the grid layout. Expanded tiles overlay siblings if the user has
  // dragged them around, which is fine for a session-prototype.
  const heightPx = expanded ? expandedHeight : collapsedHeight

  return (
    <div
      className="flex flex-col border bg-elevated/30"
      style={{
        width: tileWidth,
        height: heightPx,
        borderColor: selected ? '#F97316' : '#3a3a3a4d',
      }}
      data-comment-id={comment.id}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        <span className="mt-0.5 shrink-0 text-muted" aria-hidden>
          {expanded ? (
            <ChevronDown size={11} strokeWidth={1.5} />
          ) : (
            <ChevronRight size={11} strokeWidth={1.5} />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2 font-mono text-[10px] tracking-widest">
            {author ? (
              <>
                <span className="text-primary">@{author.username}</span>
                {authorBadge && (
                  <span
                    className="border px-1.5 py-px text-[9px]"
                    style={{ borderColor: '#3a3a3a', color: '#9CA3AF' }}
                  >
                    {authorBadge}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted">@desconocido</span>
            )}
            <span className="text-muted">· {created}</span>
            {comment.editedAt && <span className="text-muted">· EDITADO</span>}
          </div>

          <p
            className={[
              'whitespace-pre-wrap font-mono text-[12px] leading-relaxed',
              isTombstone ? 'italic text-muted' : 'text-secondary',
              expanded ? '' : 'line-clamp-1',
            ].join(' ')}
          >
            {previewBody}
          </p>
        </div>
      </div>

      {expanded && (
        <div className="mt-auto flex items-center justify-end gap-2 border-t border-dashed border-border/60 px-3 py-2">
          {articleSlug && (
            <Link
              href={`/?item=${encodeURIComponent(articleSlug)}&comment=${encodeURIComponent(comment.id)}`}
              onClick={(e) => e.stopPropagation()}
              className="border px-2 py-0.5 font-mono text-[10px] tracking-widest transition-colors hover:border-white/40"
              style={{ borderColor: '#22D3EE', color: '#22D3EE' }}
            >
              ABRIR EN OVERLAY ›
            </Link>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggleSavedComment(comment.id)
            }}
            className="border px-2 py-0.5 font-mono text-[10px] tracking-widest transition-colors hover:border-white/40"
            style={{
              borderColor: '#F97316',
              color: '#F97316',
              backgroundColor: 'rgba(249,115,22,0.08)',
            }}
          >
            ★ QUITAR
          </button>
        </div>
      )}
    </div>
  )
}
