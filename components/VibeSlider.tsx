'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { useVibe } from '@/context/VibeContext'
import { VIBE_SLOT_COLORS, VIBE_SLOT_NAMES } from '@/lib/utils'
import { DASH_INK, DASH_PAPER_RAISED } from '@/lib/dashboard/palette'
import { GENRE_VIBE, getGenreById, getRollup, getRootGenres } from '@/lib/genres'

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}

// GENRE_VIBE moved to lib/genres.ts so the foro catalog can share it for
// vibe-filtering threads via their tagged genres.

// Printed spectrogram strip («EL PLIEGO» fase B). The station dial's phosphor
// tape is retired; the same range machine now drives a measuring instrument
// printed on the sheet. Three layers, strict roles:
//   BAND    — 11 hard slot cells, 1px ink outlines (the VibeMeterLight
//             convention: outline carries the calibration, paper shows
//             through unlit cells — never low-alpha washes). In-range cells
//             fill with their slot hue.
//   NAMES   — printed slot names under the band. Static plate: in-range
//             names ink, out-of-range ink-faint.
//   NEEDLES — the two range handles, 3px ink, taller than the band. Only
//             the needles move.
const SLOT_COUNT = 11

// Value→position: integer slot v sits at the CENTER of its band, so a
// detented needle points exactly at its printed cell. The inverse mapping
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

// Focus grammar on paper: 2px ink outline, offset 2.
const FOCUS_ON_PAPER =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// ── Readout contrast audit (module scope — deterministic, SSR-safe) ────────
// The words-only readout may print in the slot hue ONLY when that hue clears
// 4.5:1 (AA small text) on the strip's paper-raised ground; otherwise ink.
// As calibrated today only GLACIAL clears — the check stays live so a future
// slot recalibration upgrades the readout automatically.
function channelLum(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}
function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return (
    0.2126 * channelLum((n >> 16) & 0xff) +
    0.7152 * channelLum((n >> 8) & 0xff) +
    0.0722 * channelLum(n & 0xff)
  )
}
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
const READOUT_COLORS: string[] = VIBE_SLOT_COLORS.map((c) =>
  contrastRatio(c, DASH_PAPER_RAISED) >= 4.5 ? c : DASH_INK,
)

