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

// Reaction palette — ! and ? only. Mutually exclusive per (user, comment);
// see lib/types.ts ReactionKind for the design rationale.
const REACTION_GLYPH: Record<ReactionKind, string> = {
  provocative: '[?]',
  signal: '[!]',
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
      <div
        className="border border-dashed px-4 py-8 text-center font-mono text-[11px] leading-relaxed"
        style={{ borderColor: '#242424', color: '#9CA3AF' }}
      >
        <p className="mb-1 tracking-widest" style={{ color: '#3a3a3a' }}>
          //SIN·DISCUSIÓN
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
        'flex flex-col gap-1.5' + (isFocused ? ' comment-focus-flash' : '')
      }
      data-comment-id={node.id}
      data-own={isOwn ? 'true' : undefined}
      data-focused={isFocused ? 'true' : undefined}
      style={
        // Subtle orange-tinted left rail on the user's own comments. Reads as
        // "this is yours" without screaming at the reader.
        isOwn
          ? {
              borderLeft: '2px solid #F97316',
              paddingLeft: '0.5rem',
              marginLeft: '-0.5rem',
              backgroundColor: 'rgba(249,115,22,0.04)',
            }
          : undefined
      }
    >
      {/* Author + meta strip */}
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[10px] tracking-widest">
        {author ? (
          <>
            <span className="text-primary">@{author.username}</span>
            <AuthorBadges author={author} />
            {isOwn && (
              <span
                className="border px-1.5 py-px text-[9px]"
                style={{
                  borderColor: '#F97316',
                  color: '#F97316',
                  backgroundColor: 'rgba(249,115,22,0.08)',
                }}
              >
                TÚ
              </span>
            )}
          </>
        ) : (
          <span className="text-muted">@desconocido</span>
        )}
        <span className="text-muted">· {created}</span>
        {node.editedAt && (
          <span className="text-muted">· EDITADO</span>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={isOwn ? 'Borrar mi comentario' : 'Borrar comentario'}
            title={isOwn ? 'Borrar (autor)' : 'Borrar (moderación)'}
            className="ml-auto flex shrink-0 items-center gap-1 border px-1.5 py-px text-[9px] transition-colors hover:bg-white/[0.02]"
            style={{ borderColor: '#E63329', color: '#E63329' }}
          >
            <Trash2 size={10} strokeWidth={1.5} />
            <span>BORRAR</span>
          </button>
        )}
      </header>

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
        <p className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-secondary">
          {node.body}
        </p>
      )}

      {/* Reactions strip + reply count + reply trigger */}
      {!isTombstone && (
        <footer className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 font-mono text-[10px] tracking-widest text-muted">
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
          Indent rail uses a left border so the visual hierarchy reads
          terminal-style without busy backgrounds. */}
      {hasChildren && !overDepthCap && (
        <ol className="ml-3 mt-2 flex flex-col gap-3 border-l border-border pl-3">
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
              className="font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
            >
              ↳ VER {totalDeep}{' '}
              {totalDeep === 1 ? 'RESPUESTA MÁS' : 'RESPUESTAS MÁS'} EN ESTE HILO
            </button>
          ) : (
            <ol className="flex flex-col gap-3 border-l border-border pl-3">
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
      <span
        className="border px-1.5 py-px text-[9px]"
        style={{ borderColor: primary.color, color: primary.color }}
      >
        {primary.label}
      </span>
      {flags.map((flag) => (
        <span
          key={flag}
          className="border px-1.5 py-px text-[9px]"
          style={{ borderColor: FLAG_COLOR[flag], color: FLAG_COLOR[flag] }}
        >
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
  // Active state: orange chrome (matches NGE primary). Inactive: muted.
  const color = userReacted ? '#F97316' : '#9CA3AF'
  const border = userReacted ? '#F97316' : '#242424'
  const bg = userReacted ? 'rgba(249,115,22,0.08)' : 'transparent'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={userReacted}
      aria-label={`Reaccionar ${REACTION_GLYPH[kind]}`}
      className="flex items-center gap-1 border px-1.5 py-0.5 transition-colors hover:border-white/40"
      style={{ borderColor: border, color, backgroundColor: bg }}
    >
      <span>{REACTION_GLYPH[kind]}</span>
      <span>{count}</span>
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
  const color = saved ? '#F97316' : '#9CA3AF'
  const border = saved ? '#F97316' : '#242424'
  const bg = saved ? 'rgba(249,115,22,0.08)' : 'transparent'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? 'Quitar de guardados' : 'Guardar comentario'}
      title={saved ? 'GUARDADO' : 'GUARDAR'}
      className="flex items-center gap-1 border px-1.5 py-0.5 transition-colors hover:border-white/40"
      style={{ borderColor: border, color, backgroundColor: bg }}
    >
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
    <div
      className="flex flex-col gap-0.5 border border-dashed px-3 py-2 font-mono text-[11px] leading-relaxed"
      style={{ borderColor: '#3a3a3a', color: '#9CA3AF' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="tracking-widest" style={{ color: '#E63329' }}>
          {isSelfDelete ? '//ELIMINADO·POR·AUTOR' : '//ELIMINADO·POR·MODERACIÓN'}
        </span>
        {canRevert && (
          <button
            type="button"
            onClick={onRevert}
            className="flex shrink-0 items-center gap-1 border px-1.5 py-px text-[9px] tracking-widest transition-colors hover:bg-white/[0.02]"
            style={{ borderColor: '#F97316', color: '#F97316' }}
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
          <span className="text-secondary">RAZÓN:</span> {deletion.reason}
        </span>
      )}
    </div>
  )
}
