'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { TAG_NAME_MAX, getSelectableTags, isClassifierTag, slugifyTag, tagLabel } from '@/lib/genres'
import { createTag, fetchCustomTags } from '@/lib/foro'
import type { Tag } from '@/lib/types'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

// ── TagMultiSelectL — transversal tags for content items ───────────────────
//
// Sibling of GenreMultiSelectL (same chip grammar, same AÑADIR picker). The
// catalogue is the shipped TAGS list unioned with the user-created registry
// the foro composer already grows (/api/foro/tags, table foro_tags), so one
// vocabulary classifies threads AND content: the dial's filters and the
// affinity map read the same ids. A tag typed that matches nothing can be
// created in place, exactly like the foro.
//
// Provenance markers the pipelines stamp ('ra', 'noticia', …) are hidden from
// the picker and never count — see `isClassifierTag`.

const MAX_TAGS = 8

export function TagMultiSelectL({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [custom, setCustom] = useState<Tag[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchCustomTags().then((tags) => { if (!cancelled) setCustom(tags) })
    return () => { cancelled = true }
  }, [])

  const catalogue = useMemo(() => {
    const shipped = getSelectableTags()
    const seen = new Set(shipped.map((t) => t.id))
    return [...shipped, ...custom.filter((t) => !seen.has(t.id))]
  }, [custom])

  const selected = value.filter(isClassifierTag)
  const selectedSet = new Set(selected)
  const term = filter.trim()
  const filtered = useMemo(() => {
    const q = term.toLowerCase()
    if (!q) return catalogue
    return catalogue.filter((t) => t.name.toLowerCase().includes(q) || t.id.includes(q))
  }, [catalogue, term])

  const toggle = (id: string) => {
    setError(null)
    if (selectedSet.has(id)) {
      onChange(value.filter((v) => v !== id))
      return
    }
    if (selected.length >= MAX_TAGS) { setError(`Máximo ${MAX_TAGS} etiquetas.`); return }
    onChange([...value, id])
  }

  const newId = slugifyTag(term)
  const exactExists = catalogue.some((t) => t.id === newId || t.name.toLowerCase() === term.toLowerCase())
  const canCreate = term.length > 0 && term.length <= TAG_NAME_MAX && newId.length > 0 && !exactExists && isClassifierTag(newId)

  const createNew = async () => {
    if (!canCreate || creating) return
    setCreating(true)
    setError(null)
    const res = await createTag(term)
    setCreating(false)
    if (!res.ok) { setError(res.error); return }
    setCustom((prev) => (prev.some((t) => t.id === res.tag.id) ? prev : [res.tag, ...prev]))
    if (!selectedSet.has(res.tag.id)) toggle(res.tag.id)
    setFilter('')
  }

  return (
    <div id="compose-field-tags" className="flex scroll-mt-40 flex-col gap-2">
      <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
        ETIQUETAS ({selected.length})
      </span>
      <p className="text-d13 leading-relaxed text-ink-soft">Cualidades que cruzan géneros: formato, contexto, sensación. Al menos una, para que los filtros y las relaciones entre piezas funcionen.</p>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <span
              key={id}
              className="flex min-h-[30px] items-center gap-1.5 bg-ink px-2.5 font-mono text-d11 uppercase tracking-wide text-paper"
            >
              {tagLabel(id)}
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label={`Quitar ${tagLabel(id)}`}
                className={`-mr-0.5 flex h-6 w-6 items-center justify-center hover:bg-paper hover:text-ink ${FOCUS_RING}`}
              >
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex min-h-11 items-center gap-2 self-start border border-dashed border-ink px-3 font-mono text-d11 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
      >
        {open ? (<><X size={12} strokeWidth={2} /> CERRAR</>) : (<><Plus size={12} strokeWidth={2} /> AÑADIR</>)}
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar o escribir una etiqueta nueva…"
            aria-label="Filtrar etiquetas"
            maxLength={TAG_NAME_MAX}
            className={`min-h-11 border border-ink bg-paper-raised px-3 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
          />
          <div className="flex flex-wrap gap-1.5 border border-dashed border-ink-faint p-3">
            {filtered.map((t) => {
              const isOn = selectedSet.has(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  aria-pressed={isOn}
                  className={`min-h-[30px] border px-2.5 font-mono text-d11 tracking-wide ${
                    isOn ? 'border-ink bg-ink text-paper' : 'border-ink-faint text-ink-soft hover:border-ink hover:text-ink'
                  } ${FOCUS_RING}`}
                >
                  {t.name}
                </button>
              )
            })}
            {canCreate && (
              <button
                type="button"
                onClick={createNew}
                disabled={creating}
                className={`min-h-[30px] border border-ink bg-acid px-2.5 font-mono text-d11 font-bold tracking-wide text-ink hover:bg-ink hover:text-acid disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
              >
                {creating ? 'Creando…' : `+ crear «${term}»`}
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <span className="font-mono text-d11 text-ink-faint">Sin coincidencias.</span>
            )}
          </div>
          {error && <p role="alert" className="font-mono text-d11 text-sys-red-paper">{error}</p>}
        </div>
      )}
    </div>
  )
}
