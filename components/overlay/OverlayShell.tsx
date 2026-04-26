'use client'

import Link from 'next/link'
import { X, Trash2, Send, Pencil, MessageSquare } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import type { ContentItem } from '@/lib/types'
import { categoryColor } from '@/lib/utils'
import { useOverlay } from './useOverlay'
import { ShareButton } from './ShareButton'
import { removeItem } from '@/lib/drafts'
import { usePublishConfirm } from '@/components/publish/usePublishConfirm'
import { CommentsColumn } from './CommentsColumn'

const TYPE_LABEL: Record<ContentItem['type'], string> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTICIA',
  review: 'REVIEW',
  editorial: 'EDITORIAL',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULO',
  listicle: 'LISTA',
  partner: 'PARTNER',
}

interface OverlayShellProps {
  item: ContentItem
  exiting: boolean
  onExited: () => void
  children: ReactNode
}

export function OverlayShell({
  item,
  exiting,
  onExited,
  children,
}: OverlayShellProps) {
  const { close, originRect } = useOverlay()
  const searchParams = useSearchParams()
  // Auto-open the comments column when the URL carries a `comment` param —
  // this is the deep-link shape the dashboard's saved-comments section uses
  // to jump straight to a particular thread.
  const focusedCommentId = searchParams?.get('comment') ?? null
  // Comments column visibility — drives the split-screen layout. Closed by
  // default so the overlay reads as a single surface until the reader asks
  // for discussion. Disabled on mobile (split is impractical < sm).
  const [commentsOpen, setCommentsOpen] = useState(focusedCommentId !== null)

  // Compute transform-origin from click rect so the CRT boot-in grows
  // from roughly where the card was.
  const [transformOrigin] = useState<string>(() => {
    if (typeof window === 'undefined' || !originRect) return 'center center'
    const cardCx = originRect.x + originRect.width / 2
    const cardCy = originRect.y + originRect.height / 2
    return `${cardCx}px ${cardCy}px`
  })

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ESC: collapse comments first if open, otherwise close the overlay.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (commentsOpen) {
        setCommentsOpen(false)
      } else {
        close()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close, commentsOpen])

  return (
    <div
      className={
        'fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 ' +
        (exiting ? 'overlay-backdrop-out' : 'overlay-backdrop-in')
      }
      onClick={close}
      onAnimationEnd={(e) => {
        if (exiting && e.animationName === 'overlay-backdrop-out') {
          onExited()
        }
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" aria-hidden />

      {/* Split-screen wrapper — animates max-width as comments toggle. */}
      <motion.div
        className="relative z-10 flex w-full items-stretch justify-center gap-0"
        animate={{ maxWidth: commentsOpen ? 1400 : 1024 }}
        initial={false}
        transition={{ duration: 0.45, ease: [0.22, 0.8, 0.32, 1] }}
      >
        {/* Panel — flex-grow:1 means it fills whatever the column doesn't.
            Framer Motion animates the resulting width change smoothly via
            the parent's max-width animation + the column's basis animation. */}
        <div
          onClick={(e) => e.stopPropagation()}
          className={
            'eva-box eva-scanlines relative flex min-w-0 flex-col overflow-hidden bg-base ' +
            (exiting ? 'overlay-panel-out' : 'overlay-panel-in')
          }
          style={{
            maxHeight: 'min(92vh, 900px)',
            transformOrigin,
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
          }}
        >
          {/* Chrome / header */}
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-base/95 px-4 py-2.5 backdrop-blur-sm">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="shrink-0 font-mono text-[10px] tracking-widest"
                style={{ color: categoryColor(item.type) }}
              >
                //{TYPE_LABEL[item.type]}
              </span>
              <span className="sys-label hidden truncate uppercase text-muted sm:inline">
                {item.slug}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <ShareButton item={item} />
              <span className="sys-label hidden items-center gap-1.5 text-sys-green sm:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-green" />
                ONLINE
              </span>
              <button
                onClick={close}
                aria-label="Cerrar"
                className="flex items-center gap-1.5 border border-border/70 bg-black px-3 py-2 font-mono text-[10px] tracking-widest text-secondary transition-colors hover:border-white/60 hover:text-primary sm:gap-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-muted"
              >
                <span className="hidden sm:inline">[ESC]</span>
                <X size={14} className="sm:hidden" />
                <span>CERRAR</span>
              </button>
            </div>
          </div>

          {/* Session item strip */}
          {item._draftState && (
            <SessionItemStrip item={item} onDeleted={close} />
          )}

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">{children}</div>

          {/* Mobile-only bottom dismiss bar */}
          <button
            onClick={close}
            aria-label="Cerrar"
            className="flex shrink-0 items-center justify-center gap-2 border-t border-border bg-base/95 px-4 py-3 font-mono text-[11px] tracking-widest text-primary backdrop-blur-sm transition-colors active:bg-elevated sm:hidden"
          >
            <X size={14} />
            <span>CERRAR</span>
          </button>

          {/* Phosphor warm-up flash — one-shot, only on enter */}
          {!exiting && (
            <div
              className="overlay-phosphor-in pointer-events-none absolute inset-0 z-20"
              style={{
                background:
                  'radial-gradient(circle at center, rgba(255,140,0,0.38) 0%, transparent 60%)',
              }}
            />
          )}
        </div>

        {/* Rail button — vertical chip anchored at the boundary between
            panel and comments. Sticks out to the right of the panel when
            comments are closed; sits flush at the 60% mark when open.
            Hidden on mobile — a separate full-screen comments mode lands later. */}
        {/* Rail button — pinned to the wrapper's right edge so it always sits
            on the rightmost surface (panel when closed, comments column when
            open). The wrapper's max-width animation moves it outward when
            comments open. No own animation: it tracks the wrapper smoothly. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setCommentsOpen((o) => !o)
          }}
          aria-expanded={commentsOpen}
          aria-label={commentsOpen ? 'Ocultar comentarios' : 'Mostrar comentarios'}
          className="absolute top-1/2 z-30 hidden items-center justify-center gap-2 border bg-base px-2 py-3 font-mono text-[10px] tracking-widest transition-colors duration-300 hover:text-primary sm:flex"
          style={{
            right: 0,
            writingMode: 'vertical-rl',
            transform: 'translate(50%, -50%) rotate(180deg)',
            borderColor: commentsOpen ? '#F97316' : '#3a3a3a',
            color: commentsOpen ? '#F97316' : '#9CA3AF',
            backgroundColor: commentsOpen ? 'rgba(249,115,22,0.08)' : '#0a0a0a',
            minHeight: '120px',
          }}
        >
          <MessageSquare size={11} aria-hidden style={{ transform: 'rotate(90deg)' }} />
          <span>{commentsOpen ? 'OCULTAR' : 'COMENTARIOS'}</span>
        </button>

        {/* Comments column — slides in from the right when commentsOpen.
            AnimatePresence handles the unmount-with-exit-anim cleanly so the
            column animates both in AND out without leaving residual layout. */}
        <AnimatePresence initial={false}>
          {commentsOpen && (
            <motion.div
              key="comments-col"
              onClick={(e) => e.stopPropagation()}
              className="eva-box eva-scanlines hidden min-w-0 flex-col overflow-hidden bg-base sm:flex"
              style={{
                maxHeight: 'min(92vh, 900px)',
                flexGrow: 0,
                flexShrink: 0,
              }}
              // marginLeft animates with the rest so the panel doesn't jump
              // 12px when AnimatePresence unmounts the column at exit-end.
              initial={{ flexBasis: '0%', opacity: 0, x: 40, marginLeft: 0 }}
              animate={{
                flexBasis: '40%',
                opacity: 1,
                x: 0,
                marginLeft: '0.75rem',
              }}
              exit={{ flexBasis: '0%', opacity: 0, x: 40, marginLeft: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 0.8, 0.32, 1] }}
            >
              <CommentsColumn
                item={item}
                onClose={() => setCommentsOpen(false)}
                focusedCommentId={focusedCommentId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

// ── Session item strip ──────────────────────────────────────────────────────
function SessionItemStrip({
  item,
  onDeleted,
}: {
  item: ContentItem
  onDeleted: () => void
}) {
  const isDraft = item._draftState === 'draft'
  const accent = isDraft ? '#F97316' : '#4ADE80'
  const label = isDraft
    ? 'DRAFT·SESIÓN · solo visible para ti'
    : 'PUBLICADO·SESIÓN · visible en tu feed local'
  const editHref = `/dashboard?type=${item.type}&edit=${encodeURIComponent(item.id)}`
  const { openConfirm } = usePublishConfirm()

  const handlePublish = () => {
    openConfirm(item.id)
  }
  const handleDelete = () => {
    removeItem(item.id)
    onDeleted()
  }

  return (
    <div
      className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2 backdrop-blur-sm"
      style={{
        borderColor: accent,
        backgroundColor: `${accent}10`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className={isDraft ? 'h-1.5 w-1.5 animate-pulse rounded-full' : 'h-1.5 w-1.5 rounded-full'}
          style={{
            backgroundColor: accent,
            boxShadow: `0 0 6px ${accent}, 0 0 12px ${accent}66`,
          }}
          aria-hidden
        />
        <span
          className="font-mono text-[10px] tracking-widest"
          style={{ color: accent }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={editHref}
          className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-white/60 hover:text-primary"
        >
          <Pencil size={11} />
          EDITAR
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-red hover:text-sys-red"
        >
          <Trash2 size={11} />
          ELIMINAR
        </button>
        {isDraft && (
          <button
            type="button"
            onClick={handlePublish}
            className="flex items-center gap-1.5 border px-3 py-1.5 font-mono text-[10px] tracking-widest transition-colors"
            style={{
              borderColor: accent,
              color: accent,
              backgroundColor: `${accent}1f`,
            }}
          >
            <Send size={11} />
            ▶ PUBLICAR AHORA
          </button>
        )}
      </div>
    </div>
  )
}
