'use client'

/**
 * PORTADA — what the editors planted. Every pinned piece takes a turn;
 * 9 s dwell shown as a single filling rule (the only clock here). Pauses on
 * hover/focus, hidden tab, and for 4 s after a manual gesture; reduced
 * motion never auto-advances.
 *
 * A turn is a plate change: the outgoing print breaks into blocks and the
 * incoming one assembles out of them (TRAMA `cruzar`), while the headline
 * re-prints in the new piece's energy.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { ContentItem } from '@/lib/types'
import { useUI } from '@/lib/store/ui'
import { useMe } from '@/lib/store/session'
import { useDispatch, useNow } from '@/lib/store/world'
import { bandLabel, bandOverlaps, bandSteps, effectiveBand, energySlotHex, energyVariation } from '@/lib/vibe'
import { useIntegerRange } from '@/lib/store/campo'
import { FORMAT_CODE, FORMAT_LABEL, FORMAT_ON, FORMAT_STOCK, FormatGlyph, Mark } from '@/components/kit/Glyph'
import { fmt, eventProximity, PROXIMITY_LABEL } from '@/lib/logic/time'
import { durationLabel } from '@/components/pieza/Pieza'
import { cruzar } from '@/components/trama/api'
import { Revelado } from '@/components/trama/Revelado'
import { fitTitle } from '@/lib/typeset'
import { useReducedMotion } from '@/lib/useMedia'
import styles from './Portada.module.css'

const DWELL = 9

const two = (n: number) => String(n).padStart(2, '0')

export function Portada({ items }: { items: ContentItem[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const holdUntil = useRef(0)
  const pausedRef = useRef(false)
  const progress = useRef<HTMLSpanElement>(null)
  const tl = useRef<gsap.core.Tween | null>(null)
  const artRef = useRef<HTMLDivElement>(null)
  const platesRef = useRef<HTMLDivElement>(null)
  const openLectura = useUI((s) => s.openLectura)
  const me = useMe()
  const now = useNow()
  const dispatch = useDispatch()
  const reduced = useReducedMotion()
  const n = items.length
  const item = items[Math.min(index, n - 1)]
  const range = useIntegerRange()

  const go = useCallback(
    (next: number, manual: boolean) => {
      if (!n) return
      const to = ((next % n) + n) % n
      if (manual) holdUntil.current = performance.now() + 4000
      const from = items[index]
      const target = items[to]
      const plates = platesRef.current
      if (plates && from && target && from.id !== target.id) {
        const a = plates.querySelector<HTMLImageElement>(`img[data-slot="${from.id}"]`)
        const b = plates.querySelector<HTMLImageElement>(`img[data-slot="${target.id}"]`)
        // The new plate feeds in from the side it comes from.
        const forward = (to - index + n) % n <= n / 2
        void cruzar(plates, a, b, { dir: forward ? 'left' : 'right' })
      }
      setIndex(to)
    },
    [index, items, n],
  )

  // Dwell clock
  useEffect(() => {
    if (n < 2 || reduced) return
    const bar = progress.current
    if (!bar) return
    tl.current?.kill()
    gsap.set(bar, { scaleX: 0 })
    tl.current = gsap.to(bar, {
      scaleX: 1,
      duration: DWELL,
      ease: 'none',
      onComplete: () => {
        // A manual gesture holds the frame for 4 s — restart the dwell.
        if (performance.now() < holdUntil.current) {
          tl.current?.restart()
          return
        }
        go(index + 1, false)
      },
    })
    if (pausedRef.current) tl.current.pause()
    return () => {
      tl.current?.kill()
    }
  }, [index, n, reduced, go])

  useEffect(() => {
    pausedRef.current = paused
    if (paused) tl.current?.pause()
    else tl.current?.resume()
  }, [paused])

  useEffect(() => {
    const onVis = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  if (!item) return null
  const band = effectiveBand(item)
  const mid = (band.min + band.max) / 2
  // Editors planted it, so it stays — but it admits when it's outside the
  // temperature you tuned to (it goes quiet, like out-of-range nights).
  const outside = !bandOverlaps(item, range)
  const dek = (item.bodyPreview ?? item.excerpt ?? '').split('\n\n')[0]

  const open = () => {
    const r = artRef.current?.getBoundingClientRect()
    if (me) dispatch({ t: 'touch', userId: me.id, itemId: item.id, kind: 'click', at: new Date().toISOString() })
    openLectura(item.slug, r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null)
  }

  const byline = (() => {
    if (item.type === 'evento' && item.date) {
      const p = eventProximity(item, now)
      return `${PROXIMITY_LABEL[p]} · ${fmt.full(item.date)}${item.venue ? ` · ${item.venue}` : ''}`
    }
    if (item.type === 'mix') return [item.mixSeries, item.duration ? durationLabel(item.duration) : null, item.author].filter(Boolean).join(' · ')
    return [item.author ? `Por ${item.author}` : null, item.readTime ? `${item.readTime} min de lectura` : null].filter(Boolean).join(' · ')
  })()

  const cta = item.type === 'evento' ? 'Ver la noche' : item.type === 'mix' ? 'Escuchar' : 'Leer completo'

  return (
    <section
      className={styles.portada}
      data-outside={outside || undefined}
      aria-roledescription="carrusel"
      aria-label="Portada"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(index + 1, true)
        if (e.key === 'ArrowLeft') go(index - 1, true)
      }}
      style={
        {
          '--e': energySlotHex(mid),
          '--band': bandSteps(band.min, band.max),
          '--stock': FORMAT_STOCK[item.type],
          '--stock-on': FORMAT_ON[item.type],
        } as React.CSSProperties
      }
    >
      <header className={styles.head}>
        <span className={styles.index}>01</span>
        <span className={styles.slash}>/</span>
        <span className={styles.name} style={{ '--chip': 'var(--l-ed)', '--chip-on': 'var(--l-ed-on)' } as React.CSSProperties}>
          Portada
        </span>
        <span className={styles.sub}>— lo que plantó la redacción</span>
        {outside ? <span className={styles.outside}>fuera de tu temperatura</span> : null}
        <span className={styles.spacer} />
        {me?.role === 'admin' ? (
          <button
            type="button"
            className={styles.unpin}
            onClick={() => dispatch({ t: 'pin', itemId: item.id, on: false, at: new Date().toISOString() })}
          >
            <Mark name="pin" size={11} /> Quitar de portada
          </button>
        ) : null}
        <span className={styles.count}>
          {two(index + 1)} / {two(n)}
        </span>
        {n > 1 ? (
          <span className={styles.nav}>
            <button type="button" onClick={() => go(index - 1, true)} aria-label="Anterior">
              <Mark name="arrow" size={13} className={styles.flip} />
            </button>
            <button type="button" onClick={() => go(index + 1, true)} aria-label="Siguiente">
              <Mark name="arrow" size={13} />
            </button>
          </span>
        ) : null}
      </header>

      <div className={styles.sheet}>
        <div className={styles.text} key={item.id}>
          <p className={styles.format}>
            <span className={styles.code}>
              <FormatGlyph type={item.type} size={11} /> {FORMAT_CODE[item.type]}
            </span>
            <span>{FORMAT_LABEL[item.type]}</span>
            {item.editorial ? <span className={styles.sel}>Selección editorial</span> : null}
          </p>
          <Revelado
            as="h2"
            trigger="load"
            energy={mid}
            dir="up"
            className={styles.title}
            style={{ fontVariationSettings: energyVariation(mid), fontSize: fitTitle(item.title, mid, 88, 22, 0.92) }}
          >
            <button type="button" onClick={open}>
              {item.title}
            </button>
          </Revelado>
          {dek ? <p className={styles.dek}>{dek}</p> : null}
          <p className={styles.byline}>{byline}</p>
          <div className={styles.foot}>
            <span className={styles.band}>
              <span className={styles.bandSwatch} />
              {bandLabel(band.min, band.max)}
            </span>
            <button type="button" className={styles.cta} onClick={open}>
              {cta} <Mark name="arrow" size={13} />
            </button>
          </div>
        </div>

        <div className={styles.art} ref={artRef}>
          <button type="button" className={styles.artHit} onClick={open} aria-label={item.title} />
          <div className={styles.plates} ref={platesRef}>
            {items.map((it, i) =>
              it.imageUrl ? (
                <Image
                  key={it.id}
                  src={it.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 900px) 100vw, 50vw"
                  priority={i === 0}
                  className={styles.img}
                  data-on={i === index || undefined}
                  data-slot={it.id}
                />
              ) : null,
            )}
            {!item.imageUrl ? <span className={`${styles.blank} hatch`} /> : null}
          </div>
          <span className={styles.energy} />
        </div>
      </div>

      <footer className={styles.rail}>
        <span className={styles.dwell}>
          <span ref={progress} className={styles.dwellFill} />
        </span>
        {n > 1 ? (
          <div className={styles.tabs} role="tablist" aria-label="Piezas en portada">
            {items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={it.title}
                className={styles.tab}
                data-on={i === index || undefined}
                onClick={() => go(i, true)}
              >
                {two(i + 1)}
              </button>
            ))}
          </div>
        ) : null}
      </footer>
    </section>
  )
}
