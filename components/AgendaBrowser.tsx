'use client'

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { ContentItem } from '@/lib/types'
import { isUpcoming } from '@/lib/utils'
import { ContentGrid } from './ContentGrid'

// Client browser around the agenda mosaic. Two controls layered on top of
// ContentGrid (which still owns vibe/genre filtering + rankAgenda):
//   - Live text search over title / artists / venue / city. An active query
//     searches EVERYTHING — upcoming and past — so you can find an old night
//     without flipping the archive on. Past hits still render gray + //PASADO
//     (ContentCard derives that from the date itself).
//   - With no query, past events are hidden until the "VER ARCHIVO" toggle.
// «EL PLIEGO» chrome: paper field + bordered ink chip; the filter/search/
// archive logic is untouched.

// Focus ring on paper — same pair the fase-A chrome uses everywhere.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

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
      if (q) {
        // Active search spans everything (upcoming + past).
        const haystack = [i.title, i.venue, i.venueCity, ...(i.artists ?? [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      }
      // No query: hide past until the archive is toggled on.
      return showArchive || isUpcoming(i)
    })
  }, [items, q, showArchive])

  return (
    <>
      {/* Live search — paper field. The 16px minimum input font on mobile
          comes from the global rule; text-d15 holds on desktop. */}
      <div className="mb-4 flex min-h-11 items-center gap-2 border border-ink bg-paper-raised px-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
        <Search size={14} className="shrink-0 text-ink-faint" aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar evento, artista, venue…"
          className="min-h-11 w-full bg-transparent font-grotesk text-d15 text-ink placeholder:text-ink-faint focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
            className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center text-ink-faint transition-colors hover:text-ink ${FOCUS_RING}`}
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
            ? 'SIN RESULTADOS PARA ESTA BÚSQUEDA'
            : 'SIN EVENTOS EN ESTE RANGO'
        }
      />

      {/* Archive toggle — bordered ink chip; hover = fill inversion. Only
          rendered when there is something to count (pastCount > 0). */}
      {pastCount > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            className={`min-h-11 border border-ink px-4 py-2 font-mono text-d11 uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
          >
            {showArchive
              ? 'OCULTAR ARCHIVO'
              : `VER ARCHIVO · ${pastCount} EVENTOS PASADOS`}
          </button>
        </div>
      )}
    </>
  )
}
