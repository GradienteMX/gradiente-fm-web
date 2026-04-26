'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

// ── DraggableCanvas — generic free-form file canvas ────────────────────────
//
// Reusable primitive that handles position storage (sessionStorage by
// namespace), default grid layout, ResizeObserver-based column tracking, and
// pointer-based drag mechanics. Consumers pass items + a render function for
// each tile. Click-vs-drag is disambiguated by a small movement threshold so
// inner buttons inside a tile keep working.
//
// SavedCommentsSection uses this for both its folder and file grids. The
// older DraggableFileGrid (in sections/) predates this primitive and stays
// independent — refactoring it is unrelated to the saved-comments work.

interface XY {
  x: number
  y: number
}

const STORAGE_PREFIX = 'gradiente:dashboard:positions:'
const GAP = 12
const PADDING = 12
// Pixels of pointer movement before we treat the gesture as a drag (rather
// than a click). Keeps single-click expansion working while still feeling
// snappy when the user actually wants to move a tile.
const DRAG_THRESHOLD = 4

function readPositions(namespace: string): Record<string, XY> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + namespace)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed
      ? (parsed as Record<string, XY>)
      : {}
  } catch {
    return {}
  }
}

function writePositions(namespace: string, value: Record<string, XY>) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_PREFIX + namespace, JSON.stringify(value))
  } catch {}
}

export interface DraggableCanvasProps<T> {
  /** Storage namespace — different views must use different namespaces or
   *  positions will collide. */
  namespace: string
  items: T[]
  getId: (item: T) => string
  tileWidth: number
  tileHeight: number
  /** Single-click without drag. */
  onClickItem?: (item: T) => void
  /** Double-click. Independent from onClickItem (browser fires onclick first). */
  onDoubleClickItem?: (item: T) => void
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  /** Tile body. The wrapper (with positioning, drag handlers, focus ring)
   *  is owned by the canvas; the consumer renders the inside. */
  renderTile: (ctx: { item: T; selected: boolean; dragging: boolean }) => ReactNode
  /** Override the default header strip label. */
  headerLabel?: string
  /** Replaces the default empty-state placeholder. */
  emptyContent?: ReactNode
}

export function DraggableCanvas<T>({
  namespace,
  items,
  getId,
  tileWidth,
  tileHeight,
  onClickItem,
  onDoubleClickItem,
  selectedId,
  onSelect,
  renderTile,
  headerLabel,
  emptyContent,
}: DraggableCanvasProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [positions, setPositions] = useState<Record<string, XY>>({})
  const [hydrated, setHydrated] = useState(false)
  const [columns, setColumns] = useState(4)

  useEffect(() => {
    setPositions(readPositions(namespace))
    setHydrated(true)
  }, [namespace])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      const cols = Math.max(1, Math.floor((w - PADDING) / (tileWidth + GAP)))
      setColumns(cols)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [tileWidth])

  const defaultPosition = useCallback(
    (index: number, columns: number): XY => {
      const col = index % columns
      const row = Math.floor(index / columns)
      return {
        x: PADDING + col * (tileWidth + GAP),
        y: PADDING + row * (tileHeight + GAP),
      }
    },
    [tileWidth, tileHeight],
  )

  const resolved = useMemo(() => {
    return items.map((item, i) => {
      const id = getId(item)
      const stored = positions[id]
      return { item, id, pos: stored ?? defaultPosition(i, columns) }
    })
  }, [items, positions, columns, defaultPosition, getId])

  const updatePos = useCallback(
    (id: string, next: XY) => {
      setPositions((prev) => {
        const merged = { ...prev, [id]: next }
        writePositions(namespace, merged)
        return merged
      })
    },
    [namespace],
  )

  const resetLayout = useCallback(() => {
    setPositions({})
    writePositions(namespace, {})
  }, [namespace])

  const canvasHeight = useMemo(() => {
    let max = 360
    for (const r of resolved) {
      max = Math.max(max, r.pos.y + tileHeight + PADDING)
    }
    return max
  }, [resolved, tileHeight])

  if (items.length === 0) {
    return <>{emptyContent ?? null}</>
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-muted">
        <span>
          {headerLabel ??
            '// ARRASTRA LOS ARCHIVOS · LAS POSICIONES SE GUARDAN EN ESTA SESIÓN'}
        </span>
        <button
          type="button"
          onClick={resetLayout}
          className="border border-border px-2 py-0.5 text-secondary transition-colors hover:border-sys-orange hover:text-sys-orange"
        >
          REORGANIZAR
        </button>
      </div>

      <div
        ref={containerRef}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onSelect?.(null)
        }}
        className="relative w-full border border-dashed border-border/60 bg-base"
        style={{
          minHeight: 360,
          height: canvasHeight,
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      >
        {hydrated &&
          resolved.map(({ item, id, pos }) => (
            <DraggableTile
              key={id}
              x={pos.x}
              y={pos.y}
              width={tileWidth}
              height={tileHeight}
              selected={selectedId === id}
              onMove={(next) => updatePos(id, next)}
              onSelect={() => onSelect?.(id)}
              onClick={() => onClickItem?.(item)}
              onDoubleClick={() => onDoubleClickItem?.(item)}
              containerRef={containerRef}
            >
              {(dragging) =>
                renderTile({ item, selected: selectedId === id, dragging })
              }
            </DraggableTile>
          ))}
      </div>
    </div>
  )
}

