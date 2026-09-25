'use client'

/**
 * CASA — the house pages (/about, /manifesto, /equipo): long-scroll
 * editorial, set like a printed document.
 *
 *  · each apartado sits at its own temperature: the document is tuned
 *    across the dial from glacial to volcán as you read it (type width and
 *    weight; hue only in the small swatch beside the number)
 *  · a side index that works (jump + where you are), never decoration
 *  · headings print in through the shared TRAMA press as they reach the
 *    eye; prose is simply there. Reduced motion / no WebGL: all still.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import { energyHex, energyVariation, vibeName } from '@/lib/vibe'
import { Revelado } from '@/components/trama/Revelado'
import styles from './Casa.module.css'
import { Cabecera } from '@/components/librea/Cabecera'
import { LIBREA_SECCION } from '@/lib/librea'

if (typeof window !== 'undefined') gsap.registerPlugin(ScrollToPlugin)

export interface Apartado {
  id: string
  title: string
  motto?: string
  /** A future that is named, not faked. */
  futuro?: boolean
  content: ReactNode
}

interface Props {
  kicker: string
  hero: ReactNode
  apartados: Apartado[]
  colofon?: ReactNode
  /** Temperature range the document sweeps (first → last apartado). */
  sweep?: [number, number]
  /** Side index (jump + where you are). Off for short documents. */
  indice?: boolean
}

const CASA_LINKS = [
  { href: '/about', label: 'Qué es Gradiente' },
  { href: '/manifesto', label: 'Manifiesto' },
  { href: '/equipo', label: 'Equipo' },
]

export function CasaDoc({ kicker, hero, apartados, colofon, sweep = [0, 10], indice = true }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(apartados[0]?.id ?? '')
  const pathname = usePathname()
  const energyOf = (i: number) => (apartados.length < 2 ? sweep[0] : sweep[0] + ((sweep[1] - sweep[0]) * i) / (apartados.length - 1))

  // Where you are: the apartado crossing the upper third of the viewport.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
      },
      { rootMargin: '-38% 0px -60% 0px', threshold: 0 },
    )
    el.querySelectorAll('[data-apartado]').forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])

  const go = (id: string) => (e: React.MouseEvent) => {
    const target = document.getElementById(id)
    if (!target) return
    e.preventDefault()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    gsap.to(window, { scrollTo: { y: target, offsetY: 96, autoKill: true }, duration: reduced ? 0 : 0.5, ease: 'power3.inOut' })
    window.history.replaceState(null, '', `#${id}`)
    setActive(id)
    target.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  }

  return (
    <div ref={root} className={styles.casa}>
      <Cabecera
        librea={{ ...LIBREA_SECCION.casa, nombre: pathname?.startsWith('/manifesto') ? 'Manifiesto' : pathname?.startsWith('/equipo') ? 'Equipo' : 'Casa' }}
        glyph="casa"
        size="compact"
        lema={kicker}
      />
      <header className={styles.hero}>
        <p className={styles.kicker}>
          <span className="label">Casa</span>
          <span className={styles.kickerRule} aria-hidden="true" />
          <span className={styles.kickerText}>{kicker}</span>
        </p>
        {hero}
      </header>

      <div className={styles.body}>
        {indice ? (
          <nav className={styles.indice} aria-label="Índice">
            <p className="label">Índice</p>
            <ol>
              {apartados.map((a, i) => {
                const e = energyOf(i)
                return (
                  <li key={a.id}>
                    <a href={`#${a.id}`} onClick={go(a.id)} data-on={active === a.id || undefined} aria-current={active === a.id ? 'location' : undefined}>
                      <span className={styles.indiceTick} style={{ background: energyHex(e) }} aria-hidden="true" />
                      <span className={styles.indiceNum}>{String(i + 1).padStart(2, '0')}</span>
                      <span className={styles.indiceName}>{a.title}</span>
                    </a>
                  </li>
                )
              })}
            </ol>
          </nav>
        ) : (
          <span aria-hidden="true" />
        )}

        <div className={styles.column}>
          {apartados.map((a, i) => {
            const e = energyOf(i)
            return (
              <section key={a.id} id={a.id} className={styles.apartado} data-apartado="" aria-labelledby={`${a.id}-h`} style={{ ['--ae' as string]: energyHex(e) }}>
                <header className={styles.apHead}>
                  <p className={styles.apNum}>
                    <span className={styles.apTick} aria-hidden="true" />
                    {String(i + 1).padStart(2, '0')} · {vibeName(e)}
                    {a.futuro ? <span className={styles.futuro}>Futuro · aún no existe</span> : null}
                  </p>
                  <Revelado
                    as="h2"
                    id={`${a.id}-h`}
                    className={styles.apTitle}
                    style={{ fontVariationSettings: energyVariation(e) }}
                    tabIndex={-1}
                    energy={e}
                  >
                    {a.title}
                  </Revelado>
                  {a.motto ? <p className={styles.motto}>{a.motto}</p> : null}
                </header>
                <div className={styles.prose}>{a.content}</div>
              </section>
            )
          })}

          <footer className={styles.colofon}>
            {colofon}
            <nav className={styles.casaNav} aria-label="Casa">
              {CASA_LINKS.map((l) => (
                <Link key={l.href} href={l.href} aria-current={pathname === l.href ? 'page' : undefined} data-on={pathname === l.href || undefined}>
                  {l.label}
                </Link>
              ))}
            </nav>
          </footer>
        </div>
      </div>
    </div>
  )
}

export function P({ children, lead }: { children: ReactNode; lead?: boolean }) {
  return <p className={lead ? styles.leadP : undefined}>{children}</p>
}

export function Sub({ children }: { children: ReactNode }) {
  return <h3 className={styles.sub}>{children}</h3>
}

export function Lista({ items, ordered }: { items: ReactNode[]; ordered?: boolean }) {
  const L = ordered ? 'ol' : 'ul'
  return (
    <L className={ordered ? styles.steps : styles.bullets}>
      {items.map((it, i) => (
        <li key={i}>
          {ordered ? <span className={styles.stepNum}>{String(i + 1).padStart(2, '0')}</span> : null}
          <span>{it}</span>
        </li>
      ))}
    </L>
  )
}

/** An honest placeholder: the text is owed, and says what it will be. */
export function SinRedactar({ note }: { note: string }) {
  return (
    <span className={styles.redactar}>
      <span className={styles.redactarTag}>sin redactar</span>
      {note}
    </span>
  )
}

export function Flujo({ steps }: { steps: string[] }) {
  return (
    <p className={styles.flujo} aria-label={steps.join(', luego ')}>
      {steps.map((s, i) => (
        <span key={s} aria-hidden="true">
          {i > 0 ? <span className={styles.flujoArrow}>→</span> : null}
          <span className={styles.flujoStep}>{s}</span>
        </span>
      ))}
    </p>
  )
}
