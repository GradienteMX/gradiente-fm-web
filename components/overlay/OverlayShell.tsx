'use client'

import Link from 'next/link'
import { X, Trash2, Send, Pencil, MessageSquare } from 'lucide-react'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ContentItem } from '@/lib/types'
import { categoryColor } from '@/lib/utils'
import { useOverlay } from './useOverlay'
import { ShareButton } from './ShareButton'
import { removeItem } from '@/lib/drafts'
import { removePublishedItemLocal } from '@/lib/publishedItemsCache'
import { usePublishConfirm } from '@/components/publish/usePublishConfirm'
import { CommentsColumn } from './CommentsColumn'
import { SaveItemButton } from './SaveItemButton'
import { useAuth } from '@/components/auth/useAuth'
import { canAssignRoles } from '@/lib/permissions'
import { usePrompt } from '@/components/prompt/usePrompt'
import { useComments } from '@/lib/hooks/useComments'
import type { Comment, User } from '@/lib/types'

// ── Shell-scoped context ────────────────────────────────────────────────────
// Lets children rendered inside <OverlayShell> (the per-type overlays —
// ReaderOverlay, ArticuloOverlay, etc.) read the live comment count and
// toggle the comments column without prop drilling. The count is sourced
// from useComments(item.id) at the shell level so it's available before
// the user opens the column.

interface OverlayShellContextValue {
  commentsOpen: boolean
  setCommentsOpen: Dispatch<SetStateAction<boolean>>
  commentsTotal: number
  commentsLoading: boolean
  comments: Comment[]
  commentsUsersById: Map<string, User>
}

const OverlayShellContext = createContext<OverlayShellContextValue | null>(null)

