'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ContentItem } from '@/lib/types'
import { useVibe } from '@/context/VibeContext'
import { HeroCard } from '@/components/HeroCard'

// ── HeroCarousel — PORTADA as a rotating front page ─────────────────────────
//
// Every pinned item (any type but franja) takes a turn in the hero frame.
// Same mechanics as EventosRail: a NATIVE horizontal scroll track, so the
// auto-advance, the ‹ › keys, a trackpad swipe and a touch drag all move the
// same property and cooperate — a reader can drag back to the slide they
// missed and the rotation resumes from wherever they left it. Slides are
// full-width with scroll-snap, so one piece is on the page at a time and the
// portada keeps its weight; the motion between them is the browser's own
// smooth scroll, not a crossfade.
//
// Seamless wrap: the first slide is cloned at the end. When the track lands
// on the clone it jumps (instantly, invisibly) back to the real first slide.
//
// Pauses: pointer or focus on the frame, hidden tab, the reader's ❚❚ key, and
// a grace window after any manual interaction. Reduced motion: no auto-
// advance, instant jumps. The category filter narrows the set in place.

const DWELL_MS = 9000
const PAUSE_AFTER_INTERACTION_MS = 4000

export function HeroCarousel({ items }: { items: ContentItem[] }) {
  const { categoryFilter } = useVibe()
  const visible = categoryFilter ? items.filter((i) => i.type === categoryFilter) : items
  const total = visible.length
  const loop = total > 1
  const slides = loop ? [...visible, visible[0]] : visible

  const trackRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ hovered: false, pausedUntil: 0 })
  const [index, setIndex] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    const onVisibility = () => setHidden(document.visibilityState === 'hidden')
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      mq.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Instant, invisible reposition (used for the wrap). Temporarily drops the
  // track's smooth behaviour so the jump cannot be seen as a reverse sweep.
  const jumpTo = useCallback((left: number) => {
    const track = trackRef.current
    if (!track) return
    const prev = track.style.scrollBehavior
    track.style.scrollBehavior = 'auto'
    track.scrollLeft = left
    // Restore on the next frame so the assignment above is not smoothed.
    requestAnimationFrame(() => { track.style.scrollBehavior = prev })
  }, [])

  const scrollToSlide = useCallback(
    (i: number) => {
      const track = trackRef.current
      if (!track) return
      track.scrollTo({ left: i * track.clientWidth, behavior: reducedMotion ? 'auto' : 'smooth' })
    },
    [reducedMotion],
  )

  // Index follows the real scroll position (drag, swipe, keys, auto — all the
  // same source of truth). Landing on the clone wraps to the real first slide.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const w = track.clientWidth || 1
        const pos = track.scrollLeft / w
        const nearest = Math.round(pos)
        if (loop && nearest === total && Math.abs(track.scrollLeft - total * w) < 2) {
          jumpTo(0)
          setIndex(0)
          return
        }
        setIndex(Math.max(0, Math.min(total - 1, nearest)))
      })
    }
    track.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      track.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [loop, total, jumpTo])

  // A manual gesture buys a grace window before the rotation resumes.
  const touch = () => { stateRef.current.pausedUntil = performance.now() + PAUSE_AFTER_INTERACTION_MS }

  const go = useCallback(
    (dir: 1 | -1) => {
      const track = trackRef.current
      if (!track || !loop) return
      touch()
      const w = track.clientWidth || 1
      const current = Math.round(track.scrollLeft / w)
      if (dir === -1 && current <= 0) {
        // Backwards from the first slide: land on the clone instantly, then
        // sweep to the real last slide.
        jumpTo(total * w)
        requestAnimationFrame(() => scrollToSlide(total - 1))
        return
      }
      scrollToSlide(current + dir)
    },
    [loop, total, jumpTo, scrollToSlide],
  )

  // Auto-advance tick — checked every 250ms against the pause conditions so a
  // grace window that expires mid-dwell does not have to wait a full cycle.
  const lastAdvanceRef = useRef(performance.now())
  useEffect(() => {
    if (!loop || userPaused || hidden || reducedMotion) return
    lastAdvanceRef.current = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const s = stateRef.current
      if (s.hovered || now < s.pausedUntil) {
        lastAdvanceRef.current = now
        return
      }
      if (now - lastAdvanceRef.current < DWELL_MS) return
      lastAdvanceRef.current = now
      const track = trackRef.current
      if (!track) return
      const w = track.clientWidth || 1
      scrollToSlide(Math.round(track.scrollLeft / w) + 1)
    }, 250)
    return () => window.clearInterval(id)
  }, [loop, userPaused, hidden, reducedMotion, scrollToSlide])

  if (total === 0) return null

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label="Portada"
      className="relative mb-6"
      onMouseEnter={() => { stateRef.current.hovered = true }}
      onMouseLeave={() => { stateRef.current.hovered = false }}
      onFocusCapture={() => { stateRef.current.hovered = true }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) stateRef.current.hovered = false
      }}
    >
      <div
        ref={trackRef}
        onWheel={touch}
        onTouchStart={touch}
        onPointerDown={touch}
        className={`flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          reducedMotion ? '' : 'scroll-smooth'
        }`}
      >
        {slides.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            className="w-full shrink-0 snap-start"
            aria-hidden={loop && i === total ? true : undefined}
          >
            <HeroCard
              item={item}
              slot={{
                index: loop && i === total ? 0 : Math.min(i, total - 1),
                total,
                paused: userPaused,
                autoRotates: loop && !reducedMotion,
                onPrev: () => go(-1),
                onNext: () => go(1),
                onTogglePause: () => setUserPaused((p) => !p),
              }}
              live={index === (loop && i === total ? 0 : i)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
