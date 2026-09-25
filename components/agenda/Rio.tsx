'use client'

/**
 * RÍO — the upcoming nights, one row each. The day number is set at the
 * energy of that night's hottest event (and prints in through the shared
 * TRAMA press when it reaches the eye); tonight carries that hue as a bar,
 * whatever is sounding right now is flagged live.
 * Events outside your horizon (or genre) stay exactly where they are but go
 * quiet, so the calendar keeps its shape while you tune it. Busy nights
 * fold to one line of posters; the last cell unfolds the rest — at once,
 * like a registration jump, with focus landing on the first new poster.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { differenceInCalendarDays, format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ContentItem } from '@/lib/types'
import type { CardLayout } from '@/lib/curation'
import { energyHex, energyVariation } from '@/lib/vibe'
import { isLive } from '@/lib/logic/time'
import { Pieza } from '@/components/pieza/Pieza'
import { useRevelar } from '@/components/trama/hooks'
import { countWord, plural } from '@/components/secciones/texto'
import { midOf, type FilaRio, type Noche } from './noches'
import styles from './Rio.module.css'

const TARGET = 198
const GAP = 12
const POSTER: CardLayout = { tier: 'sm', colSpan: 1, rowSpan: 1, intensity: 0 }

interface Props {
  rows: FilaRio[]
  now: Date
  passes: (e: ContentItem) => boolean
  narrowed: boolean
  /** A search is active: empty stretches mean no matches, not no events. */
  searching?: boolean
  lifeOf: (e: ContentItem) => number
}

