'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { useVibe } from '@/context/VibeContext'
import { vibeToColor } from '@/lib/utils'
import { GENRE_VIBE, getGenreById } from '@/lib/genres'

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}

const VIBE_SLOT_NAMES: Record<number, string> = {
  0: 'GLACIAL', 1: 'POLAR',  2: 'CHILL',   3: 'COOL',  4: 'FRESH',
  5: 'GROOVE',  6: 'WARM',   7: 'HOT',      8: 'FUEGO', 9: 'BRASA', 10: 'VOLCÁN',
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
  // Hide on the dashboard — the editor working surface isn't a feed.
  // /foro IS a feed (threads tagged with 1–5 genres each filter by the
  // shared vibe range), so the slider stays.
  const pathname = usePathname()
  if (pathname?.startsWith('/dashboard')) return null

  return <VibeSliderImpl />
}

function VibeSliderImpl() {
  const { vibeRange, setVibeRange } = useVibe()
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<'min' | 'max' | null>(null)
  const rangeRef = useRef(vibeRange)
  rangeRef.current = vibeRange
  // Mobile-only: genre list starts collapsed behind a "+ N GÉNEROS" pill.
  // Desktop (md+) always shows the list regardless of this state.
  const [genresOpen, setGenresOpen] = useState(false)

  const [min, max] = vibeRange

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
    const onUp = () => { draggingRef.current = null }
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

  const genresInRange = Object.entries(GENRE_VIBE)
    .filter(([, v]) => v >= min && v <= max)
    .map(([id]) => getGenreById(id)?.name ?? id)
    .slice(0, 60)

  return (
    <div
      className="sticky top-[76px] z-40 border-y-2 border-black bg-black"
    >
      <div className="mx-auto max-w-screen-2xl px-4 md:px-8">

        {/* Header: VIBE + RESET — float on stripe band */}
        <div className="flex items-center justify-between pb-0.5 pt-1 md:pb-1 md:pt-2">
          <span className="font-mono text-[10px] font-bold tracking-widest text-white [text-shadow:0_0_6px_#000,0_0_12px_#000]">
            VIBE
          </span>
          {!isFullRange ? (
            <button
              onClick={() => setVibeRange([0, 10])}
              className="border border-black bg-black px-2 py-0.5 font-mono text-[10px] tracking-widest text-[#F5C500] transition-colors hover:bg-[#F5C500] hover:text-black"
            >
              RESET
            </button>
          ) : <span />}
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
            onPointerDown={(e) => { e.preventDefault(); draggingRef.current = 'min' }}
          >
            <div className="mx-auto h-full w-[3px] bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
          </div>

          {/* Max handle */}
          <div
            className="absolute inset-y-0 w-6 -translate-x-1/2 cursor-col-resize"
            style={{ left: `${maxPercent}%` }}
            onPointerDown={(e) => { e.preventDefault(); draggingRef.current = 'max' }}
          >
            <div className="mx-auto h-full w-[3px] bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
          </div>
        </div>

      </div>

      {/* ── Black band: genres + ticks ── */}
      <div className="bg-black px-4 pb-1 pt-1 md:px-8 md:pb-3 md:pt-2">
        <div className="mx-auto max-w-screen-2xl">

          {genresInRange.length > 0 && (
            <>
              {/* Mobile-only pill — toggles the inline genre list.
                  Hidden on md+ because the list is always visible there. */}
              <button
                type="button"
                onClick={() => setGenresOpen((v) => !v)}
                aria-expanded={genresOpen}
                aria-controls="vibe-genres-panel"
                className="flex items-center gap-1.5 border border-border/70 bg-black px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-secondary transition-colors hover:border-white/60 hover:text-white md:hidden"
              >
                <ChevronDown
                  size={11}
                  className={`transition-transform ${genresOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                />
                {genresOpen
                  ? 'OCULTAR'
                  : `+ ${genresInRange.length} GÉNEROS`}
              </button>

              <div
                id="vibe-genres-panel"
                className={`${genresOpen ? 'mt-2 flex' : 'hidden'} flex-wrap gap-x-3 gap-y-0.5 md:mt-0 md:flex`}
              >
                {genresInRange.map((name) => (
                  <span key={name} className="font-mono text-[11px] font-bold text-white">
                    {name}
                  </span>
                ))}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
