'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { EntityKind, EntityRef } from '@/lib/types'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

// ── EntityMultiSelectL — pliego fork of forms/shared/EntityMultiSelect ──────
//
// The dark original was DELETED in fase F, so this fork is the only copy
// (/admin imports it too now). Logic is
// verbatim: type-ahead searches /api/entities (same contract); if the typed
// name has no match, a "[+ crear]" affordance POSTs a new entity
// (create-on-the-fly) and links it. Selected entities show as removable
// chips. Only the chrome is pliego.
//
// `value` is the item's FULL entity array (all kinds). The field reads/writes
// only its own `kind` slice and preserves the rest, so a form can wire
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

export function EntityMultiSelectL({
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
      <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
        {KIND_LABEL[kind]} ({selected.length})
      </span>

      {/* selected chips — ink fill on paper, ≥30px, removable */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((e) => (
            <span
              key={e.id}
              className="flex min-h-[30px] items-center gap-1.5 bg-ink px-2.5 font-mono text-d11 tracking-wide text-paper"
            >
              {e.name}
              <button
                type="button"
                onClick={() => remove(e.id)}
                aria-label={`Quitar ${e.name}`}
                className={`-mr-0.5 flex h-6 w-6 items-center justify-center hover:bg-paper hover:text-ink ${FOCUS_RING}`}
              >
                <X size={12} strokeWidth={2} />
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
        className={`min-h-11 border border-ink bg-paper-raised px-3 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
      />

      {/* results dropdown — only while typing */}
      {term && (
        <div className="flex max-h-40 flex-col gap-px overflow-y-auto border border-dashed border-ink-faint bg-paper-raised p-1">
          {loading && (
            <span className="px-2 py-1 font-mono text-d11 text-ink-faint">
              Buscando…
            </span>
          )}
          {!loading &&
            unselectedResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => add(r)}
                className={`min-h-9 px-2 py-1 text-left font-mono text-d13 text-ink-soft hover:bg-ink hover:text-paper ${FOCUS_RING}`}
              >
                {r.name}
              </button>
            ))}
          {!loading && !exactExists && (
            <button
              type="button"
              onClick={createNew}
              disabled={creating}
              className={`min-h-9 px-2 py-1 text-left font-mono text-d13 font-bold text-ink hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
            >
              {creating ? 'Creando…' : `[+ crear «${term}»]`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
