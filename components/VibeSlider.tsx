'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { useVibe } from '@/context/VibeContext'
import { VIBE_SLOT_COLORS, VIBE_SLOT_NAMES } from '@/lib/utils'
import { GENRE_VIBE, getGenreById, getRollup, getRootGenres } from '@/lib/genres'

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}

// GENRE_VIBE moved to lib/genres.ts so the foro catalog can share it for
// vibe-filtering threads via their tagged genres.

// Station dial (redesign 2026). Three layers, strict roles:
//   PLATE — printed scale: numerals + slot names at fixed band centers.
//           Never moves; in-range labels brighten ("lit plate"), nothing else.
//   TAPE  — phosphor dash field colored in 11 HARD slot bands (no per-dash
//           lerp). In-range dashes lit; out-of-range dim to a low-alpha
//           version of their OWN hue (unlit LEDs on a calibrated scale).
//   NEEDLES — the two range handles. Only the needles move.
const MID_COUNT = 120
const EDGE_COUNT = 40
const SLOT_COUNT = 11

// Integer-based hash (Math.imul) — bit-exact across JS engines, avoiding SSR/client drift.
function hash01(seed: number, salt: number): number {
  let x = Math.imul(seed | 0, 2654435761) ^ Math.imul(salt | 0, 1597334677)
  x = Math.imul(x ^ (x >>> 16), 2246822519) | 0
  x = Math.imul(x ^ (x >>> 13), 3266489917) | 0
  x = x ^ (x >>> 16)
  return (x >>> 0) / 4294967296
}

// Value→position: integer slot v sits at the CENTER of its band, so a
// detented needle points exactly at its printed numeral. The inverse mapping
// lives in getValueFromX.
function slotCenterPct(v: number): number {
  return ((v + 0.5) / SLOT_COUNT) * 100
}

// Release snap with magnetic edges: slots 0 and 10 capture a wider window
// (±0.65) than interior slots (±0.5) so the extremes are generous targets.
function snapToSlot(v: number): number {
  if (v <= 0.65) return 0
  if (v >= 9.35) return 10
  return Math.round(v)
}

type Dash = { leftPct: number; bottomPct: number; heightPx: number; slot: number }

const DASHES: Dash[] = (() => {
  const arr: Dash[] = []
  const makeRow = (count: number, bottomPct: number, halfStep: boolean, hLo: number, hHi: number, salt: number) => {
    for (let i = 0; i < count; i++) {
      const t = (i + (halfStep ? 0.5 : 0)) / count
      if (t > 0.995) continue
      arr.push({
        // Full-scale x — dash bands must line up with the plate's printed
        // centers (slotCenterPct shares this 0–100 mapping). The 0.995 cutoff
        // keeps the last dash from overflowing the track's right edge.
        leftPct: Math.round(t * 10000) / 100,
        bottomPct,
        heightPx: hLo + Math.floor(hash01(i, salt) * (hHi - hLo + 1)),
        // Hard band assignment — every dash belongs to exactly one slot.
        slot: Math.min(10, Math.floor(t * SLOT_COUNT)),
      })
    }
  }
  makeRow(MID_COUNT, 50, false, 4, 6, 10)  // middle: dense, thicker dashes → continuous baseline
  makeRow(EDGE_COUNT, 68, false, 3, 5, 20) // top: sparser
  makeRow(EDGE_COUNT, 32, true,  3, 5, 30) // bottom: half-step offset from top → saw alternation
  return arr
})()

// Ballistics + detent transitions collapse to instant under reduced motion.
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function VibeSlider() {
  // Hide on dashboard + admin surfaces — neither is a content feed and
  // neither uses vibe filtering. /foro IS a feed (threads tagged with
  // 1–5 genres each filter by the shared vibe range), so the slider
  // stays there.
  const pathname = usePathname()
  if (pathname?.startsWith('/dashboard')) return null
  if (pathname?.startsWith('/admin')) return null

  return <VibeSliderImpl />
}

