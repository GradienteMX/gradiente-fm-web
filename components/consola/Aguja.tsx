'use client'

/**
 * AGUJA — the seek hairline. At rest it's a line with a needle; under the
 * pointer it thickens and a ghost needle shows where you'd land (with the
 * time). Press anywhere to drop the needle there, or drag it. It's a real
 * slider: focus it and ←/→ move ±10 s, PgUp/PgDn ±60 s, Home/End.
 *
 * The playhead glides between the bridge's reports (usePosicion), so the
 * line moves continuously without re-rendering React every frame.
 */

import { useRef, useState } from 'react'
import { usePlayer } from '@/lib/store/player'
import { clock, spoken } from '@/lib/audio/sources'
import { usePosicion } from './hooks'
import styles from './Aguja.module.css'

type Variant = 'capsula' | 'sala' | 'sesion'

export function Aguja({ variant, className, label = 'Posición en la mezcla' }: { variant: Variant; className?: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const duration = usePlayer((s) => s.duration)
  const hasTrack = usePlayer((s) => s.track !== null)
  const [ghost, setGhost] = useState<number | null>(null)
  const drag = useRef<{ id: number } | null>(null)
  const lastSec = useRef(-1)

  usePosicion((t, d) => {
    const el = ref.current
    if (!el) return
    if (!drag.current) el.style.setProperty('--p', d > 0 ? (t / d).toFixed(5) : '0')
    const sec = Math.floor(t)
    if (sec !== lastSec.current) {
      lastSec.current = sec
      el.setAttribute('aria-valuenow', String(sec))
      el.setAttribute('aria-valuetext', d > 0 ? `${spoken(t)} de ${spoken(d)}` : 'Sin duración todavía')
    }
  })

  const ready = duration > 0
  const at = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width))) * duration
  }

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ready || e.button !== 0) return
    drag.current = { id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
    const t = at(e.clientX)
    e.currentTarget.style.setProperty('--p', (t / duration).toFixed(5))
    e.currentTarget.dataset.drag = ''
    setGhost(t)
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!ready) return
    const t = at(e.clientX)
    if (drag.current) e.currentTarget.style.setProperty('--p', (t / duration).toFixed(5))
    setGhost(t)
  }
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    delete e.currentTarget.dataset.drag
    usePlayer.getState().seek(at(e.clientX))
  }
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!ready) return
    const s = usePlayer.getState()
    let t = s.time + (s.playing && !s.loading ? (performance.now() - s.timeAt) / 1000 : 0)
    const k = e.key
    if (k === 'ArrowLeft' || k === 'ArrowDown') t -= 10
    else if (k === 'ArrowRight' || k === 'ArrowUp') t += 10
    else if (k === 'PageDown') t -= 60
    else if (k === 'PageUp') t += 60
    else if (k === 'Home') t = 0
    else if (k === 'End') t = duration - 1
    else return
    e.preventDefault()
    e.stopPropagation()
    s.seek(Math.max(0, Math.min(duration - 0.5, t)))
  }

  return (
    <div
      ref={ref}
      className={`${styles.aguja} ${className ?? ''}`}
      data-variant={variant}
      data-ready={ready || undefined}
      // aria-valuenow / -valuetext are written by the frame loop above, not by React.
      // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
      role="slider"
      tabIndex={hasTrack ? 0 : -1}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, Math.round(duration))}
      aria-disabled={!ready || undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => {
        drag.current = null
        setGhost(null)
      }}
      onPointerLeave={() => {
        if (!drag.current) setGhost(null)
      }}
      onKeyDown={onKey}
    >
      <span className={styles.rail} aria-hidden="true">
        <span className={styles.lit} />
      </span>
      <span className={styles.needle} aria-hidden="true" />
      {ghost !== null && ready ? (
        <span className={styles.ghost} style={{ left: `${(ghost / duration) * 100}%` }} aria-hidden="true">
          <em>{clock(ghost)}</em>
        </span>
      ) : null}
    </div>
  )
}

/** "12:03 / 1:04:12" — updates itself; the slider carries the accessible value. */
export function Reloj({ className, total = true }: { className?: string; total?: boolean }) {
  const now = useRef<HTMLSpanElement>(null)
  const duration = usePlayer((s) => s.duration)
  usePosicion((t) => {
    const txt = clock(t)
    if (now.current && now.current.textContent !== txt) now.current.textContent = txt
  })
  return (
    <span className={className} aria-hidden="true">
      <span ref={now}>0:00</span>
      {total ? (
        <>
          <span className={styles.sep}>/</span>
          <span>{duration > 0 ? clock(duration) : '–:––'}</span>
        </>
      ) : null}
    </span>
  )
}
