'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ContentType } from '@/lib/types'
import { categoryColor } from '@/lib/utils'
import type { DraftItem } from '@/lib/drafts'
import { FileIcon } from '../FileIcon'

// ── Position store (per-namespace, sessionStorage) ──────────────────────────

interface XY {
  x: number
  y: number
}

const STORAGE_PREFIX = 'gradiente:dashboard:positions:'

function readPositions(namespace: string): Record<string, XY> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + namespace)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? (parsed as Record<string, XY>) : {}
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

// ── Layout helpers ──────────────────────────────────────────────────────────

const TILE_W = 132
const TILE_H = 138
const GAP = 12
const PADDING = 12

/** Default grid placement for items that have never been moved. */
function defaultPosition(index: number, columns: number): XY {
  const col = index % columns
  const row = Math.floor(index / columns)
  return {
    x: PADDING + col * (TILE_W + GAP),
    y: PADDING + row * (TILE_H + GAP),
  }
}

// ── Component ───────────────────────────────────────────────────────────────

interface Props {
  namespace: string
  items: DraftItem[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpen: (item: DraftItem) => void
}

export function DraggableFileGrid({
  namespace,
  items,
  selectedId,
  onSelect,
  onOpen,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [positions, setPositions] = useState<Record<string, XY>>({})
  const [hydrated, setHydrated] = useState(false)
  const [columns, setColumns] = useState(4)

  // Load saved positions after mount.
  useEffect(() => {
    setPositions(readPositions(namespace))
    setHydrated(true)
  }, [namespace])

  // Recompute column count when the container resizes — used for default layout
  // of items that don't have a stored position yet.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      const cols = Math.max(1, Math.floor((w - PADDING) / (TILE_W + GAP)))
      setColumns(cols)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const resolved = useMemo(() => {
    return items.map((item, i) => {
      const stored = positions[item.id]
      return {
        item,
        pos: stored ?? defaultPosition(i, columns),
      }
    })
  }, [items, positions, columns])

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

  // Compute canvas height from resolved positions + a bit of slack so the
  // workspace grows as files are dragged downward.
  const canvasHeight = useMemo(() => {
    let max = 360
    for (const r of resolved) {
      max = Math.max(max, r.pos.y + TILE_H + PADDING)
    }
    return max
  }, [resolved])

  if (items.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 border border-dashed border-border/60 p-8 text-center">
        <span className="font-mono text-[10px] tracking-widest text-sys-orange">
          // BANDEJA VACÍA
        </span>
        <p className="max-w-md font-mono text-[11px] leading-relaxed text-muted">
          Cuando guardes un draft o publiques desde el dashboard aparecerá aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-muted">
        <span>// ARRASTRA LOS ARCHIVOS · LAS POSICIONES SE GUARDAN EN ESTA SESIÓN</span>
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
          if (e.target === e.currentTarget) onSelect(null)
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
          resolved.map(({ item, pos }) => (
            <DraggableFile
              key={item.id}
              item={item}
              x={pos.x}
              y={pos.y}
              selected={selectedId === item.id}
              onMove={(next) => updatePos(item.id, next)}
              onSelect={() => onSelect(item.id)}
              onOpen={() => onOpen(item)}
              containerRef={containerRef}
            />
          ))}
      </div>
    </div>
  )
}

// ── Single draggable tile ───────────────────────────────────────────────────

const TYPE_LABEL: Partial<Record<ContentType, string>> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTICIA',
  review: 'REVIEW',
  editorial: 'EDITORIAL',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULO',
  listicle: 'LISTA',
}

interface TileProps {
  item: DraftItem
  x: number
  y: number
  selected: boolean
  onMove: (next: XY) => void
  onSelect: () => void
  onOpen: () => void
  containerRef: React.MutableRefObject<HTMLDivElement | null>
}

function DraggableFile({
  item,
  x,
  y,
  selected,
  onMove,
  onSelect,
  onOpen,
  containerRef,
}: TileProps) {
  const color = categoryColor(item.type)
  const isDraft = item._draftState === 'draft'
  const stateColor = isDraft ? '#F97316' : '#4ADE80'

  // Drag state — kept in a ref so the move handler doesn't re-bind every render.
  const dragRef = useRef<{
    pointerId: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const [draggingPos, setDraggingPos] = useState<XY | null>(null)
  // Mirror of `draggingPos` for the up handler — avoids stale closure when
  // events fire in a single React batch.
  const draggingPosRef = useRef<XY | null>(null)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    onSelect()
    const target = e.currentTarget
    const rect = target.getBoundingClientRect()
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    }
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      // Pointer capture may fail in unusual environments — fall back to
      // bubble-based move/up listeners on the element below.
    }
  }

  const moveTo = (clientX: number, clientY: number) => {
    const drag = dragRef.current
    if (!drag) return
    const container = containerRef.current
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const nextX = clientX - containerRect.left - drag.offsetX
    const nextY = clientY - containerRect.top - drag.offsetY
    const clampedX = Math.max(0, Math.min(nextX, container.clientWidth - TILE_W))
    const clampedY = Math.max(0, nextY)
    const next = { x: clampedX, y: clampedY }
    draggingPosRef.current = next
    setDraggingPos(next)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    moveTo(e.clientX, e.clientY)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const finalPos = draggingPosRef.current
    if (finalPos) onMove(finalPos)
    dragRef.current = null
    draggingPosRef.current = null
    setDraggingPos(null)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore — capture may already have been released
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
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
      tabIndex={0}
      role="button"
      aria-label={item.title || 'Sin título'}
      className={[
        'absolute select-none transition-shadow',
        dragging ? 'cursor-grabbing z-30' : 'cursor-grab z-10',
      ].join(' ')}
      style={{
        left: liveX,
        top: liveY,
        width: TILE_W,
        height: TILE_H,
      }}
    >
      <div
        className={[
          'flex h-full w-full flex-col items-center gap-1.5 border bg-surface px-2 pt-2 pb-1.5 text-center',
          selected ? '' : 'border-border/40',
          dragging ? 'shadow-[0_8px_24px_rgba(0,0,0,0.5)]' : '',
        ].join(' ')}
        style={selected ? { borderColor: color, backgroundColor: '#0d0d0d' } : undefined}
      >
        <FileIcon color={color} size={44} type={item.type} />

        <span
          className="font-mono text-[9px] tracking-widest"
          style={{ color }}
        >
          //{TYPE_LABEL[item.type] ?? item.type.toUpperCase()}
        </span>

        <span className="line-clamp-2 w-full truncate font-syne text-[11px] font-bold leading-tight text-primary">
          {item.title || <span className="text-muted">[sin título]</span>}
        </span>

        <div className="mt-auto flex w-full items-center justify-center">
          <span
            className="inline-flex items-center gap-1 font-mono text-[8px] tracking-widest"
            style={{ color: stateColor }}
          >
            <span
              className={isDraft ? 'h-1 w-1 animate-pulse rounded-full' : 'h-1 w-1 rounded-full'}
              style={{ backgroundColor: stateColor }}
            />
            {isDraft ? 'DRAFT' : 'PUB'}
          </span>
        </div>
      </div>
    </div>
  )
}
