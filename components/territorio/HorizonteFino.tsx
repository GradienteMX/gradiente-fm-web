'use client'

/**
 * The slim horizon for the Territorio. Same state as the home's Horizonte
 * (`useCampo.range`), same gestures (drag a cap, drag the lit band, press
 * the track, double-press for everything, keys on the caps), a fraction of
 * the height. On the map the horizon does not remove land: pieces outside
 * the band dim in place (the shader reads the stage's smoothed band), and
 * the field behind takes the temperature, as everywhere.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useCampo } from '@/lib/store/campo'
import { VIBE_NAMES, bandLabel, energyVariation, isFullRange, type VibeRange } from '@/lib/vibe'
import { eVar } from './codes'
import styles from './HorizonteFino.module.css'

const clamp = (v: number, a = 0, b = 10) => Math.min(b, Math.max(a, v))
const snap = (v: number) => (v <= 0.65 ? 0 : v >= 9.35 ? 10 : Math.round(v))

let settleTween: gsap.core.Tween | null = null
function settleTo(to: VibeRange) {
  settleTween?.kill()
  const from = { lo: useCampo.getState().range[0], hi: useCampo.getState().range[1] }
  settleTween = gsap.to(from, {
    lo: to[0],
    hi: to[1],
    duration: 0.42,
    ease: 'back.out(2.2)',
    onUpdate: () => useCampo.getState().setRange([clamp(from.lo), clamp(from.hi)]),
    onComplete: () => useCampo.getState().setRange(to),
  })
}

type Grab = { kind: 'lo' | 'hi' | 'band'; startX: number; start: VibeRange } | null

export function HorizonteFino() {
  const range = useCampo((s) => s.range)
  const setRange = useCampo((s) => s.setRange)
  const track = useRef<HTMLDivElement>(null)
  const grab = useRef<Grab>(null)
  const [active, setActive] = useState<'lo' | 'hi' | 'band' | null>(null)
  const [lo, hi] = range
  const full = isFullRange(range)

  // Tempo follows temperature, as with the full instrument.
  useEffect(() => {
    gsap.globalTimeline.timeScale(0.85 + ((lo + hi) / 20) * 0.35)
  }, [lo, hi])

  const toValue = useCallback((x: number) => {
    const r = track.current!.getBoundingClientRect()
    return clamp(((x - r.left) / r.width) * 10)
  }, [])

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    settleTween?.kill()
    const v = toValue(e.clientX)
    const [a, b] = useCampo.getState().range
    const cap = (e.target as HTMLElement).closest('[data-cap]') as HTMLElement | null
    let kind: 'lo' | 'hi' | 'band'
    if (cap) kind = cap.dataset.cap as 'lo' | 'hi'
    else if (v > a + 0.3 && v < b - 0.3 && b - a > 1) kind = 'band'
    else {
      kind = Math.abs(v - a) <= Math.abs(v - b) ? 'lo' : 'hi'
      setRange(kind === 'lo' ? [Math.min(v, b), b] : [a, Math.max(v, a)])
    }
    grab.current = { kind, startX: e.clientX, start: useCampo.getState().range }
    setActive(kind)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = grab.current
    if (!g) return
    const r = track.current!.getBoundingClientRect()
    if (g.kind === 'band') {
      const w = g.start[1] - g.start[0]
      const a = clamp(g.start[0] + ((e.clientX - g.startX) / r.width) * 10, 0, 10 - w)
      setRange([a, a + w])
      return
    }
    const v = toValue(e.clientX)
    const cur = useCampo.getState().range
    setRange(g.kind === 'lo' ? [Math.min(v, cur[1]), cur[1]] : [cur[0], Math.max(v, cur[0])])
  }

  const up = () => {
    const g = grab.current
    grab.current = null
    setActive(null)
    if (!g) return
    const [a0, b0] = useCampo.getState().range
    let a = snap(a0)
    let b = snap(b0)
    if (g.kind === 'band') {
      const w = Math.round(g.start[1] - g.start[0])
      a = clamp(Math.round(a0), 0, 10 - w)
      b = a + w
    }
    settleTo([Math.min(a, b), Math.max(a, b)])
  }

  const key = (cap: 'lo' | 'hi') => (e: React.KeyboardEvent) => {
    const [a, b] = useCampo.getState().range
    const step = e.shiftKey ? 2 : 1
    const v = Math.round(cap === 'lo' ? a : b)
    let next: VibeRange | null = null
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = cap === 'lo' ? [clamp(v - step), b] : [a, clamp(Math.max(a, v - step))]
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = cap === 'lo' ? [clamp(Math.min(b, v + step)), b] : [a, clamp(v + step)]
    if (e.key === 'Home') next = cap === 'lo' ? [0, b] : [a, a]
    if (e.key === 'End') next = cap === 'lo' ? [b, b] : [a, 10]
    if (next) {
      e.preventDefault()
      e.stopPropagation()
      settleTo(next)
    }
  }

  const bandW = Math.max(0.0001, hi - lo)

  return (
    <div className={styles.fino} data-ui="">
      <div className={styles.head}>
        <span className="label" style={{ color: 'var(--ink-3)' }}>
          Energía
        </span>
        <span className={styles.reading} aria-live="polite">
          {full ? 'Todo el espectro' : bandLabel(Math.round(lo), Math.round(hi))}
        </span>
        {!full ? (
          <button type="button" className={styles.reset} onClick={() => settleTo([0, 10])}>
            Todo
          </button>
        ) : (
          <span className={styles.hint}>atenúa sin mover</span>
        )}
      </div>
      <div
        ref={track}
        className={styles.track}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={() => settleTo([0, 10])}
        data-grab={active ?? undefined}
      >
        <div className={styles.rail} />
        <div
          className={styles.band}
          style={{
            left: `${lo * 10}%`,
            width: `${bandW * 10}%`,
            backgroundSize: `${(10 / bandW) * 100}% 100%`,
            backgroundPosition: `${bandW >= 10 ? 0 : (lo / (10 - bandW)) * 100}% 0`,
          }}
        />
        {(['lo', 'hi'] as const).map((cap) => {
          const v = cap === 'lo' ? lo : hi
          return (
            <div
              key={cap}
              data-cap={cap}
              role="slider"
              tabIndex={0}
              aria-label={cap === 'lo' ? 'Energía mínima' : 'Energía máxima'}
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={Math.round(v)}
              aria-valuetext={VIBE_NAMES[Math.round(v)]}
              onKeyDown={key(cap)}
              className={styles.cap}
              data-active={active === cap || undefined}
              style={{ left: `${v * 10}%`, ['--cap' as string]: eVar(v) }}
            >
              <span className={styles.capBody} />
              <span className={styles.capTag} style={{ fontVariationSettings: energyVariation(v) }}>
                {VIBE_NAMES[Math.round(v)]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
