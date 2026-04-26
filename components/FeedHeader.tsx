'use client'

import { useVibe } from '@/context/VibeContext'
import { categoryColor } from '@/lib/utils'
import { getGenreById } from '@/lib/genres'
import type { ContentType } from '@/lib/types'

const TYPE_LABEL: Partial<Record<ContentType, string>> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTICIA',
  review: 'REVIEW',
  editorial: 'EDITORIAL',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULO',
  listicle: 'LISTA',
}

interface FeedHeaderProps {
  totalCount: number
}

// Adapts the home feed header strip to reflect the in-page filters. When
// neither categoryFilter nor genreFilter is set, shows the default editorial
// intro. When either is set, swaps to a terminal-flavored "subsystem focused
// on X" status with each active filter as its own clearable chip.
export function FeedHeader({ totalCount }: FeedHeaderProps) {
  const { categoryFilter, setCategoryFilter, genreFilter, setGenreFilter } =
    useVibe()

  const anyFilterActive = !!categoryFilter || !!genreFilter

  if (!anyFilterActive) {
    return (
      <div>
        <div className="nge-divider mb-1">
          <span className="font-mono text-xs tracking-widest text-primary">
            TODO LO QUE VIENE
          </span>
        </div>
        <p className="sys-label">
          {totalCount} ENTRADAS · PROMINENCIA ORGÁNICA · SEÑAL + FRESCURA
        </p>
      </div>
    )
  }

  // The status line takes its color from whichever filter is most "anchoring".
  // Category wins when both are set — it's the primary axis of the rail.
  const headlineColor = categoryFilter
    ? categoryColor(categoryFilter)
    : '#F97316'
  const categoryLabel = categoryFilter
    ? TYPE_LABEL[categoryFilter] ?? categoryFilter.toUpperCase()
    : null
  const genreLabel = genreFilter
    ? getGenreById(genreFilter)?.name?.toUpperCase() ?? genreFilter.toUpperCase()
    : null

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{
            backgroundColor: headlineColor,
            boxShadow: `0 0 6px ${headlineColor}, 0 0 12px ${headlineColor}66`,
          }}
          aria-hidden
        />
        <span
          className="font-mono text-xs tracking-widest"
          style={{ color: headlineColor }}
        >
          //SUBSISTEMA · FILTRADO
        </span>
        {categoryLabel && (
          <span
            className="font-mono text-xs tracking-widest"
            style={{ color: headlineColor }}
          >
            · {categoryLabel}
          </span>
        )}
        {genreLabel && (
          <span
            className="font-mono text-xs tracking-widest"
            style={{ color: headlineColor }}
          >
            · GÉNERO·{genreLabel}
          </span>
        )}
      </div>
      <p className="sys-label flex flex-wrap items-center gap-2">
        <span>FOCO ACTIVO</span>
        {categoryFilter && (
          <>
            <span className="text-muted">·</span>
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className="font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
            >
              [×] LIMPIAR SECCIÓN
            </button>
          </>
        )}
        {genreFilter && (
          <>
            <span className="text-muted">·</span>
            <button
              type="button"
              onClick={() => setGenreFilter(null)}
              className="font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
            >
              [×] LIMPIAR GÉNERO
            </button>
          </>
        )}
      </p>
    </div>
  )
}
