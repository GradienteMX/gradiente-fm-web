'use client'

import Link from 'next/link'
import { X, Trash2, Pencil, MessageSquare } from 'lucide-react'
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ContentItem } from '@/lib/types'
import { effectiveVibeBand, vibeToColor } from '@/lib/utils'
import {
  categoryColorOnLight,
  TYPE_CODES,
  TYPE_DISPLAY_LABELS,
} from '@/lib/dashboard/palette'
import { franjaAttributionPrefix } from '@/lib/franjaAttribution'
import { useOverlay } from './useOverlay'
import { SignalTransition } from './SignalTransition'
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

// Inert shell context for previews (e.g. the dashboard LivePreview) that render
// an overlay BODY without the full OverlayShell. A draft has no live comments,
// so overlay components that read the comment count (ReaderOverlay's DISCUSIÓN
// entry / [C] footer) get inert values instead of throwing. Real overlays always
// use the full <OverlayShell> below. The value is a module const (not inlined on
// the Provider) to dodge the SWC "jsx identifier" parse error noted in the log.
const PREVIEW_SHELL_VALUE: OverlayShellContextValue = {
  commentsOpen: false,
  setCommentsOpen: () => {},
  commentsTotal: 0,
  commentsLoading: false,
  comments: [],
  commentsUsersById: new Map<string, User>(),
}

export function OverlayShellPreviewProvider({ children }: { children: ReactNode }) {
  return <OverlayShellContext.Provider value={PREVIEW_SHELL_VALUE}>{children}</OverlayShellContext.Provider>
}

