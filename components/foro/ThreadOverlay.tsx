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
import { getGenreById, tagLabel, vibeForGenre } from '@/lib/genres'
import { canModerate } from '@/lib/permissions'
import { vibeToColor } from '@/lib/utils'
import { getResolvedUserById, useResolvedUser } from '@/lib/userOverrides'
import { usePrompt } from '@/components/prompt/usePrompt'
import { ReportButton } from '@/components/report/ReportButton'
import { ForoLightbox } from './ForoLightbox'
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
//
// Fase F chrome: a paper sheet over a flat ink scrim, same anatomy as
// components/overlay/OverlayShell — hairline-framed panel, raised header
// band with mono chips and the ink CERRAR chip, body on paper. The OP is
// framed in full ink; replies step back to an ink-faint hairline. The
// scroll-and-pulse target wears a 2px sys-red-paper outline (flat, no glow)
// so it can't be confused with the ink focus ring.

// House focus grammar — 2px ink outline, offset 2.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// The scroll-target pulse — a flat red outline, held for the 1.6s timeout.
const PULSE_RING = 'outline outline-2 outline-offset-2 outline-sys-red-paper'

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

  // Mod actions — open the house [[PromptOverlay]] for a reason.
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
  // Human-friendly label for a cited post: the author's @username, falling
  // back to a short id hash when the user isn't resolved yet. Replaces the
  // raw `>>uuid` that used to surface in quote-links and backlinks.
  const labelForPost = useCallback(
    (id: string) => {
      const authorId = authorByPostId.get(id)
      const user = authorId ? getResolvedUserById(authorId) : undefined
      return user?.username ? `@${user.username}` : `#${id.slice(0, 4)}`
    },
    [authorByPostId],
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
        <div className="absolute inset-0 bg-ink/60" aria-hidden />
        <div
          className="relative z-10 flex max-w-md flex-col items-center gap-3 border border-ink bg-paper p-6 text-center text-ink"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-mono text-d13 font-bold uppercase tracking-widest text-sys-red-paper">
            HILO NO ENCONTRADO
          </p>
          <p className="font-mono text-d11 tracking-widest text-ink-faint">
            id: {threadId}
          </p>
          <button
            type="button"
            onClick={onClose}
            className={`flex min-h-11 items-center border border-ink bg-ink px-3 font-mono text-d11 font-bold tracking-widest text-paper transition-colors hover:bg-paper hover:text-ink ${FOCUS_RING}`}
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
      {/* Ink scrim — flat, no blur (fase C anatomy). */}
      <div className="absolute inset-0 bg-ink/60" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex w-full max-w-3xl flex-col overflow-hidden border border-ink bg-paper text-ink"
        style={{ maxHeight: 'min(92vh, 900px)' }}
      >
        {/* Chrome / header — raised paper band. */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-ink bg-paper-raised px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
              FORO · HILO
            </span>
            <span className="font-mono text-d11 uppercase tabular-nums tracking-widest text-ink-faint">
              R·{String(replies.length).padStart(2, '0')}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className={`flex min-h-11 shrink-0 items-center gap-2 border border-ink bg-ink px-3 font-mono text-d11 font-bold tracking-widest text-paper transition-colors hover:bg-paper hover:text-ink ${FOCUS_RING}`}
          >
            <X size={12} className="sm:hidden" />
            <span>CERRAR</span>
            <span className="hidden sm:inline">ESC</span>
          </button>
        </div>

        {/* Scrollable body. `min-h-0` is load-bearing: without it the flex
            child keeps its implicit `min-height:auto`, grows past the panel
            on long OPs, and the panel's overflow-hidden clips the tail — so
            the bottom of a long post became unreachable. */}
        <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 p-4">
            {/* OP */}
            <article
              data-postid={thread.id}
              className={
                'flex flex-col gap-2 border border-ink bg-paper-raised p-3 ' +
                (pulsedId === thread.id ? PULSE_RING : '')
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <PostHeader
                    authorId={thread.authorId}
                    createdAt={thread.createdAt}
                    onIdClick={() => quotePost(thread.id)}
                  />
                </div>
                {/* Reader's report vs. staff's delete: the two live side by
                    side, but the report chip stays hairline-quiet against the
                    red BORRAR. Hidden on your own OP and on a tombstone —
                    there is nothing left to report once the body is gone. */}
                {!threadDeleted && thread.authorId !== currentUser?.id && (
                  <ReportButton
                    targetType="foro_thread"
                    targetId={thread.id}
                    className="min-h-11"
                  />
                )}
                {isMod && !threadDeleted && (
                  <ModDeleteButton onClick={onTombstoneThread} label="BORRAR HILO" />
                )}
              </div>
              <Backlinks
                ids={inboundIndex.get(thread.id) ?? []}
                onClick={focusPost}
                labelForPost={labelForPost}
              />
              {threadDeleted ? (
                <Tombstone
                  deletion={thread.deletion!}
                  kind="thread"
                  canRevert={isMod}
                  onRevert={() => void clearThreadTombstone(thread.id)}
                />
              ) : (
                <>
                  <h1 className="font-syne text-d18 font-extrabold leading-tight text-ink">
                    {thread.subject}
                  </h1>
                  {(thread.genres.length > 0 || thread.tags.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1">
                      {thread.genres.map((id) => {
                        const g = getGenreById(id)
                        const v = vibeForGenre(id)
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 border border-ink px-1.5 py-px font-mono text-[9px] tracking-widest text-ink"
                          >
                            {v !== null && (
                              <span
                                aria-hidden
                                className="h-2 w-2 shrink-0 border border-ink"
                                style={{ backgroundColor: vibeToColor(v) }}
                              />
                            )}
                            {(g?.name ?? id).toUpperCase()}
                          </span>
                        )
                      })}
                      {/* Metadata tags — dashed hairline so they read as a
                          separate axis from the swatch-bearing genres. */}
                      {thread.tags.map((id) => {
                        return (
                          <span
                            key={id}
                            className="border border-dashed border-ink-faint px-1.5 py-px font-mono text-[9px] tracking-widest text-ink-faint"
                          >
                            #{tagLabel(id).toUpperCase()}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <PostBody
                    images={thread.imageUrls}
                    imageRequired
                    body={thread.body}
                    onQuoteClick={focusPost}
                    isQuoteToMe={isQuoteToMe}
                    labelForPost={labelForPost}
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
                isOwn={reply.authorId === currentUser?.id}
                onIdClick={() => quotePost(reply.id)}
                onQuoteClick={focusPost}
                isQuoteToMe={isQuoteToMe}
                labelForPost={labelForPost}
                onTombstone={onTombstoneReply}
              />
            ))}

            {/* Composer — disabled on tombstoned threads. New replies on a
                deleted thread don't make sense; the moderator's pruning
                action also closes the door on continued discussion. */}
            <div ref={composerRef} className="border border-dashed border-ink bg-paper-raised p-3">
              {threadDeleted ? (
                <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                  HILO CERRADO POR MODERACIÓN — no se aceptan respuestas nuevas.
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
  isOwn,
  onIdClick,
  onQuoteClick,
  isQuoteToMe,
  labelForPost,
  onTombstone,
}: {
  reply: ForoReply
  pulsed: boolean
  inboundIds: string[]
  isMod: boolean
  isOwn: boolean
  onIdClick: () => void
  onQuoteClick: (id: string) => void
  isQuoteToMe: (id: string) => boolean
  labelForPost: (id: string) => string
  onTombstone: (reply: ForoReply) => void
}) {
  const deleted = !!reply.deletion
  return (
    <article
      data-postid={reply.id}
      className={
        'flex flex-col gap-2 border border-ink-faint bg-paper-raised p-3 ' +
        (pulsed ? PULSE_RING : '')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <PostHeader
            authorId={reply.authorId}
            createdAt={reply.createdAt}
            onIdClick={onIdClick}
          />
        </div>
        {!deleted && !isOwn && (
          <ReportButton targetType="foro_reply" targetId={reply.id} className="min-h-11" />
        )}
        {isMod && !deleted && (
          <ModDeleteButton onClick={() => onTombstone(reply)} label="BORRAR" />
        )}
      </div>
      <Backlinks ids={inboundIds} onClick={onQuoteClick} labelForPost={labelForPost} />
      {deleted ? (
        <Tombstone
          deletion={reply.deletion!}
          kind="reply"
          canRevert={isMod}
          onRevert={() => void clearReplyTombstone(reply.id, reply.threadId)}
        />
      ) : (
        <PostBody
          images={reply.imageUrl ? [reply.imageUrl] : []}
          body={reply.body}
          onQuoteClick={onQuoteClick}
          isQuoteToMe={isQuoteToMe}
          labelForPost={labelForPost}
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
      className={`flex min-h-11 shrink-0 items-center gap-1 border border-sys-red-paper px-2 font-mono text-[9px] font-bold tracking-widest text-sys-red-paper transition-colors hover:bg-sys-red-paper hover:text-paper ${FOCUS_RING}`}
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
    <div className="flex flex-col gap-0.5 border border-dashed border-ink px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-faint">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold tracking-widest text-sys-red-paper">
          {kind === 'thread' ? 'HILO ELIMINADO POR MODERACIÓN' : 'RESPUESTA ELIMINADA POR MODERACIÓN'}
        </span>
        {canRevert && (
          <button
            type="button"
            onClick={onRevert}
            className={`flex min-h-11 shrink-0 items-center gap-1 border border-ink px-2 text-[9px] font-bold tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
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
        <span className="text-ink-soft">RAZÓN:</span> {deletion.reason}
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
  labelForPost,
}: {
  ids: string[]
  onClick: (id: string) => void
  labelForPost: (id: string) => string
}) {
  if (ids.length === 0) return null
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[10px] tracking-widest text-ink-faint">
      <span>respondieron:</span>
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onClick(id)}
          className={`font-bold text-ink underline-offset-2 transition-colors hover:text-sys-red-paper hover:underline ${FOCUS_RING}`}
        >
          {labelForPost(id)}
        </button>
      ))}
    </div>
  )
}

// ── Post body — image float + body text with >>id quote-links ──────────────

function PostBody({
  images,
  imageRequired,
  body,
  onQuoteClick,
  isQuoteToMe,
  labelForPost,
}: {
  images: string[]
  imageRequired?: boolean
  body: string
  onQuoteClick: (id: string) => void
  isQuoteToMe: (id: string) => boolean
  labelForPost: (id: string) => string
}) {
  const [cover, ...rest] = images
  // Index of the image currently open in the lightbox, or null when closed.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  return (
    <div className="font-grotesk text-d15 leading-relaxed text-ink-soft">
      {cover && (
        <img
          src={cover}
          alt={imageRequired ? 'imagen del hilo' : 'adjunto'}
          onClick={() => setLightboxIndex(0)}
          className="float-left mb-2 mr-3 max-h-48 max-w-[200px] cursor-zoom-in border border-ink bg-paper object-cover sm:max-h-64 sm:max-w-[260px]"
        />
      )}
      <BodyText
        body={body}
        onQuoteClick={onQuoteClick}
        isQuoteToMe={isQuoteToMe}
        labelForPost={labelForPost}
      />
      <div className="clear-both" />
      {/* Additional images (threads can carry up to FORO_THREAD_IMAGES_MAX) —
          a thumbnail strip under the floated cover + body. */}
      {rest.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {rest.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={`imagen ${i + 2}`}
              onClick={() => setLightboxIndex(i + 1)}
              className="h-20 w-20 cursor-zoom-in border border-ink bg-paper object-cover sm:h-24 sm:w-24"
            />
          ))}
        </div>
      )}
      {lightboxIndex !== null && (
        <ForoLightbox
          images={images}
          index={lightboxIndex}
          onIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}

// Pull the 11-char video id out of any common YouTube URL shape
// (watch?v=, youtu.be/, /embed/, /shorts/). Returns null for non-YouTube.
function youtubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?(?:.*&)?v=([\w-]{11})/i,
    /youtu\.be\/([\w-]{11})/i,
    /youtube\.com\/embed\/([\w-]{11})/i,
    /youtube\.com\/shorts\/([\w-]{11})/i,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return m[1]
  }
  return null
}

function YouTubeEmbed({ id }: { id: string }) {
  return (
    <span className="my-2 block w-full max-w-md">
      <span
        className="relative block w-full overflow-hidden border border-ink bg-panel"
        style={{ aspectRatio: '16 / 9' }}
      >
        <iframe
          src={`https://www.youtube.com/embed/${id}`}
          title="Reproductor de YouTube"
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </span>
    </span>
  )
}

// Render body text with three kinds of inline tokens promoted out of plain
// text: `>>id` quote-links (clickable, with a `[TÚ]` chip when the cited post
// is the reader's), bare URLs (clickable anchors), and YouTube URLs (inline
// players right where they were pasted). Everything else stays literal text
// with whitespace preserved.
function BodyText({
  body,
  onQuoteClick,
  isQuoteToMe,
  labelForPost,
}: {
  body: string
  onQuoteClick: (id: string) => void
  isQuoteToMe: (id: string) => boolean
  labelForPost: (id: string) => string
}) {
  // Split on URLs first, then quote tokens — capturing groups keep the
  // delimiters in the resulting array.
  const parts = body.split(/(https?:\/\/[^\s]+|>>[a-z0-9-]+)/gi)
  return (
    <div className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (/^>>[a-z0-9-]+$/i.test(part)) {
          const id = part.slice(2)
          const mine = isQuoteToMe(id)
          return (
            <span key={i} className="inline-flex items-baseline gap-1">
              <button
                type="button"
                onClick={() => onQuoteClick(id)}
                className={`font-mono font-bold text-ink underline-offset-2 transition-colors hover:text-sys-red-paper hover:underline ${FOCUS_RING}`}
              >
                {labelForPost(id)}
              </button>
              {mine && (
                <span
                  className="inline-flex items-center gap-1 border border-ink px-1 py-px font-mono text-[9px] font-bold tracking-widest text-ink"
                  aria-label="te están respondiendo"
                >
                  <span aria-hidden className="h-2 w-2 shrink-0 border border-ink bg-acid" />
                  TÚ
                </span>
              )}
            </span>
          )
        }
        if (/^https?:\/\//i.test(part)) {
          const vid = youtubeId(part)
          if (vid) return <YouTubeEmbed key={i} id={vid} />
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={`break-all text-sys-red-paper underline decoration-sys-red-paper/50 underline-offset-2 transition-colors hover:text-ink hover:decoration-ink ${FOCUS_RING}`}
            >
              {part}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </div>
  )
}