export function Rio({ rows, now, passes, narrowed, searching = false, lifeOf }: Props) {
  const ruler = useRef<HTMLSpanElement>(null)
  const [grid, setGrid] = useState({ perRow: 5, cellW: TARGET })
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())

  // The strip width is measured on an invisible row with the real grid.
  useLayoutEffect(() => {
    const el = ruler.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      if (!w) return
      const perRow = Math.max(2, Math.floor((w + GAP) / (TARGET + GAP)))
      const cellW = (w - GAP * (perRow - 1)) / perRow
      setGrid((g) => (g.perRow === perRow && Math.abs(g.cellW - cellW) < 0.5 ? g : { perRow, cellW }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const toggle = useCallback((key: string) => {
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }, [])

  return (
    <div
      className={styles.rio}
      style={{ ['--cell-w' as string]: `${grid.cellW}px`, ['--cell-h' as string]: `${Math.round(grid.cellW * 1.25)}px`, ['--per-row' as string]: grid.perRow }}
    >
      <div className={styles.ruler} aria-hidden="true">
        <span />
        <span ref={ruler} />
      </div>
      {rows.map((r) => {
        if (r.kind === 'mes') return <Mes key={r.key} date={r.date} />
        if (r.kind === 'hueco') return <Hueco key={r.key} from={r.from} to={r.to} days={r.days} searching={searching} />
        return (
          <Fila
            key={r.noche.key}
            noche={r.noche}
            now={now}
            passes={passes}
            narrowed={narrowed}
            perRow={grid.perRow}
            expanded={open.has(r.noche.key)}
            onToggle={toggle}
            lifeOf={lifeOf}
          />
        )
      })}
    </div>
  )
}

// ── one night ────────────────────────────────────────────────────────────────

interface FilaProps {
  noche: Noche
  now: Date
  passes: (e: ContentItem) => boolean
  narrowed: boolean
  perRow: number
  expanded: boolean
  onToggle: (key: string) => void
  lifeOf: (e: ContentItem) => number
}

function Fila({ noche, now, passes, narrowed, perRow, expanded, onToggle, lifeOf }: FilaProps) {
  const rowRef = useRef<HTMLElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const before = useRef<number | null>(null)

  const days = differenceInCalendarDays(noche.date, now)
  const today = days <= 0
  const live = noche.events.some((e) => isLive(e, now))
  const lit = noche.events.filter(passes).length
  const overflow = noche.events.length > perRow
  const shown = expanded || !overflow ? noche.events : noche.events.slice(0, perRow - 1)
  const rest = noche.events.slice(shown.length)
  const restLit = rest.filter(passes).length
  const n = noche.events.length

  const weekday = format(noche.date, 'EEEE', { locale: es })
  const when = today ? 'Esta noche' : days === 1 ? 'Mañana' : weekday
  const rel = today || days === 1 ? weekday : `en ${days} días`

  const flip = () => {
    before.current = strip.current?.children.length ?? null
    onToggle(noche.key)
  }

  // Keyboard continuity: unfolding lands on the first new poster; folding
  // returns to the control that unfolds (and brings the row back into view).
  useLayoutEffect(() => {
    const el = strip.current
    const count = before.current
    before.current = null
    if (!el || count === null) return
    if (expanded) {
      ;(el.children[Math.max(0, count - 1)]?.querySelector('button') as HTMLElement | null)?.focus({ preventScroll: true })
    } else {
      el.querySelector<HTMLElement>('[data-mas]')?.focus({ preventScroll: true })
      const r = rowRef.current?.getBoundingClientRect()
      if (r && r.top < 0) rowRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [expanded])

  return (
    <section
      ref={rowRef}
      id={`noche-${noche.key}`}
      className={styles.noche}
      data-hoy={today || undefined}
      data-live={live || undefined}
      aria-labelledby={`noche-h-${noche.key}`}
      style={{ ['--e' as string]: energyHex(noche.hottest) }}
    >
      <div className={styles.fecha}>
        <span className={styles.node} aria-hidden="true" />
        <h3 id={`noche-h-${noche.key}`} className={styles.dia}>
          <DiaNum day={noche.date.getDate()} energy={noche.hottest} />
          <span className="sr-only">{format(noche.date, "EEEE d 'de' MMMM", { locale: es })}</span>
        </h3>
        <div className={styles.fechaText}>
          <p className={styles.cuando}>{when}</p>
          <p className={styles.mesRel}>
            {format(noche.date, 'MMM', { locale: es }).replace('.', '')} · {rel}
          </p>
          <p className={styles.cuenta}>
            <span className="num">{n}</span> {plural(n, 'evento', 'eventos')}
            {narrowed ? (
              <>
                <br />
                <span className={styles.cuentaLit}>
                  <span className="num">{lit}</span> en tu temperatura
                </span>
              </>
            ) : null}
          </p>
          {live ? <p className={styles.vivo}>En vivo ahora</p> : null}
        </div>
      </div>

      <div ref={strip} className={styles.carteles}>
        {shown.map((ev) => (
          <div
            key={ev.id}
            className={styles.cell}
            data-quiet={!passes(ev) || undefined}
            data-live={isLive(ev, now) || undefined}
            style={{ ['--ce' as string]: energyHex(midOf(ev)) }}
          >
            <Pieza item={ev} layout={POSTER} life={lifeOf(ev)} />
          </div>
        ))}
        {rest.length ? (
          <button type="button" className={styles.mas} onClick={flip} aria-expanded={false} data-mas="">
            <span className={styles.deck} aria-hidden="true">
              {rest.slice(0, 3).map((ev, i) => (
                <span key={ev.id} className={styles.deckCard} data-quiet={!passes(ev) || undefined} style={{ left: `${i * 35}%` }}>
                  {ev.imageUrl ? <Image src={ev.imageUrl} alt="" fill sizes="96px" className={styles.deckImg} /> : null}
                </span>
              ))}
            </span>
            <span className={styles.masNum}>+{rest.length}</span>
            <span className={styles.masText}>{plural(rest.length, 'evento más', 'eventos más')} esa noche</span>
            {narrowed ? <span className={styles.masLit}>{restLit} en tu temperatura</span> : null}
            <span className={styles.masCta}>Desplegar la noche</span>
          </button>
        ) : null}
        {expanded && overflow ? (
          <button type="button" className={styles.plegar} onClick={flip} aria-expanded={true}>
            <span className={styles.masText}>Plegar la noche</span>
            <span className={styles.masCta}>Volver a una línea</span>
          </button>
        ) : null}
      </div>
    </section>
  )
}

/** The day number, set at the night's hottest energy; it prints in when seen. */
function DiaNum({ day, energy }: { day: number; energy: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useRevelar(ref, { energy, preset: 'imprimir' })
  return (
    <span ref={ref} className={styles.diaNum} style={{ fontVariationSettings: energyVariation(energy) }} aria-hidden="true" data-trama="pendiente">
      {day}
    </span>
  )
}

// ── quiet stretches and month marks ─────────────────────────────────────────

function Hueco({ from, to, days, searching }: { from: Date; to: Date; days: number; searching: boolean }) {
  const word = countWord(days)
  const label = `${word.charAt(0).toUpperCase()}${word.slice(1)} ${plural(days, 'noche', 'noches')} ${searching ? 'sin coincidencias' : 'sin eventos registrados'}`
  const span = isSameDay(from, to) ? format(from, "EEEE d 'de' MMMM", { locale: es }) : `${format(from, 'd MMM', { locale: es })} – ${format(to, 'd MMM', { locale: es })}`
  return (
    <div className={styles.hueco}>
      <span className={styles.huecoSpine} aria-hidden="true" />
      <p>
        {label} <span className={styles.huecoSpan}>· {span.replace(/\./g, '')}</span>
      </p>
    </div>
  )
}

function Mes({ date }: { date: Date }) {
  return (
    <div className={styles.mesMark}>
      <span className={styles.huecoSpine} aria-hidden="true" />
      <p className={styles.mesName}>{format(date, 'MMMM yyyy', { locale: es })}</p>
    </div>
  )
}
