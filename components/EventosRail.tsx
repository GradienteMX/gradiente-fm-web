'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ContentItem } from '@/lib/types'
import { useOverlay } from '@/components/overlay/useOverlay'
import { useVibe } from '@/context/VibeContext'
import { isExpired } from '@/lib/utils'
import { franjaAttributionPrefix } from '@/lib/franjaAttribution'
import { recordItems } from '@/lib/itemsCache'
import { SmartImage } from '@/components/SmartImage'

// Compact rail tile — denser than the mosaic ContentCard so 5-7 fit on-screen
// at desktop width. Click → same EventoOverlay path as mosaic cards (matches
// the contained-single-surface UX). Paper frame; the flyer stays dark inside
// it — that's the ink-bleed the print ground allows.
function EventoRailCard({
  item,
  onOpen,
}: {
  item: ContentItem
  onOpen: (slug: string, rect?: DOMRect) => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const d = item.date ? parseISO(item.date) : null
  // Recently-passed events show up in the rail thanks to filterForHome's
  // grace window — visually demote them so they read as historical, not
  // upcoming. Same vocabulary as the PASADO ribbon in FranjaOverlay's
  // ARCHIVO section.
  const past = isExpired(item)

  return (
    <button
      ref={ref}
      onClick={() => onOpen(item.slug, ref.current?.getBoundingClientRect())}
      className="group relative w-[180px] shrink-0 overflow-hidden border border-ink bg-paper-raised text-left focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      aria-label={`Abrir evento ${item.title}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden border-b border-ink">
        {item.imageUrl ? (
          <SmartImage
            src={item.imageUrl}
            alt=""
            sizes="(max-width: 768px) 45vw, 220px"
            className={`object-cover object-top ${
              past ? 'opacity-60 grayscale-[40%]' : ''
            }`}
          />
        ) : (
          <div className="h-full w-full bg-ink" />
        )}

        {past && (
          <span className="absolute left-2 top-2 border border-ink-faint bg-paper-raised px-1.5 py-0.5 font-mono text-d11 uppercase tracking-widest text-ink-faint">
            PASADO
          </span>
        )}

        {/* Printed date chip — mono month, Syne day, mono weekday */}
        {d && (
          <div className="absolute right-2 top-2 border border-ink bg-paper-raised px-1.5 py-1 text-center font-mono text-ink">
            <div className="text-d11 font-bold uppercase tracking-widest">
              {format(d, 'MMM', { locale: es }).toUpperCase()}
            </div>
            <div className="font-syne text-d18 font-black leading-none tabular-nums">
              {format(d, 'd')}
            </div>
            <div className="text-d11 font-bold uppercase tracking-widest">
              {format(d, 'EEE', { locale: es }).toUpperCase()}
            </div>
          </div>
        )}
      </div>

      <div className="p-2.5">
        <h3 className="line-clamp-2 font-mono text-d11 font-bold leading-tight text-ink transition-colors group-hover:bg-ink group-hover:text-paper">
          {item.title}
        </h3>
        {item.venue && (
          <p className="mt-1 line-clamp-1 font-mono text-d11 tracking-wide text-ink-faint">
            {item.venue}
          </p>
        )}
        {/* Franja attribution — same vocabulary as the mosaic chip. Skip
            rendering on partial data (defensive — matches the mosaic chip's
            guard). Non-clickable here — the whole tile is a button that opens
            the overlay; the line just provides at-a-glance attribution. */}
        {item.franja && item.franja.title && (
          <p
            className="mt-1 line-clamp-1 font-mono text-d11 uppercase tracking-widest text-sys-red-paper"
            title={`Publicado por ${item.franja.title}`}
          >
            {franjaAttributionPrefix(item.franja.kind)} ·{' '}
            {item.franja.title.toUpperCase()}
          </p>
        )}
      </div>
    </button>
  )
}

interface EventosRailProps {
  items: ContentItem[]
}

// EventosRail — the AGENDA rail: auto-scrolling marquee of scraped events,
// mounted between the HeroCard and the main mosaic. Solves the "128 events
// flooding the grid" problem (see wiki/log.md 2026-05-01) by giving
// high-volume scraped agenda content its own surface, leaving the mosaic for
// editorial + editor-elevated events. Pauses on hover/focus so users can
// target a card.
export function EventosRail({ items }: EventosRailProps) {
  const { open } = useOverlay()
  const { categoryFilter } = useVibe()

  // The marquee duplicates the card set so the auto-scroll wrap (at
  // scrollWidth/2) is seamless. That's only correct when the single set is
  // WIDER than the viewport — otherwise the duplicate copy is visible on-screen
  // and reads as "every event listed twice" (acute with just 1-2 events). So we
  // only loop+duplicate when the cards actually overflow; few events render once
  // and sit still.
  const [loop, setLoop] = useState(false)

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

  // Prime the slug→item cache so the overlay can resolve rail-event clicks.
  // Rail events are rail-ONLY (excluded from the mosaic), so ContentGrid never
  // records them — without this, clicking a rail card resolves to no item and
  // the overlay never opens.
  useEffect(() => {
    recordItems(items)
  }, [items])

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

  // ‹ › page buttons — scroll the track by one viewport width. Smooth unless
  // the user prefers reduced motion; either way the auto-scroll pauses so the
  // page the user asked for stays put long enough to read.
  const pageBy = (dir: -1 | 1) => {
    const track = trackRef.current
    if (!track) return
    stateRef.current.pausedUntil = performance.now() + PAUSE_AFTER_INTERACTION_MS
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    track.scrollBy({
      left: dir * track.clientWidth,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    // Nothing to auto-scroll when the set fits on-screen (not duplicated).
    if (!loop) return

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
    // hiddenByCategoryFilter is in the dep array so the effect re-runs
    // (and re-attaches listeners to the freshly-mounted track DOM) when
    // the user toggles back from a non-event section. Without it, the
    // first cleanup removes listeners from the old DOM on unmount, the
    // new DOM mounts on re-show, but no effect re-fires to wire it up —
    // drag-to-scroll silently dies.
  }, [sorted.length, hiddenByCategoryFilter, loop])

  // Decide whether the rail needs the duplicated marquee: only when the single
  // card set is wider than the viewport. Card = 180px + 8px gap. Re-measures on
  // resize so it stays correct across breakpoints / window changes.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const CARD_PX = 188
    const measure = () => setLoop(sorted.length * CARD_PX > track.clientWidth + 8)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    return () => ro.disconnect()
  }, [sorted.length, hiddenByCategoryFilter])

  // Category-filtered to a non-evento section → hide the rail entirely (the
  // user asked to see only that section). But when there are simply no upcoming
  // events, KEEP the rail mounted with an empty-state — it must never just
  // vanish (that reads as broken). The agenda repopulates on the next scraper
  // run; until then this placeholder holds its space.
  if (hiddenByCategoryFilter) return null

  const empty = sorted.length === 0

  return (
    <section className="my-4" aria-label="Agenda de eventos">
      {/* Header row on a hairline — red AGENDA kicker, honest count, and the
          ‹ › page buttons (only when the set actually overflows). */}
      <div className="mb-2 flex items-center gap-x-3 border-b border-ink pb-1 font-mono text-d11 uppercase tracking-widest">
        <span>
          <span className="font-bold text-sys-red-paper">AGENDA</span>
          <span className="text-ink"> · PRÓXIMOS EVENTOS</span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          {sorted.length > 0 && (
            <span className="text-ink-faint">{sorted.length} EVENTOS</span>
          )}
          {loop && (
            <>
              <button
                type="button"
                onClick={() => pageBy(-1)}
                aria-label="Página anterior"
                className="flex h-11 w-11 items-center justify-center border border-ink font-mono text-d15 text-ink transition-colors hover:bg-ink hover:text-paper focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => pageBy(1)}
                aria-label="Página siguiente"
                className="flex h-11 w-11 items-center justify-center border border-ink font-mono text-d15 text-ink transition-colors hover:bg-ink hover:text-paper focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                ›
              </button>
            </>
          )}
        </span>
      </div>

      {empty ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-ink px-4 py-5">
          <p className="font-mono text-d11 leading-relaxed text-ink-soft">
            <span className="block font-bold uppercase tracking-widest text-ink">
              AGENDA VACÍA
            </span>
            No hay eventos próximos por ahora.
          </p>
          <Link
            href="/agenda"
            className="flex min-h-11 items-center border border-ink px-3 font-mono text-d11 uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            VER AGENDA →
          </Link>
        </div>
      ) : (
        <div className="relative">
          <div
            ref={trackRef}
            className="evento-rail-track flex cursor-grab gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain"
            // Hide native scrollbar (Firefox + WebKit) — auto-scroll motion +
            // edge fades carry the affordance; the bar adds visual noise.
            style={{ scrollbarWidth: 'none' }}
          >
            {(loop ? [...sorted, ...sorted] : sorted).map((item, i) => (
              <EventoRailCard
                key={`${item.id}-${i}`}
                item={item}
                onOpen={handleOpen}
              />
            ))}
          </div>
          {/* Edge fades — signal off-screen content + soften the wrap seam */}
          <div className="pointer-events-none absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-paper to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-paper to-transparent" />
        </div>
      )}
    </section>
  )
}
