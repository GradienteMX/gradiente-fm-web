'use client'

/**
 * PULSO — the next fourteen nights, as a printed timetable you can throw
 * (inertia), not a marquee. Tonight is ruled in red; live nights blink their
 * square; events outside your energy stay in their place but go grey, so
 * the fortnight keeps its shape.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import { addDays, format, isSameDay, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import type { ContentItem } from '@/lib/types'
import { useNow } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { useIntegerRange } from '@/lib/store/campo'
import { bandOverlaps, effectiveBand, energySlotHex, energyVariation } from '@/lib/vibe'
import { isLive, fmt } from '@/lib/logic/time'
import { Mark } from '@/components/kit/Glyph'
import styles from './Pulso.module.css'

if (typeof window !== 'undefined') gsap.registerPlugin(Draggable, InertiaPlugin)

const DAYS = 14
const PER_DAY = 3

export function Pulso({ events, index = '02' }: { events: ContentItem[]; index?: string }) {
  const now = useNow()
  const range = useIntegerRange()
  const openLectura = useUI((s) => s.openLectura)
  const viewport = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)

  // The fortnight only needs re-cutting when the hour turns.
  const hour = Math.floor(now.getTime() / 3_600_000)
  const days = useMemo(() => {
    const start = startOfDay(new Date(hour * 3_600_000))
    return Array.from({ length: DAYS }, (_, i) => {
      const d = addDays(start, i)
      const list = events
        .filter((e) => e.date && isSameDay(parseISO(e.date), d))
        .sort((a, b) => Number(Boolean(b.editorial)) - Number(Boolean(a.editorial)) || (a.date! < b.date! ? -1 : 1))
      return { d, list }
    })
  }, [events, hour])

  const total = days.reduce((s, d) => s + d.list.length, 0)
  const dayFraction = (now.getHours() + now.getMinutes() / 60) / 24

  useEffect(() => {
    const vp = viewport.current
    const tr = track.current
    if (!vp || !tr) return
    const [d] = Draggable.create(tr, {
      type: 'x',
      bounds: vp,
      inertia: true,
      edgeResistance: 0.85,
      dragClickables: false,
      allowContextMenu: true,
      cursor: 'grab',
      activeCursor: 'grabbing',
      zIndexBoost: false,
    })
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) && !e.shiftKey) return
      e.preventDefault()
      const min = Math.min(0, vp.clientWidth - tr.scrollWidth)
      const x = Math.max(min, Math.min(0, (gsap.getProperty(tr, 'x') as number) - (e.deltaX || e.deltaY)))
      gsap.to(tr, { x, duration: 0.5, ease: 'expo.out', onUpdate: () => d.update() })
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      d.kill()
      vp.removeEventListener('wheel', onWheel)
    }
  }, [])

  return (
    <section className={styles.pulso} aria-label="Pulso — próximas noches">
      <header className={styles.head}>
        <span className={styles.index}>{index}</span>
        <span className={styles.slash}>/</span>
        <span className={styles.name} style={{ '--chip': 'var(--l-ev)', '--chip-on': 'var(--l-ev-on)' } as React.CSSProperties}>
          Pulso
        </span>
        <span className={styles.sub}>
          — {total} {total === 1 ? 'evento' : 'eventos'} en las próximas dos semanas
        </span>
        <Link href="/agenda" className={styles.more}>
          Agenda completa <Mark name="arrow" size={12} />
        </Link>
      </header>

      <div className={styles.viewport} ref={viewport}>
        <div className={styles.track} ref={track}>
          {days.map(({ d, list }, i) => {
            const today = i === 0
            const extra = list.length - PER_DAY
            return (
              <div key={d.toISOString()} className={styles.day} data-today={today || undefined} data-empty={!list.length || undefined}>
                <div className={styles.dayHead}>
                  <span className={styles.dayNum}>{format(d, 'd')}</span>
                  <span className={styles.dayMeta}>
                    <span className={styles.weekday}>{today ? 'Hoy' : i === 1 ? 'Mañana' : format(d, 'EEE', { locale: es })}</span>
                    <span className={styles.month}>{format(d, 'MMM', { locale: es })}</span>
                  </span>
                  {today ? <span className={styles.now} style={{ left: `${dayFraction * 100}%` }} title="Ahora" /> : null}
                </div>
                <div className={styles.nights}>
                  {list.slice(0, PER_DAY).map((ev) => {
                    const b = effectiveBand(ev)
                    const mid = (b.min + b.max) / 2
                    const inRange = bandOverlaps(ev, range)
                    const live = isLive(ev, now)
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        className={styles.night}
                        data-dim={!inRange || undefined}
                        data-live={live || undefined}
                        style={{ ['--e' as string]: energySlotHex(mid) }}
                        onClick={(e) => {
                          const r = (e.currentTarget.querySelector('[data-thumb]') as HTMLElement | null)?.getBoundingClientRect()
                          openLectura(ev.slug, r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null)
                        }}
                      >
                        <span className={styles.thumb} data-thumb="">
                          {ev.imageUrl ? <Image src={ev.imageUrl} alt="" fill sizes="96px" className={styles.thumbImg} draggable={false} /> : null}
                        </span>
                        <span className={styles.nightText}>
                          <span className={styles.time}>
                            {live ? <span className={styles.liveSq} /> : null}
                            {live ? 'En vivo' : ev.date ? fmt.time(ev.date) : ''}
                            {ev.editorial ? <span className={styles.sel}>ED</span> : null}
                          </span>
                          <span className={styles.nightTitle} style={{ fontVariationSettings: energyVariation(mid) }}>
                            {ev.title}
                          </span>
                          {ev.venue ? <span className={styles.venue}>{ev.venue}</span> : null}
                        </span>
                        <span className={styles.energy} />
                      </button>
                    )
                  })}
                  {extra > 0 ? (
                    <Link href={`/agenda#noche-${format(d, 'yyyy-MM-dd')}`} className={styles.extra}>
                      +{extra} esa noche <Mark name="arrow" size={11} />
                    </Link>
                  ) : null}
                  {!list.length ? <span className={`${styles.quiet} hatch`}>Sin eventos</span> : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
