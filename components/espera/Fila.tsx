'use client'

/**
 * LA FILA — the waitlist drawn as what it is: a queue walking toward La
 * Puerta. One point per real place in the queue (GET /api/waitlist sends
 * their states, never who holds them), in order of arrival,
 * the first in line nearest the door; when a lane fills, the line turns
 * back like a queue between barriers. Rows already invited (or registered)
 * are lit. Yours carries a ring. No aliases are drawn — the queue is public,
 * the people in it aren't.
 */

import { useEffect, useRef, useState } from 'react'
import type { WaitlistPlace } from '@/lib/waitlist'
import { energyVar } from '@/components/credencial/cssColor'
import { flare } from '@/components/stage/api'
import styles from './Fila.module.css'

const GAP = 17
const LANE_H = 38
const PAD_L = 22
const DOOR_R = 40
const DOOR_ZONE = 116

export const STATUS_LABEL: Record<WaitlistPlace, string> = {
  espera: 'en espera',
  invitado: 'invitado',
  registrado: 'ya entró',
}

export function Fila({ rows, mine, celebrate }: { rows: WaitlistPlace[]; mine: number; celebrate: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const mineRef = useRef<SVGCircleElement>(null)
  const [w, setW] = useState(640)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setW(Math.max(280, Math.round(el.clientWidth)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // A new place in line: a flare in the field where your point kindles.
  useEffect(() => {
    if (!celebrate) return
    const t = window.setTimeout(() => flare(mineRef.current, 1), 120)
    return () => window.clearTimeout(t)
  }, [celebrate])

  const doorX = w - DOOR_ZONE / 2
  const xRight = w - DOOR_ZONE
  const xLeft = PAD_L
  const cap = Math.max(4, Math.floor((xRight - xLeft) / GAP) + 1)
  const lanes = Math.max(1, Math.ceil(rows.length / cap))
  const top = 44
  const h = Math.max(128, top + (lanes - 1) * LANE_H + 62)
  const y0 = top

  const pos = (i: number) => {
    const k = Math.floor(i / cap)
    const j = i % cap
    const x = k % 2 === 0 ? xRight - j * GAP : xLeft + j * GAP
    return { x, y: y0 + k * LANE_H }
  }

  // The queue's own path: from the door, lane by lane.
  let d = `M${doorX - DOOR_R - 6} ${y0}L${xRight + 8} ${y0}`
  for (let k = 0; k < lanes; k++) {
    const y = y0 + k * LANE_H
    const leftward = k % 2 === 0
    const start = leftward ? xRight : xLeft
    const end = leftward ? xLeft : xRight
    if (k > 0) d += `L${start} ${y}`
    const last = k === lanes - 1
    const count = last ? rows.length - k * cap : cap
    // An empty queue still shows where it forms.
    const reach = !rows.length ? xLeft : last ? (leftward ? start - Math.max(0, count - 1) * GAP - 18 : start + Math.max(0, count - 1) * GAP + 18) : end
    d += `L${reach} ${y}`
    if (!last) {
      const turnX = leftward ? xLeft - 12 : xRight + 12
      d += `L${turnX} ${y}Q${turnX + (leftward ? -10 : 10)} ${y + LANE_H / 2} ${turnX} ${y + LANE_H}`
    }
  }

  const spokes = []
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 - Math.PI / 2
    spokes.push(
      <line
        key={i}
        x1={doorX + Math.cos(a) * 12}
        y1={y0 + Math.sin(a) * 12}
        x2={doorX + Math.cos(a) * DOOR_R}
        y2={y0 + Math.sin(a) * DOOR_R}
        stroke={energyVar((i / 30) * 10)}
      />,
    )
  }

  return (
    <div ref={wrapRef} className={styles.fila}>
      <svg className={styles.svg} viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={rows.length ? `La fila: ${rows.length} ${rows.length === 1 ? 'señal' : 'señales'} en orden de llegada.${mine >= 0 ? ` Tu lugar es el ${mine + 1}.` : ''}` : 'La fila está vacía.'}>
        <path d={d} className={styles.path} />
        <g className={styles.door}>
          {spokes}
          <circle cx={doorX} cy={y0} r={10} className={styles.hub} />
        </g>
        <text x={doorX} y={y0 + DOOR_R + 20} className={styles.doorLabel} textAnchor="middle">
          LA PUERTA
        </text>
        {rows.map((r, i) => {
          const p = pos(i)
          const lit = r !== 'espera'
          const me = i === mine
          return (
            <g key={i} className={styles.point} data-lit={lit || undefined} data-mine={me || undefined}>
              <title>{`#${String(i + 1).padStart(3, '0')} · ${STATUS_LABEL[r]}${me ? ' · tú' : ''}`}</title>
              {lit && !me ? <circle cx={p.x} cy={p.y} r={6.5} className={styles.litRing} /> : null}
              <circle ref={me ? mineRef : undefined} cx={p.x} cy={p.y} r={lit ? 3.6 : 3.1} className={styles.dot} />
              {me ? (
                <>
                  <circle cx={p.x} cy={p.y} r={8.5} className={styles.ring} />
                  <text x={p.x} y={p.y - 17} className={styles.meLabel} textAnchor="middle">
                    tú · #{String(i + 1).padStart(3, '0')}
                  </text>
                </>
              ) : null}
            </g>
          )
        })}
        {!rows.length ? (
          <text x={(xLeft + xRight) / 2} y={y0 - 14} className={styles.empty} textAnchor="middle">
            Nadie en la fila todavía.
          </text>
        ) : null}
      </svg>
    </div>
  )
}
