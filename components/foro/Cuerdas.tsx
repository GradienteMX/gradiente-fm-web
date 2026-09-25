'use client'

/**
 * CUERDAS — `>>id` quotes as string on the wall.
 *
 * Every post has a pin in the left margin. Each quote is an arc between two
 * pins, bowing into the margin in proportion to the distance it spans, so
 * the whole conversation reads as a quiet arc diagram at rest. Hover or focus
 * a quote (or a post that has been answered) and that string is drawn in the
 * thread's energy, from where you are to where it points.
 *
 * Performance: the SVG lives inside the scrolled content (it scrolls with
 * the posts — no work on scroll) and only spans the margin. Positions come
 * from offset chains (immune to entrance transforms) and are re-measured only
 * when the content resizes. Active strings are imperative SVG nodes, one
 * GSAP tween each; React never re-renders for an animation frame.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import gsap from 'gsap'
import styles from './HiloForo.module.css'

export interface CuerdaLink {
  from: string
  to: string
}

export interface ActiveCuerda {
  key: string
  from: string
  to: string
  strong: boolean
}

interface Pin {
  x: number
  y: number
}

const SVG_NS = 'http://www.w3.org/2000/svg'

function offsetWithin(el: HTMLElement, root: HTMLElement): Pin | null {
  let x = 0
  let y = 0
  let n: HTMLElement | null = el
  while (n && n !== root) {
    x += n.offsetLeft
    y += n.offsetTop
    n = n.offsetParent as HTMLElement | null
  }
  if (n !== root) return null
  return { x: x + el.offsetWidth / 2, y: y + el.offsetHeight / 2 }
}

/** A bracket-shaped arc from pin to pin, bowing left into the margin. */
export function arcPath(a: Pin, b: Pin, room: number): string {
  const dy = Math.abs(b.y - a.y)
  const bow = Math.min(room, 9 + Math.sqrt(dy) * 1.55)
  const cx = Math.min(a.x, b.x) - bow
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} C ${cx.toFixed(1)} ${a.y.toFixed(1)}, ${cx.toFixed(1)} ${b.y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

export function Cuerdas({
  wrapRef,
  links,
  active,
  color,
  version,
}: {
  wrapRef: RefObject<HTMLDivElement | null>
  links: CuerdaLink[]
  active: ActiveCuerda[]
  color: string
  /** Bump to force a re-measure (new posts, tombstones). */
  version: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const liveRef = useRef<SVGGElement>(null)
  const pinsRef = useRef<Map<string, Pin>>(new Map())
  const [geo, setGeo] = useState<{ w: number; h: number; pins: Map<string, Pin> }>({ w: 0, h: 0, pins: new Map() })
  const reduced = useRef(false)

  const measure = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return pinsRef.current
    const pins = new Map<string, Pin>()
    let maxX = 0
    wrap.querySelectorAll<HTMLElement>('[data-pin]').forEach((el) => {
      const p = offsetWithin(el, wrap)
      if (!p) return
      pins.set(el.dataset.pin!, p)
      maxX = Math.max(maxX, p.x)
    })
    pinsRef.current = pins
    const w = Math.ceil(maxX + 8)
    const h = wrap.scrollHeight
    setGeo((g) => {
      if (g.w === w && g.h === h && samePins(g.pins, pins)) return g
      return { w, h, pins }
    })
    // Keep live strings attached to their pins.
    liveRef.current?.querySelectorAll<SVGGElement>('g[data-key]').forEach((g) => {
      const a = pins.get(g.dataset.from!)
      const b = pins.get(g.dataset.to!)
      if (!a || !b) return
      const d = arcPath(a, b, room(a, b))
      g.querySelectorAll('path').forEach((p) => {
        p.setAttribute('d', d)
        if (g.dataset.drawn) p.style.strokeDasharray = 'none'
      })
    })
    return pins
  }, [wrapRef])

  useLayoutEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wrap = wrapRef.current
    if (!wrap) return
    measure()
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => measure())
    })
    ro.observe(wrap)
    // Entrance transforms and late fonts settle after the first frame.
    const t = window.setTimeout(measure, 1100)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
      window.clearTimeout(t)
    }
  }, [measure, wrapRef, version])

  // Active strings: drawn in, retracted out — imperatively.
  const activeKey = active.map((a) => `${a.key}${a.strong ? '!' : ''}`).join('|')
  useEffect(() => {
    const live = liveRef.current
    if (!live) return
    const pins = measure()
    const existing = new Map<string, SVGGElement>()
    live.querySelectorAll<SVGGElement>('g[data-key]').forEach((g) => {
      if (!g.dataset.leaving) existing.set(g.dataset.key!, g)
    })
    const wanted = new Map(active.map((a) => [a.key, a]))

    for (const [key, g] of existing) {
      if (wanted.has(key)) {
        g.toggleAttribute('data-strong', wanted.get(key)!.strong)
        continue
      }
      g.dataset.leaving = '1'
      gsap.killTweensOf(g.querySelectorAll('path'))
      gsap.killTweensOf(g)
      gsap.to(g, { opacity: 0, duration: reduced.current ? 0.01 : 0.28, ease: 'power2.out', onComplete: () => g.remove() })
    }

    for (const [key, a] of wanted) {
      if (existing.has(key)) continue
      const pa = pins.get(a.from)
      const pb = pins.get(a.to)
      if (!pa || !pb) continue
      draw(live, key, a, pa, pb, reduced.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  useEffect(() => {
    const live = liveRef.current
    return () => {
      live?.querySelectorAll('g, path').forEach((el) => gsap.killTweensOf(el))
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      className={styles.cuerdas}
      width={geo.w}
      height={geo.h}
      style={{ ['--e' as string]: color }}
      aria-hidden="true"
    >
      <g className={styles.faint}>
        {links.map((l) => {
          const a = geo.pins.get(l.from)
          const b = geo.pins.get(l.to)
          if (!a || !b) return null
          return <path key={`${l.from}>${l.to}`} d={arcPath(a, b, room(a, b))} />
        })}
      </g>
      <g ref={liveRef} className={styles.live} />
    </svg>
  )
}

function room(a: Pin, b: Pin): number {
  return Math.max(10, Math.min(a.x, b.x) - 6)
}

function samePins(a: Map<string, Pin>, b: Map<string, Pin>): boolean {
  if (a.size !== b.size) return false
  for (const [k, p] of a) {
    const q = b.get(k)
    if (!q || Math.abs(q.x - p.x) > 0.5 || Math.abs(q.y - p.y) > 0.5) return false
  }
  return true
}

/** One flat line, revealed from where you are to where it points. */
function draw(live: SVGGElement, key: string, a: ActiveCuerda, pa: Pin, pb: Pin, reduced: boolean) {
  const d = arcPath(pa, pb, room(pa, pb))
  const g = document.createElementNS(SVG_NS, 'g')
  g.dataset.key = key
  g.dataset.from = a.from
  g.dataset.to = a.to
  if (a.strong) g.setAttribute('data-strong', '')
  const line = document.createElementNS(SVG_NS, 'path')
  line.setAttribute('class', styles.line)
  line.setAttribute('d', d)
  g.append(line)
  live.append(g)

  const L = line.getTotalLength()
  if (reduced || L < 1) {
    g.dataset.drawn = '1'
    return
  }
  line.style.strokeDasharray = `${L} ${L}`
  line.style.strokeDashoffset = `${L}`
  gsap.to(line, {
    strokeDashoffset: 0,
    duration: Math.min(0.7, 0.28 + L / 1800),
    ease: 'power2.out',
    onComplete: () => {
      g.dataset.drawn = '1'
      line.style.strokeDasharray = 'none'
    },
  })
}