// ── Single tile ────────────────────────────────────────────────────────────

interface DraggableTileProps {
  x: number
  y: number
  width: number
  height: number
  selected: boolean
  onMove: (next: XY) => void
  onSelect: () => void
  onClick: () => void
  onDoubleClick: () => void
  containerRef: React.MutableRefObject<HTMLDivElement | null>
  children: (dragging: boolean) => ReactNode
}

function DraggableTile({
  x,
  y,
  width,
  height,
  selected,
  onMove,
  onSelect,
  onClick,
  onDoubleClick,
  containerRef,
  children,
}: DraggableTileProps) {
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const [draggingPos, setDraggingPos] = useState<XY | null>(null)
  const draggingPosRef = useRef<XY | null>(null)
  // Whether the gesture has crossed the drag threshold. Below threshold the
  // pointer-up is treated as a click and forwarded to onClick.
  const exceededThresholdRef = useRef(false)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // Don't hijack clicks on interactive descendants (buttons, links). They
    // need to receive their own click events.
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, textarea, select')) return
    onSelect()
    exceededThresholdRef.current = false
    const rect = e.currentTarget.getBoundingClientRect()
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (
      !exceededThresholdRef.current &&
      Math.hypot(dx, dy) < DRAG_THRESHOLD
    ) {
      return
    }
    exceededThresholdRef.current = true
    const container = containerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const nextX = e.clientX - containerRect.left - drag.offsetX
    const nextY = e.clientY - containerRect.top - drag.offsetY
    const clampedX = Math.max(0, Math.min(nextX, container.clientWidth - width))
    const clampedY = Math.max(0, nextY)
    const next = { x: clampedX, y: clampedY }
    draggingPosRef.current = next
    setDraggingPos(next)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const wasDragging = exceededThresholdRef.current
    const finalPos = draggingPosRef.current
    if (wasDragging && finalPos) onMove(finalPos)
    dragRef.current = null
    draggingPosRef.current = null
    setDraggingPos(null)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    if (!wasDragging) {
      // Treat as a click — forward to onClick. Browser will fire dblclick
      // independently if a second click follows.
      onClick()
    }
  }

  const liveX = draggingPos?.x ?? x
  const liveY = draggingPos?.y ?? y
  const dragging = !!draggingPos

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick()
      }}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      className={[
        'absolute select-none',
        dragging ? 'cursor-grabbing z-30' : 'cursor-grab z-10',
      ].join(' ')}
      style={{ left: liveX, top: liveY, width, height }}
    >
      {children(dragging)}
    </div>
  )
}
