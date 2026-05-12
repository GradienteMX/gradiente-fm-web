'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { useVibe } from '@/context/VibeContext'
import { VIBE_SLOT_NAMES, vibeToColor } from '@/lib/utils'
import { GENRE_VIBE, getGenreById, getRollup, getRootGenres } from '@/lib/genres'

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}

// GENRE_VIBE moved to lib/genres.ts so the foro catalog can share it for
// vibe-filtering threads via their tagged genres.

// Phosphor tape — three horizontal rows of dashes evoking a waveform display:
//   MIDDLE row: dense, near-continuous baseline across the full width
//   TOP / BOTTOM rows: sparser, offset by a half-step from each other so the
//   alternation reads as a subtle saw rhythm above and below the baseline.
// Dashes inside [min, max] are "lit" (full opacity + glow); others dim.
// Positions are deterministic per-index so the pattern is stable across renders.
const MID_COUNT = 120
const EDGE_COUNT = 40

// Integer-based hash (Math.imul) — bit-exact across JS engines, avoiding SSR/client drift.
function hash01(seed: number, salt: number): number {
  let x = Math.imul(seed | 0, 2654435761) ^ Math.imul(salt | 0, 1597334677)
  x = Math.imul(x ^ (x >>> 16), 2246822519) | 0
  x = Math.imul(x ^ (x >>> 13), 3266489917) | 0
  x = x ^ (x >>> 16)
  return (x >>> 0) / 4294967296
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function interpolateVibeColor(vibe: number): string {
  const lo = Math.floor(vibe)
  const hi = Math.min(lo + 1, 10)
  const t = vibe - lo
  const [ar, ag, ab] = hexToRgb(vibeToColor(lo))
  const [br, bg, bb] = hexToRgb(vibeToColor(hi))
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const b = Math.round(ab + (bb - ab) * t)
  return `rgb(${r},${g},${b})`
}

type Dash = { leftPct: number; bottomPct: number; widthPx: number; color: string; vibe: number }

const DASHES: Dash[] = (() => {
  const arr: Dash[] = []
  const makeRow = (count: number, bottomPct: number, halfStep: boolean, widthLo: number, widthHi: number, salt: number) => {
    for (let i = 0; i < count; i++) {
      const t = (i + (halfStep ? 0.5 : 0)) / count
      if (t > 0.995) continue
      const vibeF = t * 10
      arr.push({
        leftPct: Math.round(t * 9900) / 100,
        bottomPct,
        widthPx: widthLo + Math.floor(hash01(i, salt) * (widthHi - widthLo + 1)),
        color: interpolateVibeColor(vibeF),
        vibe: vibeF,
      })
    }
  }
  makeRow(MID_COUNT, 50, false, 4, 6, 10)  // middle: dense, thicker dashes → continuous baseline
  makeRow(EDGE_COUNT, 68, false, 3, 5, 20) // top: sparser
  makeRow(EDGE_COUNT, 32, true,  3, 5, 30) // bottom: half-step offset from top → saw alternation
  return arr
})()

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
  const rangeRef = useRef(vibeRange)
  rangeRef.current = vibeRange

  // The chip strip is hidden by default. Two ways to reveal it:
  //   - Pin button (manual override — stays open until unpinned).
  //   - Recent interaction (transient — fades back out ~2s after the user
  //     stops moving the slider OR toggling chips). The transient mode
  //     replaced an older "always visible when narrowed" rule that left
  //     the chip strip cluttering the surface long after the user had
  //     committed to a range and moved on to scrolling the feed.
  // Active (yellow) filter chips always stay visible — the user needs a
  // way to see what they've filtered on and clear it. NON-active chips
  // are gated by the same interaction window, so once the user has
  // committed a filter, the surface settles to just the yellow chips and
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
    return clamp(ratio * 10, 0, 10)
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
    const onUp = () => {
      draggingRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setVibeRange])

  // min/max are continuous floats (0–10); label & color snap to the nearest integer slot
  // so the handle label reads cleanly as one of the named vibes.
  const minSlot = Math.round(min)
  const maxSlot = Math.round(max)
  const minPercent = (min / 10) * 100
  const maxPercent = (max / 10) * 100
  const minColor = vibeToColor(minSlot)
  const maxColor = vibeToColor(maxSlot)
  const isFullRange = min === 0 && max === 10
  const labelsOverlap = Math.abs(maxPercent - minPercent) < 14

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const val = getValueFromX(e.clientX)
    const [curMin, curMax] = rangeRef.current
    const dMin = Math.abs(val - curMin)
    const dMax = Math.abs(val - curMax)
    if (dMin <= dMax) {
      setVibeRange([Math.min(val, curMax), curMax])
    } else {
      setVibeRange([curMin, Math.max(val, curMin)])
    }
  }

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
      className="sticky top-[76px] z-40 border-y-2 border-black bg-black"
    >
      <div className="mx-auto max-w-screen-2xl px-4 md:px-8">

        {/* Header: VIBE + RESET — float on stripe band. RESET is always
            rendered (toggling `invisible` instead of conditional mount)
            so the row's height stays stable when the user narrows or
            resets the range — otherwise the whole strip jumps ~6px. */}
        <div className="flex items-center justify-between pb-0.5 pt-1 md:pb-1 md:pt-2">
          <span className="font-mono text-[10px] font-bold tracking-widest text-white [text-shadow:0_0_6px_#000,0_0_12px_#000]">
            VIBE
          </span>
          <button
            onClick={() => setVibeRange([0, 10])}
            aria-hidden={isFullRange}
            tabIndex={isFullRange ? -1 : 0}
            className={`border border-black bg-black px-2 py-0.5 font-mono text-[10px] tracking-widest text-[#F5C500] transition-colors hover:bg-[#F5C500] hover:text-black ${
              isFullRange ? 'pointer-events-none invisible' : ''
            }`}
          >
            RESET
          </button>
        </div>

        {/* Handle names pinned above the track */}
        <div className="relative h-3 md:h-4">
          <span
            className="absolute -translate-x-1/2 font-mono text-[9px] font-bold tracking-widest transition-[left] duration-75 [text-shadow:0_0_8px_#000,0_0_16px_#000]"
            style={{ left: `${minPercent}%`, color: minColor }}
          >
            {VIBE_SLOT_NAMES[minSlot]}
          </span>
          {!labelsOverlap && (
            <span
              className="absolute -translate-x-1/2 font-mono text-[9px] font-bold tracking-widest transition-[left] duration-75 [text-shadow:0_0_8px_#000,0_0_16px_#000]"
              style={{ left: `${maxPercent}%`, color: maxColor }}
            >
              {VIBE_SLOT_NAMES[maxSlot]}
            </span>
          )}
        </div>

        {/* ── The stripe band IS the slider ── */}
        <div
          className="relative h-7 cursor-crosshair md:h-10"
          ref={trackRef}
          onClick={handleTrackClick}
        >
          {/* Phosphor field — scattered horizontal dashes at random (x, y), not a column grid */}
          <div className="pointer-events-none absolute inset-0">
            {DASHES.map((d, i) => {
              const lit = d.vibe >= min && d.vibe <= max
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${d.leftPct}%`,
                    bottom: `${d.bottomPct}%`,
                    width: '2.5px',
                    height: `${d.widthPx}px`,
                    backgroundColor: d.color,
                    opacity: lit ? 1 : 0.08,
                    boxShadow: lit ? `0 0 3px ${d.color}` : 'none',
                    transition: 'opacity 120ms linear, box-shadow 120ms linear',
                  }}
                />
              )
            })}
          </div>

          {/* Min handle — white cut-mark with wide drag target */}
          <div
            className="absolute inset-y-0 w-6 -translate-x-1/2 cursor-col-resize"
            style={{ left: `${minPercent}%` }}
            onPointerDown={(e) => {
              e.preventDefault()
              draggingRef.current = 'min'
            }}
          >
            <div className="mx-auto h-full w-[3px] bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
          </div>

          {/* Max handle */}
          <div
            className="absolute inset-y-0 w-6 -translate-x-1/2 cursor-col-resize"
            style={{ left: `${maxPercent}%` }}
            onPointerDown={(e) => {
              e.preventDefault()
              draggingRef.current = 'max'
            }}
          >
            <div className="mx-auto h-full w-[3px] bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
          </div>
        </div>

      </div>

      {/* ── Black band: pin + genre chips ──
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
      <div className="bg-black px-4 pb-1 pt-1 md:px-8 md:pb-3 md:pt-2">
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
                className="flex shrink-0 items-center gap-1.5 border border-border/70 bg-black px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-secondary transition-colors hover:border-white/60 hover:text-white"
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
                //   - active (yellow) filter → always visible (user can clear it)
                //   - narrowed range AND in feed AND recent interaction →
                //     transiently visible. Non-active chips follow the same
                //     2s window as the container, so once the user has
                //     committed a filter, the strip settles to just the
                //     yellow chips and hides the rest of the candidates.
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
                        ? 'border-[#F5C500] bg-[#F5C500] text-black shadow-[0_0_6px_rgba(245,197,0,0.55)]'
                        : 'border-border/40 bg-black text-secondary hover:border-white/60 hover:text-white'
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
