'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Comment, ReactionKind, User } from '@/lib/types'
import {
  badgeFor,
  flagsFor,
  FLAG_COLOR,
  FLAG_LABEL,
} from '@/lib/mockUsers'
import { descendantCount, engagementScore } from '@/lib/mockComments'
import { CommentBody } from './CommentBody'
import {
  clearCommentDeletion,
  tombstoneComment,
  toggleReaction,
  toggleSavedComment,
  useIsCommentSaved,
} from '@/lib/comments'
import { useUserRank } from '@/lib/hooks/useUserRank'
import { useResolvedUser } from '@/lib/userOverrides'
import { canModerate } from '@/lib/permissions'
import { useAuth } from '@/components/auth/useAuth'
import { usePrompt } from '@/components/prompt/usePrompt'
import { CommentComposer } from './CommentComposer'

// Visual indent cap. Replies at depth > MAX_VISUAL_DEPTH collapse into a
// "ver N respuestas más" link to keep the column readable on narrow widths.
const MAX_VISUAL_DEPTH = 4

// House focus grammar — 2px ink outline, offset 2.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// Reaction palette — ! and ? only. Mutually exclusive per (user, comment);
// see lib/types.ts ReactionKind for the design rationale. On paper the chip
// carries the bare glyph — no bracket chrome.
const REACTION_GLYPH: Record<ReactionKind, string> = {
  provocative: '?',
  signal: '!',
}
const REACTION_ARIA: Record<ReactionKind, string> = {
  provocative: 'duda',
  signal: 'señal',
}
const REACTION_ORDER: ReactionKind[] = ['provocative', 'signal']

interface CommentNode extends Comment {
  children: CommentNode[]
}

// ── Tree building & sorting ────────────────────────────────────────────────

function buildTree(flat: Comment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>()
  for (const c of flat) byId.set(c.id, { ...c, children: [] })

  // forEach instead of for-of-Map.values() so we don't need
  // `--downlevelIteration` under the project's tsconfig target.
  const roots: CommentNode[] = []
  byId.forEach((node) => {
    if (node.parentId === null) {
      roots.push(node)
    } else {
      const parent = byId.get(node.parentId)
      if (parent) parent.children.push(node)
      else roots.push(node) // orphan — surface at top level
    }
  })
  return roots
}

// Sort: activity (descendants) → engagement (reactions) → chronological.
// Ties broken in that order. Each step is descending — most activity first.
function sortByActivity(nodes: CommentNode[], all: Comment[]): CommentNode[] {
  return [...nodes].sort((a, b) => {
    const da = descendantCount(a, all)
    const db = descendantCount(b, all)
    if (db !== da) return db - da
    const ea = engagementScore(a)
    const eb = engagementScore(b)
    if (eb !== ea) return eb - ea
    return parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()
  })
}

// Recursive sort: applied to children too so deep threads also surface
// active sub-conversations first.
function sortTree(nodes: CommentNode[], all: Comment[]): CommentNode[] {
  const sorted = sortByActivity(nodes, all)
  return sorted.map((n) => ({ ...n, children: sortTree(n.children, all) }))
}

// ── Public component ──────────────────────────────────────────────────────

interface CommentListProps {
  comments: Comment[]
  /** Comment id that should scroll into view + briefly flash on mount.
   *  Drives the deep-link UX from the saved-comments dashboard. */
  focusedCommentId?: string | null
}

export function CommentList({
  comments,
  focusedCommentId = null,
}: CommentListProps) {
  if (comments.length === 0) {
    return (
      <div className="border border-dashed border-ink px-4 py-8 text-center font-mono text-[11px] leading-relaxed text-ink-faint">
        <p className="mb-1 font-bold tracking-widest text-ink-soft">
          SIN DISCUSIÓN
        </p>
        <p>Aún nadie ha comentado este contenido.</p>
      </div>
    )
  }

  const tree = sortTree(buildTree(comments), comments)
  return (
    <ol className="flex flex-col gap-3">
      {tree.map((node) => (
        <li key={node.id}>
          <CommentNodeView
            node={node}
            all={comments}
            depth={0}
            focusedCommentId={focusedCommentId}
          />
        </li>
      ))}
    </ol>
  )
}

// ── Single comment ─────────────────────────────────────────────────────────

interface CommentNodeProps {
  node: CommentNode
  all: Comment[]
  depth: number
  focusedCommentId: string | null
}

