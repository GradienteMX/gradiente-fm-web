'use client'

import { useEffect, useRef, useState } from 'react'
import { vibeToColor } from '@/lib/utils'
import {
  castVibeCheck,
  useUserVibeCheck,
  useVibeCheckAggregate,
  VIBE_CHECK_THRESHOLD,
} from '@/lib/vibeChecks'
import { useAuth } from '@/components/auth/useAuth'

// Inline replacement for the static VIBE row across all overlays. Reads as a
// fader: track shows the displayed band (author's [vibeMin, vibeMax] until
// the crowd reaches threshold; crowd median thereafter), thumbs at band
// edges, faint author ticks below the band as a persistent secondary
// marker. Click anywhere on the fader → edit mode; drag-release commits
// the user's personal vibe check via the optimistic cache.
//
// Login-gated. Click while logged-out → openLogin() (matches polls/saves).

interface Props {
  item: { id: string; vibeMin: number; vibeMax: number }
}

const VOID_THRESHOLD_PX = 3 // pointer-up this close to pointer-down counts as a click, not a drag

function bandGradient(min: number, max: number): string {
  if (min === max) return vibeToColor(min)
  const span = Math.max(1, max - min)
  const stops: string[] = []
  for (let i = min; i <= max; i++) {
    const pct = ((i - min) / span) * 100
    stops.push(`${vibeToColor(i)} ${pct.toFixed(2)}%`)
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

export function VibeFader({ item }: Props) {
  const { currentUser, openLogin } = useAuth()
  const viewerId = currentUser?.id ?? null

  const userVote = useUserVibeCheck(item.id, viewerId)
  const aggregate = useVibeCheckAggregate(item.id)

  const authorBand: [number, number] = [item.vibeMin, item.vibeMax]

  // Fall-through: crowd takes over from author at >= threshold checks.
  const displayedBand: [number, number] =
    aggregate.checkCount >= VIBE_CHECK_THRESHOLD
      ? [aggregate.medianMin, aggregate.medianMax]
      : authorBand

  const [editing, setEditing] = useState(false)
  const [dragRange, setDragRange] = useState<[number, number] | null>(null)

  const trackRef = useRef<HTMLDivElement>(null)
  const draggingThumbRef = useRef<'min' | 'max' | null>(null)
  const dragRangeRef = useRef<[number, number] | null>(null)
  const dragStartXRef = useRef<number>(0)
  const movedRef = useRef(false)

  // What thumbs render at: dragging > saved vote > displayed band (in edit
  // mode); displayed band only (in view mode).
  const userVoteTuple: [number, number] | null = userVote
    ? [userVote.vibeMin, userVote.vibeMax]
    : null
  const renderRange: [number, number] = editing
    ? dragRange ?? userVoteTuple ?? displayedBand
    : displayedBand

  const [renderMin, renderMax] = renderRange
  const [authMin, authMax] = authorBand

  const valueFromX = (clientX: number): number => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return Math.max(0, Math.min(10, Math.round(ratio * 10)))
  }

  // Drag listeners — only attached while editing
  useEffect(() => {
    if (!editing) return

    const onMove = (e: PointerEvent) => {
      if (!draggingThumbRef.current) return
      if (Math.abs(e.clientX - dragStartXRef.current) > VOID_THRESHOLD_PX) {
        movedRef.current = true
      }
      const val = valueFromX(e.clientX)
      const cur = dragRangeRef.current ?? userVoteTuple ?? displayedBand
      const [curMin, curMax] = cur
      const next: [number, number] =
        draggingThumbRef.current === 'min'
          ? [Math.min(val, curMax), curMax]
          : [curMin, Math.max(val, curMin)]
      dragRangeRef.current = next
      setDragRange(next)
    }

    const onUp = () => {
      // Commit only on real drag (movement past the void threshold). Bare
      // clicks on a thumb stay in edit mode without saving — protects
      // against accidental votes.
      if (
        draggingThumbRef.current &&
        dragRangeRef.current &&
        movedRef.current &&
        viewerId
      ) {
        const [vMin, vMax] = dragRangeRef.current
        void castVibeCheck(item.id, viewerId, vMin, vMax)
        setEditing(false)
        setDragRange(null)
      }
      draggingThumbRef.current = null
      dragRangeRef.current = null
      movedRef.current = false
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, item.id, viewerId])

  // Click outside the fader exits edit mode without saving
  useEffect(() => {
    if (!editing) return
    const onMouseDown = (e: MouseEvent) => {
      if (!trackRef.current) return
      if (trackRef.current.contains(e.target as Node)) return
      setEditing(false)
      setDragRange(null)
      dragRangeRef.current = null
    }
    const id = window.setTimeout(() => {
      window.addEventListener('mousedown', onMouseDown)
    }, 0)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('mousedown', onMouseDown)
    }
  }, [editing])

  // ESC cancels
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditing(false)
        setDragRange(null)
        dragRangeRef.current = null
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!viewerId) {
      openLogin()
      return
    }
    if (!editing) setEditing(true)
  }

  const handleThumbPointerDown =
    (thumb: 'min' | 'max') => (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (!viewerId) {
        openLogin()
        return
      }
      setEditing(true)
      draggingThumbRef.current = thumb
      dragRangeRef.current = userVoteTuple ?? displayedBand
      dragStartXRef.current = e.clientX
      movedRef.current = false
    }

  const labelTxt =
    renderMin === renderMax ? `${renderMin}` : `${renderMin}-${renderMax}`
  const labelColor = vibeToColor(Math.round((renderMin + renderMax) / 2))

  // Tooltip — guides the user to what's interactive
  const tip = !viewerId
    ? 'Inicia sesión para hacer tu vibe check'
    : editing
      ? 'Arrastra los marcadores para tu vibe check · ESC para cancelar'
      : userVote
        ? `Tu vibe check: ${userVote.vibeMin === userVote.vibeMax ? userVote.vibeMin : `${userVote.vibeMin}-${userVote.vibeMax}`} · click para revisar`
        : 'Click para hacer tu vibe check'

  return (
    <div className="flex items-center gap-2">
      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        className={`group relative h-3 w-[180px] cursor-pointer transition-shadow md:w-[220px] ${
          editing
            ? 'shadow-[0_0_8px_rgba(245,197,0,0.55)]'
            : 'hover:shadow-[0_0_6px_rgba(245,197,0,0.35)]'
        }`}
        title={tip}
      >
        {/* Faint full-axis backdrop */}
        <div
          className="absolute inset-0 bg-vibe-gradient opacity-15"
          aria-hidden
        />

        {/* Lit segment — displayed band (or live drag preview) */}
        <div
          className="absolute inset-y-0 transition-[left,width] duration-75"
          style={{
            left: `${(renderMin / 10) * 100}%`,
            width: `${((renderMax - renderMin) / 10) * 100}%`,
            background: bandGradient(renderMin, renderMax),
            boxShadow: `0 0 4px ${labelColor}90`,
          }}
          aria-hidden
        />

        {/* Min thumb */}
        <button
          type="button"
          onPointerDown={handleThumbPointerDown('min')}
          aria-label={`Mínimo: ${renderMin}`}
          className="absolute inset-y-[-2px] flex w-3 -translate-x-1/2 cursor-col-resize items-stretch justify-center"
          style={{ left: `${(renderMin / 10) * 100}%` }}
        >
          <span
            className={`block h-full transition-all ${
              editing
                ? 'w-[3px] bg-[#F5C500] shadow-[0_0_6px_#F5C500]'
                : 'w-[2px] bg-white shadow-[0_0_4px_rgba(255,255,255,0.7)]'
            }`}
          />
        </button>

        {/* Max thumb */}
        <button
          type="button"
          onPointerDown={handleThumbPointerDown('max')}
          aria-label={`Máximo: ${renderMax}`}
          className="absolute inset-y-[-2px] flex w-3 -translate-x-1/2 cursor-col-resize items-stretch justify-center"
          style={{ left: `${(renderMax / 10) * 100}%` }}
        >
          <span
            className={`block h-full transition-all ${
              editing
                ? 'w-[3px] bg-[#F5C500] shadow-[0_0_6px_#F5C500]'
                : 'w-[2px] bg-white shadow-[0_0_4px_rgba(255,255,255,0.7)]'
            }`}
          />
        </button>

        {/* Author tick marks — persistent secondary anchors below the band.
            Self-revealing: while displayedBand === authorBand they sit
            directly under the lit band; they only visually separate when
            the crowd median diverges from the author. */}
        <div
          className="pointer-events-none absolute -bottom-[5px] left-0 right-0 h-1"
          aria-hidden
        >
          <div
            className="absolute h-full w-px bg-white/45"
            style={{ left: `${(authMin / 10) * 100}%` }}
          />
          {authMax !== authMin && (
            <div
              className="absolute h-full w-px bg-white/45"
              style={{ left: `${(authMax / 10) * 100}%` }}
            />
          )}
        </div>
      </div>

      <span
        className="font-mono text-[10px] tracking-widest tabular-nums"
        style={{ color: labelColor }}
      >
        {labelTxt}
      </span>

      {/* Crowd-check count — visible once at least one peer has weighed in.
          Threshold-crossing makes the band itself authoritative; the count
          is the meta hint. */}
      {aggregate.checkCount > 0 && !editing && (
        <span
          className="font-mono text-[9px] tracking-widest text-muted"
          title={`${aggregate.checkCount} vibe check${aggregate.checkCount === 1 ? '' : 's'}${
            aggregate.checkCount >= VIBE_CHECK_THRESHOLD ? ' · banda colectiva' : ' · aún muestra autor'
          }`}
        >
          {aggregate.checkCount >= VIBE_CHECK_THRESHOLD ? '◆' : '◇'}
          {aggregate.checkCount}
        </span>
      )}

      {/* User-vote indicator — subtle, only when present and not editing */}
      {userVote && !editing && (
        <span
          className="font-mono text-[9px] tracking-widest text-[#F5C500]"
          title={`Tu vibe check: ${userVote.vibeMin === userVote.vibeMax ? userVote.vibeMin : `${userVote.vibeMin}-${userVote.vibeMax}`}`}
        >
          ★{userVote.vibeMin === userVote.vibeMax ? userVote.vibeMin : `${userVote.vibeMin}-${userVote.vibeMax}`}
        </span>
      )}
    </div>
  )
}
