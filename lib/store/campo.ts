'use client'

/**
 * CAMPO — the reader's instrument state: the energy range (Horizonte), the
 * format filter and the multi-genre filter. Shared by every surface; the
 * format + genre filters only narrow the home mosaic (as in production).
 * The range is also the temperature of the whole field (stage engine).
 */

import { useMemo } from 'react'
import { create } from 'zustand'
import type { ContentType } from '@/lib/types'
import { FULL_RANGE, type VibeRange } from '@/lib/vibe'

interface CampoState {
  range: VibeRange
  type: ContentType | null
  genres: string[]
  /** Genres present in the currently filtered feed, with their mean energy. */
  present: Array<{ id: string; energy: number; count: number }>
  /** Pieces per format in the energy-filtered feed (catalog facts, not metrics). */
  counts: Partial<Record<ContentType, number>>
  total: number
  setCounts: (counts: Partial<Record<ContentType, number>>, total: number) => void
  setRange: (r: VibeRange) => void
  resetRange: () => void
  setType: (t: ContentType | null) => void
  toggleGenre: (id: string) => void
  setGenres: (ids: string[]) => void
  setPresent: (p: CampoState['present']) => void
}

export const useCampo = create<CampoState>((set) => ({
  range: FULL_RANGE,
  type: null,
  genres: [],
  present: [],
  counts: {},
  total: 0,
  setCounts: (counts, total) => set({ counts, total }),
  setRange: (range) => set({ range: [Math.min(range[0], range[1]), Math.max(range[0], range[1])] }),
  resetRange: () => set({ range: FULL_RANGE }),
  setType: (type) => set({ type }),
  toggleGenre: (id) =>
    set((s) => ({ genres: s.genres.includes(id) ? s.genres.filter((g) => g !== id) : [...s.genres, id] })),
  setGenres: (genres) => set({ genres }),
  setPresent: (present) => set({ present }),
}))

/**
 * Bands are integers, so the continuous horizon only changes what passes
 * when it crosses an integer edge. Components that filter subscribe to
 * this key instead of the raw range — no re-render per pointer pixel.
 */
export function useIntegerRange(): [number, number] {
  const key = useCampo((s) => `${Math.ceil(s.range[0] - 1e-9)}:${Math.floor(s.range[1] + 1e-9)}`)
  return useMemo(() => key.split(':').map(Number) as [number, number], [key])
}
