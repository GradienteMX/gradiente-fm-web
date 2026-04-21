import { format, isBefore, isSameDay, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ContentItem, ContentType, VibeRange } from './types'

// ── Vibe helpers ─────────────────────────────────────────────────────────────

export function categoryColor(type: ContentType): string {
  switch (type) {
    case 'evento':    return '#E63329'
    case 'mix':       return '#22D3EE'
    case 'review':    return '#F59E0B'
    case 'editorial': return '#84CC16'
    case 'noticia':   return '#F5F5F5'
    case 'opinion':   return '#A78BFA'
    case 'partner':   return '#6B7280'
  }
}

export function vibeToColor(vibe: number): string {
  if (vibe <= 0)  return '#00FFFF'
  if (vibe <= 1)  return '#00CCFF'
  if (vibe <= 2)  return '#0066FF'
  if (vibe <= 3)  return '#6600FF'
  if (vibe <= 4)  return '#CC00FF'
  if (vibe <= 5)  return '#FF00FF'
  if (vibe <= 6)  return '#FF0066'
  if (vibe <= 7)  return '#FF5500'
  if (vibe <= 8)  return '#FFAA00'
  if (vibe <= 9)  return '#FF2200'
  return '#FF0000'
}

export function vibeToLabel(vibe: number): string {
  if (vibe <= 1) return 'GLACIAL'
  if (vibe <= 3) return 'CHILL'
  if (vibe <= 4) return 'COOL'
  if (vibe <= 5) return 'NEUTRAL'
  if (vibe <= 6) return 'WARM'
  if (vibe <= 7) return 'HOT'
  if (vibe <= 9) return 'FUEGO'
  return 'VOLCÁN'
}

export function vibeToPercent(vibe: number): number {
  return (vibe / 10) * 100
}

export function isInVibeRange(vibe: number, range: VibeRange): boolean {
  return vibe >= range[0] && vibe <= range[1]
}

// ── Date helpers ─────────────────────────────────────────────────────────────

export function isExpired(item: ContentItem, now = new Date()): boolean {
  const today = startOfDay(now)
  if (item.type === 'evento') {
    const end = item.endDate ?? item.date
    if (!end) return false
    return isBefore(parseISO(end), today)
  }
  if (item.expiresAt) {
    return isBefore(parseISO(item.expiresAt), today)
  }
  return false
}

export function isUpcoming(item: ContentItem, now = new Date()): boolean {
  return !isExpired(item, now)
}

export function getItemDate(item: ContentItem): Date {
  const raw = item.date ?? item.publishedAt
  return parseISO(raw)
}

export function filterForHome(items: ContentItem[], now = new Date()): ContentItem[] {
  return items
    .filter((i) => isUpcoming(i, now))
    .sort((a, b) => getItemDate(a).getTime() - getItemDate(b).getTime())
}

export function filterForCategory(items: ContentItem[], type: ContentItem['type']): ContentItem[] {
  return items
    .filter((i) => i.type === type)
    .sort((a, b) => getItemDate(b).getTime() - getItemDate(a).getTime())
}

export function filterByVibe(items: ContentItem[], range: VibeRange): ContentItem[] {
  return items.filter((i) => isInVibeRange(i.vibe, range))
}

export function filterByDate(items: ContentItem[], date: Date): ContentItem[] {
  return items.filter((i) => {
    const d = parseISO(i.date ?? i.publishedAt)
    return isSameDay(d, date)
  })
}

export function getEventDates(items: ContentItem[]): Date[] {
  return items
    .filter((i) => i.type === 'evento' && i.date)
    .map((i) => parseISO(i.date!))
}

// ── Format helpers ────────────────────────────────────────────────────────────

export function fmtDateShort(iso: string): string {
  return format(parseISO(iso), "d MMM", { locale: es }).toUpperCase()
}

export function fmtDateFull(iso: string): string {
  return format(parseISO(iso), "EEEE d 'de' MMMM", { locale: es })
}

export function fmtDayNumber(iso: string): string {
  return format(parseISO(iso), 'd')
}

export function fmtMonthShort(iso: string): string {
  return format(parseISO(iso), 'MMM', { locale: es }).toUpperCase()
}

export function fmtDayName(iso: string): string {
  return format(parseISO(iso), 'EEE', { locale: es }).toUpperCase()
}

export function fmtTime(iso: string): string {
  // iso can be "2026-04-18T22:00:00" — returns "22:00"
  try {
    return format(parseISO(iso), 'HH:mm')
  } catch {
    return ''
  }
}

export function clsx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
