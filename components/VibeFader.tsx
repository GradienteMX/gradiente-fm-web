'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { vibeToColor, vibeRangeLabel } from '@/lib/utils'
import {
  castVibeCheck,
  useUserVibeCheck,
  useVibeCheckAggregate,
  VIBE_CHECK_THRESHOLD,
} from '@/lib/vibeChecks'
import { useAuth } from '@/components/auth/useAuth'

// ── The broadcast channel fader ──────────────────────────────────────────────
//
// In-overlay drag-to-commit crowd-vibe control, dressed as a CDMX-transmission
// CHANNEL FADER going ON AIR. The intentional drag-to-commit friction is the
// whole point — broadcast semantics JUSTIFY it (you don't bump a channel live
// by accident), so the friction reads as professional, not awkward. Nothing
// about the commitment gesture is softened here; it's the same drag-past-3px
// commit as before, just operated like real console hardware.
//
// CONSOLE VOCABULARY mapped onto the live vibe-check data:
//
//   METER (crowd needle) — the displayed band (author until the crowd reaches
//     threshold, then crowd median) is driven by a VU/PPM envelope follower:
//     fast attack toward a new aggregate, slow release back. The band edges
//     never *snap* to a new median — they ballistically chase it, exactly like
//     a meter needle catching a transient. TRUE data; the only thing animated
//     is how the real value is approached.
//
//   PEAK-HOLD (your committed vote) — the user's own saved [min,max] renders as
//     two peak-hold ticks that STAY put after commit. Distinct from the moving
//     crowd needle: the held peak is where YOU set the channel, frozen.
//
//   CALIBRATION (author range) — the author's [vibeMin,vibeMax] are factory
//     calibration marks engraved below the throw: fixed reference, visually
//     subordinate to the live needle + peak-hold.
//
//   FADER-START = ARM — entering edit mode WIDENS the throw (the track grows
//     taller). The growth IS the "armed / going on-air" cue; gold (#F5C500)
//     dresses the armed state. The committed drag is the on-air gesture. A
//     micro-label reads ARMADO while editing, EN-AIRE the moment a vote lands.
//
//   DETENT — release snaps the dragged thumb to its integer slot with a slight
//     overshoot (the felt "click" of a fader hitting a detent), via a spring
//     position transition. Reduced motion → instant, no ballistics.
//
// Colors: thermal ramp (vibeToColor) for all signal, gold (#F5C500) for the
// armed accent only, grey/white chrome for engraving. No other hues.
//
// Login-gated. Click while logged-out → openLogin().

