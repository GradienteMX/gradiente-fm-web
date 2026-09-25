'use client'

/**
 * The title, typed in the typography it will have: Anybody at the piece's
 * own energy (wide and light when cold, condensed and black when hot). Enter
 * moves on instead of breaking the line.
 */

import type { ReactNode } from 'react'
import type { FormApi } from '../context'
import { FIELD_ID } from '../model'
import f from '../fields/fields.module.css'

export function Titulo({ api, placeholder, sub, children }: { api: FormApi; placeholder: string; sub?: string | null; children?: ReactNode }) {
  const { item, patch } = api
  const long = item.title.length > 90
  return (
    <div className={f.stack} style={{ gap: 12 }}>
      <textarea
        id={FIELD_ID.title}
        className={f.titleInput}
        rows={1}
        value={item.title}
        placeholder={placeholder}
        aria-label="Título"
        spellCheck
        onChange={(e) => patch({ title: e.target.value.replace(/\s*\n+\s*/g, ' ') })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            const next = document.getElementById('mesa-f-sub') ?? e.currentTarget.closest('section')?.querySelector<HTMLElement>('input, textarea:not(#mesa-f-title)')
            next?.focus()
          }
        }}
      />
      {sub !== null && sub !== undefined ? (
        <input
          id="mesa-f-sub"
          className={f.subInput}
          value={item.subtitle ?? ''}
          placeholder={sub}
          aria-label="Subtítulo"
          onChange={(e) => patch({ subtitle: e.target.value })}
        />
      ) : null}
      <p className={f.note}>{long ? 'Un título tan largo se corta en la tarjeta. Concreto funciona mejor.' : 'Concreto, no clickbait. Se compone en la energía de la pieza.'}</p>
      {children}
    </div>
  )
}
