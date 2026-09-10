'use client'
import { useEffect, useState } from 'react'
import type { ContentItem, EntityRef } from '@/lib/types'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'

export function VenueFieldL({ draft, onChange }: { draft: ContentItem; onChange: (patch: Partial<ContentItem>) => void }) {
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<EntityRef[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('ready')
  useEffect(() => {
    const query = draft.venue?.trim()
    if (!searching || !query || query.length < 2) { setResults([]); return }
    const controller = new AbortController()
    setStatus('loading')
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/entities?kind=venue&q=${encodeURIComponent(query)}`, { signal: controller.signal })
        if (!response.ok) throw new Error('lookup failed')
        const data = await response.json() as { entities?: EntityRef[] }
        if (!controller.signal.aborted) { setResults(data.entities ?? []); setStatus('ready') }
      } catch { if (!controller.signal.aborted) { setResults([]); setStatus('error') } }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [draft.venue, searching])
  return <div>
    <label className="grid gap-2 text-d15 font-bold">Lugar
      <input type="text" value={draft.venue ?? ''} placeholder="Busca un lugar o escribe su nombre"
        onChange={(e) => { onChange({ venue: e.target.value }); setSearching(true) }}
        onKeyDown={(e) => { if (e.key === 'Escape' && searching) { e.preventDefault(); e.stopPropagation(); setSearching(false) } }}
        className={`min-h-12 w-full border border-ink bg-paper-raised px-3 font-normal ${FOCUS_RING}`} />
    </label>
    {searching && (draft.venue?.trim().length ?? 0) >= 2 && <div className="border-x border-b border-ink bg-paper-raised p-2">
      {status === 'loading' && <p role="status" className="p-2 text-d13">Buscando lugares…</p>}
      {results.map((venue) => <button type="button" key={venue.id} onClick={() => {
        const entities = draft.entities ?? []
        onChange({ venue: venue.name, venueCity: draft.venueCity || venue.address || '', entities: entities.some((e) => e.id === venue.id) ? entities : [...entities, { ...venue, relation: 'subject' }] })
        setSearching(false)
      }} className={`block min-h-12 w-full px-3 py-2 text-left hover:bg-acid ${FOCUS_RING}`}><span className="block text-d15 font-bold">{venue.name}</span>{venue.address && <span className="text-d13">{venue.address}</span>}</button>)}
      {status === 'error' && <p role="status" className="p-2 text-d13">No pudimos consultar el catálogo. Puedes usar el nombre que escribiste.</p>}
      <button type="button" onClick={() => setSearching(false)} className={`min-h-11 w-full px-3 text-left text-d13 underline ${FOCUS_RING}`}>Usar «{draft.venue}» tal como lo escribí</button>
    </div>}
    <p className="mt-2 text-d13 text-ink-soft">Puedes elegir un lugar del catálogo o escribir otro. La dirección se añade abajo.</p>
  </div>
}
