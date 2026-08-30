'use client'

import { useVibe } from '@/context/VibeContext'
import { getGenreById } from '@/lib/genres'
import {
  categoryColorOnLight,
  typeCode,
  typeDisplayLabel,
} from '@/lib/dashboard/palette'

const CLEAR_CHIP_CLASS =
  'flex min-h-11 items-center border border-ink px-3 font-mono text-d11 uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

interface FeedHeaderProps {
  totalCount: number
}

// Adapts the home feed header strip to reflect the in-page filters. When
// neither categoryFilter nor genreFilter is set, shows the idle «SEÑAL AHORA»
// line. When either is set, swaps to the FILTRADO line — category swatch
// paired with its 2-letter code (color is never the only signal) — with each
// active filter as its own clearable bordered ink chip.
export function FeedHeader({ totalCount }: FeedHeaderProps) {
  const {
    categoryFilter,
    setCategoryFilter,
    genreFilter,
    clearGenres,
    toggleGenre,
  } = useVibe()

  const genreActive = genreFilter.length > 0
  const anyFilterActive = !!categoryFilter || genreActive

  if (!anyFilterActive) {
    return (
      <div className="w-full border-b border-ink pb-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-d13 font-bold uppercase tracking-widest">
            <span className="text-sys-red-paper">SEÑAL</span>
            <span className="text-ink"> AHORA</span>
          </span>
          {totalCount > 0 && (
            <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
              {totalCount} ENTRADAS
            </span>
          )}
        </div>
      </div>
    )
  }

  const genreLabels = genreFilter.map((id) => ({
    id,
    name: getGenreById(id)?.name?.toUpperCase() ?? id.toUpperCase(),
  }))

  return (
    <div className="w-full border-b border-ink pb-2">
      <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-d13 uppercase tracking-widest text-ink">
        {categoryFilter && (
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 border border-ink"
            style={{ backgroundColor: categoryColorOnLight(categoryFilter) }}
          />
        )}
        <span className="font-bold">FILTRADO</span>
        {categoryFilter && (
          <span>
            · {typeCode(categoryFilter)} {typeDisplayLabel(categoryFilter)}
          </span>
        )}
        {genreLabels.length > 0 && (
          <span>· GÉNERO·{genreLabels.map((g) => g.name).join('+')}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {categoryFilter && (
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            className={CLEAR_CHIP_CLASS}
          >
            × LIMPIAR SECCIÓN
          </button>
        )}
        {genreLabels.length === 1 && (
          <button
            type="button"
            onClick={() => toggleGenre(genreLabels[0].id)}
            className={CLEAR_CHIP_CLASS}
          >
            × LIMPIAR GÉNERO
          </button>
        )}
        {genreLabels.length > 1 && (
          <button
            type="button"
            onClick={clearGenres}
            className={CLEAR_CHIP_CLASS}
          >
            × LIMPIAR {genreLabels.length} GÉNEROS
          </button>
        )}
      </div>
    </div>
  )
}
