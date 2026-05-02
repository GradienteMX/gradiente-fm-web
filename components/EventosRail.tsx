'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ContentItem } from '@/lib/types'
import { useOverlay } from '@/components/overlay/useOverlay'
import { useVibe } from '@/context/VibeContext'
import { categoryColor } from '@/lib/utils'

const EVENT_RED = categoryColor('evento')

// Compact rail card — denser than the mosaic ContentCard so 5-7 fit on-screen
// at desktop width. Click → same EventoOverlay path as mosaic cards (matches
// the contained-single-surface UX).
function EventoRailCard({
  item,
  onOpen,
}: {
  item: ContentItem
  onOpen: (slug: string, rect?: DOMRect) => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const d = item.date ? parseISO(item.date) : null

  return (
    <button
      ref={ref}
      onClick={() => onOpen(item.slug, ref.current?.getBoundingClientRect())}
      className="group relative w-[180px] shrink-0 overflow-hidden border border-border bg-elevated text-left transition-colors hover:border-white/30 focus:outline-none focus:border-white/50"
      aria-label={`Abrir evento ${item.title}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-base" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

        <span
          className="absolute left-2 top-2 bg-black/70 px-1.5 py-0.5 font-mono text-[9px] tracking-widest backdrop-blur-sm"
          style={{ color: EVENT_RED }}
        >
          //EVENTO
        </span>

        {d && (
          <div className="absolute right-2 top-2 border border-white/20 bg-black/70 px-1.5 py-1 text-center font-mono backdrop-blur-sm">
            <div className="text-[8px] tracking-widest text-muted">
              {format(d, 'MMM', { locale: es }).toUpperCase()}
            </div>
            <div className="text-base font-bold leading-none tabular-nums text-white">
              {format(d, 'd')}
            </div>
            <div className="text-[7px] tracking-widest text-muted/80">
              {format(d, 'EEE', { locale: es }).toUpperCase()}
            </div>
          </div>
        )}
      </div>
      <div className="p-2.5">
        <h3 className="line-clamp-2 font-syne text-xs font-bold leading-tight text-white">
          {item.title}
        </h3>
        {item.venue && (
          <p className="mt-1 line-clamp-1 font-mono text-[9px] tracking-wide text-muted">
            {item.venue}
          </p>
        )}
      </div>
    </button>
  )
}

interface EventosRailProps {
  items: ContentItem[]
}

// EventosRail — auto-scrolling marquee of scraped events, mounted between the
// HeroCard and the main mosaic. Solves the "128 events flooding the grid"
// problem (see wiki/log.md 2026-05-01) by giving high-volume scraped agenda
// content its own surface, leaving the mosaic for editorial + editor-elevated
// events. Pauses on hover/focus so users can target a card.
export function EventosRail({ items }: EventosRailProps) {
  const { open } = useOverlay()
  const { categoryFilter } = useVibe()

  // Hide the rail when the user has filtered to a category other than events
  // (mix / editorial / noticia / etc.) — they explicitly asked to NOT see
  // events. When filter is null OR 'evento', the rail is visible. Mirrors
  // the HeroCard filter-respect pattern.
  const hiddenByCategoryFilter =
    categoryFilter !== null && categoryFilter !== 'evento'

  const sorted = useMemo(
    () =>
      items
        .filter((i) => i.type === 'evento' && !!i.date)
        .sort(
          (a, b) =>
            parseISO(a.date as string).getTime() -
            parseISO(b.date as string).getTime(),
        ),
    [items],
  )

  const handleOpen = (slug: string, rect?: DOMRect) => {
    open(
      slug,
      rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : undefined,
    )
  }

  // Auto-scroll loop. Driving scrollLeft via rAF (rather than CSS transform)
  // means manual scroll/swipe/wheel and auto-scroll cooperate on the same
  // property — users can backtrack to a card they missed without waiting for
  // the next cycle, and auto-scroll resumes from wherever they left off.
  // Cards are duplicated below so wrapping at scrollWidth/2 is invisible.
  const trackRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ pausedUntil: 0, hovered: false })
  const SCROLL_SPEED_PX_PER_SEC = 35  // tuned for "background motion" feel — readable at a glance
  const PAUSE_AFTER_INTERACTION_MS = 1500  // wheel / touch — user is likely reading a card
  const PAUSE_AFTER_DRAG_MS = 500          // user just repositioned the rail; resume quickly

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    // Honor reduced-motion: no auto-scroll, manual scroll still works.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return

    let raf = 0
    let lastTime = performance.now()
    // scrollLeft on most engines rounds to integers. At high refresh rates
    // (120Hz+) the per-frame delta is sub-pixel and rounds to 0 every frame,
    // freezing the rail. Keep a fractional accumulator and only commit whole
    // pixels — the fraction carries across frames regardless of refresh rate.
    let accum = 0

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000
      lastTime = now
      const s = stateRef.current
      if (!s.hovered && now > s.pausedUntil) {
        accum += SCROLL_SPEED_PX_PER_SEC * dt
        const whole = Math.floor(accum)
        if (whole > 0) {
          track.scrollLeft += whole
          accum -= whole
        }
        // Seamless wrap — content is doubled, so subtracting half-width
        // lands on a visually identical position.
        const halfWidth = track.scrollWidth / 2
        if (halfWidth > 0 && track.scrollLeft >= halfWidth) {
          track.scrollLeft -= halfWidth
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const pauseFor = (ms: number) => {
      stateRef.current.pausedUntil = performance.now() + ms
    }
    const onWheel = () => pauseFor(PAUSE_AFTER_INTERACTION_MS)
    const onTouchStart = () => pauseFor(PAUSE_AFTER_INTERACTION_MS)
    const onMouseEnter = () => { stateRef.current.hovered = true }
    const onMouseLeave = () => { stateRef.current.hovered = false }
    const onFocusIn = () => { stateRef.current.hovered = true }
    const onFocusOut = () => { stateRef.current.hovered = false }

    // Click-and-drag scroll. Native overflow-x: auto handles touch/trackpad
    // but not mouse drag; Windows-with-mouse users had no horizontal scroll
    // affordance. Pointer events unify mouse / touch / pen. We swallow the
    // click at pointerup if the user actually dragged (>DRAG_THRESHOLD_PX),
    // so card click-to-open still works for genuine taps.
    const DRAG_THRESHOLD_PX = 5
    let dragStartX = 0
    let dragStartScroll = 0
    let pointerId: number | null = null
    let dragged = false

    const onPointerDown = (e: PointerEvent) => {
      pauseFor(PAUSE_AFTER_INTERACTION_MS)
      // Only primary button for mouse; touch/pen always pass
      if (e.pointerType === 'mouse' && e.button !== 0) return
      pointerId = e.pointerId
      dragStartX = e.clientX
      dragStartScroll = track.scrollLeft
      dragged = false
    }
    const onPointerMove = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return
      const dx = e.clientX - dragStartX
      if (!dragged && Math.abs(dx) < DRAG_THRESHOLD_PX) return
      if (!dragged) {
        dragged = true
        try { track.setPointerCapture(e.pointerId) } catch {}
        track.style.cursor = 'grabbing'
      }
      track.scrollLeft = dragStartScroll - dx
      pauseFor(PAUSE_AFTER_INTERACTION_MS)
    }
    const endDrag = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return
      if (dragged) {
        // Guard: hasPointerCapture/releasePointerCapture can throw if the
        // pointer was never captured (e.g., setPointerCapture failed silently
        // during a synthetic event or the element was reattached).
        try { if (track.hasPointerCapture?.(e.pointerId)) track.releasePointerCapture(e.pointerId) } catch {}
        track.style.cursor = ''
        // Override the 1500ms pause that pointermove was refreshing — after
        // release, a short grace period feels right.
        pauseFor(PAUSE_AFTER_DRAG_MS)
      }
      pointerId = null
    }
    const onClickCapture = (e: MouseEvent) => {
      // If the pointerup that just fired was the end of a drag, suppress the
      // click that would otherwise open an overlay.
      if (dragged) {
        e.stopPropagation()
        e.preventDefault()
        dragged = false
      }
    }

    track.addEventListener('wheel', onWheel, { passive: true })
    track.addEventListener('touchstart', onTouchStart, { passive: true })
    track.addEventListener('mouseenter', onMouseEnter)
    track.addEventListener('mouseleave', onMouseLeave)
    track.addEventListener('focusin', onFocusIn)
    track.addEventListener('focusout', onFocusOut)
    track.addEventListener('pointerdown', onPointerDown)
    track.addEventListener('pointermove', onPointerMove)
    track.addEventListener('pointerup', endDrag)
    track.addEventListener('pointercancel', endDrag)
    track.addEventListener('click', onClickCapture, true)

    return () => {
      cancelAnimationFrame(raf)
      track.removeEventListener('wheel', onWheel)
      track.removeEventListener('touchstart', onTouchStart)
      track.removeEventListener('mouseenter', onMouseEnter)
      track.removeEventListener('mouseleave', onMouseLeave)
      track.removeEventListener('focusin', onFocusIn)
      track.removeEventListener('focusout', onFocusOut)
      track.removeEventListener('pointerdown', onPointerDown)
      track.removeEventListener('pointermove', onPointerMove)
      track.removeEventListener('pointerup', endDrag)
      track.removeEventListener('pointercancel', endDrag)
      track.removeEventListener('click', onClickCapture, true)
    }
  }, [sorted.length])

  if (sorted.length === 0 || hiddenByCategoryFilter) return null

  return (
    <section className="my-4" aria-label="Agenda de eventos">
      <div className="nge-divider mb-1 flex items-center gap-2">
        <Calendar size={12} strokeWidth={1.5} style={{ color: EVENT_RED }} />
        <span
          className="font-mono text-xs tracking-widest"
          style={{ color: EVENT_RED }}
        >
          //AGENDA
        </span>
        <span className="ml-auto flex items-center gap-2 font-mono text-[10px] tracking-widest text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-green" />
          {sorted.length} EVENTOS · LIVE FEED · RA
        </span>
      </div>
      <p className="sys-label mb-2">
        PRÓXIMOS · ORDEN CRONOLÓGICO · ARRASTRA O ESPERA · CLICK PARA DETALLE
      </p>

      <div className="relative">
        <div
          ref={trackRef}
          className="evento-rail-track flex cursor-grab gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain"
          // Hide native scrollbar (Firefox + WebKit) — auto-scroll motion +
          // edge fades carry the affordance; the bar adds visual noise.
          style={{ scrollbarWidth: 'none' }}
        >
          {[...sorted, ...sorted].map((item, i) => (
            <EventoRailCard
              key={`${item.id}-${i}`}
              item={item}
              onOpen={handleOpen}
            />
          ))}
        </div>
        {/* Edge fades — signal off-screen content + soften the wrap seam */}
        <div className="pointer-events-none absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-base to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-base to-transparent" />
      </div>
    </section>
  )
}