interface Props {
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

function bandGradient(min: number, max: number): string {
  if (min === max) return vibeToColor(min)
  const span = Math.max(1, max - min)
  const stops: string[] = []
  for (let i = Math.floor(min); i <= Math.ceil(max); i++) {
    const pct = ((i - min) / span) * 100
    stops.push(`${vibeToColor(i)} ${pct.toFixed(2)}%`)
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

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

export function VibeFader({ item }: Props) {
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
  // in edit mode the thumbs follow the armed editRange instead.
  const [needleMin, needleMax] = needleBand
  const [thumbMin, thumbMax] = editing ? editRange : needleBand

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

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
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

  // Label — editing shows the live throw, view shows the displayed band
  // (quantized to slots so the readout matches the engraved scale, never a
  // fractional in-flight needle value). Uses vibeRangeLabel so the format
  // ("4-7 · COOL → HOT") matches the rest of the codebase.
  const labelRange: [number, number] = editing
    ? editRange
    : [Math.round(needleMin), Math.round(needleMax)]
  const [labelMin, labelMax] = labelRange
  const labelTxt = vibeRangeLabel({ vibeMin: labelMin, vibeMax: labelMax })
  const labelColor = vibeToColor(Math.round((labelMin + labelMax) / 2))

  // Opacity scaling for the lit meter band: dims in edit mode so the armed
  // throw takes focus.
  const meterOpacity = editing ? 0.32 : 1

  // Peak-hold ticks track the user's committed vote (held position). Visible
  // whenever they've voted; brighten on hover; suppressed while arming so the
  // gold throw owns the surface.
  const peakHoldOpacity = editing ? 0 : hovered ? 1 : 0.7

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
  const restH = 12 // px — the at-rest throw
  const armedH = 22 // px — the widened (armed) throw
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
    // flex-wrap + min-w-0 so the readout labels drop BELOW the track on a phone
    // instead of forcing the row ~470px wide (the overlay sideways-drift cause).
    // Stays a single nowrap row from sm up.
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 sm:flex-nowrap">
      <motion.div
        ref={trackRef}
        onPointerDown={handleTrackPointerDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="group relative w-full max-w-[180px] cursor-pointer md:w-[220px] md:max-w-none"
        animate={{ height: trackH }}
        initial={false}
        transition={heightTransition}
        style={{
          // Armed/on-air glow lives on the throw itself so the widening reads
          // as the channel powering up. EN-AIRE pulses brighter for ~0.7s.
          boxShadow: onAir
            ? `0 0 14px ${ARMED}, 0 0 4px ${ARMED}`
            : editing
              ? `0 0 9px ${ARMED}99`
              : hovered
                ? `0 0 6px ${ARMED}59`
                : 'none',
          transition: 'box-shadow 180ms linear',
        }}
        title={tip}
      >
        {/* Layer 1: throw scale — faint full-axis backdrop, the engraved 0–10
            terrain past the lit segment. */}
        <div
          className="absolute inset-0 bg-vibe-gradient opacity-[0.14]"
          aria-hidden
        />

        {/* Layer 2: METER — the lit displayed band, driven by the ballistic
            needle (VU envelope chasing the live aggregate). Dims while armed.
            Positions come from the smoothed needle, not the raw target, so it
            reads as a meter catching the signal rather than a hard jump. The
            needle band is set per-RAF; left/width are written directly (no CSS
            transition — the RAF IS the animation). */}
        <div
          className="absolute inset-y-0"
          style={{
            left: `${(needleMin / 10) * 100}%`,
            width: `${((needleMax - needleMin) / 10) * 100}%`,
            background: bandGradient(needleMin, needleMax),
            opacity: meterOpacity,
            boxShadow: `0 0 5px ${vibeToColor(Math.round((needleMin + needleMax) / 2))}90`,
            transition: 'opacity 140ms linear',
          }}
          aria-hidden
        />

        {/* Layer 3: ARMED throw — the user's live fader band while editing.
            Gold-outlined, full vibe gradient. Only present in edit mode; the
            committed (held) state lives in the peak-hold ticks instead. */}
        {armedRange && (
          <div
            className="absolute inset-y-0"
            style={{
              left: `${(armedRange[0] / 10) * 100}%`,
              width: `${((armedRange[1] - armedRange[0]) / 10) * 100}%`,
              background: bandGradient(armedRange[0], armedRange[1]),
              opacity: 1,
              outline: `1px solid ${ARMED}`,
              outlineOffset: -1,
              boxShadow: `0 0 7px ${ARMED}99`,
            }}
            aria-hidden
          />
        )}

        {/* Layer 4: PEAK-HOLD — the user's committed vote, frozen. Two held
            ticks (min + max edge) that stay after commit, distinct from the
            moving crowd needle. A bright cap + faint stem reads as a peak-hold
            marker on a meter. Hidden while arming. */}
        {userVoteTuple && (
          <div
            className="pointer-events-none absolute inset-y-0"
            style={{ opacity: peakHoldOpacity, transition: 'opacity 140ms linear' }}
            aria-hidden
          >
            {[userVoteTuple[0], userVoteTuple[1]].map((v, i) =>
              // Collapse the duplicate when the vote is a single point.
              i === 1 && userVoteTuple[0] === userVoteTuple[1] ? null : (
                <div
                  key={i}
                  className="absolute inset-y-0 w-px -translate-x-1/2"
                  style={{
                    left: `${(v / 10) * 100}%`,
                    background: vibeToColor(v),
                    boxShadow: `0 0 4px ${vibeToColor(v)}`,
                  }}
                >
                  {/* peak cap */}
                  <div
                    className="absolute left-1/2 top-[-2px] h-[3px] w-[5px] -translate-x-1/2"
                    style={{ background: vibeToColor(v) }}
                  />
                </div>
              ),
            )}
          </div>
        )}

        {/* Layer 5: fader thumbs — the channel handles. White grip caps in view
            mode at the meter edges (affordance hint); gold + grabbable while
            armed at the throw edges. A released thumb springs through its
            detent (overshoot). Position animates via Framer spring; in edit
            mode it tracks the drag with a stiff calm spring (near-instant
            follow) and overshoots only on release. */}
        <motion.button
          type="button"
          onPointerDown={handleThumbPointerDown('min')}
          aria-label={`Mínimo: ${thumbMin}`}
          className="absolute inset-y-[-3px] flex w-8 -translate-x-1/2 cursor-col-resize items-stretch justify-center sm:w-3"
          animate={{ left: `${(thumbMin / 10) * 100}%` }}
          initial={false}
          transition={
            // While actively dragging this thumb, follow instantly (no spring
            // lag under the pointer); otherwise spring (detent on release).
            draggingThumbRef.current === 'min'
              ? { duration: 0 }
              : thumbPosTransition('min')
          }
        >
          <span
            className="block h-full transition-[width,background-color,box-shadow] duration-150"
            style={
              editing
                ? { width: 3, background: ARMED, boxShadow: `0 0 6px ${ARMED}` }
                : {
                    width: 2,
                    background: '#fff',
                    boxShadow: '0 0 4px rgba(255,255,255,0.7)',
                  }
            }
          />
        </motion.button>

        <motion.button
          type="button"
          onPointerDown={handleThumbPointerDown('max')}
          aria-label={`Máximo: ${thumbMax}`}
          className="absolute inset-y-[-3px] flex w-8 -translate-x-1/2 cursor-col-resize items-stretch justify-center sm:w-3"
          animate={{ left: `${(thumbMax / 10) * 100}%` }}
          initial={false}
          transition={
            draggingThumbRef.current === 'max'
              ? { duration: 0 }
              : thumbPosTransition('max')
          }
        >
          <span
            className="block h-full transition-[width,background-color,box-shadow] duration-150"
            style={
              editing
                ? { width: 3, background: ARMED, boxShadow: `0 0 6px ${ARMED}` }
                : {
                    width: 2,
                    background: '#fff',
                    boxShadow: '0 0 4px rgba(255,255,255,0.7)',
                  }
            }
          />
        </motion.button>

        {/* Layer 6: CALIBRATION marks — the author's range, engraved as fixed
            factory reference below the throw. Subordinate: thin, dim, with a
            hairline base rule connecting them so they read as a printed scale
            mark, not another needle. Self-revealing — sit under the lit meter
            when displayed == author, only separate once the crowd diverges. */}
        <div
          className="pointer-events-none absolute -bottom-[6px] left-0 right-0 h-[5px]"
          aria-hidden
        >
          <div
            className="absolute bottom-0 h-px bg-white/15"
            style={{
              left: `${(authMin / 10) * 100}%`,
              width: `${(Math.max(0, authMax - authMin) / 10) * 100}%`,
            }}
          />
          <div
            className="absolute bottom-0 h-full w-px bg-white/40"
            style={{ left: `${(authMin / 10) * 100}%` }}
          />
          {authMax !== authMin && (
            <div
              className="absolute bottom-0 h-full w-px bg-white/40"
              style={{ left: `${(authMax / 10) * 100}%` }}
            />
          )}
        </div>
      </motion.div>

      {/* Channel-state micro-label — the broadcast voice. ARMADO while editing,
          a transient EN AIRE on commit, else hidden (slot stays reserved so
          the meta strip never reflows). Gold to match the armed accent. */}
      <span
        className="inline-block min-w-0 font-mono text-[10px] font-bold tracking-[0.18em] tabular-nums whitespace-normal sm:min-w-[3.25rem] sm:text-[8px] sm:whitespace-nowrap"
        style={{
          color: ARMED,
          opacity: editing || onAir ? 1 : 0,
          transition: 'opacity 160ms linear',
        }}
        aria-hidden={!editing && !onAir}
      >
        {onAir ? '◉ EN AIRE' : editing ? '◎ ARMADO' : ''}
      </span>

      {/* Numeric label + vibe names — vibeRangeLabel("4-7 · COOL → HOT").
          Fixed min-width slot so the label's content can change between
          single-point ("5 · GROOVE") and range ("0-10 · GLACIAL → VOLCÁN")
          without reflowing the surrounding meta strip. */}
      <span
        className="inline-block min-w-0 font-mono text-[10px] tracking-widest tabular-nums whitespace-normal sm:min-w-[12rem] sm:whitespace-nowrap"
        style={{ color: labelColor }}
      >
        {labelTxt}
      </span>

      {/* Crowd-check count — always rendered to keep the slot stable. Empty
          when zero, visibility-hidden in edit mode, ◆ when the crowd has
          crossed threshold (meter is crowd-authoritative), ◇ otherwise. */}
      <span
        className={`inline-block min-w-0 font-mono text-[10px] tracking-widest text-muted whitespace-normal sm:min-w-[1.75rem] sm:text-[9px] sm:whitespace-nowrap ${
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
