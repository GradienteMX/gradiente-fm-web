'use client'

/**
 * ETIQUETAS — qualities that cross genres (format, context, sensation).
 * The shipped catalogue plus the tags people already created on the field;
 * a word that matches nothing can be created in place, exactly like the foro.
 */

import { useMemo, useState } from 'react'
import { TAG_NAME_MAX, getSelectableTags, isClassifierTag, slugifyTag, tagLabel } from '@/lib/genres'
import { useMesa } from '../context'
import { Chip, Highlight, Search, fold } from './bits'
import f from './fields.module.css'

const MAX = 8

export function Etiquetas({ value, onChange, id }: { value: string[]; onChange: (v: string[]) => void; id?: string }) {
  const { knowledge } = useMesa()
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const selected = value.filter(isClassifierTag)
  const selectedSet = new Set(selected)

  const catalogue = useMemo(() => {
    const shipped = getSelectableTags().map((t) => ({ id: t.id, name: t.name }))
    const seen = new Set(shipped.map((t) => t.id))
    const custom = knowledge.customTags.filter((t) => !seen.has(t)).map((t) => ({ id: t, name: tagLabel(t) }))
    return [...shipped, ...custom]
  }, [knowledge.customTags])

  const term = q.trim()
  const shown = useMemo(() => {
    const n = fold(term)
    return n ? catalogue.filter((t) => fold(t.name).includes(n) || t.id.includes(n)) : catalogue
  }, [catalogue, term])

  const newId = slugifyTag(term)
  const exists = catalogue.some((t) => t.id === newId || fold(t.name) === fold(term))
  const canCreate = term.length > 0 && term.length <= TAG_NAME_MAX && newId.length > 0 && !exists && isClassifierTag(newId)

  const toggle = (tid: string) => {
    setError(null)
    if (selectedSet.has(tid)) return onChange(value.filter((v) => v !== tid))
    if (selected.length >= MAX) return setError(`Máximo ${MAX} etiquetas. Tres precisas valen más.`)
    onChange([...value, tid])
  }

  const create = () => {
    if (!canCreate) return
    toggle(newId)
    setQ('')
  }

  return (
    <div className={f.stack} style={{ gap: 14 }}>
      <div className={f.inline} style={{ justifyContent: 'space-between' }}>
        <span className={f.label}>Etiquetas · {selected.length || 'ninguna aún'}</span>
        {selected.length > 3 ? <span className={f.note}>Tres precisas valen más que ocho.</span> : null}
      </div>

      {selected.length ? (
        <div className={f.chips}>
          {selected.map((t) => (
            <Chip key={t} onRemove={() => toggle(t)}>
              {tagLabel(t)}
            </Chip>
          ))}
        </div>
      ) : null}

      <Search
        id={id}
        value={q}
        onChange={(v) => {
          setQ(v)
          setError(null)
        }}
        placeholder="Buscar o crear una etiqueta…"
        label="Buscar o crear etiqueta"
        keyHint={shown[0] && term ? `Enter añade «${shown[0].name}»` : canCreate ? `Enter crea «${term}»` : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && term) {
            e.preventDefault()
            if (shown[0]) {
              if (!selectedSet.has(shown[0].id)) toggle(shown[0].id)
              setQ('')
            } else create()
          }
          if (e.key === 'Escape' && q) {
            e.preventDefault()
            e.stopPropagation()
            setQ('')
          }
        }}
      />

      <div className={f.chips} role="group" aria-label="Catálogo de etiquetas">
        {shown.map((t) => (
          <button key={t.id} type="button" className={f.pick} aria-pressed={selectedSet.has(t.id)} onClick={() => toggle(t.id)}>
            <Highlight text={t.name} q={term} />
          </button>
        ))}
        {canCreate ? (
          <button type="button" className={f.pick} data-create="" onClick={create}>
            + crear «{term}»
          </button>
        ) : null}
        {!shown.length && !canCreate ? <span className={f.empty}>Sin coincidencias.</span> : null}
      </div>
      {error ? (
        <p className={f.warn} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
