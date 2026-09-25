'use client'

/**
 * SINTONÍA — the lock-on.
 *
 * A franja is a station on the dial. When its Estación opens (or its dossier
 * loads), the needle sweeps in from where the radio was last tuned (or from
 * the far end of the band), overshoots and settles on this station's
 * frequency with a detent. While it travels, a band of ink blocks retunes
 * the plate (TRAMA `barrido`); as it arrives, the logo prints out of its own
 * coarse blocks and the name resolves (`revelarImagen`, `revelar`). The
 * frequency is the one the home Dial prints for this station — its place in
 * the order of last signals.
 *
 * All pixel work is the shared TRAMA engine's; this file only moves the
 * needle. Reduced motion or no WebGL: the station is simply already tuned
 * (the engine resolves every gesture instantly and nothing stays hidden).
 */

import { type RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { barrido, revelar, revelarImagen } from '@/components/trama/api'
import styles from './Sintonia.module.css'

if (typeof window !== 'undefined') gsap.registerPlugin(useGSAP)

const LO = 88
const HI = 108
const MAJORS = [88, 92, 96, 100, 104, 108]

/** Where the needle was last left — the next station sweeps from here. */
let lastTuned: number | null = null

const pct = (f: number) => ((Math.min(HI, Math.max(LO, f)) - LO) / (HI - LO)) * 100

export function Escala({ freq, compact }: { freq: number; compact?: boolean }) {
  return (
    <div className={styles.escala} data-compact={compact || undefined} data-sint-scale="">
      <div className={styles.readout}>
        <span className={styles.dialLabel}>Dial</span>
        <span className={styles.freq} data-sint-readout="">
          {freq.toFixed(1)}
        </span>
        <span className={styles.state} data-sint-state="" aria-live="polite">
          En sintonía
        </span>
      </div>
      <div className={styles.track} role="img" aria-label={`Posición en el dial: ${freq.toFixed(1)}, por orden de última señal`}>
        <span className={styles.ticks} aria-hidden="true" />
        {MAJORS.map((m, k) => (
          <span
            key={m}
            className={styles.major}
            data-edge={k === 0 ? 'lo' : k === MAJORS.length - 1 ? 'hi' : undefined}
            style={{ left: k === MAJORS.length - 1 ? 'calc(100% - 1px)' : `${pct(m)}%` }}
            aria-hidden="true"
          >
            <i>{m}</i>
          </span>
        ))}
        <span className={styles.needle} data-sint-needle="" style={{ left: `${pct(freq)}%` }} aria-hidden="true" />
      </div>
    </div>
  )
}

/** Print an <img> once it has pixels; never leave it hidden if it can't load. */
function printWhenLoaded(img: HTMLImageElement) {
  const go = () => void revelarImagen(img, { dir: 'right' })
  if (img.complete && img.naturalWidth) return go()
  const done = () => {
    img.removeEventListener('load', done)
    img.removeEventListener('error', fail)
    go()
  }
  const fail = () => {
    img.removeEventListener('load', done)
    img.removeEventListener('error', fail)
    img.setAttribute('data-trama-img', 'listo')
  }
  img.addEventListener('load', done)
  img.addEventListener('error', fail)
}

/**
 * Runs the lock-on over `scope`. Markup contract:
 *   needle `[data-sint-needle]` · readout `[data-sint-readout]` · state `[data-sint-state]`
 *   plate box `[data-sint-plate]` holding an `img[data-trama-img="pendiente"]` (or
 *   `[data-trama="pendiente"]` initials) · name `[data-sint-name][data-trama="pendiente"]`.
 */
export function useSintonia(scope: RefObject<HTMLElement | null>, freq: number, energy: number) {
  useGSAP(
    () => {
      const root = scope.current
      if (!root) return
      const needles = [...root.querySelectorAll<HTMLElement>('[data-sint-needle]')]
      const readouts = [...root.querySelectorAll<HTMLElement>('[data-sint-readout]')]
      const states = [...root.querySelectorAll<HTMLElement>('[data-sint-state]')]
      const plates = [...root.querySelectorAll<HTMLElement>('[data-sint-plate]')]
      const names = [...root.querySelectorAll<HTMLElement>('[data-sint-name]')]
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const print = () => {
        for (const plate of plates) {
          const img = plate.querySelector<HTMLImageElement>('img[data-trama-img="pendiente"]')
          if (img) printWhenLoaded(img)
          const initials = plate.querySelector<HTMLElement>('[data-trama="pendiente"]')
          if (initials) void revelar(initials, { energy, preset: 'bitmap' })
        }
        for (const n of names) void revelar(n, { energy, preset: 'imprimir' })
      }
      const settle = () => {
        needles.forEach((n) => (n.style.left = `${pct(freq)}%`))
        readouts.forEach((r) => (r.textContent = freq.toFixed(1)))
        states.forEach((s) => (s.textContent = 'En sintonía'))
        root.dataset.sintonia = 'fija'
      }

      if (reduced || !needles.length) {
        settle()
        print()
        lastTuned = freq
        return
      }

      const from = lastTuned !== null && Math.abs(lastTuned - freq) > 0.05 ? lastTuned : freq > (LO + HI) / 2 ? LO : HI
      const dir = Math.sign(freq - from) || 1
      const st = { f: from }
      root.dataset.sintonia = 'buscando'
      states.forEach((s) => (s.textContent = 'Buscando señal'))
      const render = () => {
        const left = `${pct(st.f)}%`
        needles.forEach((n) => (n.style.left = left))
        const txt = st.f.toFixed(1)
        readouts.forEach((r) => (r.textContent = txt))
      }
      render()
      plates.forEach((p) => barrido(p, { energy, dir: 'down' }))

      const travel = Math.min(1.1, 0.5 + Math.abs(freq - from) / 30)
      gsap
        .timeline({ onComplete: settle })
        .to(st, { f: freq + dir * 0.7, duration: travel, ease: 'power3.inOut', onUpdate: render }, 0)
        .to(st, { f: freq, duration: 0.5, ease: 'back.out(2.4)', onUpdate: render }, travel)
        .call(print, [], travel * 0.6)
        .call(() => states.forEach((s) => (s.textContent = 'En sintonía')), [], travel + 0.2)
      lastTuned = freq
    },
    { scope, dependencies: [freq] },
  )
}
