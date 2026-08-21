'use client'

// ── WidgetGrid — the broadsheet grid + edit mode (FINAL_SPEC §2) ────────────
//
// One CSS grid per §2.1: repeat(12, 1fr) / auto-rows 96px / 24px gap at
// desktop; 6 columns (derived halve-and-pack, never stored) at tablet; a
// 1-column priority stack in the user's saved mobileOrder below 768px with
// ZERO drag listeners (desktop/tablet-only drag v1).
//
// Layout state lives in the provider (§2.4): localStorage mirror paints
// first, profile_meta reconciles, and EVERY completed gesture (drop, resize
// snap, hide, restore, reset) runs exactly one commitLayout — the single
// profileMeta writer serializes the PATCHes. No per-frame persistence.
//
// Widgets arrive through the `widgets` registry prop (Stage 2 registers the
// real components); unregistered ids render the honest WidgetPlaceholder.
// Widgets read their data from useDashboardData() themselves — the grid only
// hands them geometry: `size` (stored desktop state), `compact`, `editing`.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import {
  DESKTOP_COLS,
  TABLET_COLS,
  applyCompactModes,
  defaultLayoutMeta,
  nextAllowedSize,
  remapToTablet,
  visibleEntries,
  type LayoutEntry,
  type WidgetId,
  type WidgetSize,
} from '@/lib/dashboard/layout'
import { FOCUS_RING, WIDGET_LABELS, WidgetPlaceholder } from './WidgetFrame'
import { GridGhost } from './GridGhost'
import { EditModeBar } from './EditModeBar'
import {
  CUT_IN_DURATION,
  CUT_IN_STAGGER,
  CUT_IN_STAGGER_CAP,
  REORDER_TRANSITION,
  stepEase,
  useGridDrag,
} from './useGridDrag'

// ── Widget registry contract (Stage 2 integration point) ────────────────────

export interface DashboardWidgetProps {
  // The STORED desktop size state (§2.5 allowedSizes vocabulary) — size-state
  // adaptive widgets (MAPA {8,4} = expanded black panel) key off this, on
  // every breakpoint.
  size: WidgetSize
  // Data-aware boot (§2.5): render the single teaching row.
  compact: boolean
  editing: boolean
}

export type WidgetRegistry = Partial<Record<WidgetId, ComponentType<DashboardWidgetProps>>>

// ── Breakpoints (§2.1) — JS-derived because the packing math differs ────────

type GridMode = 'desktop' | 'tablet' | 'mobile'

function subscribeToBreakpoints(onChange: () => void): () => void {
  const queries = [
    window.matchMedia('(min-width: 1280px)'),
    window.matchMedia('(min-width: 768px)'),
  ]
  queries.forEach((q) => q.addEventListener('change', onChange))
  return () => queries.forEach((q) => q.removeEventListener('change', onChange))
}

function readGridMode(): GridMode {
  if (window.matchMedia('(min-width: 1280px)').matches) return 'desktop'
  if (window.matchMedia('(min-width: 768px)').matches) return 'tablet'
  return 'mobile'
}

function useGridMode(): GridMode {
  return useSyncExternalStore(subscribeToBreakpoints, readGridMode, () => 'desktop')
}

// ── The grid ────────────────────────────────────────────────────────────────

export interface WidgetGridProps {
  widgets: WidgetRegistry
  // Edit mode is a MODE, not a widget (§2.3): entered from the masthead's
  // EDITAR PANEL (WP1 hosts the state), exited via LISTO or Esc here.
  editing: boolean
  onEditingChange: (editing: boolean) => void
}

