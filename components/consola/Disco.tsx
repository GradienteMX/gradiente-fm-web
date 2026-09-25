'use client'

/**
 * DISCO — the cover as a record label on a platter, drawn flat like the
 * `mix` pictogram (disc, hairline grooves, spindle).
 *
 * It turns at 33⅓ while the deck is sounding and behaves like a platter with
 * mass: the motor brings it up to speed in about half a second, and when the
 * sound stops it coasts down instead of freezing. An index tick on the rim
 * keeps the turn legible whatever the label looks like. Reduced motion: it
 * never spins.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import gsap from 'gsap'
import styles from './Disco.module.css'

const RPM = 100 / 3

/** Platter physics: angular velocity chases the motor's target with inertia. */
export function useGiro(ref: RefObject<HTMLElement | null>, spinning: boolean, rpm = RPM) {
  const st = useRef({ angle: 0, w: 0, target: 0, running: false })
  const tick = useRef<gsap.TickerCallback | null>(null)
  if (!tick.current) {
    tick.current = (_time: number, deltaTime: number) => {
      const s = st.current
      const dt = Math.min(0.1, deltaTime / 1000)
      // Spin-up is quick (direct drive); stopping is a coast.
      const tau = s.target > s.w ? 0.42 : 1.6
      s.w += (s.target - s.w) * (1 - Math.exp(-dt / tau))
      if (s.target === 0 && s.w < 0.6) {
        s.w = 0
        s.running = false
        gsap.ticker.remove(tick.current!)
      }
      s.angle = (s.angle + s.w * dt) % 360
      const el = ref.current
      if (el) el.style.transform = `rotate(${s.angle.toFixed(2)}deg)`
    }
  }

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const s = st.current
    s.target = spinning && !reduced ? rpm * 6 : 0
    if (reduced) s.w = 0
    if ((s.target > 0 || s.w > 0) && !s.running) {
      s.running = true
      gsap.ticker.add(tick.current!)
    }
  }, [spinning, rpm])

  useEffect(
    () => () => {
      gsap.ticker.remove(tick.current!)
      st.current.running = false
    },
    [],
  )
}

interface Props {
  src?: string
  spinning: boolean
  /** Label diameter as a share of the disc (0..1). */
  label?: number
  /** `sizes` for the label image. */
  sizes?: string
  className?: string
  style?: CSSProperties
  priority?: boolean
}

export function Disco({ src, spinning, label = 0.64, sizes = '96px', className, style, priority }: Props) {
  const plato = useRef<HTMLSpanElement>(null)
  useGiro(plato, spinning)
  return (
    <span className={`${styles.disco} ${className ?? ''}`} style={{ ['--label' as string]: label, ...style }} aria-hidden="true">
      <span ref={plato} className={styles.plato}>
        <span className={styles.surcos} />
        <span className={styles.marca} />
        <span className={styles.etiqueta}>
          {src ? <Image src={src} alt="" fill sizes={sizes} className={styles.img} priority={priority} /> : <span className={styles.vacia} />}
        </span>
        <span className={styles.eje} />
      </span>
    </span>
  )
}
