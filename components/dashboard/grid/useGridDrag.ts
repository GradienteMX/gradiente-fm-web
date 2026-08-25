'use client'

// ── useGridDrag — edit-mode-gated drag engine (§2.2) ────────────────────────
//
// Grammar, verbatim from the spec:
//   · Drag exists ONLY in edit mode — the grid attaches `onPointerDown` (via
//     the edit overlay) exclusively while editing; window listeners exist only
//     during an active press. Outside edit mode: zero drag listeners.
//   · 6px movement threshold before a press becomes a drag.
//   · Pick-up: hard-offset shadow + a 4px lift. NO scale, NO rotation/tilt.
//   · Mid-drag: neighbors reflow live — every target-cell change re-runs the
//     WP0-D packer over a candidate layout; the dashed GridGhost marks the
//     packed landing slot at all times.
//   · Drop: zero-overshoot settle — the residual offset between the lifted
//     visual position and the committed slot animates to 0 at 250ms easeOut,
//     bounce-free. Persistence is one commit per completed gesture.
//
// Coordinate math is delta-based (pointer deltas + offsetWidth), never
// getBoundingClientRect — rect math breaks under ancestor transforms (the
// CRT-boot trap, feedback_layout_box_in_overlay).

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { animate, useMotionValue, useReducedMotion, type MotionValue } from 'framer-motion'
import {
  GUTTER_DESKTOP_PX,
  ROW_UNIT_PX,
  packLayout,
  type LayoutEntry,
  type WidgetId,
} from '@/lib/dashboard/layout'

// Motion constitution (§6) — shared by the grid tree.
// Stepped 4-frame opacity cut-in: floor(t*4)/3, clamped.
export function stepEase(t: number): number {
  return Math.min(1, Math.floor(t * 4) / 3)
}
export const CUT_IN_DURATION = 0.28
export const CUT_IN_STAGGER = 0.04
export const CUT_IN_STAGGER_CAP = 8
// Reorder / drag reflow: position-only, easeOut, bounce-free, no exits.
export const REORDER_TRANSITION = { duration: 0.25, ease: 'easeOut' } as const

export const DRAG_THRESHOLD_PX = 6
const LIFT_PX = 4
const SETTLE_DURATION_S = 0.25

interface PressState {
  id: WidgetId
  pointerId: number
  startX: number
  startY: number
  entry: LayoutEntry
  entries: readonly LayoutEntry[]
  colW: number
  active: boolean
  lastTarget: { x: number; y: number } | null
  detach: () => void
}

export interface GridDragApi {
  // Widget currently attached to the pointer (lifted, transform-driven).
  draggedId: WidgetId | null
  // Widget in its zero-overshoot settle animation after drop/cancel.
  settlingId: WidgetId | null
  // Live packed reflow — neighbors render their positions from here.
  candidate: LayoutEntry[] | null
  // The dragged widget's packed landing slot (GridGhost target).
  ghost: LayoutEntry | null
  // Transform offsets for the dragged/settling widget only.
  x: MotionValue<number>
  y: MotionValue<number>
  // Attach ONLY from the edit-mode overlay — never rendered outside editing.
  onPointerDown: (id: WidgetId, event: ReactPointerEvent) => void
  // Esc mid-drag: settle back to origin, no commit.
  cancelDrag: () => void
}

