'use client'

/**
 * The Horizonte is one instrument everywhere. On a section it filters by
 * energy, and the genre particles it shows are this section's genres at
 * this temperature — so pressing one narrows *this* surface. Same state as
 * the home: tune here, and the whole field is tuned.
 */

import { useEffect, useMemo } from 'react'
import type { ContentItem } from '@/lib/types'
import { useCampo, useIntegerRange } from '@/lib/store/campo'
import { itemMatchesGenreFilter } from '@/lib/genres'
import { presentGenres } from '@/lib/logic/genres'
import { bandOverlaps } from '@/lib/vibe'

export function useFiltroSeccion(items: ContentItem[], opts: { publishPresent?: boolean } = {}) {
  const range = useIntegerRange()
  const genres = useCampo((s) => s.genres)
  const setPresent = useCampo((s) => s.setPresent)
  const publish = opts.publishPresent ?? true

  const energyOnly = useMemo(() => items.filter((i) => bandOverlaps(i, range)), [items, range])
  const filtered = useMemo(
    () => (genres.length ? energyOnly.filter((i) => itemMatchesGenreFilter(i.genres, genres)) : energyOnly),
    [energyOnly, genres],
  )

  useEffect(() => {
    if (publish) setPresent(presentGenres(energyOnly))
  }, [energyOnly, publish, setPresent])

  // Leave no stale particles behind for the next surface.
  useEffect(() => () => setPresent([]), [setPresent])

  /** True when a piece passes the whole instrument (energy ∩ genres). */
  const passes = useMemo(
    () => (i: ContentItem) => bandOverlaps(i, range) && (!genres.length || itemMatchesGenreFilter(i.genres, genres)),
    [range, genres],
  )

  return { range, genres, energyOnly, filtered, passes }
}
