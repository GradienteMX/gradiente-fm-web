'use client'

/**
 * DIAL — franjas are "bands on the dial". This is a literal tuning scale:
 * stations ordered by their last signal (chronological, never by HL), a
 * fixed needle, inertia, and interference between stations. Deaf to the
 * horizon — franjas never enter the mosaic and never take the temperature.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import type { ContentItem, FranjaKind } from '@/lib/types'
import { useNow } from '@/lib/store/world'
import { useUI } from '@/lib/store/ui'
import { ago } from '@/lib/logic/time'
import { Mark } from '@/components/kit/Glyph'
import styles from './Dial.module.css'

if (typeof window !== 'undefined') gsap.registerPlugin(Draggable, InertiaPlugin)

export const KIND_LABEL: Record<FranjaKind, string> = {
  label: 'Sello',
  promoter: 'Promotora',
  venue: 'Venue',
  dealer: 'Dealer',
  colectivo: 'Colectivo',
  festival: 'Festival',
  club: 'Club',
  medios: 'Medio',
  'mix-series': 'Serie de mixes',
  plataforma: 'Plataforma',
}

const ROW = 30
const WINDOW = 7 // odd: rows visible around the needle

export function Dial({ franjas, market }: { franjas: ContentItem[]; market: ContentItem[] }) {
  const now = useNow()
  const openLectura = useUI((s) => s.openLectura)
  const scale = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const [locked, setLocked] = useState(0)
  const [static_, setStatic] = useState(0)
  const n = franjas.length
  const H = ROW * WINDOW
  const center = (H - ROW) / 2

  useEffect(() => {
    const el = scale.current
    const vp = viewport.current
    if (!el || !vp || !n) return
    const maxY = center
    const minY = center - (n - 1) * ROW
    gsap.set(el, { y: center })

    const update = () => {
      const y = gsap.getProperty(el, 'y') as number
      const pos = (center - y) / ROW
      const idx = Math.max(0, Math.min(n - 1, Math.round(pos)))
      setLocked(idx)
      setStatic(Math.min(1, Math.abs(pos - Math.round(pos)) * 2))
      el.querySelectorAll<HTMLElement>('[data-station]').forEach((row, i) => {
        const d = Math.abs(i - pos)
        row.style.setProperty('--d', Math.min(3.5, d).toFixed(3))
      })
    }

    const [d] = Draggable.create(el, {
      type: 'y',
      bounds: { minY, maxY },
      inertia: true,
      edgeResistance: 0.9,
      snap: (v: number) => Math.round((v - center) / ROW) * ROW + center,
      onDrag: update,
      onThrowUpdate: update,
      onThrowComplete: update,
      dragClickables: true,
      cursor: 'ns-resize',
      activeCursor: 'grabbing',
      zIndexBoost: false,
    })
    update()

    const tune = (to: number) => {
      const y = center - Math.max(0, Math.min(n - 1, to)) * ROW
      gsap.to(el, { y, duration: 0.55, ease: 'back.out(1.6)', onUpdate: update, onComplete: () => d.update() })
    }
    ;(vp as HTMLElement & { __tune?: (i: number) => void }).__tune = tune

    let acc = 0
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      acc += e.deltaY
      if (Math.abs(acc) < 24) return
      const step = acc > 0 ? 1 : -1
      acc = 0
      const cur = Math.round((center - (gsap.getProperty(el, 'y') as number)) / ROW)
      tune(cur + step)
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      d.kill()
      vp.removeEventListener('wheel', onWheel)
    }
  }, [n, center])

  const tuneTo = (i: number) => {
    const vp = viewport.current as (HTMLElement & { __tune?: (i: number) => void }) | null
    vp?.__tune?.(i)
  }

  const f = franjas[locked]
  const covers = useMemo(
    () =>
      market
        .flatMap((m) => (m.marketplaceListings ?? []).filter((l) => l.status !== 'sold' && l.images[0]).map((l) => ({ l, m })))
        .slice(0, 6),
    [market],
  )

  if (!n) return null

  return (
    <div className={styles.dial}>
      <header className={styles.head}>
        <span className={styles.name} style={{ '--chip': 'var(--l-fr)', '--chip-on': 'var(--l-fr-on)' } as React.CSSProperties}>
          Franjas
        </span>
        <span className={styles.sub}>{n} · por última señal</span>
      </header>

      <div
        className={styles.window}
        ref={viewport}
        style={{ height: H, ['--static' as string]: static_.toFixed(3) }}
        tabIndex={0}
        role="listbox"
        aria-label="Sintonizar franja"
        aria-activedescendant={f ? `st-${f.id}` : undefined}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            tuneTo(locked + 1)
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            tuneTo(locked - 1)
          }
          if (e.key === 'Enter' && f) openLectura(f.slug)
        }}
      >
        <div className={styles.needle} style={{ top: center + ROW / 2 }} />
        <div className={styles.interference} />
        <div className={styles.scale} ref={scale}>
          {franjas.map((fr, i) => (
            <button
              key={fr.id}
              id={`st-${fr.id}`}
              type="button"
              role="option"
              aria-selected={i === locked}
              data-station=""
              data-locked={i === locked || undefined}
              className={styles.station}
              style={{ height: ROW }}
              onClick={() => (i === locked ? openLectura(fr.slug) : tuneTo(i))}
            >
              <span className={styles.freq}>{(88 + (i * 20) / Math.max(1, n - 1)).toFixed(1)}</span>
              <span className={styles.stationName}>{fr.title}</span>
              <span className={styles.kind}>{fr.franjaKind ? KIND_LABEL[fr.franjaKind] : ''}</span>
            </button>
          ))}
        </div>
      </div>

      {f ? (
        <div className={styles.locked} key={f.id}>
          <div className={styles.logo}>
            {f.imageUrl ? <Image src={f.imageUrl} alt="" fill sizes="96px" className={styles.logoImg} /> : <span>{f.title.slice(0, 2)}</span>}
          </div>
          <div className={styles.lockedText}>
            <span className={styles.lockedName}>{f.title}</span>
            <span className={styles.lockedMeta}>
              {f.franjaKind ? KIND_LABEL[f.franjaKind] : 'Franja'}
              {f.franjaLastUpdated ? ` · señal ${ago(f.franjaLastUpdated, now)}` : ''}
            </span>
            <div className={styles.lockedActions}>
              <button type="button" className={styles.tune} onClick={() => openLectura(f.slug)}>
                Sintonizar
              </button>
              <Link href={`/f/${f.slug}`} className={styles.link}>
                Dossier <Mark name="arrow" size={12} />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {covers.length ? (
        <div className={styles.market}>
          <header className={styles.head}>
            <span className={styles.name} style={{ '--chip': 'var(--l-fr)', '--chip-on': 'var(--l-fr-on)' } as React.CSSProperties}>
              Mercado
            </span>
            <span className={styles.sub}>{market.length} tiendas de franja</span>
          </header>
          <div className={styles.covers}>
            {covers.map(({ l, m }) => (
              <Link key={l.id} href={`/mercado?franja=${m.slug}&pieza=${l.id}`} className={styles.cover} title={`${l.title} — ${m.title}`}>
                <Image src={l.images[0]} alt="" fill sizes="80px" className={styles.coverImg} />
              </Link>
            ))}
          </div>
          <Link href="/mercado" className={styles.link}>
            Ir al mercado <Mark name="arrow" size={12} />
          </Link>
        </div>
      ) : null}
    </div>
  )
}
