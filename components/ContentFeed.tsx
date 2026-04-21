'use client'

import { useMemo } from 'react'
import { isSameDay, parseISO } from 'date-fns'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ContentItem } from '@/lib/types'
import { useVibe } from '@/context/VibeContext'
import { filterByVibe, getItemDate } from '@/lib/utils'
import { EventCard } from './cards/EventCard'
import { MixCard } from './cards/MixCard'
import { ArticleCard } from './cards/ArticleCard'
import { vibeToColor } from '@/lib/utils'

interface ContentFeedProps {
  items: ContentItem[]
  mode?: 'home' | 'category'
  emptyLabel?: string
}

function DateDivider({ date }: { date: Date }) {
  const label = format(date, "EEEE d 'de' MMMM", { locale: es }).toUpperCase()
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="font-mono text-[10px] tracking-widest text-sys-red">//</span>
      <span className="font-mono text-[10px] tracking-widest text-secondary">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

function renderCard(item: ContentItem) {
  switch (item.type) {
    case 'evento':
      return <EventCard key={item.id} item={item} />
    case 'mix':
      return <MixCard key={item.id} item={item} />
    default:
      return <ArticleCard key={item.id} item={item} />
  }
}

export function ContentFeed({ items, mode = 'home', emptyLabel }: ContentFeedProps) {
  const { vibeRange, selectedDate } = useVibe()

  const filtered = useMemo(() => {
    let result = filterByVibe(items, vibeRange)
    if (selectedDate) {
      // Pin items on selected date to top, keep the rest below
      const onDate = result.filter((i) => {
        const d = parseISO(i.date ?? i.publishedAt)
        return isSameDay(d, selectedDate)
      })
      const rest = result.filter((i) => {
        const d = parseISO(i.date ?? i.publishedAt)
        return !isSameDay(d, selectedDate)
      })
      result = [...onDate, ...rest]
    }
    return result
  }, [items, vibeRange, selectedDate])

  if (filtered.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 border border-border py-16">
        <div className="hazard-stripe h-1 w-16" />
        <p className="sys-label text-muted">
          {emptyLabel ?? '// SIN CONTENIDO EN ESTE RANGO DE VIBE'}
        </p>
        <div className="hazard-stripe h-1 w-16" />
      </div>
    )
  }

  if (mode === 'home') {
    // Group by date for home feed
    const byDate = new Map<string, ContentItem[]>()
    for (const item of filtered) {
      const d = getItemDate(item)
      const key = format(d, 'yyyy-MM-dd')
      if (!byDate.has(key)) byDate.set(key, [])
      byDate.get(key)!.push(item)
    }

    return (
      <div className="flex flex-col gap-0">
        {Array.from(byDate.entries()).map(([key, dayItems]) => {
          const date = parseISO(key)
          return (
            <section key={key} className="animate-fade-in">
              <DateDivider date={date} />
              <div className="flex flex-col gap-0">
                {dayItems.map((item) => (
                  <div key={item.id} className="animate-fade-up">
                    {renderCard(item)}
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    )
  }

  // Category mode: flat list, no date grouping
  return (
    <div className="flex flex-col gap-0">
      {filtered.map((item) => (
        <div key={item.id} className="animate-fade-up">
          {renderCard(item)}
        </div>
      ))}
    </div>
  )
}
