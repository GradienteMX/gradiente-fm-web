'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { EntityLink } from '@/lib/types'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

// ── LinkListFieldL — pliego fork of forms/shared/Fields.tsx LinkListField ───
//
// The dark original stays byte-untouched. Labeled outbound-link editor for
// the CONTEXTO block — "where to buy / listen / read more" (Bandcamp,
// Discogs, official site, news source…). Edits an EntityLink[] { label, url }
// in place. Preset chips pre-fill the label so the common destinations are
// one click; the label itself stays free-text. Distinct from EmbedListL
// (playable sources) and EntityMultiSelectL (browsable scene rows).
// Logic verbatim; chrome pliego.

const LINK_PRESETS = ['Bandcamp', 'Discogs', 'Spotify', 'Sitio', 'Fuente']

export function LinkListFieldL({
  label,
  values,
  onChange,
  addLabel = 'AÑADIR ENLACE',
  presets = LINK_PRESETS,
}: {
  label: string
  values: EntityLink[]
  onChange: (v: EntityLink[]) => void
  addLabel?: string
  presets?: string[]
}) {
  const add = (preset?: string) =>
    onChange([...values, { label: preset ?? '', url: '' }])
  const update = (i: number, patch: Partial<EntityLink>) =>
    onChange(values.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))
  const remove = (i: number) =>
    onChange(values.filter((_, idx) => idx !== i))

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
        {label} ({values.length})
      </span>

      {values.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {values.map((link, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                type="text"
                value={link.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Bandcamp"
                aria-label={`Etiqueta del enlace ${i + 1}`}
                className={`min-h-11 w-28 shrink-0 border border-ink bg-paper-raised px-2 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
              />
              <input
                type="url"
                value={link.url}
                onChange={(e) => update(i, { url: e.target.value })}
                placeholder="https://artista.bandcamp.com/album/…"
                aria-label={`URL del enlace ${i + 1}`}
                className={`min-h-11 min-w-0 flex-1 border border-ink bg-paper-raised px-2 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Quitar enlace ${i + 1}`}
                className={`flex h-11 w-11 shrink-0 items-center justify-center border border-ink text-ink hover:border-sys-red-paper hover:bg-sys-red-paper hover:text-paper md:h-9 md:w-9 ${FOCUS_RING}`}
              >
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => add()}
          className={`flex min-h-11 items-center gap-1.5 border border-dashed border-ink px-3 font-mono text-d11 uppercase tracking-widest text-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
        >
          <Plus size={11} strokeWidth={2} />
          {addLabel}
        </button>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => add(p)}
            className={`flex min-h-11 items-center border border-ink-faint px-2.5 font-mono text-d11 tracking-widest text-ink-soft hover:border-ink hover:bg-ink hover:text-paper md:min-h-9 ${FOCUS_RING}`}
          >
            + {p}
          </button>
        ))}
      </div>
    </div>
  )
}
