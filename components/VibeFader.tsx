'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { vibeRangeLabel, VIBE_SLOT_COLORS } from '@/lib/utils'
import {
  castVibeCheck,
  useUserVibeCheck,
  useVibeCheckAggregate,
  VIBE_CHECK_THRESHOLD,
} from '@/lib/vibeChecks'
import { useAuth } from '@/components/auth/useAuth'

// Full-width instrument: stepped thermal meter, personal handles, fixed author
// calibration. A >3px drag commits; keyboard arrows preview and Enter commits.
// Aggregate ballistics and the five-check author/median fall-through are shared
// across compact overlay seats and the expanded dashboard listening sheet.

interface Props {
  // Adds endpoints and the reading legend; both variants fill their seat.
  fullWidth?: boolean
  item: { id: string; vibeMin: number; vibeMax: number }
}

const VOID_THRESHOLD_PX = 3 // pointer-up this close to pointer-down counts as a click, not a drag

// Armed gold — the existing armed accent. Single source so chrome stays in sync.
const ARMED = '#F5C500'

// ── Meter ballistics (VU/PPM envelope) ──────────────────────────────────────
// Per-edge attack/release time constants in ms. Attack is fast (the needle
// catches a rising transient quickly); release is slow (it falls back lazily).
// These shape ONLY how the displayed band approaches its true live value — the
// target is always the real aggregate, never invented motion.
const ATTACK_MS = 90
const RELEASE_MS = 540

// Asymmetric one-pole follower: pulls `current` toward `target` with a time
// constant that depends on direction of travel (attack when |target|>|current|
// magnitude-wise per edge semantics, release otherwise). Frame-rate
// independent via dt. Returns the new value.
function followEdge(
  current: number,
  target: number,
  dtMs: number,
  attacking: boolean,
): number {
  const tau = attacking ? ATTACK_MS : RELEASE_MS
  // alpha = 1 - e^(-dt/tau): standard exponential smoothing coefficient.
  const alpha = 1 - Math.exp(-dtMs / tau)
  return current + (target - current) * alpha
}

