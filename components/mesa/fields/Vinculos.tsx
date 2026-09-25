'use client'

/**
 * VÍNCULOS — what the piece is about. Scene entities are free text (the
 * scene grows faster than any catalogue) with suggestions from what the field
 * already knows; franjas «sobre» come from the dial itself. Neither is
 * authorship: publishing *with* a franja is decided at review.
 */

import { Imagen as Image } from '@/components/kit/Imagen'
import { useId, useMemo, useState, type ReactNode } from 'react'
import type { EntityRef, FranjaRef } from '@/lib/types'
import type { EntityKind } from '@/lib/types'
import { franjaAttributionPrefix } from '@/lib/franjaAttribution'
import { useMesa } from '../context'
import { ENTITY_LABEL, entityRef, slugify } from '../model'
import { Chip, Highlight, fold } from './bits'
import f from './fields.module.css'

interface Option {
  key: string
  label: ReactNode
  text: string
  meta?: string
  logo?: string
  pick: () => void
}

/** An input with a keyboard-navigable suggestion list. */
function Suggest({
  id,
  placeholder,
  label,
  options,
  q,
  setQ,
  onFree,
}: {
  id?: string
  placeholder: string
  label: string
  options: Option[]
  q: string
  setQ: (v: string) => void
  onFree?: () => void
}) {
  const [focus, setFocus] = useState(false)
  const [idx, setIdx] = useState(0)
  const listId = useId()
  const open = focus && q.trim().length > 0 && (options.length > 0 || !!onFree)
  const total = options.length + (onFree ? 1 : 0)
  return (
    <div className={f.stack} style={{ gap: 6, position: 'relative' }}>
      <input
        id={id}
        className={f.cell}
        value={q}
        placeholder={placeholder}
        aria-label={label}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onFocus={() => setFocus(true)}
        onBlur={() => window.setTimeout(() => setFocus(false), 120)}
        onChange={(e) => {
          setQ(e.target.value)
          setIdx(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setIdx((i) => Math.min(total - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setIdx((i) => Math.max(0, i - 1))
          } else if (e.key === 'Enter' && q.trim()) {
            e.preventDefault()
            if (idx < options.length) options[idx].pick()
            else onFree?.()
            setIdx(0)
          } else if (e.key === 'Escape' && q) {
            e.preventDefault()
            e.stopPropagation()
            setQ('')
          }
        }}
      />
      {open ? (
        <div id={listId} className={f.suggest} role="listbox">
          {options.map((o, i) => (
            <button
              key={o.key}
              type="button"
              role="option"
              aria-selected={i === idx}
              className={f.suggestItem}
              data-active={i === idx || undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                o.pick()
                setIdx(0)
              }}
            >
              {o.logo !== undefined ? <span className={f.logo}>{o.logo ? <Image src={o.logo} alt="" fill sizes="26px" /> : null}</span> : null}
              <span>{o.label}</span>
              {o.meta ? <small>{o.meta}</small> : null}
            </button>
          ))}
          {onFree ? (
            <button
              type="button"
              role="option"
              aria-selected={idx === options.length}
              className={f.suggestItem}
              data-active={idx === options.length || undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onFree()
                setIdx(0)
              }}
            >
              <span>+ Añadir «{q.trim()}»</span>
              <small>nuevo</small>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function Entidades({ value, onChange, kinds, id }: { value: EntityRef[]; onChange: (v: EntityRef[]) => void; kinds: EntityKind[]; id?: string }) {
  const { knowledge } = useMesa()
  const [kind, setKind] = useState<EntityKind>(kinds[0])
  const [q, setQ] = useState('')
  const mine = value.filter((e) => kinds.includes(e.kind))
  const has = (k: EntityKind, name: string) => value.some((e) => e.kind === k && e.slug === slugify(name))

  const pool = useMemo(() => {
    const out = new Map<string, EntityRef>()
    for (const e of knowledge.entities) if (e.kind === kind) out.set(e.slug, e)
    if (kind === 'artist') for (const a of knowledge.artists) if (!out.has(slugify(a))) out.set(slugify(a), entityRef('artist', a))
    if (kind === 'venue') for (const v of knowledge.venues) if (!out.has(slugify(v.name))) out.set(slugify(v.name), entityRef('venue', v.name))
    return [...out.values()]
  }, [knowledge, kind])

  const term = fold(q.trim())
  const options: Option[] = term
    ? pool
        .filter((e) => fold(e.name).includes(term) && !has(kind, e.name))
        .slice(0, 8)
        .map((e) => ({ key: e.id, label: <Highlight text={e.name} q={q} />, text: e.name, meta: ENTITY_LABEL[e.kind].one, pick: () => add(e) }))
    : []

  function add(e: EntityRef) {
    if (!has(e.kind, e.name)) onChange([...value, { ...e, relation: 'subject' }])
    setQ('')
  }

  const exact = pool.some((e) => fold(e.name) === term)
  const free = term && !exact && !has(kind, q) ? () => add(entityRef(kind, q)) : undefined

  return (
    <div className={f.stack} style={{ gap: 12 }}>
      <div className={f.inline} style={{ justifyContent: 'space-between' }}>
        <span className={f.label}>Escena</span>
        {kinds.length > 1 ? (
          <div className={f.seg} role="radiogroup" aria-label="Tipo de vínculo">
            {kinds.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={f.segBtn} onClick={() => setKind(k)}>
                {ENTITY_LABEL[k].one}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <Suggest
        id={id}
        q={q}
        setQ={setQ}
        options={options}
        onFree={free}
        placeholder={`${ENTITY_LABEL[kind].one}: escribe un nombre y pulsa Enter`}
        label={`Añadir ${ENTITY_LABEL[kind].one.toLowerCase()}`}
      />
      {mine.length ? (
        <div className={f.chips}>
          {mine.map((e) => (
            <Chip key={`${e.kind}:${e.slug}`} kind={ENTITY_LABEL[e.kind].one} onRemove={() => onChange(value.filter((x) => !(x.kind === e.kind && x.slug === e.slug)))}>
              {e.name}
            </Chip>
          ))}
        </div>
      ) : (
        <p className={f.note}>Nombres que la pieza toca: aparecen en su contexto y enlazan a su ficha.</p>
      )}
    </div>
  )
}

export function FranjasSobre({ value, onChange }: { value: FranjaRef[]; onChange: (v: FranjaRef[]) => void }) {
  const { knowledge } = useMesa()
  const [q, setQ] = useState('')
  const term = fold(q.trim())
  const ids = new Set(value.map((r) => r.id))
  const options: Option[] = term
    ? knowledge.franjas
        .filter((fr) => !ids.has(fr.id) && fold(fr.title).includes(term))
        .slice(0, 8)
        .map((fr) => ({
          key: fr.id,
          label: <Highlight text={fr.title} q={q} />,
          text: fr.title,
          meta: fr.franjaKind ? franjaAttributionPrefix(fr.franjaKind) : undefined,
          logo: fr.imageUrl ?? '',
          pick: () => {
            onChange([...value, { id: fr.id, title: fr.title, slug: fr.slug, kind: fr.franjaKind ?? 'colectivo' }])
            setQ('')
          },
        }))
    : []
  return (
    <div className={f.stack} style={{ gap: 12 }}>
      <span className={f.label}>Franjas de las que habla</span>
      <Suggest q={q} setQ={setQ} options={options} placeholder={`Buscar entre ${knowledge.franjas.length} franjas del dial…`} label="Buscar franja" />
      {value.length ? (
        <div className={f.chips}>
          {value.map((r) => (
            <Chip key={r.id} kind={franjaAttributionPrefix(r.kind)} onRemove={() => onChange(value.filter((x) => x.id !== r.id))}>
              {r.title}
            </Chip>
          ))}
        </div>
      ) : (
        <p className={f.note}>Sellos, venues o colectivos sobre los que escribes. No es firmar con ellos: eso se decide al revisar.</p>
      )}
    </div>
  )
}
