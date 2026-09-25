'use client'

/**
 * HOLD — the commitment gesture. Publishing and harvesting are not taps:
 * press and hold while the bar prints across the button, block by block
 * (the newest block lands in the energy's ink, then cools to ink); let go
 * early and it un-prints. Same philosophy as drag-to-calibrate — friction
 * is what makes the act mean something. When the bar is full the commit
 * lands with a TRAMA burst. Keyboard: hold Space or Enter.
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { energySlotHex } from '@/lib/vibe'
import { flare } from '@/components/stage/api'
import styles from './HoldButton.module.css'

interface Props {
  children: ReactNode
  /** Shown while holding. */
  holdingLabel?: ReactNode
  onConfirm: () => void
  duration?: number
  energy?: number
  disabled?: boolean
  tone?: 'ink' | 'danger'
  size?: 'md' | 'lg'
  full?: boolean
}

/** Blocks across the bar: ~24px each, never fewer than 10 or more than 20. */
function blocksFor(width: number): number {
  return Math.min(20, Math.max(10, Math.round(width / 24)))
}

export function HoldButton({ children, holdingLabel, onConfirm, duration = 1.1, energy = 5, disabled, tone = 'ink', size = 'lg', full }: Props) {
  const ref = useRef<HTMLButtonElement>(null)
  const tween = useRef<gsap.core.Tween | null>(null)
  const prog = useRef({ p: 0 })
  const blocks = useRef(12)
  const [holding, setHolding] = useState(false)
  const done = useRef(false)
  const howId = useId()

  // Progress is continuous; what's printed is whole blocks (ceil: the first
  // block lands the moment you press).
  const paint = useCallback(() => {
    const el = ref.current
    if (!el) return
    const n = blocks.current
    el.style.setProperty('--q', String(Math.ceil(prog.current.p * n - 1e-6) / n))
  }, [])

  const start = useCallback(() => {
    const el = ref.current
    if (!el || disabled || done.current) return
    blocks.current = blocksFor(el.offsetWidth)
    el.style.setProperty('--n', String(blocks.current))
    setHolding(true)
    tween.current?.kill()
    tween.current = gsap.to(prog.current, {
      p: 1,
      duration,
      ease: 'power1.in',
      onUpdate: paint,
      onComplete: () => {
        done.current = true
        setHolding(false)
        flare(el, energy)
        onConfirm()
        window.setTimeout(() => {
          done.current = false
          tween.current = gsap.to(prog.current, { p: 0, duration: 0.24, ease: 'none', onUpdate: paint })
        }, 900)
      },
    })
  }, [disabled, duration, energy, onConfirm, paint])

  const cancel = useCallback(() => {
    if (done.current) return
    setHolding(false)
    tween.current?.kill()
    // Release is faster than entry: the bar un-prints in a few jumps.
    tween.current = gsap.to(prog.current, { p: 0, duration: 0.16, ease: 'none', onUpdate: paint })
  }, [paint])

  useEffect(
    () => () => {
      tween.current?.kill()
    },
    [],
  )

  const label = holding && holdingLabel ? holdingLabel : children
  const hint = holding ? 'sigue…' : 'mantén'

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={[styles.hold, styles[tone], styles[size], full ? styles.full : ''].join(' ')}
      data-holding={holding || undefined}
      style={{ ['--hc' as string]: energySlotHex(energy) }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        start()
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault()
          start()
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') cancel()
      }}
      aria-describedby={howId}
    >
      <span id={howId} hidden>
        Mantén presionado para confirmar
      </span>
      <span className={styles.row}>
        <span className={styles.label}>{label}</span>
        <span className={styles.hint}>{hint}</span>
      </span>
      {/* The printed bar: the same row in paper, on ink blocks, clipped to
          the blocks printed so far; the newest block is still hot. */}
      <span className={styles.bar} aria-hidden="true">
        <span className={styles.head} />
        <span className={styles.row}>
          <span className={styles.label}>{label}</span>
          <span className={styles.hint}>{hint}</span>
        </span>
      </span>
    </button>
  )
}