export function VibeFader({ item, fullWidth = false }: Props) {
  const scaleId = useId()
  const { currentUser, openLogin } = useAuth()
  const viewerId = currentUser?.id ?? null
  const reducedMotion = useReducedMotion()

  const userVote = useUserVibeCheck(item.id, viewerId)
  const aggregate = useVibeCheckAggregate(item.id)

  const authorBand: [number, number] = [item.vibeMin, item.vibeMax]

  // The TRUE displayed band — author until the crowd crosses threshold, then
  // crowd median. This is the meter's target; the needle chases it ballistically.
  const targetBand: [number, number] =
    aggregate.checkCount >= VIBE_CHECK_THRESHOLD
      ? [aggregate.medianMin, aggregate.medianMax]
      : authorBand

  const [editing, setEditing] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [dragRange, setDragRange] = useState<[number, number] | null>(null)
  // Pulses gold for ~700ms right after a vote commits — the "EN-AIRE" flash.
  const [onAir, setOnAir] = useState(false)
  // Which thumb just released — drives the detent overshoot spring on that
  // thumb only (the other keeps following position with a calm transition).
  const [snapThumb, setSnapThumb] = useState<'min' | 'max' | null>(null)

  // ── Meter needle (ballistic displayed band) ──────────────────────────────
  // Smoothed copy of targetBand. Initialized AT target (no intro sweep on
  // mount — the meter is already locked when you open the overlay). A RAF loop
  // chases the live target with the VU envelope whenever they differ.
  const [needleBand, setNeedleBand] = useState<[number, number]>(targetBand)
  const needleRef = useRef<[number, number]>(targetBand)
  const targetRef = useRef<[number, number]>(targetBand)
  targetRef.current = targetBand

  useEffect(() => {
    // Reduced motion: the needle is instant — no envelope, no RAF.
    if (reducedMotion) {
      needleRef.current = targetBand
      setNeedleBand(targetBand)
      return
    }
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(64, now - last) // clamp tab-switch jumps
      last = now
      const [cMin, cMax] = needleRef.current
      const [tMin, tMax] = targetRef.current
      // Per-edge direction → attack (edge moving outward, signal rising) vs
      // release (edge settling inward). Min edge attacks when dropping toward 0
      // (band opening downward = colder transient arriving); max edge attacks
      // when rising. Symmetric "open fast, close slow" envelope on the span.
      const nMin = followEdge(cMin, tMin, dt, tMin < cMin)
      const nMax = followEdge(cMax, tMax, dt, tMax > cMax)
      const next: [number, number] = [nMin, nMax]
      needleRef.current = next
      // Stop the loop once locked within sub-pixel tolerance — idle overlays
      // must not hold a RAF (home is already at the context/perf ceiling).
      const locked =
        Math.abs(nMin - tMin) < 0.004 && Math.abs(nMax - tMax) < 0.004
      if (locked) {
        needleRef.current = [tMin, tMax]
        setNeedleBand([tMin, tMax])
        raf = 0
        return
      }
      setNeedleBand(next)
      raf = requestAnimationFrame(tick)
    }
    // Only spin up if we're actually off-target.
    const [cMin, cMax] = needleRef.current
    if (Math.abs(cMin - targetBand[0]) > 0.004 || Math.abs(cMax - targetBand[1]) > 0.004) {
      last = performance.now()
      raf = requestAnimationFrame(tick)
    }
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
    // Re-evaluated whenever the live target moves (median shift / threshold cross).
  }, [targetBand[0], targetBand[1], reducedMotion]) // eslint-disable-line react-hooks/exhaustive-deps

  const trackRef = useRef<HTMLDivElement>(null)
  const draggingThumbRef = useRef<'min' | 'max' | null>(null)
  const dragRangeRef = useRef<[number, number] | null>(null)
  const dragStartXRef = useRef<number>(0)
  const movedRef = useRef(false)

  const userVoteTuple: [number, number] | null = userVote
    ? [userVote.vibeMin, userVote.vibeMax]
    : null

  // Editable range — what thumbs sit at in edit mode and what the armed band
  // tracks during drag. Defaults to the user's saved vote, falls through to the
  // displayed (target) band for first-time operators.
  const editRange: [number, number] = dragRange ?? userVoteTuple ?? targetBand

  // Armed band — the user's live throw while editing. Shown only in edit mode.
  const armedRange: [number, number] | null = editing ? editRange : null

  const [authMin, authMax] = authorBand

  // Displayed needle edges (ballistic) drive the lit meter band in view mode;
  // Handles retain the personal vote after commit; first use starts at the meter.
  const [needleMin, needleMax] = needleBand
  const [thumbMin, thumbMax] = editing ? editRange : userVoteTuple ?? needleBand

  const valueFromX = (clientX: number): number => {
    const track = trackRef.current
    if (!track) return 0
    // offsetWidth, not getBoundingClientRect: inside OverlayShell the panel
    // transform makes gBCR return a near-zero box (documented trap). We still
    // need the track's viewport-left to map clientX, but gBCR.left is the only
    // viewport anchor available and IS reliable for left/top (the transform is
    // a scale/translate that preserves the left coordinate under the boot
    // anim's settle); width comes from offsetWidth which is transform-immune.
    const rect = track.getBoundingClientRect()
    const width = track.offsetWidth || rect.width || 1
    const ratio = (clientX - rect.left) / width
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
      const cur = dragRangeRef.current ?? userVoteTuple ?? targetBand
      const [curMin, curMax] = cur

      // Single-point auto-switch: when both thumbs sit at the same value, the
      // active thumb depends on drag direction. The DOM stacking puts 'max' on
      // top, so a leftward drag from a single point would otherwise be ignored
      // (max can't go below min). Flip to 'min' on leftward movement, 'max' on
      // rightward — feels natural either way.
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
      // clicks on a thumb stay in edit mode without saving — the friction that
      // protects against accidental on-air pushes. UNCHANGED.
      if (
        draggingThumbRef.current &&
        dragRangeRef.current &&
        movedRef.current &&
        viewerId
      ) {
        const [vMin, vMax] = dragRangeRef.current
        // Detent overshoot on the released thumb, then the EN-AIRE flash.
        setSnapThumb(draggingThumbRef.current)
        void castVibeCheck(item.id, viewerId, vMin, vMax)
        setOnAir(true)
        window.setTimeout(() => setOnAir(false), 720)
        window.setTimeout(() => setSnapThumb(null), 420)
        setEditing(false)
        setDragRange(null)
      }
      draggingThumbRef.current = null
      dragRangeRef.current = null
      movedRef.current = false
    }

    const onCancel = () => {
      draggingThumbRef.current = null
      dragRangeRef.current = null
      movedRef.current = false
      setDragRange(null)
      setEditing(false)
    }

    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, item.id, viewerId])

  // Click outside the fader exits edit mode without saving (disarm)
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

  // ESC cancels (disarm)
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
      dragRangeRef.current = userVoteTuple ?? targetBand
      dragStartXRef.current = e.clientX
      movedRef.current = false
    }

  // Keyboard changes are a preview; Enter is the deliberate commit gesture.
  const handleThumbKeyDown = (thumb: 'min' | 'max') => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(e.key)) return
    e.preventDefault()
    e.stopPropagation()
    if (!viewerId) { openLogin(); return }
    if (e.key === 'Enter' || e.key === ' ') {
      if (editing && dragRange) {
        void castVibeCheck(item.id, viewerId, dragRange[0], dragRange[1])
        setOnAir(true)
        window.setTimeout(() => setOnAir(false), 720)
        setEditing(false)
        setDragRange(null)
        dragRangeRef.current = null
      } else setEditing(true)
      return
    }
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1
    const [min, max] = editRange
    const next: [number, number] = thumb === 'min'
      ? [Math.max(0, Math.min(max, min + delta)), max]
      : [min, Math.min(10, Math.max(min, max + delta))]
    setEditing(true)
    setDragRange(next)
    dragRangeRef.current = next
  }

  // Label — editing shows the live throw, view shows the displayed band
  // (quantized to slots so the readout matches the engraved scale, never a
  // fractional in-flight needle value). Uses vibeRangeLabel so the format
  // ("4-7 · COOL → HOT") matches the rest of the codebase.
  const labelRange: [number, number] = editing
    ? editRange
    : [Math.round(needleMin), Math.round(needleMax)]
  const [labelMin, labelMax] = labelRange
  const labelTxt = vibeRangeLabel({ vibeMin: labelMin, vibeMax: labelMax })

  // Opacity scaling for the lit meter band: dims in edit mode so the armed
  // throw takes focus.
  const meterOpacity = editing ? 0.32 : 1

  // Peak-hold ticks track the user's committed vote (held position). Visible
  // whenever they've voted; brighten on hover; suppressed while arming so the
  // gold throw owns the surface.
  const peakHoldOpacity = editing ? 0 : hovered ? 1 : 0.85

  const tip = !viewerId
    ? 'Inicia sesión para hacer tu vibe check'
    : editing
      ? 'ARMADO · arrastra el fader para salir EN AIRE · ESC para cancelar'
      : userVote
        ? `Tu vibe check: ${vibeRangeLabel({ vibeMin: userVote.vibeMin, vibeMax: userVote.vibeMax })} · click para rearmar`
        : 'Click para armar tu vibe check'

  // ── Throw geometry — ARM widens the fader ────────────────────────────────
  // The track grows taller on arm: the growth IS the going-on-air cue. Reduced
  // motion gets the grown height instantly (designed static armed state).
  const restH = 20 // Visible tape; the interaction surface always stays 44px tall.
  const armedH = 26
  const trackH = editing ? armedH : restH
  const heightTransition = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 520, damping: 30 }

  // Detent spring for a just-released thumb (overshoot click); calm tween
  // otherwise. Reduced motion → no positional animation.
  const thumbPosTransition = (which: 'min' | 'max') =>
    reducedMotion
      ? { duration: 0 }
      : snapThumb === which
        ? { type: 'spring' as const, stiffness: 700, damping: 12 } // overshoot detent
        : { type: 'spring' as const, stiffness: 900, damping: 40 } // calm follow

  return (
    <div className="w-full min-w-0 flex-1 basis-64 text-panel-text">
      <p id={`${scaleId}-help`} className="sr-only">{viewerId ? 'Arrastra para registrar. Con teclado: flechas para ajustar, Enter para registrar y Escape para cancelar.' : 'Inicia sesión para hacer tu vibe check.'}</p>
      {/* Metadata gets its own row. It can never steal the fader's throw. */}
      <div className="mb-1 flex min-h-4 items-baseline justify-between gap-3 font-mono text-[10px] tracking-wider">
        <span className="min-w-0 truncate font-bold">{editing ? 'TU LECTURA' : fullWidth ? 'RANGO DE LA PIEZA' : 'VIBE CHECK'} <span className="ml-2 font-normal text-panel-text">{labelMin === labelMax ? labelMin : `${labelMin}–${labelMax}`} · {labelTxt}</span></span>
        <span className="shrink-0 text-[#F5C500]" aria-live="polite">{onAir ? '◉ EN AIRE' : editing ? '◎ ARMADO' : ''}</span>
      </div>
      {fullWidth && <div aria-hidden className="mb-2 mt-4 flex justify-between font-mono text-d11 tracking-widest"><span className="text-vibe-1">GLACIAL</span><span className="text-vibe-10">VOLCÁN</span></div>}
      {/* Padding keeps the generous edge hit areas inside the faceplate. */}
      <div className="px-4">
        <svg aria-hidden width="100%" height="16" className="overflow-visible font-mono text-[10px] text-panel-text">
          {VIBE_SLOT_COLORS.map((_, n) => <text key={n} x={`${n * 10}%`} y="11" fill="currentColor" textAnchor={n === 0 ? 'start' : n === 10 ? 'end' : 'middle'}>{n}</text>)}
        </svg>
        <div
          ref={trackRef}
          onPointerDown={handleTrackPointerDown}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="group relative h-11 w-full touch-none cursor-pointer"
          title={tip}
        >
          <motion.div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2" animate={{ height: trackH }} initial={false} transition={heightTransition}>
            <svg aria-hidden viewBox="0 0 1000 26" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <defs>
                <clipPath id={`${scaleId}-meter`}><rect x={Math.max(0, needleMin * 100 - 50)} y="0" width={Math.min(1000, needleMax * 100 + 50) - Math.max(0, needleMin * 100 - 50)} height="26" /></clipPath>
                {armedRange && <clipPath id={`${scaleId}-armed`}><rect x={Math.max(0, armedRange[0] * 100 - 50)} y="0" width={Math.min(1000, armedRange[1] * 100 + 50) - Math.max(0, armedRange[0] * 100 - 50)} height="26" /></clipPath>}
              </defs>
              {/* Canonical hard-stepped thermal colors, anchored to the scale. */}
              {VIBE_SLOT_COLORS.map((color, n) => <rect key={`base-${n}`} x={Math.max(0, n * 100 - 50)} y="0" width={n === 0 || n === 10 ? 50 : 100} height="26" fill={color} opacity="0.32" />)}
              <g clipPath={`url(#${scaleId}-meter)`} opacity={meterOpacity}>{VIBE_SLOT_COLORS.map((color, n) => <rect key={n} x={Math.max(0, n * 100 - 50)} y="0" width={n === 0 || n === 10 ? 50 : 100} height="26" fill={color} />)}</g>
              {armedRange && <g clipPath={`url(#${scaleId}-armed)`}>{VIBE_SLOT_COLORS.map((color, n) => <rect key={n} x={Math.max(0, n * 100 - 50)} y="0" width={n === 0 || n === 10 ? 50 : 100} height="26" fill={color} />)}</g>}
              {Array.from({ length: 51 }, (_, n) => <line key={n} x1={n * 20} x2={n * 20} y1={n % 5 === 0 ? 14 : 21} y2="26" stroke="#0D0D0D" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
              <line x1="0" x2="1000" y1="26" y2="26" stroke={editing || onAir ? ARMED : '#ffffff66'} vectorEffect="non-scaling-stroke" />
            </svg>
          </motion.div>

          {/* Personal reading: a held white bracket, independent of the meter. */}
          {userVoteTuple && <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" opacity={peakHoldOpacity}>
            <line x1={`${userVoteTuple[0] * 10}%`} x2={`${userVoteTuple[1] * 10}%`} y1="3" y2="3" stroke="white" />
            {Array.from(new Set(userVoteTuple)).map(v => <rect key={v} x={`${v * 10}%`} y="0" width="4" height="6" fill="white" />)}
          </svg>}

          {(['min', 'max'] as const).map(which => {
            const value = which === 'min' ? thumbMin : thumbMax
            return <motion.button
              key={which}
              type="button"
              onPointerDown={handleThumbPointerDown(which)}
              onKeyDown={handleThumbKeyDown(which)}
              role="slider"
              aria-valuemin={which === 'min' ? 0 : Math.round(thumbMin)}
              aria-valuemax={which === 'min' ? Math.round(thumbMax) : 10}
              aria-valuenow={Math.round(value)}
              aria-describedby={`${scaleId}-help`}
              aria-label={`${which === 'min' ? 'Mínimo' : 'Máximo'}: ${Math.round(value)}`}
              className="absolute inset-y-0 flex w-8 -translate-x-1/2 touch-none cursor-col-resize items-center justify-center outline-none focus-visible:ring-1 focus-visible:ring-[#F5C500]"
              animate={{ left: `${value * 10}%` }}
              initial={false}
              transition={draggingThumbRef.current === which ? { duration: 0 } : thumbPosTransition(which)}
            >
              <span className={`flex h-8 w-3.5 items-center justify-center gap-px rounded-[2px] border border-black/80 shadow-[0_2px_5px_#000] ${editing || onAir ? 'bg-[#F5C500]' : 'bg-paper'}`}>
                <span className="h-4 w-px bg-black/60" /><span className="h-4 w-px bg-black/60" />
              </span>
            </motion.button>
          })}

          {/* Author calibration remains fixed below the interactive range. */}
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            <line x1={`${authMin * 10}%`} x2={`${authMax * 10}%`} y1="42" y2="42" stroke="#ffffff66" strokeDasharray="2 2" />
            {[authMin, authMax].map((v, i) => <line key={i} x1={`${v * 10}%`} x2={`${v * 10}%`} y1="38" y2="44" stroke="#ffffff99" />)}
          </svg>
        </div>
      </div>
      {fullWidth && <div className="mt-3 grid gap-3 border-t border-white/25 pt-3 font-mono text-d11 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <span>▰ {aggregate.checkCount >= VIBE_CHECK_THRESHOLD ? 'RANGO COLECTIVO' : 'RANGO DEL AUTOR'}: {targetBand[0]}–{targetBand[1]}</span>
          <span>⌜ TU LECTURA: {userVoteTuple ? `${userVoteTuple[0]}–${userVoteTuple[1]}` : 'SIN REGISTRAR'}</span>
          {aggregate.checkCount >= VIBE_CHECK_THRESHOLD && <span>┊ AUTOR: {authMin}–{authMax}</span>}
        </div>
        <p className="max-w-72 text-panel-text/75">{viewerId ? 'Arrastra un extremo y suelta para registrar tu rango.' : 'Inicia sesión para registrar tu lectura.'}</p>
      </div>}
    </div>
  )
}
