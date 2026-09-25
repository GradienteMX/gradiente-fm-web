'use client'

/**
 * The format selector for Lecturas — pictograms, never color (hue is
 * energy). A boxed strip of cells; the chosen one is printed inverse (ink
 * ground, paper type) at once — pressing never tweens. Counts are catalog
 * facts at the current temperature.
 * Keyboard: a radio group — arrows move, Home/End jump.
 */

import { useRef } from 'react'
import { FormatGlyph, FORMAT_STOCK } from '@/components/kit/Glyph'
import { TodoGlyph } from './Pictos'
import { TIPOS_LECTURA, TIPO_LABEL, type TipoLectura } from './tipos'
import styles from './SelectorTipos.module.css'

interface Props {
  value: TipoLectura | null
  onChange: (t: TipoLectura | null) => void
  counts: Partial<Record<TipoLectura, number>>
  total: number
}

const OPTIONS: Array<TipoLectura | null> = [null, ...TIPOS_LECTURA]

export function SelectorTipos({ value, onChange, counts, total }: Props) {
  const track = useRef<HTMLDivElement>(null)

  const onKey = (e: React.KeyboardEvent) => {
    const i = OPTIONS.indexOf(value)
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % OPTIONS.length
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + OPTIONS.length) % OPTIONS.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = OPTIONS.length - 1
    if (next < 0) return
    e.preventDefault()
    onChange(OPTIONS[next])
    requestAnimationFrame(() => track.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus())
  }

  return (
    <div className={styles.wrap}>
      <div ref={track} className={styles.track} role="radiogroup" aria-label="Formato de lectura" onKeyDown={onKey}>
        {OPTIONS.map((t) => {
          const on = value === t
          const n = t ? counts[t] ?? 0 : total
          return (
            <button
              key={t ?? 'todo'}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              className={styles.opt}
              data-on={on || undefined}
              data-empty={n === 0 || undefined}
              onClick={() => onChange(t)}
            >
              {t ? <span className={styles.swatch} style={{ background: FORMAT_STOCK[t] }} aria-hidden="true" /> : null}
              {t ? <FormatGlyph type={t} size={15} /> : <TodoGlyph size={15} />}
              <span className={styles.name}>{t ? TIPO_LABEL[t] : 'Todo'}</span>
              <span className={styles.count}>{String(n).padStart(2, '0')}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
