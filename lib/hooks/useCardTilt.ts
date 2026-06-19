'use client'

// ── useCardTilt — signal-panel 3D pointer-tilt (redesign 2026) ───────────────
//
// Cards read as physical broadcast/signal PANELS: on pointer-move over a card
// (fine-pointer / desktop only) the card tilts in 3D toward the cursor — a
// small rotateX/rotateY under a perspective host — and the flyer image sits at
// a slight negative translateZ BEHIND the chrome frame + VibeMeter + type
// badge, so moving the pointer reveals depth like examining a physical slide
// under glass. Eases back to flat on leave.
//
// This is a pure VISUAL LAYER. It applies the transform to an INNER wrapper
// (NOT the MosaicItem element Framer Motion controls via layout="position" —
// fighting Framer's transform breaks the grid reflow), drives everything with
// imperative refs (no per-frame React state → zero re-render churn during a
// mouse-move), and never touches the click target, focus, text selection,
// screen-reader semantics, or the .flyer-scope hover-develop. transform-only,
// so it stays on the compositor — no WebGL, no canvas.
//
// Honesty / safety:
//   - The tilt carries a TRUE interaction (the pointer position over the card).
//     No RNG, no idle animation, no decoration.
//   - prefers-reduced-motion OR a coarse pointer (touch) → NO tilt at all. The
//     card stays flat; the develop-on-hover is unchanged. This is the designed
//     static state for the motion, not a degraded one.
//   - transform-only (rotate + translateZ) → composited, never paints, never
//     oscillates full-surface luminance. Photosensitivity-safe by construction.

import { useCallback, useEffect, useRef, type CSSProperties } from 'react'

// ── Tunables ─────────────────────────────────────────────────────────────────

/** Max tilt away from flat, per axis, in degrees. Capped low so the card reads
 *  as a panel being examined, not a flipping card. */
export const MAX_TILT_DEG = 7

/** Parallax depth (CSS px) the recessed image sits behind the chrome plane.
 *  The image layer gets translateZ(-PARALLAX_Z); the chrome layer (frame,
 *  VibeMeter, badges) gets translateZ(+PARALLAX_Z) so it floats above. */
export const PARALLAX_Z = 18

/** Ease-back-to-flat transition (ms) applied on pointer-leave / blur. While the
 *  pointer is moving we update the transform every frame (no transition) so it
 *  tracks 1:1; on leave we re-enable a short transition to settle to neutral. */
export const EASE_MS = 260

/** Perspective distance (CSS px) on the host. Larger = flatter / subtler 3D.
 *  Tuned so MAX_TILT_DEG reads as a gentle lean, not a fisheye. */
const PERSPECTIVE_PX = 900

export interface CardTilt {
  /** Spread onto the perspective HOST (the focusable role="button" wrapper).
   *  Establishes the 3D viewing frustum and wires the pointer/focus listeners. */
  hostProps: {
    ref: (node: HTMLDivElement | null) => void
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
    onPointerLeave: () => void
    onFocus: () => void
    onBlur: () => void
  }
  /** Spread onto the INNER tilt wrapper (the element that actually rotates).
   *  Carries transform-style: preserve-3d so the image/chrome translateZ
   *  layers separate into real depth. */
  tiltProps: {
    ref: (node: HTMLDivElement | null) => void
    style: CSSProperties
  }
  /** translateZ for the recessed image layer (behind the chrome plane). */
  imageZStyle: CSSProperties
  /** translateZ for the lifted chrome layer (frame, VibeMeter, badges). */
  chromeZStyle: CSSProperties
}

