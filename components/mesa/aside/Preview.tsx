'use client'

/**
 * The light table. «Tarjeta» is the real `<Pieza>` at the size a fresh piece
 * is born with (lg), alive — the lens works on hover — but inert to clicks.
 * «Lectura» is the real reader for this format, set at the reading panel's
 * width and scaled into the frame. Nothing here is a mock-up.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { ContentItem } from '@/lib/types'
import type { CardLayout } from '@/lib/curation'
import { Pieza } from '@/components/pieza/Pieza'
import { Readers } from '@/components/lectura/readers'
import { FormatGlyph, FORMAT_LABEL } from '@/components/kit/Glyph'
import { effectiveBand } from '@/lib/vibe'
import { bandVar, eVar } from '../model'
import s from './aside.module.css'

const LG: CardLayout = { tier: 'lg', colSpan: 2, rowSpan: 2, intensity: 1 }
const PANEL_W = 1180

/** A fresh piece burns: life 1, tier lg. Clicks and keys are swallowed. */
export function TarjetaFrame({ item, cold }: { item: ContentItem; cold: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const flip = useRef<HTMLDivElement>(null)
  const band = effectiveBand(item)
  const key = `${item.imageUrl ?? ''}|${band.min}|${band.max}|${cold}`
  const last = useRef(key)

  // Keep the card out of the tab order: it's a picture of the piece, not the piece.
  useEffect(() => {
    box.current?.querySelectorAll<HTMLElement>('button, a, [tabindex]').forEach((el) => el.setAttribute('tabindex', '-1'))
  })

  // When the poster changes (art, band), it turns over once — a card, not a form.
  useEffect(() => {
    if (last.current === key) return
    last.current = key
    const el = flip.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo(el, { rotateY: -10 }, { rotateY: 0, duration: 0.6, ease: 'expo.out', clearProps: 'transform' })
  }, [key])

  return (
    <div className={s.stageCard}>
      <div
        ref={box}
        className={s.cardBox}
        data-cold={cold || undefined}
        aria-hidden="true"
        onClickCapture={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onKeyDownCapture={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
      >
        <div ref={flip} style={{ position: 'absolute', inset: 0 }}>
          <Pieza item={item} layout={LG} life={1} />
        </div>
      </div>
      {cold ? <p className={s.coldNote}>Sin energía todavía, la tarjeta no tiene color: lo toma cuando fijes su banda.</p> : null}
    </div>
  )
}

/** The real reader, set at the panel's width and scaled to fit. */
export function LecturaFrame({ item }: { item: ContentItem }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.36)
  const [h, setH] = useState(320)
  const band = effectiveBand(item)
  const mid = (band.min + band.max) / 2
  const Reader = Readers[item.type] ?? Readers.editorial

  useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const measure = () => {
      const sc = o.clientWidth / PANEL_W
      setScale(sc)
      setH(Math.ceil(i.offsetHeight * sc))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(o)
    ro.observe(i)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={outer} className={s.lecturaOuter} style={{ height: h }}>
      <div
        ref={inner}
        className={s.lecturaInner}
        inert
        style={{
          width: PANEL_W,
          transform: `scale(${scale})`,
          ['--e' as string]: eVar(mid),
          ['--band' as string]: bandVar(band.min, band.max),
        }}
      >
        <div className={s.lecturaHead}>
          <span>
            <FormatGlyph type={item.type} size={13} />
            {FORMAT_LABEL[item.type]}
            {item.editorial ? ' · ★' : ''}
          </span>
          <span>Vista previa · así se abre sobre el campo</span>
        </div>
        <Reader item={item} />
        <span className={s.lecturaEnergy} aria-hidden="true" />
      </div>
    </div>
  )
}

export function VistaPrevia({ item, cold, mode, onMode, big }: { item: ContentItem; cold: boolean; mode: 'tarjeta' | 'lectura'; onMode: (m: 'tarjeta' | 'lectura') => void; big?: boolean }) {
  return (
    <section className={s.preview} aria-label="Vista previa de la pieza">
      <div className={s.previewHead}>
        <span className="label" style={{ color: 'var(--ink-3)' }}>
          Así se verá
        </span>
        <div className={s.seg} role="group" aria-label="Tipo de vista previa">
          <button type="button" aria-pressed={mode === 'tarjeta'} onClick={() => onMode('tarjeta')}>
            Tarjeta
          </button>
          <button type="button" aria-pressed={mode === 'lectura'} onClick={() => onMode('lectura')}>
            Lectura
          </button>
        </div>
      </div>
      {mode === 'tarjeta' ? (
        <>
          <div style={big ? { maxWidth: 620 } : undefined}>
            <TarjetaFrame item={item} cold={cold} />
          </div>
          <p className={s.caption}>
            En tamaño grande. En el campo, su tamaño y su lugar los decide su vida frente a las demás. Pasa el cursor para ver su cara densa.
          </p>
        </>
      ) : big ? (
        <LecturaFrame item={item} />
      ) : (
        <div className={s.scroller}>
          <LecturaFrame item={item} />
        </div>
      )}
    </section>
  )
}