// House focus ring on paper grounds (fase C).
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

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

  // ── Print-resolve transition ───────────────────────────────────────────────
  // The sheet resolves out of halftone print noise (SignalTransition,
  // canvas-2D, NO WebGL) on open, and de-resolves back into noise on close.
  // The wavefront emanates from the clicked card's viewport-space center.
  const panelRef = useRef<HTMLDivElement | null>(null)

  // Click origin in viewport space — the mosaic sweep emanates from here.
  const [originPoint] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === 'undefined' || !originRect) return null
    return {
      x: originRect.x + originRect.width / 2,
      y: originRect.y + originRect.height / 2,
    }
  })

  // Item's vibe slot color — warms the wavefront edge (a hint, not a wash).
  // Uses the effective band midpoint so crowd vibe checks are honored.
  const vibeColor = (() => {
    const [lo, hi] = effectiveVibeBand(item)
    return vibeToColor(Math.round((lo + hi) / 2))
  })()

  // Panel opacity is shell-owned state (not an imperative panel.style mutation)
  // so React re-renders — comments toggle, chip hovers — don't clobber it.
  // Starts at 0 to avoid a 1-frame flash of unmasked content before the mosaic
  // canvas mounts; SignalTransition fires onReveal once the mask is in place.
  const [panelRevealed, setPanelRevealed] = useState(false)

  // Gate unmount on the close-transition finishing. The backdrop fade runs in
  // parallel; we only call onExited() once the panel de-resolve has cut out.
  const [signalOutDone, setSignalOutDone] = useState(false)
  useEffect(() => {
    if (exiting && signalOutDone) onExited()
  }, [exiting, signalOutDone, onExited])

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

  // Franja attribution stamp — the ONE surviving slash idiom on paper (the
  // brand stamp), set in sys-red-paper. Kind-adaptive verb per
  // lib/franjaAttribution (//PRESENTA · CLUB JAPAN, //SELLO · X, …).
  const franjaStamp =
    item.franja && item.franja.title
      ? `//${franjaAttributionPrefix(item.franja.kind)} · ${item.franja.title.toUpperCase()}`
      : null

  return (
    <OverlayShellContext.Provider value={shellCtxValue}>
    <div
      className={
        'fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 ' +
        (exiting ? 'overlay-backdrop-out' : 'overlay-backdrop-in')
      }
      onClick={close}
    >
      {/* Ink scrim — flat, no blur (fase C). */}
      <div className="absolute inset-0 bg-ink/60" aria-hidden />

      {/* Split-screen wrapper — animates max-width as comments toggle. */}
      <motion.div
        className="relative z-10 flex w-full items-stretch justify-center gap-0"
        animate={{ maxWidth: commentsOpen ? 1400 : 1024 }}
        initial={false}
        transition={{ duration: 0.45, ease: [0.22, 0.8, 0.32, 1] }}
      >
        {/* Panel — the paper sheet. flex-grow:1 means it fills whatever the
            column doesn't. Framer Motion animates the resulting width change
            smoothly via the parent's max-width animation + the column's basis
            animation. */}
        <div
          ref={panelRef}
          onClick={(e) => e.stopPropagation()}
          className="relative flex min-w-0 flex-col overflow-hidden border border-ink bg-paper text-ink"
          style={{
            maxHeight: 'min(92dvh, 900px)',
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
            // Hidden until the mosaic mounts and reveals it — avoids a 1-frame
            // flash of unmasked content. Once SignalTransition fires onReveal
            // the canvas masks the now-opaque panel. On close we keep it at 1
            // through the de-resolve; the unmount (signalOutDone → onExited) is
            // the press cut. Reduced-motion: instant 0→1.
            opacity: panelRevealed ? 1 : 0,
          }}
        >
          {/* Print-resolve mosaic — transient canvas, mounted only while
              the transition runs, fully torn down on completion. Keyed on the
              phase so the open mosaic and close mosaic are distinct mounts. */}
          <SignalTransition
            key={exiting ? 'signal-out' : 'signal-in'}
            panelRef={panelRef}
            phase={exiting ? 'out' : 'in'}
            originPoint={originPoint}
            vibeColor={vibeColor}
            onReveal={() => setPanelRevealed(true)}
            onDone={exiting ? () => setSignalOutDone(true) : () => {}}
          />
          {/* Chrome / header — raised paper band. */}
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-ink bg-paper-raised px-4 py-2">
            <div className="flex min-w-0 items-center gap-3">
              {/* Type chip — category swatch + 2-letter code + display label.
                  Hue is never the sole signal; the code rides beside the
                  swatch (review/articulo ambers alias by design). */}
              <span className="flex shrink-0 items-center gap-1.5 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
                <span
                  aria-hidden
                  className="h-[9px] w-[9px] shrink-0"
                  style={{ backgroundColor: categoryColorOnLight(item.type) }}
                />
                {TYPE_CODES[item.type]} · {TYPE_DISPLAY_LABELS[item.type]}
              </span>
              <span className="hidden truncate font-mono text-d11 uppercase tracking-widest text-ink-faint sm:inline">
                {item.slug}
              </span>
              {/* Franja attribution byline — renders when item.franja is set
                  (resolved server-side via the franja_id self-join). Clickable
                  through to /marketplace when the franja is marketplace-enabled;
                  static stamp otherwise. See wiki/90-Decisions/Franja Authoring. */}
              {franjaStamp && item.franja && (
                item.franja.marketplaceEnabled ? (
                  <Link
                    href={`/marketplace?franja=${encodeURIComponent(item.franja.slug)}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`hidden shrink-0 font-mono text-d11 font-bold tracking-widest text-sys-red-paper transition-colors hover:bg-sys-red-paper hover:text-paper-raised sm:inline ${FOCUS_RING}`}
                    title={`Ver perfil de ${item.franja.title} en marketplace`}
                  >
                    {franjaStamp}
                  </Link>
                ) : (
                  <span
                    className="hidden shrink-0 font-mono text-d11 font-bold tracking-widest text-sys-red-paper sm:inline"
                    title={`Publicado por ${item.franja.title}`}
                  >
                    {franjaStamp}
                  </span>
                )
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <SaveItemButton item={item} />
              <ShareButton item={item} variant="paper" />
              {canAdminDelete && (
                <button
                  type="button"
                  onClick={handleAdminDelete}
                  aria-label="Eliminar (admin)"
                  title="Eliminar (admin)"
                  className={`hidden min-h-11 items-center gap-1.5 border border-sys-red-paper px-2.5 font-mono text-d11 font-bold tracking-widest text-sys-red-paper transition-colors hover:bg-sys-red-paper hover:text-paper-raised sm:flex ${FOCUS_RING}`}
                >
                  <Trash2 size={11} />
                  ELIMINAR
                </button>
              )}
              <button
                onClick={close}
                aria-label="Cerrar"
                className={`flex min-h-11 shrink-0 items-center gap-2 border border-ink bg-ink px-3 font-mono text-d11 font-bold tracking-widest text-paper transition-colors hover:bg-paper hover:text-ink ${FOCUS_RING}`}
              >
                <X size={12} className="sm:hidden" />
                <span>CERRAR</span>
                <span className="hidden sm:inline">ESC</span>
              </button>
            </div>
          </div>

          {/* Session item strip */}
          {item._draftState && (
            <SessionItemStrip item={item} onDeleted={close} />
          )}

          {/* Scrollable content. overflow-x-hidden is load-bearing on mobile:
              with only overflow-y-auto, CSS promotes overflow-x to auto, so any
              child wider than the panel becomes a horizontal scroll and a
              diagonal drag drifts the content sideways into empty space. Pinning
              x-hidden keeps reading strictly vertical (per-type bodies still
              stack their wide pieces so nothing is clipped). The literal
              .overflow-y-auto class is a contract — Reader/Articulo/Listicle
              scroll instrumentation finds this element via
              closest('.overflow-y-auto'). */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">{children}</div>

          {/* Mobile-only bottom bar — 2×2 instrument faceplate. Top row gives
              phones the save/share seats (the desktop header chips are hidden
              < sm); bottom row keeps the comments entry + dismiss. The desktop
              rail tab is hidden < sm, so COMENTARIOS here is the phone path
              into comments (works for EVERY overlay type, not just Reader). */}
          <div className="grid shrink-0 grid-cols-2 border-t border-ink bg-paper-raised sm:hidden">
            <div className="border-b border-r border-ink">
              <SaveItemButton item={item} seat="bar" />
            </div>
            <div className="border-b border-ink">
              <ShareButton item={item} variant="bar" />
            </div>
            <button
              onClick={() => setCommentsOpen(true)}
              aria-label="Mostrar comentarios"
              className={`flex min-h-[44px] items-center justify-center gap-2 border-r border-ink px-2 font-mono text-d11 font-bold tracking-widest text-ink transition-colors active:bg-ink active:text-paper ${FOCUS_RING}`}
            >
              <MessageSquare size={14} />
              <span>
                COMENTARIOS
                {commentsTotal > 0 && !commentsLoading ? ` · ${commentsTotal}` : ''}
              </span>
            </button>
            <button
              onClick={close}
              aria-label="Cerrar"
              className={`flex min-h-[44px] items-center justify-center gap-2 px-2 font-mono text-d11 font-bold tracking-widest text-ink transition-colors active:bg-ink active:text-paper ${FOCUS_RING}`}
            >
              <X size={14} />
              <span>CERRAR</span>
            </button>
          </div>
        </div>

        {/* Rail tab — vertical tab docked to the wrapper's right edge so it
            always sits on the rightmost surface (panel when closed, comments
            column when open). Flush-mounted: when the column opens the wrapper
            grows to 1400px and there's almost no side room, so nothing pokes
            out. Closed: an acid fill-block with ink text (the whitelisted acid
            use) that reads as the one invitation to talk. Open: recedes to an
            ink-filled OCULTAR control. Count renders only when > 0. Hidden on
            mobile — comments are reachable via the bottom-bar COMENTARIOS
            button instead. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setCommentsOpen((o) => !o)
          }}
          aria-expanded={commentsOpen}
          aria-label={commentsOpen ? 'Ocultar comentarios' : 'Mostrar comentarios'}
          className={`absolute right-0 top-1/2 z-30 hidden w-11 -translate-y-1/2 items-center justify-center border border-ink py-4 font-mono text-d11 font-bold uppercase tracking-widest transition-colors sm:flex ${
            commentsOpen
              ? 'bg-ink text-paper hover:bg-paper hover:text-ink'
              : 'bg-acid text-ink hover:bg-ink hover:text-acid'
          } ${FOCUS_RING}`}
          style={{ writingMode: 'vertical-rl' }}
        >
          {commentsOpen ? (
            <span>OCULTAR</span>
          ) : (
            <span>
              COMENTARIOS
              {commentsTotal > 0 && !commentsLoading ? ` · ${commentsTotal}` : ''}
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
              className="hidden min-w-0 flex-col overflow-hidden border border-ink bg-paper text-ink sm:flex"
              style={{
                maxHeight: 'min(92dvh, 900px)',
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

      {/* Mobile comments — full-screen sheet (the desktop split column above is
          hidden < sm). Reuses the same CommentsColumn body + shell context, so
          the live count, threaded list, and composer all work. Opened from the
          bottom-bar COMENTARIOS button (and any in-body entry that flips
          commentsOpen, e.g. ReaderOverlay's). */}
      {commentsOpen && (
        <div
          className="overlay-backdrop-in fixed inset-0 z-[60] flex flex-col bg-paper text-ink sm:hidden"
          style={{ height: '100dvh', paddingBottom: 'env(safe-area-inset-bottom)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Comentarios"
        >
          <CommentsColumn
            item={item}
            onClose={() => setCommentsOpen(false)}
            focusedCommentId={focusedCommentId}
          />
        </div>
      )}
    </OverlayShellContext.Provider>
  )
}

// ── Session item strip ──────────────────────────────────────────────────────
// Draft/published session banner in the paper grammar: ink chips throughout;
// the only state accent is the acid dot-badge (≥8px, 1px ink outline) on
// drafts — no pulsing dots, no glow.
function SessionItemStrip({
  item,
  onDeleted,
}: {
  item: ContentItem
  onDeleted: () => void
}) {
  const isDraft = item._draftState === 'draft'
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
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-ink bg-paper-raised px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {isDraft && (
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full border border-ink bg-acid"
          />
        )}
        <span className="truncate font-mono text-d11 font-bold tracking-widest text-ink">
          {label}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleEdit}
          className={`flex min-h-11 items-center gap-1.5 border border-ink px-2.5 font-mono text-d11 font-bold tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
        >
          <Pencil size={11} />
          EDITAR
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className={`flex min-h-11 items-center gap-1.5 border border-sys-red-paper px-2.5 font-mono text-d11 font-bold tracking-widest text-sys-red-paper transition-colors hover:bg-sys-red-paper hover:text-paper-raised ${FOCUS_RING}`}
        >
          <Trash2 size={11} />
          ELIMINAR
        </button>
        {isDraft && (
          <button
            type="button"
            onClick={handlePublish}
            className={`flex min-h-11 items-center gap-1.5 border border-ink bg-ink px-3 font-mono text-d11 font-bold tracking-widest text-paper transition-colors hover:bg-paper hover:text-ink ${FOCUS_RING}`}
          >
            ▶ PUBLICAR AHORA
          </button>
        )}
      </div>
    </div>
  )
}
