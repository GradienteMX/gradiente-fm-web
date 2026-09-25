'use client'

/**
 * DESCIFRAR — text that decodes when it changes: each character runs through
 * a few glyphs before landing, left to right. Event-driven only (never an
 * idle loop), ≤ ~400 ms, glyph changes stepped at ~24 fps. Screen readers
 * get the real text immediately.
 */

import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/lib/useMedia'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·—+▮▯'

export function Descifrar({
  text,
  className,
  duration = 380,
  onMount = false,
  as: Tag = 'span',
}: {
  text: string
  className?: string
  duration?: number
  /** Also decode on first mount (after hydration). */
  onMount?: boolean
  as?: 'span' | 'strong' | 'em'
}) {
  const [shown, setShown] = useState(text)
  const prev = useRef<string | null>(onMount ? '' : text)
  const reduced = useReducedMotion()

  useEffect(() => {
    const from = prev.current
    prev.current = text
    if (from === text || reduced) return
    const start = performance.now()
    let raf = 0
    let lastStep = -1
    const n = text.length
    // Each character lands at its own moment, left to right with a little jitter.
    const land = Array.from({ length: n }, (_, i) => (i / Math.max(1, n)) * duration * 0.72 + ((i * 37) % 11) * 6)
    const tick = (now: number) => {
      const t = now - start
      const step = Math.floor(t / 42)
      if (step !== lastStep) {
        lastStep = step
        let out = ''
        for (let i = 0; i < n; i++) {
          const ch = text[i]
          if (ch === ' ' || t >= land[i]) out += ch
          else out += GLYPHS[(i * 7 + step * 13) % GLYPHS.length]
        }
        setShown(out)
      }
      if (t < duration + 60) raf = requestAnimationFrame(tick)
      else setShown(text)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text, duration, reduced])

  return (
    <Tag className={className} aria-label={text}>
      <span aria-hidden="true">{reduced ? text : shown}</span>
    </Tag>
  )
}
