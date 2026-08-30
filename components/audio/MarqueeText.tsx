'use client'

import { useEffect, useRef, useState } from 'react'

// Single-line text that horizontally marquee-scrolls ONLY when it overflows
// its container — otherwise it renders static. Two copies of the text each
// translate -100% (see .hud-marquee in globals.css) so the loop is seamless.
// Overflow is re-measured on resize via ResizeObserver; under
// prefers-reduced-motion the animation is neutralized and the line just
// truncates (overflow-hidden).
export function MarqueeText({ text, className }: { text: string; className?: string }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const check = () =>
      setOverflowing(inner.scrollWidth > outer.clientWidth + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(outer)
    return () => ro.disconnect()
  }, [text])

  return (
    <div
      ref={outerRef}
      className={`overflow-hidden whitespace-nowrap ${className ?? ''}`}
      title={text}
    >
      <span
        ref={innerRef}
        className={`inline-block ${overflowing ? 'hud-marquee pr-10' : ''}`}
      >
        {text}
      </span>
      {overflowing && (
        <span className="hud-marquee inline-block pr-10" aria-hidden>
          {text}
        </span>
      )}
    </div>
  )
}
