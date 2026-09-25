'use client'

/**
 * DENSIDAD — the next thirty nights as one instrument strip. Each tick is a
 * day: its ghost is how many events that night holds (the calendar's
 * shape), its lit part is how many pass your horizon and search, and its hue
 * is their mean energy. Catalog facts, never attention. Press a night to
 * travel the river to it.
 */

import { useMemo, useRef, useState } from 'react'
import { format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { energyHex, vibeName } from '@/lib/vibe'
import type { DiaDensidad } from './noches'
import { plural } from '@/components/secciones/texto'
import styles from './Densidad.module.css'

interface Props {
  dias: DiaDensidad[]
  now: Date
  /** Days that have a row in the river right now. */
  reachable: Set<string>
  narrowed: boolean
  /** A search is active: the lit part means matches, not only temperature. */
  searching: boolean
  onPick: (key: string) => void
}

const longDate = (d: Date) => format(d, "EEEE d 'de' MMMM", { locale: es })

export function Densidad({ dias, now, reachable, narrowed, searching, onPick }: Props) {
  const litWord = searching ? (narrowed ? 'coinciden en tu temperatura' : 'coinciden') : 'en tu temperatura'
  const showLit = narrowed || searching
  const [hover, setHover] = useState<string | null>(null)
  // One tab stop for the whole strip; arrows move between reachable nights.
  const [cursor, setCursor] = useState<string | null>(null)
  const strip = useRef<HTMLDivElement>(null)
  const order = dias.filter((d) => reachable.has(d.key)).map((d) => d.key)
  const stop = cursor && order.includes(cursor) ? cursor : order[0]
  const onKey = (e: React.KeyboardEvent) => {
    const i = order.indexOf(stop ?? '')
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(order.length - 1, i + 1)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, i - 1)
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = order.length - 1
    if (next < 0 || !order.length) return
    e.preventDefault()
    const key = order[next]
    setCursor(key)
    strip.current?.querySelector<HTMLElement>(`[data-key="${key}"]`)?.focus()
  }
  const max = Math.max(1, ...dias.map((d) => d.total))
  const totals = useMemo(() => dias.reduce((a, d) => ({ total: a.total + d.total, lit: a.lit + d.lit }), { total: 0, lit: 0 }), [dias])
  const h = hover ? dias.find((d) => d.key === hover) ?? null : null

  const readout = h ? (
    <>
      <span className={styles.readDate}>{isSameDay(h.date, now) ? `Hoy · ${longDate(h.date)}` : longDate(h.date)}</span>
      <span className={styles.readFacts}>
        {h.total === 0
          ? 'sin eventos registrados'
          : `${h.total} ${plural(h.total, 'evento', 'eventos')}${showLit ? ` · ${h.lit} ${litWord}` : ''}`}
        {h.mean !== null ? (
          <b className={styles.readEnergy}>
            <span className={styles.swatch} style={{ background: energyHex(h.mean) }} aria-hidden="true" />
            {vibeName(h.mean)}
          </b>
        ) : null}
      </span>
    </>
  ) : (
    <>
      <span className={styles.readDate}>Próximas treinta noches</span>
      <span className={styles.readFacts}>
        {totals.total} {plural(totals.total, 'evento', 'eventos')}
        {showLit ? ` · ${totals.lit} ${litWord}` : ''}
      </span>
    </>
  )

  return (
    <section className={styles.densidad} aria-label="Densidad de las próximas treinta noches">
      <p className={styles.readout} aria-live="polite">
        <span className="label">Densidad</span>
        {readout}
      </p>
      <div
        ref={strip}
        className={styles.strip}
        role="toolbar"
        aria-label="Noches: flechas para recorrer, Enter para ir a la noche"
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
      >
        {dias.map((d, i) => {
          const first = i === 0 || d.date.getDate() === 1
          const dow = d.date.getDay()
          const weekend = dow === 5 || dow === 6
          const today = isSameDay(d.date, now)
          const can = reachable.has(d.key)
          const ghost = d.total ? 0.06 + (d.total / max) * 0.94 : 0
          const lit = d.lit ? 0.06 + (d.lit / max) * 0.94 : 0
          const hue = d.mean !== null ? energyHex(d.mean) : 'transparent'
          const label = `${longDate(d.date)}: ${d.total ? `${d.total} ${plural(d.total, 'evento', 'eventos')}` : 'sin eventos'}${showLit && d.total ? `, ${d.lit} ${litWord}` : ''}`
          const body = (
            <>
              <span className={styles.bars} aria-hidden="true">
                <span className={styles.ghost} style={{ height: `${ghost * 100}%` }} />
                <span className={styles.lit} style={{ height: `${lit * 100}%`, ['--hue' as string]: hue }} />
                {!d.total ? <span className={styles.zero} /> : null}
              </span>
              <span className={styles.num} aria-hidden="true">
                {d.date.getDate()}
              </span>
              <span className={styles.dow} aria-hidden="true">
                {today ? 'hoy' : format(d.date, 'EEEEE', { locale: es })}
              </span>
            </>
          )
          return (
            <div key={d.key} className={styles.col} data-weekend={weekend || undefined} data-today={today || undefined} data-first={first || undefined}>
              {first ? <span className={styles.month}>{format(d.date, 'MMMM', { locale: es })}</span> : null}
              {can ? (
                <button
                  type="button"
                  className={styles.tick}
                  aria-label={label}
                  data-key={d.key}
                  tabIndex={d.key === stop ? 0 : -1}
                  onPointerEnter={() => setHover(d.key)}
                  onFocus={() => {
                    setHover(d.key)
                    setCursor(d.key)
                  }}
                  onBlur={() => setHover(null)}
                  onClick={() => onPick(d.key)}
                >
                  {body}
                </button>
              ) : (
                <span className={styles.tick} data-off="" onPointerEnter={() => setHover(d.key)} aria-label={label} role="img">
                  {body}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
