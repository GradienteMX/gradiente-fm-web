'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { FranjaKind, FranjaRef } from '@/lib/types'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

// ── FranjaMultiSelectL — "this piece is about these franjas" ───────────────
//
// Sibling of EntityMultiSelectL, but the catalogue is the dial itself: every
// published franja row (labels, venues, colectivos, dealers, festivals, clubs,
// medios, mix series). Search hits /api/franjas; nothing is created here —
// franjas are admin-onboarded. Selected refs live on `draft.franjaRefs`, are
// persisted by the publish route into item_franjas (migration 0051), render
// as FRANJAS chips in the overlay CONTEXTO rail, and feed the affinity map.
//
// Not the same as «Publicar con mi franja» (authorship attribution): a
// review can be ABOUT a label without the label having written it.

const KIND_LABEL: Record<FranjaKind, string> = {
  label: 'SELLO', venue: 'LUGAR', promoter: 'PROMOTORA', colectivo: 'COLECTIVO', dealer: 'DEALER',
  festival: 'FESTIVAL', club: 'CLUB', medios: 'MEDIOS', 'mix-series': 'SERIE', plataforma: 'PLATAFORMA',
}

export function FranjaMultiSelectL({
  value,
  onChange,
}: {
  value: FranjaRef[]
  onChange: (next: FranjaRef[]) => void
}) {
  const selectedIds = new Set(value.map((f) => f.id))
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FranjaRef[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const term = q.trim()
    if (!term) { setResults([]); return }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/franjas?q=${encodeURIComponent(term)}`)
        const json = await res.json()
        if (!cancelled) setResults((json.franjas ?? []) as FranjaRef[])
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q])

  const add = (ref: FranjaRef) => {
    if (selectedIds.has(ref.id)) return
    onChange([...value, ref])
    setQ('')
    setResults([])
  }
  const remove = (id: string) => onChange(value.filter((f) => f.id !== id))
  const term = q.trim()
  const unselected = results.filter((r) => !selectedIds.has(r.id))

  return (
    <div id="compose-field-context" className="flex scroll-mt-40 flex-col gap-2">
      <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
        FRANJAS ({value.length})
      </span>
      <p className="text-d13 leading-relaxed text-ink-soft">Sellos, lugares, colectivos y otras franjas del dial de las que trata tu pieza.</p>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((f) => (
            <span
              key={f.id}
              className="flex min-h-[30px] items-center gap-1.5 bg-ink px-2.5 font-mono text-d11 tracking-wide text-paper"
            >
              <span className="text-paper/60">{KIND_LABEL[f.kind] ?? f.kind.toUpperCase()}</span>
              {f.title}
              <button
                type="button"
                onClick={() => remove(f.id)}
                aria-label={`Quitar ${f.title}`}
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
        placeholder="Buscar una franja del dial…"
        aria-label="Buscar una franja del dial"
        className={`min-h-11 border border-ink bg-paper-raised px-3 font-mono text-d13 text-ink placeholder:text-ink-faint ${FOCUS_RING}`}
      />

      {term && (
        <div className="flex max-h-40 flex-col gap-px overflow-y-auto border border-dashed border-ink-faint bg-paper-raised p-1">
          {loading && <span className="px-2 py-1 font-mono text-d11 text-ink-faint">Buscando…</span>}
          {!loading && unselected.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => add(r)}
              className={`flex min-h-9 items-center gap-2 px-2 py-1 text-left font-mono text-d13 text-ink-soft hover:bg-ink hover:text-paper ${FOCUS_RING}`}
            >
              <span className="text-d11 text-ink-faint">{KIND_LABEL[r.kind] ?? r.kind.toUpperCase()}</span>
              {r.title}
            </button>
          ))}
          {!loading && unselected.length === 0 && (
            <span className="px-2 py-1 font-mono text-d11 text-ink-faint">Ninguna franja coincide. Las franjas las da de alta un administrador.</span>
          )}
        </div>
      )}
    </div>
  )
}
