'use client'

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { ContentItem } from '@/lib/types'
import { isUpcoming } from '@/lib/utils'
import { ContentGrid } from './ContentGrid'

// Client browser around the agenda mosaic. Two controls layered on top of
// ContentGrid (which still owns vibe/genre filtering + rankAgenda):
//   - Live text search over title / artists / venue / city.
//   - Past events hidden by default; a "VER ARCHIVO" toggle reveals them.
// Search is scoped to the visible set — reveal the archive to search past
// nights too.
export function AgendaBrowser({ items }: { items: ContentItem[] }) {
  const [query, setQuery] = useState('')
  const [showArchive, setShowArchive] = useState(false)

  const q = query.trim().toLowerCase()

  const pastCount = useMemo(
    () => items.filter((i) => !isUpcoming(i)).length,
    [items],
  )

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (!showArchive && !isUpcoming(i)) return false
      if (!q) return true
      const haystack = [i.title, i.venue, i.venueCity, ...(i.artists ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [items, q, showArchive])

  return (
    <>
      {/* Live search */}
      <div className="mb-4 flex items-center gap-2 border border-border px-3 py-2">
        <Search size={14} className="shrink-0 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar evento, artista, venue…"
          className="w-full bg-transparent font-mono text-xs tracking-wide text-primary placeholder:text-muted focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
            className="shrink-0 text-muted hover:text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <ContentGrid
        items={filtered}
        mode="agenda"
        emptyLabel={
          q
            ? '// SIN RESULTADOS PARA ESTA BÚSQUEDA'
            : '// SIN EVENTOS EN ESTE RANGO'
        }
      />

      {/* Archive toggle */}
      {pastCount > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            className="border border-border px-4 py-2 font-mono text-[11px] tracking-widest text-muted transition-colors hover:border-primary hover:text-primary"
          >
            {showArchive
              ? '// OCULTAR ARCHIVO'
              : `// VER ARCHIVO · ${pastCount} EVENTOS PASADOS`}
          </button>
        </div>
      )}
    </>
  )
}
