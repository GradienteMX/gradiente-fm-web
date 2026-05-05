'use client'

import { useEffect, useRef, useState } from 'react'
import { vibeToColor, vibeRangeLabel } from '@/lib/utils'
import {
  castVibeCheck,
  useUserVibeCheck,
  useVibeCheckAggregate,
  VIBE_CHECK_THRESHOLD,
} from '@/lib/vibeChecks'
import { useAuth } from '@/components/auth/useAuth'

// Inline replacement for the static VIBE row across all overlays.
//
// Visual stack (bottom → top):
//   1. Faint full-axis backdrop — shows the 0–10 scale subtly so dragging
//      has visible terrain past the lit band.
//   2. Lit displayed band — full-opacity vibe gradient at the displayed
//      range (author until crowd reaches threshold; crowd median after).
//      Dims to 30% in edit mode so the user's vote can take focus.
//   3. User-vote ghost — vibe gradient at the user's range, opacity scales
//      with interaction: 25% at rest (persistent post-commit feedback),
//      60% on hover, 100% in edit mode.
//   4. Thumbs — white in view mode at displayed-band edges (decorative
//      affordance hint), gold + draggable in edit mode at the user-vote /
//      drag-preview edges.
//   5. Author tick marks — persistent secondary anchors below the band.
//
// Login-gated. Click while logged-out → openLogin().

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

  const displayedBand: [number, number] =
    aggregate.checkCount >= VIBE_CHECK_THRESHOLD
      ? [aggregate.medianMin, aggregate.medianMax]
      : authorBand

  const [editing, setEditing] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [dragRange, setDragRange] = useState<[number, number] | null>(null)

  const trackRef = useRef<HTMLDivElement>(null)
  const draggingThumbRef = useRef<'min' | 'max' | null>(null)
  const dragRangeRef = useRef<[number, number] | null>(null)
  const dragStartXRef = useRef<number>(0)
  const movedRef = useRef(false)

  const userVoteTuple: [number, number] | null = userVote
    ? [userVote.vibeMin, userVote.vibeMax]
    : null

  // Editable range — what thumbs sit at in edit mode and what the ghost
  // overlay tracks during drag. Defaults to the user's saved vote, falls
  // through to the displayed band for first-time voters.
  const editRange: [number, number] = dragRange ?? userVoteTuple ?? displayedBand

  // Ghost band — represents the user's vote. Shown in view mode (faint) when
  // they've voted, at full opacity when editing. Hidden when no prior vote
  // and not editing.
  const ghostRange: [number, number] | null = editing
    ? editRange
    : userVoteTuple

  const [dispMin, dispMax] = displayedBand
  const [authMin, authMax] = authorBand

  // Thumb positions follow editRange in edit mode, displayed in view mode.
  const [thumbMin, thumbMax] = editing ? editRange : displayedBand

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

      // Single-point auto-switch: when both thumbs sit at the same value,
      // the active thumb depends on drag direction. The DOM stacking puts
      // 'max' on top, so a leftward drag from a single point would otherwise
      // be ignored (max can't go below min). Flip to 'min' on leftward
      // movement, 'max' on rightward — feels natural either way.
      if (curMin === curMax) {
        if (val < curMin && draggingThumbRef.current === 'max') {
          draggingThumbRef.current = 'min'
        } else if (val > curMax && draggingThumbRef.current === 'min') {
          draggingThumbRef.current = 'max'
        }
      }

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

  // Label — editing shows the live drag preview, view shows the displayed
  // band. Uses vibeRangeLabel so the format ("4-7 · COOL → HOT") matches
  // the rest of the codebase.
  const labelRange: [number, number] = editing ? editRange : displayedBand
  const [labelMin, labelMax] = labelRange
  const labelTxt = vibeRangeLabel({ vibeMin: labelMin, vibeMax: labelMax })
  const labelColor = vibeToColor(Math.round((labelMin + labelMax) / 2))

  // Opacity scaling for the two band layers
  const dispOpacity = editing ? 0.3 : 1
  const ghostOpacity = editing ? 1 : hovered ? 0.6 : 0.25

  const tip = !viewerId
    ? 'Inicia sesión para hacer tu vibe check'
    : editing
      ? 'Arrastra los marcadores para tu vibe check · ESC para cancelar'
      : userVote
        ? `Tu vibe check: ${vibeRangeLabel({ vibeMin: userVote.vibeMin, vibeMax: userVote.vibeMax })} · click para revisar`
        : 'Click para hacer tu vibe check'

  return (
    <div className="flex items-center gap-2">
      <div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`group relative h-3 w-[180px] cursor-pointer transition-shadow md:w-[220px] ${
          editing
            ? 'shadow-[0_0_8px_rgba(245,197,0,0.55)]'
            : 'hover:shadow-[0_0_6px_rgba(245,197,0,0.35)]'
        }`}
        title={tip}
      >
        {/* Layer 1: faint full-axis backdrop */}
        <div
          className="absolute inset-0 bg-vibe-gradient opacity-15"
          aria-hidden
        />

        {/* Layer 2: lit displayed band — dims to 30% in edit mode */}
        <div
          className="absolute inset-y-0 transition-[opacity,left,width] duration-100"
          style={{
            left: `${(dispMin / 10) * 100}%`,
            width: `${((dispMax - dispMin) / 10) * 100}%`,
            background: bandGradient(dispMin, dispMax),
            opacity: dispOpacity,
            boxShadow: `0 0 4px ${vibeToColor(Math.round((dispMin + dispMax) / 2))}90`,
          }}
          aria-hidden
        />

        {/* Layer 3: user-vote ghost — opacity scales with interaction.
            Outlined in EVA gold while editing so it reads as "yours". */}
        {ghostRange && (
          <div
            className="absolute inset-y-0 transition-[opacity,left,width] duration-100"
            style={{
              left: `${(ghostRange[0] / 10) * 100}%`,
              width: `${((ghostRange[1] - ghostRange[0]) / 10) * 100}%`,
              background: bandGradient(ghostRange[0], ghostRange[1]),
              opacity: ghostOpacity,
              outline: editing ? '1px solid #F5C500' : 'none',
              outlineOffset: -1,
              boxShadow: editing
                ? '0 0 6px rgba(245,197,0,0.6)'
                : 'none',
            }}
            aria-hidden
          />
        )}

        {/* Layer 4: thumbs — white in view mode at displayed edges (subtle
            affordance hint), gold + draggable in edit mode at editRange.
            Position transitions smoothly when entering/leaving edit. */}
        <button
          type="button"
          onPointerDown={handleThumbPointerDown('min')}
          aria-label={`Mínimo: ${thumbMin}`}
          className="absolute inset-y-[-2px] flex w-3 -translate-x-1/2 cursor-col-resize items-stretch justify-center transition-[left] duration-100"
          style={{ left: `${(thumbMin / 10) * 100}%` }}
        >
          <span
            className={`block h-full transition-all ${
              editing
                ? 'w-[3px] bg-[#F5C500] shadow-[0_0_6px_#F5C500]'
                : 'w-[2px] bg-white shadow-[0_0_4px_rgba(255,255,255,0.7)]'
            }`}
          />
        </button>

        <button
          type="button"
          onPointerDown={handleThumbPointerDown('max')}
          aria-label={`Máximo: ${thumbMax}`}
          className="absolute inset-y-[-2px] flex w-3 -translate-x-1/2 cursor-col-resize items-stretch justify-center transition-[left] duration-100"
          style={{ left: `${(thumbMax / 10) * 100}%` }}
        >
          <span
            className={`block h-full transition-all ${
              editing
                ? 'w-[3px] bg-[#F5C500] shadow-[0_0_6px_#F5C500]'
                : 'w-[2px] bg-white shadow-[0_0_4px_rgba(255,255,255,0.7)]'
            }`}
          />
        </button>

        {/* Layer 5: author tick marks. Self-revealing — sit under the lit
            band when displayed = author, only visually separate once the
            crowd median diverges. */}
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

      {/* Numeric label + vibe names — vibeRangeLabel("4-7 · COOL → HOT").
          Fixed min-width slot so the label's content can change between
          single-point ("5 · GROOVE") and range ("0-10 · GLACIAL → VOLCÁN")
          without reflowing the surrounding meta strip (the parent flex
          uses `ml-auto` in some overlays — any inner width change shifts
          the block's left edge). */}
      <span
        className="inline-block min-w-[12rem] font-mono text-[10px] tracking-widest tabular-nums whitespace-nowrap"
        style={{ color: labelColor }}
      >
        {labelTxt}
      </span>

      {/* Crowd-check count — always rendered to keep the slot stable.
          Empty when zero, visibility-hidden in edit mode, ◆ when the
          crowd has crossed threshold, ◇ otherwise. */}
      <span
        className={`inline-block min-w-[1.75rem] font-mono text-[9px] tracking-widest text-muted whitespace-nowrap ${
          editing || aggregate.checkCount === 0 ? 'invisible' : ''
        }`}
        aria-hidden={editing || aggregate.checkCount === 0}
        title={
          aggregate.checkCount === 0
            ? undefined
            : `${aggregate.checkCount} vibe check${aggregate.checkCount === 1 ? '' : 's'}${
                aggregate.checkCount >= VIBE_CHECK_THRESHOLD
                  ? ' · banda colectiva'
                  : ' · aún muestra autor'
              }`
        }
      >
        {aggregate.checkCount > 0 && (
          <>
            {aggregate.checkCount >= VIBE_CHECK_THRESHOLD ? '◆' : '◇'}
            {aggregate.checkCount}
          </>
        )}
      </span>
    </div>
  )
}
