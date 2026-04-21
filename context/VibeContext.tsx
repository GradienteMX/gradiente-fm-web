'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import type { VibeRange } from '@/lib/types'

interface VibeContextValue {
  vibeRange: VibeRange
  setVibeRange: (range: VibeRange) => void
  selectedDate: Date | null
  setSelectedDate: (date: Date | null) => void
  calendarOpen: boolean
  toggleCalendar: () => void
}

const VibeContext = createContext<VibeContextValue | null>(null)

export function VibeProvider({ children }: { children: ReactNode }) {
  const [vibeRange, setVibeRange] = useState<VibeRange>([0, 10])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)

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
