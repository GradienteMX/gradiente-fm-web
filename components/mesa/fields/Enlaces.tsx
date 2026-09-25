'use client'

/**
 * ENLACES — where to buy, listen or read more. Plain labeled URLs (distinct
 * from playable sources and from scene entities). Presets fill the label.
 */

import type { EntityLink } from '@/lib/types'
import { Mark } from '@/components/kit/Glyph'
import { hostOf, usableUrl } from '../model'
import { IconBtn } from './bits'
import f from './fields.module.css'

export function Enlaces({ value, onChange, presets, label = 'Enlaces' }: { value: EntityLink[]; onChange: (v: EntityLink[]) => void; presets: string[]; label?: string }) {
  const update = (i: number, p: Partial<EntityLink>) => onChange(value.map((l, k) => (k === i ? { ...l, ...p } : l)))
  const add = (preset?: string) => {
    onChange([...value, { label: preset ?? '', url: '' }])
    requestAnimationFrame(() => document.getElementById(`mesa-link-${value.length}`)?.focus())
  }
  return (
    <div className={f.stack} style={{ gap: 10 }}>
      <span className={f.label}>{label}</span>
      {value.length ? (
        <div className={f.rows}>
          {value.map((l, i) => {
            const bad = l.url.trim() !== '' && !usableUrl(l.url)
            return (
              <div key={i} className={f.rowLine} style={{ gridTemplateColumns: '150px minmax(0, 1fr) auto' }}>
                <input
                  className={f.cell}
                  value={l.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder={usableUrl(l.url) ? hostOf(l.url) : 'Etiqueta'}
                  aria-label={`Etiqueta del enlace ${i + 1}`}
                />
                <input
                  id={`mesa-link-${i}`}
                  className={f.cell}
                  type="url"
                  value={l.url}
                  data-bad={bad ? '' : undefined}
                  onChange={(e) => update(i, { url: e.target.value })}
                  placeholder="https://…"
                  aria-label={`Dirección del enlace ${i + 1}`}
                  aria-invalid={bad || undefined}
                />
                <IconBtn label={`Quitar enlace ${i + 1}`} onClick={() => onChange(value.filter((_, k) => k !== i))}>
                  <Mark name="close" size={12} />
                </IconBtn>
              </div>
            )
          })}
        </div>
      ) : null}
      <div className={f.inline}>
        <button type="button" className={f.add} onClick={() => add()}>
          <Mark name="plus" size={13} /> Enlace
        </button>
        {presets.map((p) => (
          <button key={p} type="button" className={f.pick} onClick={() => add(p)}>
            + {p}
          </button>
        ))}
      </div>
      {value.some((l) => l.url.trim() && !usableUrl(l.url)) ? <p className={f.note}>Los enlaces sin https:// no se publican.</p> : null}
    </div>
  )
}
