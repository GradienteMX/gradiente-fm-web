'use client'

/**
 * RELEVO — changing section is a handover between liveries. The new
 * section's slabs arrive already covering the page (rendered in the same
 * commit as the page, so nothing flashes), the channel and code decode, and
 * the slabs retract in registration steps, staggered. ~0.55 s, pointer-
 * transparent, skipped on first load, within a section, and in reduced motion.
 */

import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { Librea } from '@/lib/librea'
import { SeccionGlyph } from '@/components/kit/Glyph'
import { Descifrar } from './Descifrar'
import { patronCss } from './patron'
import styles from './Relevo.module.css'

let lastKey: string | null = null

export function Relevo({ librea }: { librea: Librea }) {
  const root = useRef<HTMLDivElement>(null)
  // Decided once per mount (templates remount per route): play only on a
  // real change of section, never on first load.
  const [play] = useState(
    () =>
      typeof window !== 'undefined' &&
      lastKey !== null &&
      lastKey !== librea.key &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [done, setDone] = useState(false)

  useLayoutEffect(() => {
    lastKey = librea.key
    const el = root.current
    if (!play || !el) return
    const slabs = el.querySelectorAll<HTMLElement>('[data-slab]')
    const tl = gsap.timeline({ onComplete: () => setDone(true) })
    tl.to(slabs, {
      xPercent: 101,
      duration: 0.34,
      ease: 'steps(5)',
      stagger: { each: 0.045, from: 'end' },
      delay: 0.16,
    })
    return () => {
      tl.kill()
    }
  }, [play, librea.key])

  if (!play || done) return null
  const pat = patronCss(librea.patron, librea.on, 1.6)
  return (
    <div ref={root} className={styles.relevo} aria-hidden="true" style={{ '--lc': librea.color, '--lo': librea.on, '--la': librea.alt } as React.CSSProperties}>
      <div data-slab="" className={styles.slab} data-kind="patron">
        <div className={styles.pat} style={{ backgroundImage: pat.backgroundImage, backgroundSize: pat.backgroundSize }} />
      </div>
      <div data-slab="" className={styles.slab} data-kind="ink" />
      <div data-slab="" className={`${styles.slab} ${styles.main}`}>
        <span className={styles.canal}>
          <Descifrar text={`${librea.canal} ${librea.code}`} onMount />
        </span>
        <span className={styles.name}>
          <Descifrar text={librea.nombre.toUpperCase()} onMount duration={300} />
        </span>
        <SeccionGlyph seccion={librea.key} className={styles.glyph} />
      </div>
      <div data-slab="" className={styles.slab} data-kind="ink" />
      <div data-slab="" className={styles.slab} data-kind="patron">
        <div className={styles.pat} style={{ backgroundImage: pat.backgroundImage, backgroundSize: pat.backgroundSize }} />
      </div>
    </div>
  )
}
