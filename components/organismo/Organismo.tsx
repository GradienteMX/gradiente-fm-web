'use client'

/**
 * ORGANISMO — the HL mosaic.
 *
 * Ranking is the production `rankItems` (xl/lg/md/sm, rank caps, weave,
 * run-breaker, tail). This component only adds physics:
 *   · positions slide (manual FLIP from container-relative rects)
 *   · size snaps (scaling a poster mid-flight would smear its type)
 *   · the first sheet and every piece that enters after a retune prints
 *     out of blocks; pieces that leave break into grey blocks as ghosts
 *     while the grid closes around them
 *   · a retune passes one thin band of ink blocks over what's on screen
 * Size and position stay the only visible ranking signals.
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import type { RankedItem } from '@/lib/curation'
import { Pieza } from '@/components/pieza/Pieza'
import { barrido, revelarImagen } from '@/components/trama/api'
import { useCampo } from '@/lib/store/campo'
import styles from './Organismo.module.css'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Ghost {
  key: string
  ranked: RankedItem
  rect: Rect
}

const MIN_COL = 250
const GAP = 12
/** Pieces of the first sheet that print themselves in. */
const FIRST_PRINT = 9

function spanFor(r: RankedItem, cols: number) {
  const L = r.layout
  const colSpan = Math.min(L.colSpan, cols)
  const rowSpan = L.rowSpan
  const start = L.colStart && L.colStart + colSpan - 1 <= cols ? L.colStart : undefined
  return { colSpan, rowSpan, start }
}

export function Organismo({ ranked, empty }: { ranked: RankedItem[]; empty?: React.ReactNode }) {
  const gridRef = useRef<HTMLDivElement>(null)
  const ghostsRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(3)
  const [rowH, setRowH] = useState(260)
  const rects = useRef(new Map<string, Rect>())
  const prevIds = useRef<string[] | null>(null)
  const prevRanked = useRef(new Map<string, RankedItem>())
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const first = useRef(true)
  const reduced = useRef(false)

  useLayoutEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const el = gridRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const c = Math.max(2, Math.min(6, Math.floor((w + GAP) / (MIN_COL + GAP))))
      const colW = (w - GAP * (c - 1)) / c
      setCols(c)
      setRowH(Math.round(Math.max(190, Math.min(360, colW * 0.96))))
    }
    measure()
    const ro = new ResizeObserver(() => {
      measure()
      snapshot()
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const key = useMemo(() => ranked.map((r) => `${r.item.id}:${r.layout.colSpan}x${r.layout.rowSpan}`).join('|'), [ranked])

  // Which pieces print on mount: the first sheet, then whatever enters.
  const printDelay = useMemo(() => {
    const out = new Map<string, number>()
    const before = prevIds.current
    if (!before) {
      ranked.slice(0, FIRST_PRINT).forEach((r, i) => out.set(r.item.id, 120 + i * 70))
      return out
    }
    const had = new Set(before)
    let k = 0
    for (const r of ranked) {
      if (!had.has(r.item.id)) out.set(r.item.id, 60 + Math.min(8, k++) * 55)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  function readRects(): Map<string, Rect> {
    const el = gridRef.current
    const out = new Map<string, Rect>()
    if (!el) return out
    el.querySelectorAll<HTMLElement>('[data-cell]').forEach((c) => {
      out.set(c.dataset.cell!, { x: c.offsetLeft, y: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight })
    })
    return out
  }

  function snapshot() {
    rects.current = readRects()
  }

  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    const ids = ranked.map((r) => r.item.id)
    const now = readRects()

    if (first.current || reduced.current) {
      first.current = false
      rects.current = now
      prevIds.current = ids
      prevRanked.current = new Map(ranked.map((r) => [r.item.id, r]))
      return
    }

    const before = rects.current
    const cells = el.querySelectorAll<HTMLElement>('[data-cell]')
    const tl = gsap.timeline()
    cells.forEach((cell) => {
      const id = cell.dataset.cell!
      const a = before.get(id)
      const b = now.get(id)
      if (!b || !a) return
      const dx = a.x - b.x
      const dy = a.y - b.y
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        tl.fromTo(cell, { x: dx, y: dy }, { x: 0, y: 0, duration: 0.6, ease: 'expo.out', clearProps: 'transform' }, 0)
      }
    })

    // Leaving pieces become ghosts at their last rect and break into blocks.
    const gone = (prevIds.current ?? []).filter((id) => !now.has(id))
    if (gone.length) {
      const g: Ghost[] = gone
        .map((id) => {
          const r = before.get(id)
          const rk = prevRanked.current.get(id)
          return r && rk ? { key: `${id}:${Date.now()}`, ranked: rk, rect: r } : null
        })
        .filter((x): x is Ghost => x !== null)
      setGhosts((old) => [...old, ...g])
      window.setTimeout(() => {
        setGhosts((old) => old.filter((x) => !g.includes(x)))
      }, 620)
    }

    const range = useCampo.getState().range
    barrido(el, { energy: (range[0] + range[1]) / 2 })

    rects.current = now
    prevIds.current = ids
    prevRanked.current = new Map(ranked.map((r) => [r.item.id, r]))
    return () => {
      tl.progress(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cols])

  // Fresh ghosts: their plates break into grey blocks.
  useLayoutEffect(() => {
    const host = ghostsRef.current
    if (!host) return
    host.querySelectorAll<HTMLImageElement>('[data-ghost]:not([data-ashed]) img').forEach((img) => {
      img.closest('[data-ghost]')?.setAttribute('data-ashed', '')
      void revelarImagen(img, { ceniza: true })
    })
  }, [ghosts])

  if (!ranked.length && !ghosts.length) return <div className={styles.empty}>{empty}</div>

  return (
    <div className={styles.wrap}>
      <div
        ref={gridRef}
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: `${rowH}px`, gap: `${GAP}px` }}
      >
        {ranked.map((r, i) => {
          const { colSpan, rowSpan, start } = spanFor(r, cols)
          return (
            <div
              key={r.item.id}
              data-cell={r.item.id}
              className={styles.cell}
              style={{
                gridColumn: start ? `${start} / span ${colSpan}` : `span ${colSpan}`,
                gridRow: `span ${rowSpan}`,
              }}
            >
              <Pieza item={r.item} layout={r.layout} priority={i < 6} imprimir={printDelay.get(r.item.id)} />
            </div>
          )
        })}
      </div>
      <div ref={ghostsRef} className={styles.ghosts} aria-hidden="true">
        {ghosts.map((g) => (
          <div
            key={g.key}
            data-ghost=""
            className={styles.ghost}
            style={{ left: g.rect.x, top: g.rect.y, width: g.rect.w, height: g.rect.h }}
          >
            <Pieza item={g.ranked.item} layout={g.ranked.layout} />
          </div>
        ))}
      </div>
    </div>
  )
}
