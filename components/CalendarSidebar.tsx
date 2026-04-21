'use client'

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react'
import { useState } from 'react'
import { useVibe } from '@/context/VibeContext'

interface CalendarSidebarProps {
  eventDates: Date[]
}

export function CalendarSidebar({ eventDates }: CalendarSidebarProps) {
  const { calendarOpen, toggleCalendar, selectedDate, setSelectedDate } = useVibe()
  const [viewMonth, setViewMonth] = useState(new Date())

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const hasEvent = (day: Date) => eventDates.some((d) => isSameDay(d, day))
  const isSelected = (day: Date) => selectedDate ? isSameDay(day, selectedDate) : false

  const handleDayClick = (day: Date) => {
    if (selectedDate && isSameDay(day, selectedDate)) {
      setSelectedDate(null)
    } else {
      setSelectedDate(day)
    }
  }

  const dayHeaders = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={toggleCalendar}
        className={[
          'fixed left-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-2 rounded-r-lg border border-l-0 border-border px-2 py-3 text-muted transition-colors hover:border-secondary hover:text-secondary',
          calendarOpen ? 'bg-surface' : 'bg-base',
        ].join(' ')}
        aria-label="Toggle calendario"
      >
        <Calendar size={14} />
      </button>

      {/* Sidebar panel */}
      <aside
        className={[
          'fixed left-0 top-0 z-30 flex h-full flex-col overflow-y-auto border-r border-border bg-surface pt-14 transition-transform duration-300',
          calendarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ width: 240 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="font-mono text-xs tracking-widest text-secondary">CALENDARIO</span>
          <button onClick={toggleCalendar} className="text-muted hover:text-secondary">
            <X size={14} />
          </button>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setViewMonth((m) => subMonths(m, 1))}
            className="text-muted hover:text-secondary"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="font-mono text-xs tracking-widest text-primary">
            {format(viewMonth, 'MMMM yyyy', { locale: es }).toUpperCase()}
          </span>
          <button
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            className="text-muted hover:text-secondary"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day grid */}
        <div className="px-3">
          {/* Day headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {dayHeaders.map((d, i) => (
              <span key={i} className="font-mono text-[10px] text-muted">
                {d}
              </span>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {days.map((day, i) => {
              const inMonth = isSameMonth(day, viewMonth)
              const today = isToday(day)
              const event = hasEvent(day)
              const selected = isSelected(day)

              return (
                <button
                  key={i}
                  onClick={() => inMonth && handleDayClick(day)}
                  disabled={!inMonth}
                  className={[
                    'relative flex flex-col items-center rounded py-1 font-mono text-xs transition-colors',
                    !inMonth && 'opacity-20',
                    inMonth && !selected && !today && 'hover:bg-elevated text-secondary',
                    today && !selected && 'text-vibe-cool',
                    selected && 'bg-vibe-cool/20 text-vibe-cool',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span>{format(day, 'd')}</span>
                  {event && inMonth && (
                    <span
                      className={[
                        'mt-0.5 h-1 w-1 rounded-full',
                        selected ? 'bg-vibe-cool' : 'bg-vibe-hot',
                      ].join(' ')}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected date label */}
        {selectedDate && (
          <div className="mx-3 mt-4 flex items-center justify-between rounded border border-vibe-cool/30 bg-vibe-cool/10 px-3 py-2">
            <span className="font-mono text-xs text-vibe-cool">
              {format(selectedDate, "d 'de' MMMM", { locale: es })}
            </span>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-vibe-cool/60 hover:text-vibe-cool"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="mt-auto border-t border-border p-4">
          <p className="font-mono text-[10px] leading-relaxed text-muted">
            Los puntos naranjas
            <br />
            indican eventos.
          </p>
        </div>
      </aside>

      {/* Backdrop */}
      {calendarOpen && (
        <div
          className="fixed inset-0 z-20 bg-base/50 backdrop-blur-sm"
          onClick={toggleCalendar}
        />
      )}
    </>
  )
}
