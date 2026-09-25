'use client'

/**
 * GÉNEROS — the taxonomy as a drawer of roots. Search across every
 * selectable genre (accent-insensitive; Enter adds the first match), or open
 * a root to see its leaves. The categorical axis only — no stereotype
 * suggestions here: energy is set on its own instrument.
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import type { Genre } from '@/lib/types'
import { getDirectChildren, getGenreById, getRootGenres, getSelectableGenres } from '@/lib/genres'
import { Chip, Highlight, Search, fold } from './bits'
import f from './fields.module.css'

const ROOTS = getRootGenres()
const ALL = getSelectableGenres()

function under(rootId: string, id: string): boolean {
  if (id === rootId) return true
  return getGenreById(id)?.parents.includes(rootId) ?? false
}

export function Generos({ value, onChange, id }: { value: string[]; onChange: (v: string[]) => void; id?: string }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const drawer = useRef<HTMLDivElement>(null)
  const selected = new Set(value)

  const toggle = (gid: string) => onChange(selected.has(gid) ? value.filter((v) => v !== gid) : [...value, gid])

  const results = useMemo(() => {
    const n = fold(q.trim())
    if (!n) return null
    const hits = ALL.filter((g) => fold(g.name).includes(n) || g.id.includes(n))
    const by = new Map<string, Genre[]>()
    for (const g of hits) {
      const root = g.parents.length ? g.parents[0] : g.id
      const arr = by.get(root) ?? []
      arr.push(g)
      by.set(root, arr)
    }
    return ROOTS.filter((r) => by.has(r.id)).map((root) => ({ root, members: by.get(root.id)! }))
  }, [q])

  const first = results?.[0]?.members[0] ?? null

  useLayoutEffect(() => {
    const el = drawer.current
    if (!el || !open) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.5, ease: 'expo.out', clearProps: 'height,opacity' })
  }, [open])

  const openRoot = open ? ROOTS.find((r) => r.id === open) ?? null : null

  return (
    <div className={f.stack} style={{ gap: 14 }}>
      <div className={f.inline} style={{ justifyContent: 'space-between' }}>
        <span className={f.label}>Géneros · {value.length || 'ninguno aún'}</span>
        {value.length ? (
          <button type="button" className={f.textBtn} onClick={() => onChange([])}>
            Quitar todos
          </button>
        ) : null}
      </div>

      {value.length ? (
        <div className={f.chips}>
          {value.map((g) => (
            <Chip key={g} onRemove={() => toggle(g)}>
              {getGenreById(g)?.name ?? g}
            </Chip>
          ))}
        </div>
      ) : null}

      <Search
        id={id}
        value={q}
        onChange={setQ}
        placeholder={`Buscar entre ${ALL.length} géneros…`}
        label="Buscar género"
        keyHint={first ? `Enter añade «${first.name}»` : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && first) {
            e.preventDefault()
            if (!selected.has(first.id)) toggle(first.id)
            setQ('')
          }
          if (e.key === 'Escape' && q) {
            e.preventDefault()
            e.stopPropagation()
            setQ('')
          }
        }}
      />

      {results ? (
        <div className={f.results} role="group" aria-label="Resultados">
          {results.length ? (
            results.map(({ root, members }) => (
              <div key={root.id} className={f.group}>
                <span className={f.groupHead}>{root.name}</span>
                <div className={f.chips}>
                  {members.map((g) => (
                    <button key={g.id} type="button" className={f.pick} aria-pressed={selected.has(g.id)} onClick={() => toggle(g.id)}>
                      <Highlight text={g.name} q={q} />
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className={f.empty}>Ningún género se llama así. Prueba con otra palabra o abre una familia abajo.</p>
          )}
        </div>
      ) : (
        <>
          <div className={f.roots} role="group" aria-label="Familias de géneros">
            {ROOTS.map((r) => {
              const has = value.some((v) => under(r.id, v))
              return (
                <button
                  key={r.id}
                  type="button"
                  className={f.rootBtn}
                  aria-expanded={open === r.id}
                  data-has={has || undefined}
                  onClick={() => setOpen((o) => (o === r.id ? null : r.id))}
                >
                  {r.name}
                </button>
              )
            })}
          </div>
          {openRoot ? (
            <div ref={drawer} className={f.drawer} key={openRoot.id}>
              <div className={f.drawerInner}>
                <span className={f.groupHead}>{openRoot.name}</span>
                <div className={f.chips}>
                  <button type="button" className={f.pick} aria-pressed={selected.has(openRoot.id)} onClick={() => toggle(openRoot.id)}>
                    Todo {openRoot.name}
                  </button>
                  {getDirectChildren(openRoot.id).map((g) => (
                    <button key={g.id} type="button" className={f.pick} aria-pressed={selected.has(g.id)} onClick={() => toggle(g.id)}>
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
