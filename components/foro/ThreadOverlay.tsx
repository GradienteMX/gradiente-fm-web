'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, Trash2, X } from 'lucide-react'
import { useAuth } from '@/components/auth/useAuth'
import {
  clearReplyTombstone,
  clearThreadTombstone,
  tombstoneReply,
  tombstoneThread,
  useReplies,
  useThread,
} from '@/lib/foro'
import { getGenreById, vibeForGenre } from '@/lib/genres'
import { canModerate } from '@/lib/permissions'
import { vibeToColor } from '@/lib/utils'
import { useResolvedUser } from '@/lib/userOverrides'
import { usePrompt } from '@/components/prompt/usePrompt'
import { PostHeader } from './PostHeader'
import { ReplyComposer } from './ReplyComposer'
import type { ForoDeletion, ForoReply } from '@/lib/types'

// ── ThreadOverlay ──────────────────────────────────────────────────────────
//
// Full-screen modal showing one thread: OP at top, replies in chronological
// order beneath, reply composer pinned at the bottom of the scrollable body.
// Driven by the `?thread=<id>` URL param (mounted by ForoCatalog).
//
// Imageboard layout:
//   - OP and replies share the same post chrome (PostHeader)
//   - Replies are flat — no nesting. Quote-links via >>id render as buttons
//     that scroll-and-pulse the target post.
//   - Image is left-floated next to the body (CSS float, like 4chan)

interface ThreadOverlayProps {
  threadId: string
  onClose: () => void
}

