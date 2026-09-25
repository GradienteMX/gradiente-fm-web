'use client'

/**
 * The publication's link. It follows the title until the author edits it;
 * once a piece is published its link never changes (old links keep working).
 */

import { useEffect, useRef, useState } from 'react'
import { Mark } from '@/components/kit/Glyph'
import { useMesa } from '../context'
import { slugify, uniqueSlug } from '../model'
import f from './fields.module.css'

export function Slug({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const { existing, slugTaken, setSlugFollows, slugFollows } = useMesa()
  const [editing, setEditing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const locked = !!existing

  useEffect(() => {
    if (editing) input.current?.focus()
  }, [editing])

  const taken = !!value && !locked && slugTaken(value)
  const final = taken ? uniqueSlug(value, slugTaken) : value

  return (
    <div className={f.stack} style={{ gap: 8 }}>
      <span className={f.label}>Enlace de la publicación</span>
      <div className={f.rowLine} style={{ gridTemplateColumns: 'auto minmax(0, 1fr) auto', padding: '0 4px 0 12px', height: 42, borderRadius: 'var(--r-piece)', border: '1px solid var(--hair-2)', background: 'var(--obs-0)' }}>
        <span style={{ color: 'var(--ink-3)', display: 'grid' }}>
          <Mark name={locked || !editing ? 'lock' : 'share'} size={13} />
        </span>
        {editing ? (
          <input
            ref={input}
            className={f.mono}
            style={{ background: 'transparent', border: 0, color: 'var(--ink)', height: 40, outline: 'none', minWidth: 0 }}
            value={value}
            aria-label="Enlace de la publicación"
            onChange={(e) => {
              setSlugFollows(false)
              onChange(slugify(e.target.value))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                setEditing(false)
              }
            }}
            placeholder="se-genera-del-titulo"
          />
        ) : (
          <span className={f.mono} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: value ? 'var(--ink)' : 'var(--ink-4)' }}>
            <span style={{ color: 'var(--ink-4)' }}>/?item=</span>
            {value || 'se-genera-del-titulo'}
          </span>
        )}
        {locked ? (
          <span className={f.note} style={{ paddingRight: 10 }}>
            publicada
          </span>
        ) : (
          <button id={id} type="button" className={f.tool} onClick={() => setEditing((v) => !v)}>
            {editing ? 'Listo' : 'Editar enlace'}
          </button>
        )}
      </div>
      {locked ? (
        <p className={f.note}>Una pieza publicada conserva su enlace: quien la compartió no pierde el camino.</p>
      ) : taken ? (
        <p className={f.warn}>
          Ya hay una pieza con este enlace; se publicará como <span className={f.mono}>{final}</span>.
        </p>
      ) : !slugFollows ? (
        <p className={f.note}>
          Enlace propio: ya no sigue al título.{' '}
          <button type="button" className={f.textBtn} onClick={() => setSlugFollows(true)}>
            Volver a seguirlo
          </button>
        </p>
      ) : (
        <p className={f.note}>Sigue al título mientras no lo edites.</p>
      )}
    </div>
  )
}