function CommentNodeView({ node, all, depth, focusedCommentId }: CommentNodeProps) {
  const [collapsedDeep, setCollapsedDeep] = useState(true)
  const author = useResolvedUser(node.authorId)
  const { currentUser } = useAuth()
  const viewerId = currentUser?.id ?? null
  const isOwn = viewerId !== null && node.authorId === viewerId
  const isFocused = focusedCommentId !== null && focusedCommentId === node.id
  const isTombstone = !!node.deletion
  const isMod = canModerate(currentUser)
  const canDelete = !isTombstone && (isOwn || isMod)
  const { confirm, input: promptInput } = usePrompt()
  const onDelete = useCallback(async () => {
    if (!currentUser) return
    if (isOwn) {
      // Author self-delete — no reason required, just confirm.
      const ok = await confirm({
        title: 'Borrar tu comentario',
        body: 'El comentario se reemplaza por una lápida con el texto «eliminado por autor». Tus respuestas hijas se conservan.',
        confirmLabel: 'BORRAR',
        destructive: true,
      })
      if (!ok) return
      tombstoneComment(node.id, currentUser.id, '')
      return
    }
    // Mod delete — reason required.
    const reason = await promptInput({
      title: 'Borrar comentario',
      body: `Comentario de @${author?.username ?? 'desconocido'}. La razón se mostrará en la lápida.`,
      placeholder: 'spam · acoso · off-topic · …',
      defaultValue: 'spam',
      confirmLabel: 'BORRAR',
      destructive: true,
    })
    if (!reason || !reason.trim()) return
    tombstoneComment(node.id, currentUser.id, reason.trim())
  }, [currentUser, isOwn, node.id, author?.username, confirm, promptInput])
  const created = formatDistanceToNowStrict(parseISO(node.createdAt), {
    locale: es,
    addSuffix: true,
  })

  // Scroll the focused comment into view once the column has had a moment to
  // settle (it animates in over ~450ms). One-shot per mount; the highlight
  // animation in CSS is also one-shot (no fill-mode), so it fades naturally
  // and never becomes a permanent decoration.
  const articleRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!isFocused) return
    const t = setTimeout(() => {
      articleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 600)
    return () => clearTimeout(t)
  }, [isFocused])

  // Reaction counts grouped by kind — show only nonzero.
  const reactionCounts: Record<ReactionKind, number> = {
    provocative: 0,
    signal: 0,
  }
  for (const r of node.reactions) reactionCounts[r.kind]++

  const hasChildren = node.children.length > 0
  // Past the visual cap, stop indenting and offer a collapse to keep
  // the column readable. The whole subtree still renders if user expands.
  const overDepthCap = depth >= MAX_VISUAL_DEPTH
  const totalDeep = node.children.reduce(
    (s, c) => s + 1 + descendantCount(c, all),
    0,
  )

  return (
    <article
      ref={articleRef}
      className={
        'flex flex-col gap-1.5' +
        // Quiet "this is yours" marker: 2px ink rail + a step down to the
        // base paper tone (the column ground is paper-raised).
        (isOwn ? ' -ml-2 border-l-2 border-ink bg-paper pl-2' : '') +
        (isFocused ? ' comment-focus-flash' : '')
      }
      data-comment-id={node.id}
      data-own={isOwn ? 'true' : undefined}
      data-focused={isFocused ? 'true' : undefined}
    >
      {/* Author + meta strip */}
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[10px] tracking-widest">
        {author ? (
          <>
            {/* Plain span on purpose — profile links open in fase E. */}
            <span className="font-bold text-ink">@{author.username}</span>
            <AuthorBadges author={author} />
            {isOwn && (
              <span className="inline-flex items-center gap-1 border border-ink px-1.5 py-px text-[9px] font-bold text-ink">
                <span aria-hidden className="h-2 w-2 shrink-0 border border-ink bg-acid" />
                TÚ
              </span>
            )}
          </>
        ) : (
          <span className="text-ink-faint">@desconocido</span>
        )}
        <span className="text-ink-faint">· {created}</span>
        {node.editedAt && (
          <span className="text-ink-faint">· EDITADO</span>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={isOwn ? 'Borrar mi comentario' : 'Borrar comentario'}
            title={isOwn ? 'Borrar (autor)' : 'Borrar (moderación)'}
            className={`ml-auto flex shrink-0 items-center gap-1 border border-sys-red-paper px-1.5 py-px text-[9px] text-sys-red-paper transition-colors hover:bg-sys-red-paper hover:text-paper ${FOCUS_RING}`}
          >
            <Trash2 size={10} strokeWidth={1.5} />
            <span>BORRAR</span>
          </button>
        )}
      </header>

      {/* Author firma — small italic mono line under the chip. Only renders
          when the author has set one (Bundle A profile field). Treat as
          decoration; doesn't ship if the user opted out by leaving it blank. */}
      {author?.firma && (
        <p className="font-mono text-[10px] italic leading-tight text-ink-faint">
          — {author.firma}
        </p>
      )}

      {/* Body — tombstone or text */}
      {isTombstone ? (
        <Tombstone
          deletion={node.deletion!}
          authorId={node.authorId}
          canRevert={
            // Mods can always revert. The actor (author who self-deleted, or
            // mod who deleted) can also revert their own action — gives the
            // author an undo for an accidental self-delete without exposing
            // the affordance to anyone else.
            isMod || node.deletion!.moderatorId === viewerId
          }
          onRevert={() => clearCommentDeletion(node.id)}
        />
      ) : (
        <CommentBody body={node.body} />
      )}

      {/* Reactions strip + reply count + reply trigger */}
      {!isTombstone && (
        <footer className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 font-mono text-[10px] tracking-widest text-ink-faint">
          {REACTION_ORDER.map((kind) => (
            <ReactionButton
              key={kind}
              commentId={node.id}
              kind={kind}
              count={reactionCounts[kind]}
              userReacted={
                viewerId !== null &&
                node.reactions.some(
                  (r) => r.userId === viewerId && r.kind === kind,
                )
              }
            />
          ))}
          <SaveButton commentId={node.id} />
          <span className="flex-1" aria-hidden />
          {hasChildren && (
            <span className="flex items-center gap-1">
              <span aria-hidden>↳</span>
              <span>
                {totalDeep} {totalDeep === 1 ? 'RESPUESTA' : 'RESPUESTAS'}
              </span>
            </span>
          )}
        </footer>
      )}

      {/* Inline reply composer — collapsed by default. Hidden under tombstone:
          replies to a deleted comment are awkward; user can still reply to a
          parent or sibling. */}
      {!isTombstone && (
        <div className="pt-0.5">
          <CommentComposer
            itemId={node.contentItemId}
            parentId={node.id}
            variant="reply"
          />
        </div>
      )}

      {/* Children — indented up to MAX_VISUAL_DEPTH, then linearized.
          Indent rail is an ink hairline so the thread hierarchy reads like
          a printed margin rule, no busy backgrounds. */}
      {hasChildren && !overDepthCap && (
        <ol className="ml-3 mt-2 flex flex-col gap-3 border-l border-ink pl-3">
          {node.children.map((child) => (
            <li key={child.id}>
              <CommentNodeView
                node={child}
                all={all}
                depth={depth + 1}
                focusedCommentId={focusedCommentId}
              />
            </li>
          ))}
        </ol>
      )}

      {/* Past the depth cap: collapse the deeper subtree behind a single
          "ver N respuestas más" toggle. Keeps the column from becoming a
          horizontal mess on long threads. */}
      {hasChildren && overDepthCap && (
        <div className="ml-3 mt-2">
          {collapsedDeep ? (
            <button
              type="button"
              onClick={() => setCollapsedDeep(false)}
              className={`font-mono text-[10px] tracking-widest text-ink-faint transition-colors hover:text-ink ${FOCUS_RING}`}
            >
              ↳ VER {totalDeep}{' '}
              {totalDeep === 1 ? 'RESPUESTA MÁS' : 'RESPUESTAS MÁS'} EN ESTE HILO
            </button>
          ) : (
            <ol className="flex flex-col gap-3 border-l border-ink pl-3">
              {node.children.map((child) => (
                <li key={child.id}>
                  <CommentNodeView
                node={child}
                all={all}
                depth={depth + 1}
                focusedCommentId={focusedCommentId}
              />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </article>
  )
}

// ── Author badges (primary role/rank chip + mod/og flag chips) ─────────────
//
// Paper spine pattern: every chip is ink-bordered with the label in ink; the
// role/rank/flag hue lives in a small ink-outlined swatch square so color is
// never the sole signal (the label always carries the meaning).

function AuthorBadges({ author }: { author: User }) {
  // For user-tier accounts the primary chip is the derived rank
  // (NORMIE/DETONADOR/ENIGMA/ESPECTRO). For staff roles it's the role label.
  // useUserRank returns 'normie' for non-user accounts too — badgeFor only
  // consumes it when role === 'user', so the spurious value is harmless.
  const rank = useUserRank(author.id)
  const primary = badgeFor(author, rank)
  const flags = flagsFor(author)
  return (
    <>
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
    </>
  )
}

// ── Reaction button (login-gated, click toggles) ───────────────────────────

function ReactionButton({
  commentId,
  kind,
  count,
  userReacted,
}: {
  commentId: string
  kind: ReactionKind
  count: number
  userReacted: boolean
}) {
  const { currentUser, openLogin } = useAuth()
  const onClick = () => {
    if (!currentUser) {
      openLogin()
      return
    }
    toggleReaction(commentId, currentUser.id, kind)
  }
  // Active state: ink fill (house inversion). Inactive: ink-bordered chip.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={userReacted}
      aria-label={`Reaccionar con ${REACTION_ARIA[kind]}`}
      className={
        'flex items-center gap-1 border border-ink px-1.5 py-0.5 transition-colors ' +
        (userReacted
          ? 'bg-ink text-paper'
          : 'text-ink hover:bg-ink hover:text-paper') +
        ` ${FOCUS_RING}`
      }
    >
      <span>{REACTION_GLYPH[kind]}</span>
      {count > 0 && <span>{count}</span>}
    </button>
  )
}

// ── Save toggle (login-gated, click pins to dashboard) ─────────────────────

function SaveButton({ commentId }: { commentId: string }) {
  const { currentUser, openLogin } = useAuth()
  const saved = useIsCommentSaved(commentId)
  const onClick = () => {
    if (!currentUser) {
      openLogin()
      return
    }
    toggleSavedComment(commentId)
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? 'Quitar de guardados' : 'Guardar comentario'}
      title={saved ? 'GUARDADO' : 'GUARDAR'}
      className={
        'flex items-center gap-1 border border-ink px-1.5 py-0.5 transition-colors ' +
        (saved
          ? 'bg-ink text-paper'
          : 'text-ink hover:bg-ink hover:text-paper') +
        ` ${FOCUS_RING}`
      }
    >
      {/* Saved state marker: acid dot on the ink fill (black-panel legality). */}
      {saved && <span aria-hidden className="h-2 w-2 shrink-0 bg-acid" />}
      <span aria-hidden>{saved ? '★' : '☆'}</span>
      <span>{saved ? 'GUARDADO' : 'GUARDAR'}</span>
    </button>
  )
}

// ── Tombstone (author self-delete or mod-deleted) ─────────────────────────
//
// Same shape covers both flows. When the actor (`deletion.moderatorId`) is
// the post's author, render as "ELIMINADO POR AUTOR" with no reason — a
// self-delete is implicit, no justification needed. Otherwise render the
// "ELIMINADO POR MODERACIÓN · RAZÓN: …" form.

function Tombstone({
  deletion,
  authorId,
  canRevert,
  onRevert,
}: {
  deletion: NonNullable<Comment['deletion']>
  authorId: string
  canRevert: boolean
  onRevert: () => void
}) {
  const actor = useResolvedUser(deletion.moderatorId)
  const isSelfDelete = deletion.moderatorId === authorId
  return (
    <div className="flex flex-col gap-0.5 border border-dashed border-ink px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-faint">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold tracking-widest text-sys-red-paper">
          {isSelfDelete ? 'ELIMINADO POR AUTOR' : 'ELIMINADO POR MODERACIÓN'}
        </span>
        {canRevert && (
          <button
            type="button"
            onClick={onRevert}
            className={`flex shrink-0 items-center gap-1 border border-ink px-1.5 py-px text-[9px] tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
            aria-label="Restaurar"
            title="Restaurar"
          >
            <RotateCcw size={10} strokeWidth={1.5} />
            <span>RESTAURAR</span>
          </button>
        )}
      </div>
      {!isSelfDelete && (
        <span>
          {actor ? `@${actor.username}` : 'moderador'} ·{' '}
          <span className="text-ink-soft">RAZÓN:</span> {deletion.reason}
        </span>
      )}
    </div>
  )
}
