'use client'

/**
 * «Energía, no género» — the one live element of /about. A small fader
 * re-sets one sentence from glacial (wide, light) to volcán (compressed,
 * black). The words — and the genre in them — never change; only the
 * temperature does.
 *
 * Drag, press the track, or use ←/→ (Shift = ±2), Home, End. It settles on
 * the nearest station with a detent when you let go.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { VIBE_NAMES, energyHex, energyVariation, vibeName } from '@/lib/vibe'
import styles from './FaderDemo.module.css'

const clamp = (v: number) => Math.min(10, Math.max(0, v))

export function FaderDemo() {
  const [v, setV] = useState(2)
  const vRef = useRef(2)
  const track = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const tween = useRef<gsap.core.Tween | null>(null)
  const [grabbed, setGrabbed] = useState(false)

  const apply = useCallback((x: number) => {
    const c = clamp(x)
    vRef.current = c
    setV(c)
  }, [])

  const settle = useCallback(
    (to: number) => {
      tween.current?.kill()
      const o = { x: vRef.current }
      tween.current = gsap.to(o, { x: to, duration: 0.16, ease: 'power2.out', onUpdate: () => apply(o.x) })
    },
    [apply],
  )

  const takeOver = () => tween.current?.kill()

  useEffect(
    () => () => {
      tween.current?.kill()
    },
    [],
  )

  const toValue = (clientX: number) => {
    const r = track.current!.getBoundingClientRect()
    return clamp(((clientX - r.left) / r.width) * 10)
  }

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    takeOver()
    dragging.current = true
    setGrabbed(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    apply(toValue(e.clientX))
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current) apply(toValue(e.clientX))
  }
  const onUp = () => {
    if (!dragging.current) return
    dragging.current = false
    setGrabbed(false)
    settle(Math.round(vRef.current))
  }
  const onKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 2 : 1
    const cur = Math.round(vRef.current)
    let to: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') to = clamp(cur + step)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') to = clamp(cur - step)
    if (e.key === 'Home') to = 0
    if (e.key === 'End') to = 10
    if (to === null) return
    e.preventDefault()
    takeOver()
    settle(to)
  }

  const t = v / 10
  const hue = energyHex(v)

  return (
    <figure ref={box} className={styles.demo} style={{ ['--h' as string]: hue }}>
      <div className={styles.readout}>
        <span className="label">Energía</span>
        <span className={styles.station} aria-hidden="true">
          <span className={styles.swatch} />
          {String(Math.round(v)).padStart(2, '0')} · {vibeName(v)}
        </span>
        <span className={styles.hint}>Mueve el fader: el género no cambia, cambia la temperatura.</span>
      </div>

      <blockquote className={styles.sentence} style={{ fontVariationSettings: energyVariation(v) }}>
        <span className={styles.sentenceText}>
          Hay techno que{' '}
          <span className={styles.word} style={{ opacity: 1 - t * 0.62 }}>
            medita
          </span>{' '}
          y techno que{' '}
          <span className={styles.word} style={{ opacity: 0.38 + t * 0.62 }}>
            detona
          </span>
          .
        </span>
      </blockquote>

      <div
        ref={track}
        className={styles.track}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <span className={styles.rail} aria-hidden="true" />
        <span className={styles.lit} style={{ width: `${t * 100}%`, backgroundSize: `${t > 0 ? 100 / t : 100}% 100%` }} aria-hidden="true" />
        {VIBE_NAMES.map((n, i) => (
          <span key={n} className={styles.detent} style={{ left: `${i * 10}%` }} data-on={Math.round(v) === i || undefined} aria-hidden="true" />
        ))}
        <span
          role="slider"
          tabIndex={0}
          aria-label="Energía de la frase de ejemplo"
          aria-valuemin={0}
          aria-valuemax={10}
          aria-valuenow={Math.round(v)}
          aria-valuetext={VIBE_NAMES[Math.round(v)]}
          className={styles.cap}
          data-grabbed={grabbed || undefined}
          style={{ left: `${t * 100}%` }}
          onKeyDown={onKey}
        >
          <span className={styles.capBody} />
        </span>
      </div>

      <figcaption className={styles.scale} aria-hidden="true">
        <span>Glacial</span>
        <span>Groove</span>
        <span>Volcán</span>
      </figcaption>
    </figure>
  )
}
