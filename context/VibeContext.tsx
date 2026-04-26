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
  // In-page genre filter — driven by clicking a genre chip on a card or
  // overlay (see [[GenreChipButton]]). Stores the genre id (matches
  // ContentItem.genres entries). Composes with categoryFilter; both can be
  // active simultaneously and intersect.
  genreFilter: string | null
  setGenreFilter: (id: string | null) => void
}

const VibeContext = createContext<VibeContextValue | null>(null)

export function VibeProvider({ children }: { children: ReactNode }) {
  const [vibeRange, setVibeRange] = useState<VibeRange>([0, 10])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<ContentType | null>(null)
  const [genreFilter, setGenreFilter] = useState<string | null>(null)

  const toggleCalendar = useCallback(() => {
    setCalendarOpen((v) => !v)
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