export function useCardTilt(): CardTilt {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const tiltRef = useRef<HTMLDivElement | null>(null)
  // Whether tilt is allowed at all (fine pointer + motion ok). Resolved on the
  // client only — SSR renders the flat designed state.
  const enabledRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

    const resolve = () => {
      enabledRef.current = finePointer.matches && !reduced.matches
      // If tilt just became disallowed (e.g. user switched to reduced motion,
      // or a hybrid device flipped to coarse), snap any active tilt to flat.
      if (!enabledRef.current) applyFlat(true)
    }
    resolve()
    finePointer.addEventListener('change', resolve)
    reduced.addEventListener('change', resolve)
    return () => {
      finePointer.removeEventListener('change', resolve)
      reduced.removeEventListener('change', resolve)
    }
    // applyFlat is stable (defined below via useCallback); listed in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Write a transform imperatively to the tilt wrapper. `settle` toggles the
  // ease-back transition: off while tracking (1:1 follow), on when returning to
  // neutral so it springs back rather than snapping.
  //
  // will-change is set ONLY while a tilt is active and dropped once the card is
  // flat-and-settled — a permanent will-change on every card would force a
  // compositor layer per card across the whole grid (memory pressure, and home
  // idle already sits at the Safari WebGL ceiling). Promote on demand, demote
  // on settle.
  const settleTimer = useRef<number | null>(null)
  const write = useCallback((rx: number, ry: number, settle: boolean) => {
    const el = tiltRef.current
    if (!el) return
    if (settleTimer.current != null) {
      window.clearTimeout(settleTimer.current)
      settleTimer.current = null
    }
    const flat = rx === 0 && ry === 0
    el.style.transition = settle ? `transform ${EASE_MS}ms cubic-bezier(0.22,1,0.36,1)` : 'transform 0ms'
    el.style.transform = `rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`
    if (flat && settle) {
      // Returning to neutral — drop the compositor hint once the ease finishes.
      settleTimer.current = window.setTimeout(() => {
        if (tiltRef.current) tiltRef.current.style.willChange = 'auto'
        settleTimer.current = null
      }, EASE_MS)
    } else {
      el.style.willChange = 'transform'
    }
  }, [])

  const applyFlat = useCallback(
    (settle: boolean) => {
      write(0, 0, settle)
    },
    [write],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!enabledRef.current) return
      const host = hostRef.current
      if (!host) return
      // Cards live in the normal grid flow, OUTSIDE the overlay transform, so
      // getBoundingClientRect returns a true box here (the gBCR-near-zero-box
      // trap is overlay-only). One rect read per pointer-move event — the
      // browser batches it and only the single hovered card is ever measured.
      const rect = host.getBoundingClientRect()
      const w = rect.width || 1
      const h = rect.height || 1
      // Normalized -1..1 from center.
      const nx = ((e.clientX - rect.left) / w) * 2 - 1
      const ny = ((e.clientY - rect.top) / h) * 2 - 1
      // Cursor toward top → card leans back (negative rotateX). Cursor toward
      // right → card turns its right edge away (positive rotateY). Clamp.
      const clamp = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v)
      const ry = clamp(nx) * MAX_TILT_DEG
      const rx = -clamp(ny) * MAX_TILT_DEG
      write(rx, ry, false)
    },
    [write],
  )

  const onPointerLeave = useCallback(() => {
    applyFlat(true)
  }, [applyFlat])

  // Keyboard focus: a gentle, settled tilt-to-neutral. The develop-on-hover is
  // owned by the .flyer-scope :focus-within CSS; here we just make sure focus
  // lands the panel flat-and-settled (it may have been left mid-tilt by a prior
  // pointer interaction) so the focused card reads as squarely presented.
  const onFocus = useCallback(() => {
    applyFlat(true)
  }, [applyFlat])

  const onBlur = useCallback(() => {
    applyFlat(true)
  }, [applyFlat])

  // Clear any pending will-change demote timer on unmount.
  useEffect(() => {
    return () => {
      if (settleTimer.current != null) window.clearTimeout(settleTimer.current)
    }
  }, [])

  const setHostRef = useCallback((node: HTMLDivElement | null) => {
    hostRef.current = node
  }, [])
  const setTiltRef = useCallback((node: HTMLDivElement | null) => {
    tiltRef.current = node
  }, [])

  return {
    hostProps: {
      ref: setHostRef,
      onPointerMove,
      onPointerLeave,
      onFocus,
      onBlur,
    },
    tiltProps: {
      ref: setTiltRef,
      style: {
        // The wrapper rotates; preserve-3d lets the image/chrome translateZ
        // layers separate into real parallax depth. will-change is toggled
        // imperatively only during an active tilt (see write()) — not declared
        // here, so resting cards don't each hold a compositor layer.
        transformStyle: 'preserve-3d',
        // Start flat (designed static state). Imperative writes take over.
        transform: 'rotateX(0deg) rotateY(0deg)',
        height: '100%',
      },
    },
    // Negative Z → recessed behind the chrome plane.
    imageZStyle: { transform: `translateZ(-${PARALLAX_Z}px)`, transformStyle: 'preserve-3d' },
    // Positive Z → floats above the image plane.
    chromeZStyle: { transform: `translateZ(${PARALLAX_Z}px)` },
  }
}

export const CARD_TILT_PERSPECTIVE_PX = PERSPECTIVE_PX
