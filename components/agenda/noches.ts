/**
 * Agenda logic — nights, gaps and the month strip. Pure (no React).
 *
 * A night is a local calendar day with its events, ordered the way a
 * listing reads: curator picks (editorial / elevated) first, then by doors,
 * then by name. Runs of empty days are kept as honest gaps so the river
 * never lies about time.
 */

import { addDays, differenceInCalendarDays, format, isSameMonth, parseISO, startOfDay } from 'date-fns'
import type { ContentItem } from '@/lib/types'
import { effectiveBand } from '@/lib/vibe'

export interface Noche {
  key: string
  date: Date
  events: ContentItem[]
  /** Mid energy of the night's hottest event — sets the day number. */
  hottest: number
}

export type FilaRio =
  | { kind: 'noche'; noche: Noche }
  | { kind: 'hueco'; key: string; from: Date; to: Date; days: number }
  | { kind: 'mes'; key: string; date: Date }

export const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

/**
 * Still ahead of us (or sounding right now). Finer than the day-granular
 * `isUpcoming`: a night that ended at 6 a.m. today belongs to the archive,
 * not to "esta noche". Without an end time a night is given six hours, the
 * same allowance `isLive` uses.
 */
export function sigueViva(ev: ContentItem, now: Date): boolean {
  if (!ev.date) return false
  const end = ev.endDate ? parseISO(ev.endDate).getTime() : parseISO(ev.date).getTime() + 6 * 3_600_000
  return end >= now.getTime()
}

export function midOf(item: ContentItem): number {
  const b = effectiveBand(item)
  return (b.min + b.max) / 2
}

function byListing(a: ContentItem, b: ContentItem): number {
  const pa = a.editorial || a.elevated ? 0 : 1
  const pb = b.editorial || b.elevated ? 0 : 1
  if (pa !== pb) return pa - pb
  const ta = a.date ?? ''
  const tb = b.date ?? ''
  if (ta !== tb) return ta < tb ? -1 : 1
  return a.title.localeCompare(b.title, 'es')
}

/**
 * Group events by the local day they start. Multi-day events live on their
 * first night — unless that night is already behind us, then on today.
 */
export function groupNights(events: ContentItem[], now: Date): Map<string, Noche> {
  const today = startOfDay(now)
  const out = new Map<string, Noche>()
  for (const ev of events) {
    if (!ev.date) continue
    let d = startOfDay(parseISO(ev.date))
    if (d < today) d = today
    const key = dayKey(d)
    let n = out.get(key)
    if (!n) {
      n = { key, date: d, events: [], hottest: 0 }
      out.set(key, n)
    }
    n.events.push(ev)
  }
  for (const n of out.values()) {
    n.events.sort(byListing)
    n.hottest = n.events.reduce((m, e) => Math.max(m, midOf(e)), 0)
  }
  return out
}

/** The river: nights in order, empty stretches folded into gaps, months marked. */
export function riverRows(nights: Map<string, Noche>, now: Date): FilaRio[] {
  const list = [...nights.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
  if (!list.length) return []
  const rows: FilaRio[] = []
  let cursor = startOfDay(now)
  let lastMonth: Date | null = null
  for (const n of list) {
    const gap = differenceInCalendarDays(n.date, cursor)
    if (gap > 0) {
      const to = addDays(n.date, -1)
      rows.push({ kind: 'hueco', key: `hueco-${dayKey(cursor)}`, from: cursor, to, days: gap })
    }
    if (lastMonth && !isSameMonth(lastMonth, n.date)) rows.push({ kind: 'mes', key: `mes-${format(n.date, 'yyyy-MM')}`, date: n.date })
    rows.push({ kind: 'noche', noche: n })
    lastMonth = n.date
    cursor = addDays(n.date, 1)
  }
  return rows
}

export interface DiaDensidad {
  key: string
  date: Date
  /** Every upcoming event that night (the calendar's shape). */
  total: number
  /** Those passing the instrument and the search. */
  lit: number
  /** Mean mid energy of the lit events (null when none). */
  mean: number | null
}

/** One tick per day for the next `days` days. Catalog facts only. */
export function density(
  all: Map<string, Noche>,
  passes: (e: ContentItem) => boolean,
  now: Date,
  days = 30,
): DiaDensidad[] {
  const start = startOfDay(now)
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i)
    const key = dayKey(date)
    const evs = all.get(key)?.events ?? []
    let lit = 0
    let sum = 0
    for (const e of evs) {
      if (!passes(e)) continue
      lit++
      sum += midOf(e)
    }
    return { key, date, total: evs.length, lit, mean: lit ? sum / lit : null }
  })
}