function VibeSliderImpl() {
  const { vibeRange, setVibeRange, genreFilter, toggleGenre, visibleGenres } = useVibe()
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<'min' | 'max' | null>(null)
  // Drag-end on the track also fires a click — suppress it so releasing a
  // needle between the two handles can't teleport the OTHER handle.
  const justDraggedRef = useRef(false)
  const rangeRef = useRef(vibeRange)
  rangeRef.current = vibeRange
  // State mirror of draggingRef — switches the needle's left-transition off
  // while dragging (instant follow) and back on for the detent overshoot.
  const [dragHandle, setDragHandle] = useState<'min' | 'max' | null>(null)
  const reducedMotion = usePrefersReducedMotion()

  // The chip strip is hidden by default. Two ways to reveal it:
  //   - Pin button (manual override — stays open until unpinned).
  //   - Recent interaction (transient — fades back out ~2s after the user
  //     stops moving the slider OR toggling chips). The transient mode
  //     replaced an older "always visible when narrowed" rule that left
  //     the chip strip cluttering the surface long after the user had
  //     committed to a range and moved on to scrolling the feed.
  // Active (orange) filter chips always stay visible — the user needs a
  // way to see what they've filtered on and clear it. NON-active chips
  // are gated by the same interaction window, so once the user has
  // committed a filter, the surface settles to just the orange chips and
  // hides the rest of the candidates.
  const [pinned, setPinned] = useState(false)
  const [recentInteraction, setRecentInteraction] = useState(false)
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstInteractionRender = useRef(true)

  const [min, max] = vibeRange
  const activeFilterCount = genreFilter.length

  // Interaction tracker. Each slider [min, max] change OR chip toggle
  // (activeFilterCount change) extends the visibility window — so
  // continuous dragging keeps chips open, and clicking a chip resets
  // the timer so the user can immediately see and pick another one.
  // The 2s countdown only really starts after the last action. The
  // isFirstInteractionRender guard skips the mount-time pseudo-"change"
  // so chips don't flash open on page load.
  useEffect(() => {
    if (isFirstInteractionRender.current) {
      isFirstInteractionRender.current = false
      return
    }
    setRecentInteraction(true)
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current)
    interactionTimerRef.current = setTimeout(() => {
      setRecentInteraction(false)
    }, 2000)
    return () => {
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current)
    }
  }, [min, max, activeFilterCount])

  const getValueFromX = (clientX: number): number => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    // Inverse of slotCenterPct — edge half-bands clamp to 0 / 10, which
    // makes the extremes generous hit targets by construction.
    return clamp(ratio * SLOT_COUNT - 0.5, 0, 10)
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return
      const val = getValueFromX(e.clientX)
      const [curMin, curMax] = rangeRef.current
      if (draggingRef.current === 'min') {
        setVibeRange([Math.min(val, curMax), curMax])
      } else {
        setVibeRange([curMin, Math.max(val, curMin)])
      }
    }
    // Detent: drag is continuous; release snaps the dragged needle to the
    // nearest integer slot (magnetic at 0 / 10). The needle's overshoot
    // transition (see needleTransition) makes the snap read as a felt click.
    const onUp = () => {
      const which = draggingRef.current
      if (!which) return
      draggingRef.current = null
      setDragHandle(null)
      // The drag-end click (if any) fires before timers run, so this guard
      // covers exactly one click and self-clears when the release happens
      // off-track and no click follows.
      justDraggedRef.current = true
      setTimeout(() => {
        justDraggedRef.current = false
      }, 0)
      const [curMin, curMax] = rangeRef.current
      if (which === 'min') {
        setVibeRange([Math.min(snapToSlot(curMin), Math.round(curMax)), curMax])
      } else {
        setVibeRange([curMin, Math.max(snapToSlot(curMax), Math.round(curMin))])
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setVibeRange])

  // min/max are continuous floats only DURING a drag (release snaps them).
  // Slot-quantized values drive the lit bands, the plate and the readout, so
  // whole bands flip as the needle crosses detent boundaries — stepped, not
  // smeared.
  const minSlot = Math.round(min)
  const maxSlot = Math.round(max)
  const minPercent = slotCenterPct(min)
  const maxPercent = slotCenterPct(max)
  const isFullRange = min === 0 && max === 10

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false
      return
    }
    const val = getValueFromX(e.clientX)
    const slot = snapToSlot(val)
    const [curMin, curMax] = rangeRef.current
    const dMin = Math.abs(val - curMin)
    const dMax = Math.abs(val - curMax)
    if (dMin <= dMax) {
      setVibeRange([Math.min(slot, Math.round(curMax)), curMax])
    } else {
      setVibeRange([curMin, Math.max(slot, Math.round(curMin))])
    }
  }

  // Arrow-key stepping — one detent per press, clamped against the other
  // needle. Home/End jump to the magnetic extremes.
  const handleKeyDown = (which: 'min' | 'max') => (e: React.KeyboardEvent) => {
    let delta: number
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -1
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = 1
    else if (e.key === 'Home') delta = -SLOT_COUNT
    else if (e.key === 'End') delta = SLOT_COUNT
    else return
    e.preventDefault()
    const [curMin, curMax] = rangeRef.current
    if (which === 'min') {
      setVibeRange([clamp(Math.round(curMin) + delta, 0, Math.round(curMax)), curMax])
    } else {
      setVibeRange([curMin, clamp(Math.round(curMax) + delta, Math.round(curMin), 10)])
    }
  }

  // PPM ballistics: fast attack when a band lights, slow decay when it dims.
  // Per-element duration is chosen by the lit-state it is transitioning INTO.
  const litDuration = (lit: boolean): string =>
    reducedMotion ? '0ms' : lit ? '100ms' : '600ms'
  // Needle: instant follow while dragging; overshoot ease on release/step so
  // the integer snap reads as a detent click. Reduced motion → no positional
  // animation at all.
  const needleTransition = (active: boolean): string =>
    reducedMotion || active ? 'none' : 'left 200ms cubic-bezier(0.3, 1.6, 0.5, 1)'

  // Universe of chips: top-level parent categories (always — for
  // broad-stroke "show me all techno" filtering) + the genres actually
  // present in the feed + currently active filters. Active stays in the
  // set even if outside the feed so the user can clear it.
  const activeIds = genreFilter
  // `visibleGenres` is what ContentGrid pushes — the union of genres
  // across items currently passing the vibe (and category) filter. When
  // present, it's the source of truth for "is this chip in the feed".
  // When null (page has no ContentGrid yet — e.g. /foro), fall back to
  // GENRE_VIBE keys so the slider isn't dead on first paint.
  const feedSet = visibleGenres !== null ? new Set(visibleGenres) : null
  const fallbackUniverse = visibleGenres ?? Object.keys(GENRE_VIBE)
  const allGenreIds = Array.from(
    new Set([
      ...getRootGenres().map((g) => g.id),
      ...fallbackUniverse,
      ...activeIds,
    ]),
  )
  // Order: active filters first (always visible), then sorted by ascending
  // default vibe so the chip row roughly mirrors the slider's left→right
  // gradient when fully expanded.
  const sortedGenreIds = [
    ...activeIds.filter((id) => allGenreIds.includes(id)),
    ...allGenreIds
      .filter((id) => !activeIds.includes(id))
      .sort((a, b) => (GENRE_VIBE[a] ?? 5) - (GENRE_VIBE[b] ?? 5)),
  ]

  // Container visibility:
  //   - Pinned → always visible (manual override).
  //   - Active filters → always visible (user needs to see / clear them).
  //   - Narrowed range AND recent interaction → transiently visible
  //     (fades back out 2s after the user's last slider move or chip toggle).
  //   - Anything else (incl. full range, or narrowed range gone idle) →
  //     hidden. Pin button reappears as the way back in.
  const chipsVisible =
    pinned ||
    activeIds.length > 0 ||
    (!isFullRange && recentInteraction)
  // Show pin button only when it would actually change something — when
  // chips are hidden (pin reveals them) or when pinned (pin unpins).
  const pinButtonVisible = !chipsVisible || pinned

  return (
    <div
      data-vibe-strip
      className="sticky top-[56px] z-40 border-y border-border-subtle bg-base"
    >
      <div className="mx-auto max-w-screen-2xl px-4 md:px-8">

        {/* Header: //VIBE + range readout + RESET. The readout lives in a
            fixed-width slot (zero-padded slots, longest name pair fits in
            24ch) so changing the range never reflows the row. RESET is
            always rendered (toggling `invisible` instead of conditional
            mount) so the row's height stays stable when the user narrows
            or resets the range — otherwise the whole strip jumps ~6px. */}
        <div className="flex items-center justify-between pb-0.5 pt-1 md:pb-1 md:pt-2">
          <div className="flex min-w-0 items-baseline gap-2 md:gap-3">
            <span className="font-mono text-[10px] font-bold tracking-widest text-primary">
              //VIBE
            </span>
            <span className="inline-block min-w-[24ch] whitespace-nowrap font-mono text-[10px] tracking-wider">
              <span style={{ color: VIBE_SLOT_COLORS[minSlot] }}>
                {VIBE_SLOT_NAMES[minSlot]}
              </span>
              {minSlot !== maxSlot && (
                <>
                  <span className="text-muted"> → </span>
                  <span style={{ color: VIBE_SLOT_COLORS[maxSlot] }}>
                    {VIBE_SLOT_NAMES[maxSlot]}
                  </span>
                </>
              )}
            </span>
          </div>
          <button
            onClick={() => setVibeRange([0, 10])}
            aria-hidden={isFullRange}
            tabIndex={isFullRange ? -1 : 0}
            className={`border border-sys-orange/50 bg-base px-2 py-0.5 font-mono text-[10px] tracking-widest text-sys-orange transition-colors hover:bg-sys-orange hover:text-black ${
              isFullRange ? 'pointer-events-none invisible' : ''
            }`}
          >
            RESET
          </button>
        </div>

        {/* ── The tape band IS the slider ── */}
        <div
          className="relative h-7 cursor-crosshair md:h-10"
          ref={trackRef}
          onClick={handleTrackClick}
        >
          {/* Tape — the phosphor "station-dial" detail: 200 deterministic dashes
              colored by their hard thermal slot, lit inside the selected range
              and dimmed (low-alpha same hue) outside it, with PPM ballistics
              (fast attack lighting, slow decay leaving) via the per-dash
              transition. Visual layer only — the needles/plate/readout/chips are
              the interactive DOM on top; this is pointer-events-none. */}
          <div className="pointer-events-none absolute inset-0">
            {DASHES.map((d, i) => {
              const lit = d.slot >= minSlot && d.slot <= maxSlot
              const color = VIBE_SLOT_COLORS[d.slot]
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${d.leftPct}%`,
                    bottom: `${d.bottomPct}%`,
                    width: '2.5px',
                    height: `${d.heightPx}px`,
                    backgroundColor: color,
                    opacity: lit ? 1 : 0.16,
                    boxShadow: lit ? `0 0 3px ${color}` : 'none',
                    transitionProperty: 'opacity, box-shadow',
                    transitionTimingFunction: 'linear',
                    transitionDuration: litDuration(lit),
                  }}
                />
              )
            })}
          </div>

          {/* Min needle — thin line + grip cap, wide drag target */}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Vibe mínimo"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={10}
            aria-valuenow={minSlot}
            aria-valuetext={`${minSlot} · ${VIBE_SLOT_NAMES[minSlot]}`}
            className="absolute inset-y-0 w-7 -translate-x-1/2 cursor-col-resize touch-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/70"
            style={{ left: `${minPercent}%`, transition: needleTransition(dragHandle === 'min') }}
            onPointerDown={(e) => {
              e.preventDefault()
              draggingRef.current = 'min'
              setDragHandle('min')
            }}
            onKeyDown={handleKeyDown('min')}
          >
            <div className="mx-auto h-full w-[1.5px] bg-white shadow-[0_0_4px_rgba(255,255,255,0.7)]" />
            <div className="absolute left-1/2 top-0 h-[5px] w-[7px] -translate-x-1/2 bg-white" />
          </div>

          {/* Max needle */}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Vibe máximo"
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={10}
            aria-valuenow={maxSlot}
            aria-valuetext={`${maxSlot} · ${VIBE_SLOT_NAMES[maxSlot]}`}
            className="absolute inset-y-0 w-7 -translate-x-1/2 cursor-col-resize touch-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/70"
            style={{ left: `${maxPercent}%`, transition: needleTransition(dragHandle === 'max') }}
            onPointerDown={(e) => {
              e.preventDefault()
              draggingRef.current = 'max'
              setDragHandle('max')
            }}
            onKeyDown={handleKeyDown('max')}
          >
            <div className="mx-auto h-full w-[1.5px] bg-white shadow-[0_0_4px_rgba(255,255,255,0.7)]" />
            <div className="absolute left-1/2 top-0 h-[5px] w-[7px] -translate-x-1/2 bg-white" />
          </div>
        </div>

        {/* Scale plate — printed and STATIC. Tick + numeral (+ name on md+)
            at each band center; the needles cross it, the plate never moves.
            In-range labels brighten (muted → secondary) on the same
            attack/decay ballistics as the tape. */}
        <div className="relative mb-1 h-[15px] md:h-[26px]" aria-hidden>
          {VIBE_SLOT_NAMES.map((name, i) => {
            const lit = i >= minSlot && i <= maxSlot
            const duration = { transitionDuration: litDuration(lit) }
            return (
              <div
                key={name}
                className="absolute top-0 -translate-x-1/2 text-center"
                style={{ left: `${slotCenterPct(i)}%` }}
              >
                <div
                  className={`mx-auto mb-px h-[3px] w-px transition-colors ${lit ? 'bg-secondary' : 'bg-muted'}`}
                  style={duration}
                />
                <div
                  className={`hidden font-mono text-[8px] leading-tight tracking-wider transition-colors md:block ${lit ? 'text-secondary' : 'text-muted'}`}
                  style={duration}
                >
                  {name}
                </div>
              </div>
            )
          })}
        </div>

      </div>

      {/* ── Lower band: pin + genre chips ──
          Visibility is tied to interaction, not range:
          - Slider moves → chips fade in, stay open while dragging, fade
            back out 2s after the last range change (see the
            recentSliderInteraction effect above).
          - Active filters → always visible (the user needs to see / clear
            them).
          - Pin button → forces them visible indefinitely. Auto-hides when
            chips are already up for another reason.
          - Otherwise (full range idle, or narrowed range gone idle) →
            hidden. */}
      <div className="bg-base px-4 pb-1 pt-1 md:px-8 md:pb-3 md:pt-2">
        <div className="mx-auto max-w-screen-2xl">
          {/* The row's height is content-driven now — when chips are
              hidden, the row collapses to just the pin button's height
              (~22px) instead of holding ~56px of dead space. The trade-
              off: each slider interaction causes a small vertical
              shift below as chips fade in/out. The chips container
              animates `max-height` in lockstep with `opacity` (both
              200ms) so the collapse reads smooth, not janky. */}
          <div className="flex items-start gap-2">
            {/* Pin pill — only rendered when it would actually do
                something useful (chips hidden by default OR user has
                pinned and might want to unpin). */}
            {pinButtonVisible && (
              <button
                type="button"
                onClick={() => setPinned((v) => !v)}
                aria-expanded={pinned}
                aria-controls="vibe-genres-panel"
                className="flex shrink-0 items-center gap-1.5 border border-border/70 bg-base px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-secondary transition-colors hover:border-white/60 hover:text-white"
              >
                <ChevronDown
                  size={11}
                  className={`transition-transform ${pinned ? 'rotate-180' : ''}`}
                  aria-hidden
                />
                {pinned ? 'OCULTAR' : `+ ${allGenreIds.length} GÉNEROS`}
              </button>
            )}

            {/* Chip flex — multi-row wrap with content-start alignment.
                Per-chip margins (not container gap) so hidden chips
                collapse fully without leaving phantom gap-spacing that
                would spread visible chips apart. max-h caps the row
                count for very dense states (e.g. pinned at full range
                on narrow viewports) — overflow scrolls vertically with
                the scrollbar hidden. */}
            <div
              id="vibe-genres-panel"
              className={`flex min-w-0 flex-1 flex-wrap items-start content-start overflow-y-auto transition-[opacity,max-height] duration-200 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                chipsVisible
                  ? 'max-h-[7rem] opacity-100'
                  : 'pointer-events-none max-h-0 opacity-0'
              }`}
              aria-hidden={!chipsVisible}
            >
              {sortedGenreIds.map((id) => {
                const name = getGenreById(id)?.name ?? id
                const active = activeIds.includes(id)
                // Per-chip "in feed" decision. When ContentGrid has
                // pushed the actual feed genres, use that — but rolled
                // up: a parent chip ("techno") is in-feed when any
                // descendant leaf is tagged on a feed item. Without
                // rollup, root chips would never appear. Otherwise fall
                // back to the GENRE_VIBE typical-vibe heuristic.
                const inFeed = feedSet
                  ? getRollup(id).some((rid) => feedSet.has(rid))
                  : (() => {
                      const v = GENRE_VIBE[id] ?? 5
                      return v >= min && v <= max
                    })()
                // Per-chip visibility:
                //   - pinned (browse-all override) → always visible
                //   - active (orange) filter → always visible (user can clear it)
                //   - narrowed range AND in feed AND recent interaction →
                //     transiently visible. Non-active chips follow the same
                //     2s window as the container, so once the user has
                //     committed a filter, the strip settles to just the
                //     orange chips and hides the rest of the candidates.
                // At full range without pin, every genre tends to be
                // "in feed" — so we suppress the in-feed path there to
                // keep active filters visually focused.
                const chipVisible =
                  pinned ||
                  active ||
                  (!isFullRange && inFeed && recentInteraction)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleGenre(id)}
                    aria-pressed={active}
                    aria-hidden={!chipVisible}
                    tabIndex={chipVisible ? 0 : -1}
                    title={
                      active
                        ? `Quitar filtro: ${name}`
                        : `Filtrar por ${name}`
                    }
                    className={`overflow-hidden whitespace-nowrap border font-mono text-[10px] font-bold tracking-wider transition-all duration-200 md:text-[11px] ${
                      chipVisible
                        ? 'mb-1.5 mr-1.5 max-w-[18rem] px-1.5 py-px opacity-100'
                        : 'pointer-events-none mb-0 mr-0 max-w-0 border-transparent px-0 py-px opacity-0'
                    } ${
                      active
                        ? 'border-sys-orange bg-sys-orange text-black shadow-[0_0_6px_rgba(249,115,22,0.55)]'
                        : 'border-border/40 bg-base text-secondary hover:border-white/60 hover:text-white'
                    }`}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
