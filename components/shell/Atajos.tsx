'use client'

import { useEffect, useState } from 'react'
import { Sheet } from '@/components/kit/Sheet'
import { Kbd } from '@/components/kit/Bits'
import { Mark } from '@/components/kit/Glyph'
import styles from './Atajos.module.css'

const GROUPS: Array<{ title: string; note?: string; rows: Array<[string[], string]> }> = [
  {
    title: 'En todas partes',
    rows: [
      [['/'], 'Buscar'],
      [['?'], 'Esta ayuda'],
      [['Esc'], 'Cerrar lo que esté encima'],
    ],
  },
  {
    title: 'Horizonte',
    note: 'con una tapa enfocada',
    rows: [
      [['←', '→'], 'Mover una detención'],
      [['Shift', '←/→'], 'Mover dos'],
      [['Inicio', 'Fin'], 'Ir a un extremo'],
      [['clic en un nombre'], 'Sintonizar esa estación'],
      [['Shift', 'clic'], 'Extender hasta esa estación'],
      [['doble clic'], 'Todo el espectro'],
    ],
  },
  {
    title: 'Lectura',
    rows: [
      [['C'], 'Abrir / cerrar el hilo'],
      [['Esc'], 'Cerrar el hilo, luego la lectura'],
      [['P'], 'Reproducir / pausar (sesiones)'],
      [['O'], 'Abrir la fuente (sesiones)'],
    ],
  },
  {
    title: 'Calibrador',
    rows: [
      [['arrastrar'], 'Pinta tu lectura y suéltala para sellarla'],
      [['←', '→'], 'Mover tu lectura'],
      [['Shift', '→'], 'Ensancharla'],
      [['Enter'], 'Sellar'],
    ],
  },
  {
    title: 'Hilo',
    rows: [
      [['Enter'], 'Enviar'],
      [['Shift', 'Enter'], 'Salto de línea'],
    ],
  },
]

/** Pointer gestures print in a dashed box: they aren't keys. */
const GESTURES = new Set(['clic en un nombre', 'clic', 'doble clic', 'arrastrar'])

const two = (n: number) => String(n).padStart(2, '0')

/** `?` opens the keys. Every shortcut listed here exists. */
export function Atajos() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      setOpen((o) => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <Sheet open={open} onClose={() => setOpen(false)} label="Atajos de teclado" width={720} z={92}>
      <div className={styles.body}>
        <header className={styles.head}>
          <p className={styles.kicker}>
            <span className={styles.name}>Teclado</span>
            <span className={styles.rest}>— todo lo que aparece aquí existe</span>
          </p>
          <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Cerrar (Esc)">
            <Mark name="close" size={13} />
            <kbd>Esc</kbd>
          </button>
        </header>
        <div className={styles.groups}>
          {GROUPS.map((g, gi) => (
            <section key={g.title} className={styles.group} aria-labelledby={`atajos-${gi}`}>
              <h3 id={`atajos-${gi}`} className={styles.groupHead}>
                <span className={styles.n}>{two(gi + 1)}</span>
                <span className={styles.slash}>/</span>
                <span className={styles.gname}>{g.title}</span>
                {g.note ? <span className={styles.note}>— {g.note}</span> : null}
              </h3>
              <dl className={styles.table}>
                {g.rows.map(([keys, what]) => (
                  <div key={what} className={styles.row}>
                    <dt className={styles.keys}>
                      {keys.map((k, i) => (
                        <span key={k} className={styles.key}>
                          {i > 0 ? (
                            <span className={styles.join} aria-hidden="true">
                              {keys[i - 1] === 'Shift' ? '+' : '/'}
                            </span>
                          ) : null}
                          {GESTURES.has(k) ? <span className={styles.gesture}>{k}</span> : <Kbd>{k}</Kbd>}
                        </span>
                      ))}
                    </dt>
                    <dd className={styles.what}>{what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
