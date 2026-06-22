'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { EntityKind, EntityRef } from '@/lib/types'

// Per-kind scene-entity picker for the composer. Type-ahead searches
// /api/entities; if the typed name has no match, a "[+ crear]" affordance
// POSTs a new entity (create-on-the-fly) and links it. Selected entities show
// as removable chips.
//
// `value` is the item's FULL entity array (all kinds). The field reads/writes
// only its own `kind` slice and preserves the rest, so a ReviewForm can wire
// four of these against a single `draft.entities`.

const KIND_LABEL: Record<EntityKind, string> = {
  artist: 'ARTISTAS',
  label: 'LABELS',
  venue: 'VENUES',
  promoter: 'PROMOTORAS',
}

const KIND_PLACEHOLDER: Record<EntityKind, string> = {
  artist: 'Buscar o crear artista…',
  label: 'Buscar o crear label…',
  venue: 'Buscar o crear venue…',
  promoter: 'Buscar o crear promotora…',
}

const INPUT_BORDER = '#242424'
const ACCENT = '#F97316'

export function EntityMultiSelect({
  kind,
  value,
  onChange,
}: {
  kind: EntityKind
  value: EntityRef[]
  onChange: (next: EntityRef[]) => void
}) {
  const selected = value.filter((e) => e.kind === kind)
  const selectedIds = new Set(selected.map((e) => e.id))

  const [q, setQ] = useState('')
  const [results, setResults] = useState<EntityRef[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  // Debounced search — re-runs on query / kind change.
  useEffect(() => {
    const term = q.trim()
    if (!term) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/entities?kind=${kind}&q=${encodeURIComponent(term)}`,
        )
        const json = await res.json()
        if (!cancelled) setResults((json.entities ?? []) as EntityRef[])
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q, kind])

  const add = (ref: EntityRef) => {
    if (selectedIds.has(ref.id)) return
    onChange([...value, { ...ref, kind, relation: 'subject' }])
    setQ('')
    setResults([])
  }

  const remove = (id: string) => onChange(value.filter((e) => e.id !== id))

  const term = q.trim()
  const exactExists = results.some(
    (r) => r.name.toLowerCase() === term.toLowerCase(),
  )

  const createNew = async () => {
    if (!term || creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name: term }),
      })
      const json = await res.json()
      if (res.ok && json.entity) add(json.entity as EntityRef)
    } finally {
      setCreating(false)
    }
  }

  const unselectedResults = results.filter((r) => !selectedIds.has(r.id))

  return (
    <div className="flex flex-col gap-2">
      <span className="sys-label">
        {KIND_LABEL[kind]} ({selected.length})
      </span>

      {/* selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((e) => (
            <span
              key={e.id}
              className="flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] tracking-wide"
              style={{
                borderColor: ACCENT,
                color: ACCENT,
                backgroundColor: 'rgba(249,115,22,0.12)',
              }}
            >
              {e.name}
              <button
                type="button"
                onClick={() => remove(e.id)}
                className="transition-opacity hover:opacity-60"
                aria-label={`Quitar ${e.name}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={KIND_PLACEHOLDER[kind]}
        className="border bg-black px-3 py-1.5 font-mono text-xs text-primary outline-none focus:border-sys-orange"
        style={{ borderColor: INPUT_BORDER }}
      />

      {/* results dropdown — only while typing */}
      {term && (
        <div
          className="flex max-h-40 flex-col gap-px overflow-y-auto border border-dashed p-1"
          style={{ borderColor: INPUT_BORDER }}
        >
          {loading && (
            <span className="px-2 py-1 font-mono text-[10px] text-muted">
              Buscando…
            </span>
          )}
          {!loading &&
            unselectedResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => add(r)}
                className="px-2 py-1 text-left font-mono text-[11px] text-secondary transition-colors hover:bg-white/[0.04] hover:text-primary"
              >
                {r.name}
              </button>
            ))}
          {!loading && !exactExists && (
            <button
              type="button"
              onClick={createNew}
              disabled={creating}
              className="px-2 py-1 text-left font-mono text-[11px] transition-colors hover:bg-white/[0.04] disabled:opacity-50"
              style={{ color: ACCENT }}
            >
              {creating ? 'Creando…' : `[+ crear «${term}»]`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