// Below xl the printed names row shows only the three ruler anchors —
// eleven names collide once the band shares its row with label + readout.
const NAME_ANCHORS = [0, 5, 10] as const

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
  // Active (ink-filled) filter chips always stay visible — the user needs a
  // way to see what they've filtered on and clear it. NON-active chips
  // are gated by the same interaction window, so once the user has
  // committed a filter, the surface settles to just the filled chips and
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
  // Slot-quantized values drive the lit cells, the names row and the readout,
  // so whole cells flip as the needle crosses detent boundaries — stepped,
  // not smeared.
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

  // PPM ballistics: fast attack when a cell lights, slow decay when it dims.
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

  // Sticky offset = the nav height, centralized as --gr-nav-h in globals.css.
  // The player lives in a fixed bottom bar, so no top-strip arithmetic: one
  // offset on every page. CategoryRail keeps measuring [data-vibe-strip]
  // for its own placement below.
  return (
    <div
      data-vibe-strip
      className="sticky z-40 border-y border-ink bg-paper-raised"
      style={{ top: 'var(--gr-nav-h)' }}
    >
      <div className="mx-auto max-w-screen-2xl px-4 md:px-8">

        {/* ── Instrument row: VIBE · band+needles+names · readout · RESET ──
            One printed line on md+. On phones the band takes its own
            full-width line (order-last) and the label/readout/RESET share
            the line above — same DOM, CSS order only. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0 py-1 md:flex-nowrap md:gap-x-4">
          <span className="order-1 shrink-0 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
            VIBE
          </span>

          {/* Track column — the band IS the slider; the names row below
              shares its exact width so printed names register with cells. */}
          <div className="order-4 w-full md:order-2 md:min-w-0 md:w-auto md:flex-1">
            <div
              ref={trackRef}
              onClick={handleTrackClick}
              className="relative h-11 cursor-crosshair"
            >
              {/* Band — 11 hard slot cells, shared 1px ink hairlines so cell
                  centers stay exactly at slotCenterPct. In-range cells fill
                  with their hue via an opacity layer carrying the PPM
                  ballistics (fast attack lighting, slow decay dimming);
                  out-of-range cells are plain paper — the outline carries
                  the calibration (VibeMeterLight convention). Visual layer
                  only — pointer-events-none; the track + needles are the
                  interactive DOM. */}
              <div
                className="pointer-events-none absolute inset-x-0 top-1/2 flex h-6 -translate-y-1/2"
                aria-hidden
              >
                {VIBE_SLOT_COLORS.map((color, slot) => {
                  const lit = slot >= minSlot && slot <= maxSlot
                  return (
                    <div
                      key={slot}
                      className="relative min-w-0 flex-1 border-y border-l border-ink last:border-r"
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundColor: color,
                          opacity: lit ? 1 : 0,
                          transitionProperty: 'opacity',
                          transitionTimingFunction: 'linear',
                          transitionDuration: litDuration(lit),
                        }}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Min needle — 3px ink line taller than the band, wide
                  invisible drag target (≥44px both axes). */}
              <div
                role="slider"
                tabIndex={0}
                aria-label="Vibe mínimo"
                aria-orientation="horizontal"
                aria-valuemin={0}
                aria-valuemax={10}
                aria-valuenow={minSlot}
                aria-valuetext={VIBE_SLOT_NAMES[minSlot]}
                className={`absolute inset-y-0 w-11 -translate-x-1/2 cursor-col-resize touch-none ${FOCUS_ON_PAPER}`}
                style={{ left: `${minPercent}%`, transition: needleTransition(dragHandle === 'min') }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  draggingRef.current = 'min'
                  setDragHandle('min')
                }}
                onKeyDown={handleKeyDown('min')}
              >
                <div className="mx-auto h-full w-[3px] bg-ink" />
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
                aria-valuetext={VIBE_SLOT_NAMES[maxSlot]}
                className={`absolute inset-y-0 w-11 -translate-x-1/2 cursor-col-resize touch-none ${FOCUS_ON_PAPER}`}
                style={{ left: `${maxPercent}%`, transition: needleTransition(dragHandle === 'max') }}
                onPointerDown={(e) => {
                  e.preventDefault()
                  draggingRef.current = 'max'
                  setDragHandle('max')
                }}
                onKeyDown={handleKeyDown('max')}
              >
                <div className="mx-auto h-full w-[3px] bg-ink" />
              </div>
            </div>

            {/* Printed slot names — static plate under the band. In-range
                names ink, out-of-range ink-faint, on the same attack/decay
                ballistics as the cells. Eleven names only fit on xl; below
                that the three ruler anchors print flush left / center /
                right. */}
            <div className="relative h-4 xl:hidden" aria-hidden>
              <div className="flex h-full items-start justify-between font-mono text-d11 tracking-wider">
                {NAME_ANCHORS.map((slot) => {
                  const lit = slot >= minSlot && slot <= maxSlot
                  return (
                    <span
                      key={slot}
                      className={`transition-colors ${lit ? 'text-ink' : 'text-ink-faint'}`}
                      style={{ transitionDuration: litDuration(lit) }}
                    >
                      {VIBE_SLOT_NAMES[slot]}
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="relative hidden h-4 xl:block" aria-hidden>
              {VIBE_SLOT_NAMES.map((name, i) => {
                const lit = i >= minSlot && i <= maxSlot
                return (
                  <span
                    key={name}
                    className={`absolute top-0 -translate-x-1/2 whitespace-nowrap font-mono text-d11 tracking-wider transition-colors ${
                      lit ? 'text-ink' : 'text-ink-faint'
                    }`}
                    style={{ left: `${slotCenterPct(i)}%`, transitionDuration: litDuration(lit) }}
                  >
                    {name}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Words-only readout — reserved width so a changing range never
              reflows the row. Word color = slot hue only where it clears
              AA on paper (READOUT_COLORS audit above), ink otherwise.
              Never numbers. */}
          <span className="order-2 ml-auto inline-block min-w-[17ch] whitespace-nowrap text-right font-mono text-d11 tracking-wider md:order-3 md:ml-0">
            <span style={{ color: READOUT_COLORS[minSlot] }}>
              {VIBE_SLOT_NAMES[minSlot]}
            </span>
            {minSlot !== maxSlot && (
              <>
                <span className="text-ink-faint"> → </span>
                <span style={{ color: READOUT_COLORS[maxSlot] }}>
                  {VIBE_SLOT_NAMES[maxSlot]}
                </span>
              </>
            )}
          </span>

          {/* RESET — always rendered (toggling `invisible`, not conditional
              mount) so the row never reflows when the user narrows or
              resets the range. */}
          <button
            onClick={() => setVibeRange([0, 10])}
            aria-hidden={isFullRange}
            tabIndex={isFullRange ? -1 : 0}
            className={`group order-3 flex min-h-11 shrink-0 items-center md:order-4 ${FOCUS_ON_PAPER} ${
              isFullRange ? 'pointer-events-none invisible' : ''
            }`}
          >
            <span className="border border-ink px-2 py-0.5 font-mono text-d11 tracking-widest text-ink transition-colors group-hover:bg-ink group-hover:text-paper">
              RESET
            </span>
          </button>
        </div>
      </div>

      {/* ── Lower band: pin + genre chips ──
          Visibility is tied to interaction, not range:
          - Slider moves → chips fade in, stay open while dragging, fade
            back out 2s after the last range change (see the
            recentInteraction effect above).
          - Active filters → always visible (the user needs to see / clear
            them).
          - Pin button → forces them visible indefinitely. Auto-hides when
            chips are already up for another reason.
          - Otherwise (full range idle, or narrowed range gone idle) →
            hidden. */}
      <div className="px-4 md:px-8">
        <div className="mx-auto max-w-screen-2xl">
          {/* The row's height is content-driven — when chips are hidden,
              the row collapses to just the pin button's height instead of
              holding dead space. The chips container animates `max-height`
              in lockstep with `opacity` (both 200ms) so the collapse reads
              smooth, not janky. */}
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
                className={`group flex min-h-11 shrink-0 items-center ${FOCUS_ON_PAPER}`}
              >
                <span className="flex items-center gap-1.5 border border-ink px-2 py-0.5 font-mono text-d11 font-bold tracking-widest text-ink transition-colors group-hover:bg-ink group-hover:text-paper">
                  <ChevronDown
                    size={11}
                    className={`transition-transform ${pinned ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                  {pinned ? 'OCULTAR' : `+ ${allGenreIds.length} GÉNEROS`}
                </span>
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
                  ? 'max-h-[9rem] opacity-100'
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
                //   - active (ink-filled) filter → always visible (user can
                //     clear it)
                //   - narrowed range AND in feed AND recent interaction →
                //     transiently visible. Non-active chips follow the same
                //     2s window as the container, so once the user has
                //     committed a filter, the strip settles to just the
                //     filled chips and hides the rest of the candidates.
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
                    className={`group flex min-h-11 items-center overflow-hidden whitespace-nowrap transition-[max-width,margin,opacity] duration-200 ${FOCUS_ON_PAPER} ${
                      chipVisible
                        ? 'mr-1.5 max-w-[18rem] opacity-100'
                        : 'pointer-events-none mr-0 max-w-0 opacity-0'
                    }`}
                  >
                    <span
                      className={`border border-ink px-1.5 py-px font-mono text-d11 font-bold tracking-wider transition-colors ${
                        active
                          ? 'bg-ink text-paper'
                          : 'bg-transparent text-ink group-hover:bg-ink group-hover:text-paper'
                      }`}
                    >
                      {name}
                    </span>
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
