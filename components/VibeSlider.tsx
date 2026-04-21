'use client'

import { useEffect, useRef } from 'react'
import { useVibe } from '@/context/VibeContext'
import { vibeToColor } from '@/lib/utils'
import { getGenreById } from '@/lib/genres'

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}

const VIBE_SLOT_NAMES: Record<number, string> = {
  0: 'GLACIAL', 1: 'POLAR',  2: 'CHILL',   3: 'COOL',  4: 'FRESH',
  5: 'GROOVE',  6: 'WARM',   7: 'HOT',      8: 'FUEGO', 9: 'BRASA', 10: 'VOLCÁN',
}

const GENRE_VIBE: Record<string, number> = {
  'ambient': 0,
  'lo-fi': 1, 'downtempo': 1,
  'organic-house': 2, 'ambient-techno': 2, 'dub': 2,
  'deep-house': 3, 'minimal': 3, 'jazz': 3, 'neo-soul': 3,
  'house': 4, 'electronica': 4, 'melodic-techno': 4, 'nu-disco': 4, 'indie-dance': 4,
  'tech-house': 5, 'electro': 5, 'idm': 5, 'latin-electronic': 5,
  'techno-raw': 6, 'progressive-house': 6, 'afro-house': 6, 'breaks': 6,
  'peak-techno': 7, 'drum-and-bass': 7, 'ukg': 7, 'uk-bass': 7,
  'hard-techno': 8, 'dark-techno': 8, 'jungle': 8, 'footwork': 8, 'hard-dance': 8,
  'industrial': 9, 'noise': 9, 'deconstructed': 9,
  'psy-trance': 10, 'hyperpop': 10, 'gqom': 10,
}

const STRIPE_MASK = 'repeating-linear-gradient(-45deg, transparent 0px, transparent 9px, #000 9px, #000 18px)'
const NEON_GRADIENT = 'linear-gradient(to right, #00ffff 0%, #0066ff 18%, #6600ff 34%, #ff00ff 50%, #ff0066 62%, #ff5500 76%, #ff2200 90%, #ff0000 100%)'
const GREY_STRIPE = `${STRIPE_MASK}, linear-gradient(to right, #333 0%, #333 100%)`

export function VibeSlider() {
  const { vibeRange, setVibeRange } = useVibe()
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<'min' | 'max' | null>(null)
  const rangeRef = useRef(vibeRange)
  rangeRef.current = vibeRange

  const [min, max] = vibeRange

  const getValueFromX = (clientX: number): number => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return clamp(Math.round(ratio * 10), 0, 10)
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

  const minPercent = (min / 10) * 100
  const maxPercent = (max / 10) * 100
  const minColor = vibeToColor(min)
  const maxColor = vibeToColor(max)
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
        <div className="flex items-center justify-between pb-1 pt-2">
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
        <div className="relative h-4">
          <span
            className="absolute -translate-x-1/2 font-mono text-[9px] font-bold tracking-widest transition-[left] duration-75 [text-shadow:0_0_8px_#000,0_0_16px_#000]"
            style={{ left: `${minPercent}%`, color: minColor }}
          >
            {VIBE_SLOT_NAMES[min]}
          </span>
          {!labelsOverlap && (
            <span
              className="absolute -translate-x-1/2 font-mono text-[9px] font-bold tracking-widest transition-[left] duration-75 [text-shadow:0_0_8px_#000,0_0_16px_#000]"
              style={{ left: `${maxPercent}%`, color: maxColor }}
            >
              {VIBE_SLOT_NAMES[max]}
            </span>
          )}
        </div>

        {/* ── The stripe band IS the slider ── */}
        <div
          className="relative h-10 cursor-crosshair"
          ref={trackRef}
          onClick={handleTrackClick}
        >
          {/* Neon band — full-width gradient, clipped to [min,max] so colors stay correct */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `${STRIPE_MASK}, ${NEON_GRADIENT}`,
              clipPath: `inset(0 ${100 - maxPercent}% 0 ${minPercent}%)`,
              transition: 'clip-path 75ms linear',
            }}
          />

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
      <div className="bg-black px-4 pb-3 pt-2 md:px-8">
        <div className="mx-auto max-w-screen-2xl">

          {genresInRange.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {genresInRange.map((name) => (
                <span key={name} className="font-mono text-[11px] font-bold text-white">
                  {name}
                </span>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