export function WidgetGrid({ widgets, editing, onEditingChange }: WidgetGridProps) {
  const data = useDashboardData()
  const mode = useGridMode()
  const reducedMotion = useReducedMotion()
  const containerRef = useRef<HTMLDivElement | null>(null)

  const meta = data.layoutMeta
  // Latest meta for gesture-end commits (a poll tick mid-drag must not make
  // the drop write against a stale snapshot).
  const metaRef = useRef(meta)
  metaRef.current = meta

  const cols = mode === 'tablet' ? TABLET_COLS : DESKTOP_COLS

  // Rendered entries: hidden filtered + re-packed, tablet remap derived,
  // compact modes applied from live dataPresence (§2.5).
  const { entries, compact } = useMemo(() => {
    const visible = visibleEntries(meta, DESKTOP_COLS)
    const base = mode === 'tablet' ? remapToTablet(visible) : visible
    return applyCompactModes(base, data.dataPresence, cols)
  }, [meta, mode, cols, data.dataPresence])

  const storedById = useMemo(() => {
    const map = new Map<WidgetId, LayoutEntry>()
    for (const entry of meta.layout) map.set(entry.id, entry)
    return map
  }, [meta.layout])

  // ── Gesture-end commits (one commitLayout per completed gesture) ──────────

  const commitMove = useCallback(
    (id: WidgetId, renderedX: number, renderedY: number) => {
      const current = metaRef.current
      const stored = current.layout.find((entry) => entry.id === id)
      if (!stored) return
      const scale = DESKTOP_COLS / (mode === 'tablet' ? TABLET_COLS : DESKTOP_COLS)
      const x = Math.min(
        Math.max(0, Math.round(renderedX * scale)),
        DESKTOP_COLS - stored.w,
      )
      data.commitLayout({
        ...current,
        layout: current.layout.map((entry) =>
          entry.id === id ? { ...entry, x, y: renderedY } : entry,
        ),
      })
    },
    [data, mode],
  )

  const cycleSize = useCallback(
    (id: WidgetId) => {
      const current = metaRef.current
      const stored = current.layout.find((entry) => entry.id === id)
      if (!stored) return
      // Size SNAPS between the declared states — never tweens (§2.2/R4).
      const next = nextAllowedSize(id, { w: stored.w, h: stored.h })
      data.commitLayout({
        ...current,
        layout: current.layout.map((entry) =>
          entry.id === id ? { ...entry, w: next.w, h: next.h } : entry,
        ),
      })
    },
    [data],
  )

  const hideWidget = useCallback(
    (id: WidgetId) => {
      const current = metaRef.current
      if (current.hidden.includes(id)) return
      data.commitLayout({ ...current, hidden: [...current.hidden, id] })
    },
    [data],
  )

  const restoreWidget = useCallback(
    (id: WidgetId) => {
      const current = metaRef.current
      data.commitLayout({
        ...current,
        hidden: current.hidden.filter((hid) => hid !== id),
      })
    },
    [data],
  )

  // RESTABLECER (§2.3): one commit restores the default meta; the epoch bump
  // keys the grid subtree so the restored arrangement PAINTS immediately.
  // The commit alone updates every gridColumn/gridRow style, but the mounted
  // motion nodes are position-projected (layout='position') and a bulk
  // restore — position + size + compactness of every widget in one commit —
  // can leave stale projection transforms holding widgets at their old
  // visual boxes until a reload. Remounting drops all projection state and
  // replays the §2 stepped cut-in: reset reads as one deliberate
  // re-composition of the broadsheet, not a partial shuffle.
  const [resetEpoch, setResetEpoch] = useState(0)
  const resetLayout = useCallback(() => {
    data.commitLayout(defaultLayoutMeta(data.registry))
    setResetEpoch((epoch) => epoch + 1)
  }, [data])

  const drag = useGridDrag({
    editing: editing && mode !== 'mobile',
    entries,
    cols,
    containerRef,
    onCommitMove: commitMove,
  })

  // Esc: cancel an active drag first, otherwise exit the mode (§2.3).
  const draggedId = drag.draggedId
  const cancelDrag = drag.cancelDrag
  useEffect(() => {
    if (!editing) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (draggedId) cancelDrag()
      else onEditingChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, draggedId, cancelDrag, onEditingChange])

  if (!data.layoutReady) return null

  const cutIn = (index: number) => ({
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: {
      opacity: {
        duration: CUT_IN_DURATION,
        ease: stepEase,
        delay: Math.min(index, CUT_IN_STAGGER_CAP) * CUT_IN_STAGGER,
      },
      layout: REORDER_TRANSITION,
    },
  })

  const renderWidget = (id: WidgetId, size: WidgetSize, isCompact: boolean) => {
    const Registered = widgets[id]
    return Registered ? (
      <Registered size={size} compact={isCompact} editing={editing} />
    ) : (
      <WidgetPlaceholder id={id} compact={isCompact} />
    )
  }

  // ── Mobile <768px: 1-col stack in mobileOrder, no drag listeners ──────────
  if (mode === 'mobile') {
    const hidden = new Set(meta.hidden)
    const order = meta.mobileOrder.filter((id) => !hidden.has(id))
    return (
      <>
        {editing && (
          <EditModeBar
            hidden={meta.hidden}
            onRestore={restoreWidget}
            onReset={resetLayout}
            onDone={() => onEditingChange(false)}
          />
        )}
        <div key={resetEpoch} className="flex flex-col gap-4">
          {order.map((id, index) => {
            const stored = storedById.get(id)
            if (!stored) return null
            const isCompact = data.dataPresence[id] === false
            return (
              <motion.div
                key={id}
                layout={false}
                {...cutIn(index)}
                className={isCompact ? 'min-h-11' : 'min-h-44'}
              >
                {renderWidget(id, { w: stored.w, h: stored.h }, isCompact)}
              </motion.div>
            )
          })}
        </div>
      </>
    )
  }

  // ── Desktop / tablet CSS grid ─────────────────────────────────────────────
  return (
    <>
      {editing && (
        <EditModeBar
          hidden={meta.hidden}
          onRestore={restoreWidget}
          onReset={resetLayout}
          onDone={() => onEditingChange(false)}
        />
      )}
      <div
        key={resetEpoch}
        ref={containerRef}
        className={`relative grid auto-rows-[96px] gap-6 ${
          cols === TABLET_COLS ? 'grid-cols-6' : 'grid-cols-12'
        }${editing ? ' select-none' : ''}`}
      >
        {drag.ghost && <GridGhost entry={drag.ghost} />}
        {entries.map((entry, index) => {
          const stored = storedById.get(entry.id)
          if (!stored) return null
          const isDragged = drag.draggedId === entry.id
          const isSettling = drag.settlingId === entry.id
          const isLifted = isDragged || isSettling
          // Neighbors reflow live from the packed candidate; the dragged
          // widget keeps its origin slot and rides the pointer transform.
          const pos =
            !isDragged && drag.candidate
              ? drag.candidate.find((c) => c.id === entry.id) ?? entry
              : entry
          const isCompact = compact.has(entry.id)
          const nextSize = nextAllowedSize(entry.id, { w: stored.w, h: stored.h })
          const label = WIDGET_LABELS[entry.id]
          return (
            <motion.div
              key={entry.id}
              layout={reducedMotion || isLifted ? false : 'position'}
              {...cutIn(index)}
              data-cue={isDragged ? 'lift' : isSettling ? 'slot' : undefined}
              className={`relative${
                editing ? ' outline-dashed outline-1 outline-offset-2 outline-ink' : ''
              }${isDragged ? ' shadow-lift-deep' : ''}${isSettling ? ' shadow-lift' : ''}`}
              style={{
                gridColumn: `${pos.x + 1} / span ${pos.w}`,
                gridRow: `${pos.y + 1} / span ${pos.h}`,
                zIndex: isLifted ? 30 : undefined,
                ...(isLifted ? { x: drag.x, y: drag.y } : null),
              }}
            >
              {renderWidget(entry.id, { w: stored.w, h: stored.h }, isCompact)}
              {editing && (
                <>
                  {/* The whole surface drags in edit mode (§2.2); content
                      stays fully rendered and readable beneath. Listeners
                      exist ONLY while this overlay exists. */}
                  <div
                    aria-hidden
                    onPointerDown={(event) => drag.onPointerDown(entry.id, event)}
                    className={`absolute inset-0 z-10 touch-none ${
                      isDragged ? 'cursor-grabbing' : 'cursor-grab'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => hideWidget(entry.id)}
                    aria-label={`Ocultar ${label}`}
                    title="OCULTAR"
                    className={`absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center border border-ink bg-paper font-mono text-d15 text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
                  >
                    ×
                  </button>
                  {!isCompact && (
                    <button
                      type="button"
                      onClick={() => cycleSize(entry.id)}
                      aria-label={`Cambiar tamaño de ${label}`}
                      title={`TAMAÑO ${stored.w}×${stored.h} → ${nextSize.w}×${nextSize.h}`}
                      className={`absolute bottom-2 right-2 z-20 flex h-8 w-8 items-center justify-center border border-ink bg-paper text-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}
                    >
                      <span
                        aria-hidden
                        className="block h-3 w-3 border-b-2 border-r-2 border-current"
                      />
                    </button>
                  )}
                </>
              )}
            </motion.div>
          )
        })}
      </div>
    </>
  )
}