export function useGridDrag({
  editing,
  entries,
  cols,
  containerRef,
  onCommitMove,
}: {
  editing: boolean
  // The rendered (packed, compact-applied) entries for the active breakpoint.
  entries: readonly LayoutEntry[]
  cols: number
  containerRef: RefObject<HTMLDivElement | null>
  // Rendered-grid coordinates of the completed gesture — the grid maps them
  // to stored desktop units and runs the ONE commit for the gesture.
  onCommitMove: (id: WidgetId, x: number, y: number) => void
}): GridDragApi {
  const reducedMotion = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const [draggedId, setDraggedId] = useState<WidgetId | null>(null)
  const [settlingId, setSettlingId] = useState<WidgetId | null>(null)
  const [candidate, setCandidate] = useState<LayoutEntry[] | null>(null)

  const pressRef = useRef<PressState | null>(null)
  const candidateRef = useRef<LayoutEntry[] | null>(null)

  const setCandidateBoth = useCallback((next: LayoutEntry[] | null) => {
    candidateRef.current = next
    setCandidate(next)
  }, [])

  const settleTo = useCallback(
    (id: WidgetId) => {
      setSettlingId(id)
      const duration = reducedMotion ? 0 : SETTLE_DURATION_S
      animate(x, 0, { duration, ease: 'easeOut' })
      animate(y, 0, {
        duration,
        ease: 'easeOut',
        onComplete: () => setSettlingId((prev) => (prev === id ? null : prev)),
      })
    },
    [reducedMotion, x, y],
  )

  const finishPress = useCallback(
    (commit: boolean) => {
      const press = pressRef.current
      if (!press) return
      pressRef.current = null
      press.detach()
      if (!press.active) return

      const stepX = press.colW + GUTTER_DESKTOP_PX
      const stepY = ROW_UNIT_PX + GUTTER_DESKTOP_PX
      const packed = candidateRef.current
      const slot = commit
        ? packed?.find((en) => en.id === press.id) ?? press.entry
        : press.entry
      // Visual continuity: fold the slot change into the transform so the
      // widget settles from exactly where the hand left it.
      x.set(x.get() - (slot.x - press.entry.x) * stepX)
      y.set(y.get() - (slot.y - press.entry.y) * stepY)

      setDraggedId(null)
      setCandidateBoth(null)
      if (commit) onCommitMove(press.id, slot.x, slot.y)
      settleTo(press.id)
    },
    [onCommitMove, setCandidateBoth, settleTo, x, y],
  )

  const cancelDrag = useCallback(() => finishPress(false), [finishPress])

  const onPointerDown = useCallback(
    (id: WidgetId, event: ReactPointerEvent) => {
      if (!editing || pressRef.current || settlingId) return
      if (event.button !== 0 || !event.isPrimary) return
      const container = containerRef.current
      const entry = entries.find((en) => en.id === id)
      if (!container || !entry) return
      // offsetWidth, never rect (transform trap).
      const colW = (container.offsetWidth - (cols - 1) * GUTTER_DESKTOP_PX) / cols

      const onMove = (e: PointerEvent) => {
        const press = pressRef.current
        if (!press || e.pointerId !== press.pointerId) return
        const dx = e.clientX - press.startX
        const dy = e.clientY - press.startY
        if (!press.active) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
          press.active = true
          setDraggedId(press.id)
        }
        x.set(dx)
        y.set(dy - LIFT_PX)

        const stepX = press.colW + GUTTER_DESKTOP_PX
        const stepY = ROW_UNIT_PX + GUTTER_DESKTOP_PX
        const tx = Math.min(
          Math.max(0, press.entry.x + Math.round(dx / stepX)),
          cols - press.entry.w,
        )
        const ty = Math.max(0, press.entry.y + Math.round(dy / stepY))
        if (press.lastTarget && press.lastTarget.x === tx && press.lastTarget.y === ty) {
          return
        }
        press.lastTarget = { x: tx, y: ty }
        // Live position-only reflow via the WP0-D packer (§2.1).
        const moved = press.entries.map((en) =>
          en.id === press.id ? { ...en, x: tx, y: ty } : en,
        )
        setCandidateBoth(packLayout(moved, cols))
      }

      const onUp = (e: PointerEvent) => {
        if (e.pointerId !== pressRef.current?.pointerId) return
        finishPress(true)
      }
      const onCancel = (e: PointerEvent) => {
        if (e.pointerId !== pressRef.current?.pointerId) return
        finishPress(false)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)

      pressRef.current = {
        id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        entry,
        entries,
        colW,
        active: false,
        lastTarget: null,
        detach: () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onCancel)
        },
      }
    },
    [editing, settlingId, containerRef, entries, cols, x, y, setCandidateBoth, finishPress],
  )

  // Leaving edit mode (or unmounting) mid-press abandons the gesture cleanly.
  useEffect(() => {
    if (!editing) cancelDrag()
  }, [editing, cancelDrag])
  useEffect(() => () => pressRef.current?.detach(), [])

  const ghost =
    draggedId && candidate ? candidate.find((en) => en.id === draggedId) ?? null : null

  return { draggedId, settlingId, candidate, ghost, x, y, onPointerDown, cancelDrag }
}
