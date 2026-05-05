'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import type { ContentType, VibeRange } from '@/lib/types'

interface VibeContextValue {
  vibeRange: VibeRange
  setVibeRange: (range: VibeRange) => void
  selectedDate: Date | null
  setSelectedDate: (date: Date | null) => void
  calendarOpen: boolean
  toggleCalendar: () => void
  // In-page category filter — drives [[CategoryRail]] click-to-filter UX.
  // null = show everything (default). Setting a type narrows the home grid
  // and hides the hero if its type differs.
  categoryFilter: ContentType | null
  setCategoryFilter: (type: ContentType | null) => void
  // In-page genre filter — multi-select set of active genre ids. Filters
  // intersect: an item passes if it's tagged with at least one active genre.
  // Empty array means no filter. Composed with categoryFilter and vibeRange
  // (all three intersect at the grid level).
  //   - setGenreFilter(ids) replaces the entire set (used by GenreChipButton
  //     to "jump to filter by this genre" from a card chip click).
  //   - toggleGenre(id) adds the id if absent, removes it if present (used by
  //     the slider chip strip's toggle badges).
  //   - clearGenres() resets to empty.
  genreFilter: string[]
  setGenreFilter: (ids: string[]) => void
  toggleGenre: (id: string) => void
  clearGenres: () => void
  // The genres actually present in the current vibe-filtered feed. Pushed
  // from [[ContentGrid]] (the page-level feed component), consumed by
  // [[VibeSlider]] so its chip strip reflects what's actually in the feed
  // rather than `GENRE_VIBE`'s genre→typical-vibe stereotype map. `null`
  // means "no feed has reported in" — slider falls back to GENRE_VIBE.
  // See `Vibe Philosophy` (idea 2): genre alone is a lie; chip strip
  // must mirror the curator-driven reality, not the stereotype.
  visibleGenres: string[] | null
  setVisibleGenres: (ids: string[] | null) => void
}

const VibeContext = createContext<VibeContextValue | null>(null)

export function VibeProvider({ children }: { children: ReactNode }) {
  const [vibeRange, setVibeRange] = useState<VibeRange>([0, 10])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<ContentType | null>(null)
  const [genreFilter, setGenreFilter] = useState<string[]>([])
  const [visibleGenres, setVisibleGenres] = useState<string[] | null>(null)

  const toggleCalendar = useCallback(() => {
    setCalendarOpen((v) => !v)
  }, [])

  const toggleGenre = useCallback((id: string) => {
    setGenreFilter((current) =>
      current.includes(id) ? current.filter((g) => g !== id) : [...current, id],
    )
  }, [])

  const clearGenres = useCallback(() => {
    setGenreFilter([])
  }, [])

  return (
    <VibeContext.Provider
      value={{
        vibeRange,
        setVibeRange,
        selectedDate,
        setSelectedDate,
        calendarOpen,
        toggleCalendar,
        categoryFilter,
        setCategoryFilter,
        genreFilter,
        setGenreFilter,
        toggleGenre,
        clearGenres,
        visibleGenres,
        setVisibleGenres,
      }}
    >
      {children}
    </VibeContext.Provider>
  )
}

export function useVibe(): VibeContextValue {
  const ctx = useContext(VibeContext)
  if (!ctx) throw new Error('useVibe must be used inside <VibeProvider>')
  return ctx
}
