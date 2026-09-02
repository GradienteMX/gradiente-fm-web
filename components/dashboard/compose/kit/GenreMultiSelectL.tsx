'use client'

import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { GENRES } from '@/lib/genres'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

// ── GenreMultiSelectL — pliego fork of forms/shared/Fields.tsx GenreMultiSelect
//
// The dark original was DELETED in fase F; this fork is the only copy. Logic is verbatim (same `!g.legacy`
// taxonomy filter, same toggle semantics); the chrome follows the pliego
// compose spec: selected genres render as ink chips ≥30px with a × remove
// affordance, and AÑADIR opens the picker (filter input + taxonomy chip
// cloud) instead of the always-open cloud.
//
// The open picker unfolds INTO the page — the page is the scroller, never an
// internal max-h scroller (judge r6 fix 1). The ~200-entry taxonomy is kept
// legible by grouping under mono eyebrow rows, one per root (a leaf files
// under its primary root — parents[0] — so cross-listed leaves render once).
// Grouping is purely presentational: the offered set, the filter predicate,
// and the chip toggle are byte-identical to the flat cloud.
//
// Old DB rows can still carry legacy ids — they display through the full
// catalog lookup, but the picker only offers the current Gradiente taxonomy
// (parents + non-legacy subgenres).

export function GenreMultiSelectL({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const selected = new Set(value)
  // Hide legacy ids from the composer — old DB rows still display them
  // through the catalog, but new items should pick from the current
  // Gradiente taxonomy (parents + non-legacy subgenres).
  const filtered = useMemo(
    () =>
      GENRES.filter(
        (g) =>
          !g.legacy &&
          (!filter ||
            g.name.toLowerCase().includes(filter.toLowerCase()) ||
            g.id.includes(filter.toLowerCase())),
      ),
    [filter],
  )

  // Presentational grouping only — partition the SAME filtered list under its
  // roots (a root heads its own group; a leaf files under parents[0]). Group
  // order follows the taxonomy's root order; empty groups drop out.
  const grouped = useMemo(() => {
    const byRoot = new Map<string, typeof filtered>()
    for (const g of filtered) {
      const rootId = g.parents.length === 0 ? g.id : g.parents[0]
      const arr = byRoot.get(rootId) ?? []
      arr.push(g)
      byRoot.set(rootId, arr)
    }
    // Every group key is itself a GENRES entry, so ordering by the catalog
    // (roots first) covers even a hypothetical non-root primary parent —
    // nothing offered by `filtered` can ever drop out of the render.
    return GENRES.filter((g) => byRoot.has(g.id)).map((root) => ({
      root,
      members: byRoot.get(root.id)!,
    }))
  }, [filtered])

  const toggle = (id: string) => {
    if (selected.has(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  const nameOf = (id: string) => GENRES.find((g) => g.id === id)?.name ?? id

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
        GÉNEROS ({value.length})
      </span>

      {/* Selected chips — ink fill on paper, ≥30px, removable. */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span
              key={id}
              className="flex min-h-[30px] items-center gap-1.5 bg-ink px-2.5 font-mono text-d11 uppercase tracking-wide text-paper"
            >
              {nameOf(id)}
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label={`Quitar ${nameOf(id)}`}
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
        {open ? (
          <>
            <X size={12} strokeWidth={2} /> CERRAR
          </>
        ) : (
          <>
            <Plus size={12} strokeWidth={2} /> AÑADIR
          </>
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar géneros…"
            className={`min-h-11 border border-ink bg-paper-raised px-3 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
          />
          {/* NO height cap — the picker unfolds into the page (the page is
              the scroller). Mono eyebrow rows group the taxonomy by root. */}
          <div className="flex flex-col gap-3 border border-dashed border-ink-faint p-3">
            {grouped.map(({ root, members }) => (
              <div key={root.id} className="flex flex-col gap-1.5">
                <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-faint">
                  {root.name}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((g) => {
                    const isOn = selected.has(g.id)
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggle(g.id)}
                        aria-pressed={isOn}
                        className={`min-h-[30px] border px-2.5 font-mono text-d11 tracking-wide ${
                          isOn
                            ? 'border-ink bg-ink text-paper'
                            : 'border-ink-faint text-ink-soft hover:border-ink hover:text-ink'
                        } ${FOCUS_RING}`}
                      >
                        {g.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
