'use client'

/**
 * COLOFÓN — the printer's note at the foot of every sheet: what this is,
 * how to read it (the ramp's legend), and the house pages the nav doesn't
 * carry. Every line either links somewhere real or explains the page.
 */

import Link from 'next/link'
import { SPECTRUM_HEX, VIBE_NAMES } from '@/lib/vibe'
import styles from './Colofon.module.css'

const CASA = [
  { href: '/about', label: 'Sobre Gradiente' },
  { href: '/manifesto', label: 'Manifiesto' },
  { href: '/equipo', label: 'Equipo' },
  { href: '/espera', label: 'Lista de espera' },
]

export function Colofon() {
  return (
    <footer className={styles.colofon}>
      <div className={styles.inner}>
        <div className={styles.lead}>
          <p className={styles.mark}>
            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" className={styles.reg}>
              <circle cx="10" cy="10" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M10 1v18M1 10h18" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="10" cy="10" r="1.9" fill="currentColor" />
            </svg>
            Gradiente
          </p>
          <p className={styles.what}>
            Infraestructura y memoria para la escena underground de música y arte sonoro en México. Se navega por energía, no por
            género; la atención se comporta como física, no como dinero.
          </p>
        </div>

        <figure className={styles.legend} aria-label="Leyenda de energía">
          <div className={styles.ramp}>
            {SPECTRUM_HEX.map((c, i) => (
              <span key={i} style={{ background: c }} title={`${String(i).padStart(2, '0')} ${VIBE_NAMES[i]}`} />
            ))}
          </div>
          <figcaption className={styles.caption}>
            <span>00 {VIBE_NAMES[0]}</span>
            <span>Energía, no género</span>
            <span>10 {VIBE_NAMES[10]}</span>
          </figcaption>
        </figure>

        <nav className={styles.casa} aria-label="La casa">
          {CASA.map((l, i) => (
            <Link key={l.href} href={l.href}>
              <span className={styles.idx}>{String(i + 1).padStart(2, '0')}</span>
              {l.label}
            </Link>
          ))}
        </nav>

        <p className={styles.imprint}>
          <span>CDMX · 2026</span>
          <span>Tamaño + posición = vida · sin métricas públicas</span>
          <span>V2 · beta</span>
        </p>
      </div>
    </footer>
  )
}
