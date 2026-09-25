'use client'

/**
 * FLUJO DE VIDA — small multiples, hand-built SVG.
 *
 * One strip per series, each on its own labelled scale: decay runs orders of
 * magnitude above what readers add in a quiet week, and a shared axis would
 * flatten the ledger into a line of zeros. Bars, not lines — the values are
 * daily sums, discrete by construction. A series may carry a `floor`: a
 * stacked part that is only a lower bound, drawn hatched so it can never be
 * read as measured. Today is lighter because it is not over yet.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { dayLabel, num, signed } from './data'
import s from './Flujo.module.css'

export interface FlujoSeries {
  key: string
  label: string
  values: number[]
  /** Stacked lower-bound part (hatched). Only for `down` series. */
  floor?: number[]
  /** up: positive from a floor · down: losses hanging from a ceiling · both. */
  direction: 'up' | 'down' | 'both'
  estimate?: boolean
  empty?: string
}

const GUTTER_WIDE = 176
const GUTTER_NARROW = 112
const STRIP_H = 64

export function Flujo({ bounds, series, caption }: { bounds: number[]; series: FlujoSeries[]; caption: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(720)
  const [cur, setCur] = useState<number | null>(null)
  const hatch = useId().replace(/:/g, '')
  const D = bounds.length - 1

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const GUTTER = w < 560 ? GUTTER_NARROW : GUTTER_WIDE
  const cw = Math.max(120, w - GUTTER)
  const slot = cw / D
  const barW = Math.max(1, Math.min(18, slot * 0.62))

  const totals = useMemo(
    () =>
      series.map((sr) => ({
        v: sr.values.reduce((a, b) => a + b, 0),
        f: (sr.floor ?? []).reduce((a, b) => a + b, 0),
      })),
    [series],
  )

  const pick = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect()
    const k = Math.floor((clientX - r.left) / slot)
    setCur(k >= 0 && k < D ? k : null)
  }

  const cell = (sr: FlujoSeries, v: number, f: number) => (
    <span className={s.readVal}>
      {fmtVal(sr, v + f)}
      {sr.estimate ? <span className={s.est}> est.</span> : null}
      {f > 0.05 ? <span className={s.est}> · cota {num(f)}</span> : null}
    </span>
  )

  const mid = Math.floor((D - 1) / 2)

  return (
    <figure className={s.fig}>
      <div
        ref={wrap}
        className={s.chart}
        tabIndex={0}
        role="group"
        aria-label={`${caption}. Usa las flechas para recorrer los días.`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault()
            const d = e.key === 'ArrowRight' ? 1 : -1
            setCur((c) => (c === null ? D - 1 : Math.max(0, Math.min(D - 1, c + d))))
          } else if (e.key === 'Home') {
            e.preventDefault()
            setCur(0)
          } else if (e.key === 'End') {
            e.preventDefault()
            setCur(D - 1)
          } else if (e.key === 'Escape') setCur(null)
        }}
        onBlur={() => setCur(null)}
      >
        <svg width={0} height={0} className={s.defs} aria-hidden="true">
          <defs>
            <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="1" y1="0" x2="1" y2="5" className={s.hatchLine} />
            </pattern>
          </defs>
        </svg>

        {series.map((sr) => {
          const vals = sr.values
          const floor = sr.floor
          let max = 0
          let min = 0
          for (let k = 0; k < vals.length; k++) {
            const v = vals[k] + (floor?.[k] ?? 0)
            if (v > max) max = v
            if (v < min) min = v
          }
          const isEmpty = max - min < 1e-9
          const inner = STRIP_H - 12
          let base: number
          let scale: number
          if (sr.direction === 'down') {
            base = 5
            scale = inner / Math.max(max, 1e-9)
          } else if (sr.direction === 'up') {
            base = STRIP_H - 6
            scale = inner / Math.max(max, 1e-9)
          } else {
            scale = inner / Math.max(max - min, 1e-9)
            base = 6 + max * scale
          }
          const scaleText =
            sr.direction === 'down'
              ? `máx −${num(max)}`
              : min < 0
                ? `${signed(max)} / ${signed(min)}`
                : `máx ${signed(max)}`
          return (
            <div key={sr.key} className={s.strip}>
              <div className={s.gut} style={{ width: GUTTER }}>
                <span className={s.label}>
                  {sr.label}
                  {sr.estimate ? <span className={s.estTag}>estimado</span> : null}
                </span>
                <span className={s.scale}>{isEmpty ? '—' : scaleText}</span>
                {floor ? (
                  <span className={s.key}>
                    <span className={s.keySolid} aria-hidden="true" /> modelo
                    <span className={s.keyHatch} aria-hidden="true" /> cota inferior
                  </span>
                ) : null}
              </div>
              <svg
                width={cw}
                height={STRIP_H}
                className={s.svg}
                onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
                onPointerLeave={() => setCur(null)}
                aria-hidden="true"
              >
                <line x1={0} x2={cw} y1={base} y2={base} className={s.zero} />
                {isEmpty ? (
                  <text x={10} y={STRIP_H / 2 + 4} className={s.emptyText}>
                    {sr.empty ?? 'Sin movimiento en esta ventana'}
                  </text>
                ) : (
                  vals.map((v, k) => {
                    const f = floor?.[k] ?? 0
                    if (Math.abs(v) < 1e-9 && f < 1e-9) return null
                    const x = k * slot + (slot - barW) / 2
                    const today = k === D - 1 || undefined
                    const rx = 0
                    if (sr.direction === 'down') {
                      const h0 = v * scale
                      const h1 = f * scale
                      return (
                        <g key={k} data-today={today} className={s.barGroup}>
                          {h0 > 0.2 ? <rect x={x} y={base} width={barW} height={Math.max(1, h0)} rx={rx} className={s.bar} data-series={sr.key} /> : null}
                          {h1 > 0.2 ? (
                            <rect x={x} y={base + h0} width={barW} height={Math.max(1, h1)} rx={rx} className={s.barFloor} fill={`url(#${hatch})`} />
                          ) : null}
                        </g>
                      )
                    }
                    const h = Math.max(1, Math.abs(v) * scale)
                    const y = v < 0 ? base : base - h
                    return <rect key={k} x={x} y={y} width={barW} height={h} rx={rx} className={s.bar} data-series={sr.key} data-today={today} />
                  })
                )}
                {cur !== null ? <line x1={cur * slot + slot / 2} x2={cur * slot + slot / 2} y1={0} y2={STRIP_H} className={s.guide} /> : null}
              </svg>
            </div>
          )
        })}

        <div className={s.axis} style={{ paddingLeft: GUTTER }}>
          <span>{dayLabel(bounds[0])}</span>
          {D > 2 ? (
            <span style={{ left: GUTTER + mid * slot + slot / 2 }} className={s.axisMid}>
              {dayLabel(bounds[mid])}
            </span>
          ) : null}
          <span className={s.axisEnd}>hoy</span>
        </div>
      </div>

      <figcaption className={s.readout} aria-live="polite">
        <span className={s.readDay}>
          {cur === null ? 'Ventana completa' : `${dayLabel(bounds[cur])}${cur === D - 1 ? ' · hoy, parcial' : ''}`}
        </span>
        {series.map((sr, i) => (
          <span key={sr.key} className={s.readItem}>
            <span className={s.readKey}>{sr.label}</span>
            {cur === null ? cell(sr, totals[i].v, totals[i].f) : cell(sr, sr.values[cur], sr.floor?.[cur] ?? 0)}
          </span>
        ))}
      </figcaption>

      {/* A table ignores width: the clipping wrapper keeps it off the layout. */}
      <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Día</th>
            {series.map((sr) => (
              <th key={sr.key} scope="col">
                {sr.label}
                {sr.estimate ? ' (estimado)' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: D }, (_, k) => (
            <tr key={k}>
              <th scope="row">{dayLabel(bounds[k])}</th>
              {series.map((sr) => (
                <td key={sr.key}>
                  {fmtVal(sr, sr.values[k] + (sr.floor?.[k] ?? 0))}
                  {sr.floor && sr.floor[k] > 0.05 ? `, de ello ${num(sr.floor[k])} es cota inferior` : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  )
}

function fmtVal(sr: FlujoSeries, v: number): string {
  if (sr.direction === 'down') return v > 0.05 ? `−${num(v)}` : num(0)
  return signed(v)
}
