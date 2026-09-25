'use client'

/**
 * CABECERA — a section's masthead, in its livery, at full volume.
 *
 * Channel and code, the name set huge in Anybody with an outlined overprint,
 * the livery's pattern drifting in a band (only while on screen), the
 * pictogram overprinted on the name, one true line and real counts.
 *
 * It morphs instead of cutting: when the livery changes (Lecturas → Reseñas)
 * the old colour wipes off in registration steps, the name and code decode
 * into the new ones while the type's width morphs, the counts roll.
 */

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import type { Librea } from '@/lib/librea'
import { SeccionGlyph } from '@/components/kit/Glyph'
import { useReducedMotion } from '@/lib/useMedia'
import { Descifrar } from './Descifrar'
import { patronCss } from './patron'
import styles from './Cabecera.module.css'

export interface Dato {
  k: string
  v: string | number
}

export function Cabecera({
  librea,
  glyph,
  datos = [],
  lema,
  size = 'full',
  children,
}: {
  librea: Librea
  /** Pictogram key (defaults to the livery's key). */
  glyph?: string
  /** Real counts only — catalog facts, never rankings. */
  datos?: Dato[]
  lema?: ReactNode
  size?: 'full' | 'compact' | 'banda'
  /** A controls row printed inside the livery (tabs, filters). */
  children?: ReactNode
}) {
  const root = useRef<HTMLElement>(null)
  const flood = useRef<HTMLDivElement>(null)
  const band = useRef<HTMLDivElement>(null)
  const prev = useRef<Librea | null>(null)
  const reduced = useReducedMotion()
  const name = librea.nombre.toUpperCase()
  const pat = patronCss(librea.patron, librea.on)

  // Morph: the previous livery's colour wipes off in steps over the new one.
  useLayoutEffect(() => {
    const el = root.current
    const f = flood.current
    const old = prev.current
    prev.current = librea
    if (!el || !f || !old || old.key === librea.key || reduced) return
    f.style.background = old.color
    const tl = gsap.timeline()
    tl.fromTo(f, { clipPath: 'inset(0 0% 0 0)' }, { clipPath: 'inset(0 0% 0 100%)', duration: 0.42, ease: 'steps(7)' })
    tl.fromTo(el, { '--wd': old.wdth, '--wg': old.wght }, { '--wd': librea.wdth, '--wg': librea.wght, duration: 0.5, ease: 'steps(9)' }, 0)
    return () => {
      tl.progress(1).kill()
    }
  }, [librea, reduced])

  // The pattern drifts only while the masthead is on screen.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => el.toggleAttribute('data-vivo', e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Size the name so the whole word always fits its line (extended type runs wide).
  const perChar = 0.64 * (librea.wdth / 100) * (0.9 + librea.wght / 9000)
  const fit = (96 / Math.max(1, name.length * perChar)).toFixed(2)
  const fontSize =
    size === 'full'
      ? `clamp(52px, ${fit}cqi, 196px)`
      : size === 'banda'
        ? `clamp(30px, ${(Number(fit) * 0.34).toFixed(2)}cqi, 58px)`
        : `clamp(40px, ${(Number(fit) * 0.62).toFixed(2)}cqi, 112px)`

  return (
    <header
      ref={root}
      className={styles.cab}
      data-size={size}
      data-patron={librea.patron}
      style={
        {
          '--lc': librea.color,
          '--lo': librea.on,
          '--la': librea.alt,
          '--wd': librea.wdth,
          '--wg': librea.wght,
          '--tile': `${pat.tile}px`,
        } as React.CSSProperties
      }
    >
      <div ref={flood} className={styles.flood} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.top}>
          <span className={styles.canal}>
            Canal <Descifrar text={librea.canal} />
          </span>
          <span className={styles.code}>
            <Descifrar text={librea.code} />
          </span>
          <span className={styles.rule} aria-hidden="true" />
          <span className={styles.meta}>Gradiente · señal {librea.canal}/12</span>
          <span className={styles.arrows} aria-hidden="true">
            ▶▶▶
          </span>
        </div>

        <div className={styles.body}>
          <h1 className={styles.name} style={{ fontSize }}>
            <span className={styles.ghost} aria-hidden="true">
              {name}
            </span>
            <Descifrar text={name} className={styles.solid} />
          </h1>
          <SeccionGlyph seccion={glyph ?? librea.key} className={styles.glyph} />
        </div>

        <div ref={band} className={styles.band} aria-hidden="true">
          <div className={styles.bandInk} style={{ backgroundImage: pat.backgroundImage, backgroundSize: pat.backgroundSize }} />
        </div>

        <div className={styles.foot}>
          <p className={styles.lema}>{lema ?? librea.lema}</p>
          {datos.length ? (
            <dl className={styles.datos}>
              {datos.map((d) => (
                <div key={d.k} className={styles.dato}>
                  <dd>
                    <Descifrar text={String(d.v)} />
                  </dd>
                  <dt>{d.k}</dt>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        {children ? <div className={styles.controls}>{children}</div> : null}
      </div>
    </header>
  )
}