export function useOverlayShell() {
  const ctx = useContext(OverlayShellContext)
  if (!ctx) {
    throw new Error('useOverlayShell must be used inside <OverlayShell>')
  }
  return ctx
}

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
  const router = useRouter()
  const { currentUser } = useAuth()
  const isAdmin = canAssignRoles(currentUser)
  const { typeToConfirm } = usePrompt()
  // Auto-open the comments column when the URL carries a `comment` param —
  // this is the deep-link shape the dashboard's saved-comments section uses
  // to jump straight to a particular thread.
  const focusedCommentId = searchParams?.get('comment') ?? null
  // Comments column visibility — drives the split-screen layout. Closed by
  // default so the overlay reads as a single surface until the reader asks
  // for discussion. Disabled on mobile (split is impractical < sm).
  const [commentsOpen, setCommentsOpen] = useState(focusedCommentId !== null)

  // Lift comment fetching to the shell so the count is available to the rail
  // button + any child overlay (metadata row, footer legend) before the
  // column is opened. CommentsColumn still calls useComments itself; the
  // dedupe is at the supabase realtime layer + cheap enough to keep simple.
  const shellCommentsHook = useComments(item.id)
  const commentsTotal = shellCommentsHook.comments.length
  const commentsLoading = shellCommentsHook.loading

  const [railHover, setRailHover] = useState(false)

  // Admin-only hard-delete from inside the overlay. Hidden for session-only
  // items (those have their own Trash2 in SessionItemStrip via removeItem).
  // Typed-confirmation gate matches the Publicados owner-delete pattern.
  const isSessionOnly = !!item._draftState
  const canAdminDelete = isAdmin && !isSessionOnly
  const handleAdminDelete = async () => {
    const title = item.title?.trim() || 'sin título'
    const required = `BORRAR ${title}`
    const confirmed = await typeToConfirm({
      title: `Borrar ${title}`,
      body:
        'Acción de admin. Eliminación permanente. Por cascada de FK también caen los comentarios, guardados, polls, vibe-checks y registros de HP del ítem.',
      requiredText: required,
      placeholder: required,
      confirmLabel: 'BORRAR PERMANENTE',
      cancelLabel: 'CANCELAR',
      destructive: true,
    })
    if (!confirmed) return
    const res = await fetch(`/api/items/${encodeURIComponent(item.id)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      console.error('[overlay admin delete]', res.status, await res.text())
      return
    }
    removePublishedItemLocal(item.id)
    close()
    router.refresh()
  }

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
  // [C]: toggle comments column. Ignored when focus is in any editable
  // field so the user can still type the letter c inside the composer.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (commentsOpen) {
          setCommentsOpen(false)
        } else {
          close()
        }
        return
      }
      if (e.key === 'c' || e.key === 'C') {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        const t = e.target as HTMLElement | null
        const tag = t?.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return
        e.preventDefault()
        setCommentsOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close, commentsOpen])

  const shellCtxValue = {
    commentsOpen,
    setCommentsOpen,
    commentsTotal,
    commentsLoading,
    comments: shellCommentsHook.comments,
    commentsUsersById: shellCommentsHook.usersById,
  }

  return (
    <OverlayShellContext.Provider value={shellCtxValue}>
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
              {/* Partner attribution byline — renders when item.partner is set
                  (resolved server-side via the partner_id self-join). Clickable
                  through to /marketplace when the partner is marketplace-enabled;
                  static label otherwise. See wiki/90-Decisions/Partner Authoring. */}
              {item.partner && (
                <span className="sys-label hidden shrink-0 items-center gap-1.5 sm:inline-flex">
                  <span className="text-muted">PUBLICADO POR</span>
                  {item.partner.marketplaceEnabled ? (
                    <Link
                      href={`/marketplace?partner=${encodeURIComponent(item.partner.slug)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="transition-opacity hover:opacity-80"
                      style={{ color: '#FF8800' }}
                      title={`Ver perfil de ${item.partner.title}`}
                    >
                      //{item.partner.title.toUpperCase()}
                    </Link>
                  ) : (
                    <span
                      style={{ color: '#FF8800' }}
                      title={`Publicado por ${item.partner.title}`}
                    >
                      //{item.partner.title.toUpperCase()}
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <SaveItemButton item={item} />
              <ShareButton item={item} />
              {canAdminDelete && (
                <button
                  type="button"
                  onClick={handleAdminDelete}
                  aria-label="Eliminar (admin)"
                  title="Eliminar (admin)"
                  className="hidden items-center gap-1.5 border border-border/70 px-2.5 py-1 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-sys-red hover:text-sys-red sm:flex"
                >
                  <Trash2 size={11} />
                  ELIMINAR
                </button>
              )}
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

        {/* Rail button — vertical "terminal tab" anchored to the wrapper's
            right edge so it always sits on the rightmost surface (panel when
            closed, comments column when open). Reads as a live system
            readout: zero-padded count on top, label in the middle, presence
            dot on bottom when count > 0. Closed-state is orange-on-rest so
            it carries CTA color at rest rather than only on press.
            Hidden on mobile — comments are reachable via the in-body
            DISCUSIÓN entry + footer legend instead. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setCommentsOpen((o) => !o)
          }}
          onMouseEnter={() => setRailHover(true)}
          onMouseLeave={() => setRailHover(false)}
          aria-expanded={commentsOpen}
          aria-label={commentsOpen ? 'Ocultar comentarios' : 'Mostrar comentarios'}
          className="absolute top-1/2 z-30 hidden items-center justify-center gap-3 border px-3 py-5 font-mono text-[12px] tracking-widest sm:flex"
          style={{
            right: 0,
            writingMode: 'vertical-rl',
            transform: `translate(${railHover ? 'calc(50% - 8px)' : '50%'}, -50%) rotate(180deg)`,
            borderColor: commentsOpen
              ? '#F97316'
              : railHover
              ? '#F97316'
              : 'rgba(249,115,22,0.55)',
            color: commentsOpen || railHover ? '#F97316' : '#FF9A33',
            backgroundColor: commentsOpen
              ? 'rgba(249,115,22,0.12)'
              : railHover
              ? 'rgba(249,115,22,0.08)'
              : '#0a0a0a',
            minHeight: '220px',
            transition:
              'transform 220ms cubic-bezier(0.22,0.8,0.32,1), border-color 220ms, color 220ms, background-color 220ms',
          }}
        >
          <span
            className="tabular-nums"
            style={{ fontSize: 11, opacity: 0.85, letterSpacing: '0.18em' }}
          >
            {commentsLoading
              ? '··'
              : String(Math.min(commentsTotal, 99)).padStart(2, '0')}
          </span>
          <MessageSquare size={14} aria-hidden style={{ transform: 'rotate(90deg)' }} />
          <span>{commentsOpen ? 'OCULTAR' : 'COMENTARIOS'}</span>
          {commentsTotal > 0 && !commentsLoading && (
            <span
              className="inline-flex items-center gap-1.5 tabular-nums"
              style={{ fontSize: 11, letterSpacing: '0.18em' }}
              aria-hidden
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: '#F97316', boxShadow: '0 0 6px #F97316' }}
              />
              <span>{commentsTotal}</span>
            </span>
          )}
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
    </OverlayShellContext.Provider>
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
  const { close } = useOverlay()
  const router = useRouter()

  const handlePublish = () => {
    openConfirm(item.id)
  }
  const handleDelete = () => {
    removeItem(item.id)
    onDeleted()
  }
  // Close the overlay before navigating to /dashboard?edit=… — without
  // this, hitting EDITAR pushes the dashboard URL but leaves the overlay
  // mounted on top of it. The overlay only auto-closes on the `item`
  // search param being cleared, which doesn't happen for unrelated nav.
  const handleEdit = () => {
    close()
    router.push(editHref)
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
        <button
          type="button"
          onClick={handleEdit}
          className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 font-mono text-[10px] tracking-widest text-muted transition-colors hover:border-white/60 hover:text-primary"
        >
          <Pencil size={11} />
          EDITAR
        </button>
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