export function ThreadOverlay({ threadId, onClose }: ThreadOverlayProps) {
  const thread = useThread(threadId)
  const replies = useReplies(threadId)
  const { currentUser } = useAuth()
  const isMod = canModerate(currentUser)
  const threadDeleted = !!thread?.deletion
  const { input: promptInput } = usePrompt()

  // Mod actions — open the NGE-styled [[PromptOverlay]] for a reason.
  // The storage layer doesn't re-check the role (real backend will via
  // RLS); we guard at the UI by only rendering the buttons for mods.
  const onTombstoneThread = useCallback(async () => {
    if (!currentUser || !thread) return
    const reason = await promptInput({
      title: 'Borrar hilo',
      body: `Hilo «${thread.subject}». La acción deja una lápida con la razón visible para los demás usuarios.`,
      placeholder: 'spam · acoso · off-topic · …',
      defaultValue: 'spam',
      confirmLabel: 'BORRAR HILO',
      destructive: true,
    })
    if (!reason || !reason.trim()) return
    void tombstoneThread(thread.id, reason.trim())
  }, [currentUser, thread, promptInput])

  const onTombstoneReply = useCallback(
    async (reply: ForoReply) => {
      if (!currentUser) return
      const reason = await promptInput({
        title: 'Borrar respuesta',
        body: `Respuesta ${reply.id}. Se preserva la posición del post; el cuerpo se reemplaza por la lápida con la razón.`,
        placeholder: 'spam · acoso · off-topic · …',
        defaultValue: 'spam',
        confirmLabel: 'BORRAR',
        destructive: true,
      })
      if (!reason || !reason.trim()) return
      void tombstoneReply(reply.id, threadId, reason.trim())
    },
    [currentUser, promptInput],
  )
  // Reverse-quote map for backlinks. Inverts each reply's quotedReplyIds:
  // for any post id, lists the reply ids that pointed at it. Recomputed when
  // replies change. Cheap because thread reply counts stay small.
  const inboundIndex = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const r of replies) {
      if (!r.quotedReplyIds) continue
      for (const target of r.quotedReplyIds) {
        const list = map.get(target) ?? []
        list.push(r.id)
        map.set(target, list)
      }
    }
    return map
  }, [replies])
  // Author lookup for any post in this thread (OP + replies). Used to mark
  // `>>id` quote-tokens in body text with `[TÚ]` when the cited post is the
  // current user's — surfaces "someone is replying to me" without forcing
  // the reader to find the cited post.
  const authorByPostId = useMemo(() => {
    const map = new Map<string, string>()
    if (thread) map.set(thread.id, thread.authorId)
    for (const r of replies) map.set(r.id, r.authorId)
    return map
  }, [thread, replies])
  const isQuoteToMe = useCallback(
    (id: string) =>
      currentUser !== null && authorByPostId.get(id) === currentUser.id,
    [authorByPostId, currentUser],
  )
  // When a user clicks `>>id` in a post, we want the reply composer to
  // pre-fill with that quote-link. Held here so PostBody can request it.
  const [pendingQuote, setPendingQuote] = useState<string[]>([])
  // Bumped to force-remount the composer so its useState(initial) re-runs
  // with the new initialQuotedIds prop — uncontrolled inputs are reset by
  // identity, not by prop changes.
  const [composerKey, setComposerKey] = useState(0)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const [pulsedId, setPulsedId] = useState<string | null>(null)

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ESC closes.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Click on a `>>id` link — scroll the target into view + pulse it.
  const focusPost = (id: string) => {
    const el = scrollerRef.current?.querySelector<HTMLElement>(`[data-postid="${id}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPulsedId(id)
      setTimeout(() => setPulsedId((cur) => (cur === id ? null : cur)), 1600)
    }
  }

  // Click on the post id in the header — adds `>>id` to the composer and
  // scrolls to it.
  const quotePost = (id: string) => {
    setPendingQuote((q) => (q.includes(id) ? q : [...q, id]))
    setComposerKey((k) => k + 1)
    setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }, 50)
  }

  if (!thread) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 overlay-backdrop-in"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md" aria-hidden />
        <div
          className="eva-box relative z-10 flex max-w-md flex-col items-center gap-3 bg-base p-6 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-mono text-[11px] tracking-widest text-sys-red">// HILO NO ENCONTRADO</p>
          <p className="font-mono text-[10px] tracking-widest text-muted">
            id: {threadId}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest text-secondary transition-colors hover:border-white/60 hover:text-primary"
          >
            CERRAR
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 overlay-backdrop-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="eva-box eva-scanlines relative z-10 flex w-full max-w-3xl flex-col overflow-hidden bg-base overlay-panel-in"
        style={{ maxHeight: 'min(92vh, 900px)' }}
      >
        {/* Chrome */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-base/95 px-4 py-2.5 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 font-mono text-[10px] tracking-widest" style={{ color: '#F97316' }}>
              //FORO·HILO
            </span>
            <span className="sys-label hidden truncate uppercase text-muted sm:inline">
              {thread.id}
            </span>
            <span className="sys-label tabular-nums text-muted">
              R·{String(replies.length).padStart(2, '0')}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex items-center gap-1.5 border border-border/70 bg-black px-3 py-2 font-mono text-[10px] tracking-widest text-secondary transition-colors hover:border-white/60 hover:text-primary sm:gap-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-muted"
          >
            <span className="hidden sm:inline">[ESC]</span>
            <X size={14} className="sm:hidden" />
            <span>CERRAR</span>
          </button>
        </div>

        {/* Scrollable body */}
        <div ref={scrollerRef} className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 p-4">
            {/* OP */}
            <article
              data-postid={thread.id}
              className={
                'flex flex-col gap-2 border bg-elevated/30 p-3 transition-shadow ' +
                (pulsedId === thread.id ? 'ring-2 ring-sys-orange ring-offset-1 ring-offset-base' : '')
              }
              style={{ borderColor: '#3a2200' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <PostHeader
                    postId={thread.id}
                    authorId={thread.authorId}
                    createdAt={thread.createdAt}
                    onIdClick={() => quotePost(thread.id)}
                  />
                </div>
                {isMod && !threadDeleted && (
                  <ModDeleteButton onClick={onTombstoneThread} label="BORRAR HILO" />
                )}
              </div>
              <Backlinks ids={inboundIndex.get(thread.id) ?? []} onClick={focusPost} />
              {threadDeleted ? (
                <Tombstone
                  deletion={thread.deletion!}
                  kind="thread"
                  canRevert={isMod}
                  onRevert={() => void clearThreadTombstone(thread.id)}
                />
              ) : (
                <>
                  <h1 className="font-syne text-lg font-bold leading-tight text-primary">
                    {thread.subject}
                  </h1>
                  {thread.genres.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      {thread.genres.map((id) => {
                        const g = getGenreById(id)
                        const v = vibeForGenre(id)
                        const accent = v !== null ? vibeToColor(v) : '#9CA3AF'
                        return (
                          <span
                            key={id}
                            className="border px-1.5 py-px font-mono text-[9px] tracking-widest"
                            style={{
                              borderColor: accent,
                              color: accent,
                              backgroundColor: `${accent}12`,
                            }}
                          >
                            {(g?.name ?? id).toUpperCase()}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <PostBody
                    imageUrl={thread.imageUrl}
                    imageRequired
                    body={thread.body}
                    onQuoteClick={focusPost}
                    isQuoteToMe={isQuoteToMe}
                  />
                </>
              )}
            </article>

            {/* Replies */}
            {replies.map((reply) => (
              <ReplyArticle
                key={reply.id}
                reply={reply}
                pulsed={pulsedId === reply.id}
                inboundIds={inboundIndex.get(reply.id) ?? []}
                isMod={isMod}
                onIdClick={() => quotePost(reply.id)}
                onQuoteClick={focusPost}
                isQuoteToMe={isQuoteToMe}
                onTombstone={onTombstoneReply}
              />
            ))}

            {/* Composer — disabled on tombstoned threads. New replies on a
                deleted thread don't make sense; the moderator's pruning
                action also closes the door on continued discussion. */}
            <div ref={composerRef} className="border border-dashed border-border/60 bg-black p-3">
              {threadDeleted ? (
                <p className="font-mono text-[10px] tracking-widest text-muted">
                  //HILO·CERRADO·POR·MODERACIÓN — no se aceptan respuestas nuevas.
                </p>
              ) : (
                <ReplyComposer
                  key={composerKey}
                  threadId={thread.id}
                  initialQuotedIds={pendingQuote}
                  onPosted={() => {
                    setPendingQuote([])
                    setComposerKey((k) => k + 1)
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Reply article ──────────────────────────────────────────────────────────

function ReplyArticle({
  reply,
  pulsed,
  inboundIds,
  isMod,
  onIdClick,
  onQuoteClick,
  isQuoteToMe,
  onTombstone,
}: {
  reply: ForoReply
  pulsed: boolean
  inboundIds: string[]
  isMod: boolean
  onIdClick: () => void
  onQuoteClick: (id: string) => void
  isQuoteToMe: (id: string) => boolean
  onTombstone: (reply: ForoReply) => void
}) {
  const deleted = !!reply.deletion
  return (
    <article
      data-postid={reply.id}
      className={
        'flex flex-col gap-2 border border-border/60 bg-base p-3 transition-shadow ' +
        (pulsed ? 'ring-2 ring-sys-orange ring-offset-1 ring-offset-base' : '')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <PostHeader
            postId={reply.id}
            authorId={reply.authorId}
            createdAt={reply.createdAt}
            onIdClick={onIdClick}
          />
        </div>
        {isMod && !deleted && (
          <ModDeleteButton onClick={() => onTombstone(reply)} label="BORRAR" />
        )}
      </div>
      <Backlinks ids={inboundIds} onClick={onQuoteClick} />
      {deleted ? (
        <Tombstone
          deletion={reply.deletion!}
          kind="reply"
          canRevert={isMod}
          onRevert={() => void clearReplyTombstone(reply.id, reply.threadId)}
        />
      ) : (
        <PostBody
          imageUrl={reply.imageUrl}
          body={reply.body}
          onQuoteClick={onQuoteClick}
          isQuoteToMe={isQuoteToMe}
        />
      )}
    </article>
  )
}

// ── Mod button — visible only when canModerate(currentUser) ────────────────

function ModDeleteButton({
  onClick,
  label,
}: {
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] tracking-widest transition-colors hover:bg-white/[0.02]"
      style={{ borderColor: '#E63329', color: '#E63329' }}
      aria-label={label}
      title={label}
    >
      <Trash2 size={10} strokeWidth={1.5} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

// ── Tombstone — replaces the body of a moderator-deleted post ──────────────
//
// Mirrors components/overlay/CommentList.tsx Tombstone. The post stays in
// place (article + PostHeader + Backlinks all render normally) so quote-IDs
// and >>id navigation continue to work — only the body content is
// suppressed in favor of the moderator's stated reason.

function Tombstone({
  deletion,
  kind,
  canRevert,
  onRevert,
}: {
  deletion: ForoDeletion
  kind: 'thread' | 'reply'
  canRevert: boolean
  onRevert: () => void
}) {
  const mod = useResolvedUser(deletion.moderatorId)
  return (
    <div
      className="flex flex-col gap-0.5 border border-dashed px-3 py-2 font-mono text-[11px] leading-relaxed"
      style={{ borderColor: '#3a3a3a', color: '#9CA3AF' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="tracking-widest" style={{ color: '#E63329' }}>
          //{kind === 'thread' ? 'HILO' : 'RESPUESTA'}·ELIMINADO·POR·MODERACIÓN
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
            <span className="hidden sm:inline">RESTAURAR</span>
          </button>
        )}
      </div>
      <span>
        {mod ? `@${mod.username}` : 'moderador'} ·{' '}
        <span className="text-secondary">RAZÓN:</span> {deletion.reason}
      </span>
    </div>
  )
}

// ── Backlinks — "respondieron" line under a post header ────────────────────
//
// Lists the reply ids that quoted this post via >>id. Imageboard convention.
// Renders nothing when there are no inbound replies, so unanswered posts
// stay visually quiet.

function Backlinks({
  ids,
  onClick,
}: {
  ids: string[]
  onClick: (id: string) => void
}) {
  if (ids.length === 0) return null
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[10px] tracking-widest text-muted">
      <span>respondieron:</span>
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onClick(id)}
          className="text-sys-orange transition-colors hover:text-primary hover:underline"
        >
          &gt;&gt;{id}
        </button>
      ))}
    </div>
  )
}

// ── Post body — image float + body text with >>id quote-links ──────────────

function PostBody({
  imageUrl,
  imageRequired,
  body,
  onQuoteClick,
  isQuoteToMe,
}: {
  imageUrl?: string
  imageRequired?: boolean
  body: string
  onQuoteClick: (id: string) => void
  isQuoteToMe: (id: string) => boolean
}) {
  return (
    <div className="font-mono text-[12px] leading-relaxed text-secondary">
      {imageUrl && (
        <img
          src={imageUrl}
          alt={imageRequired ? 'imagen del hilo' : 'adjunto'}
          className="float-left mb-2 mr-3 max-h-48 max-w-[200px] border border-border object-cover sm:max-h-64 sm:max-w-[260px]"
        />
      )}
      <BodyText body={body} onQuoteClick={onQuoteClick} isQuoteToMe={isQuoteToMe} />
      <div className="clear-both" />
    </div>
  )
}

// Render body text with `>>id` tokens turned into clickable buttons.
// When the cited id resolves to a post authored by the current user,
// append a `[TÚ]` chip so the reader sees "this person is replying to me"
// without scanning the thread.
function BodyText({
  body,
  onQuoteClick,
  isQuoteToMe,
}: {
  body: string
  onQuoteClick: (id: string) => void
  isQuoteToMe: (id: string) => boolean
}) {
  const parts = body.split(/(>>[a-z0-9-]+)/gi)
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (/^>>[a-z0-9-]+$/i.test(part)) {
          const id = part.slice(2)
          const mine = isQuoteToMe(id)
          return (
            <span key={i} className="inline-flex items-baseline gap-1">
              <button
                type="button"
                onClick={() => onQuoteClick(id)}
                className="font-mono text-sys-orange transition-colors hover:text-primary hover:underline"
              >
                {part}
              </button>
              {mine && (
                <span
                  className="border px-1 py-px font-mono text-[9px] tracking-widest"
                  style={{
                    borderColor: '#F97316',
                    color: '#F97316',
                    backgroundColor: 'rgba(249,115,22,0.12)',
                  }}
                  aria-label="te están respondiendo"
                >
                  TÚ
                </span>
              )}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}
