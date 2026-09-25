import { format, isBefore, parseISO, startOfDay, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ContentItem } from '@/lib/types'

export const HOME_PAST_GRACE_DAYS = 30

export function isExpired(item: ContentItem, now: Date): boolean {
  const today = startOfDay(now)
  if (item.type === 'evento') {
    const end = item.endDate ?? item.date
    if (!end) return false
    return isBefore(parseISO(end), today)
  }
  if (item.expiresAt) return isBefore(parseISO(item.expiresAt), today)
  return false
}

export function isUpcoming(item: ContentItem, now: Date): boolean {
  return !isExpired(item, now)
}

export function isRecentlyPast(item: ContentItem, graceDays: number, now: Date): boolean {
  if (item.type !== 'evento') return false
  const end = item.endDate ?? item.date
  if (!end) return false
  const endTime = parseISO(end).getTime()
  if (endTime >= startOfDay(now).getTime()) return false
  return endTime >= now.getTime() - graceDays * 86_400_000
}

export function itemDate(item: ContentItem): Date {
  return parseISO(item.date ?? item.publishedAt)
}

/** Event live window: 1 h before doors → 1 h after the end. */
export function isLive(item: ContentItem, now: Date): boolean {
  if (item.type !== 'evento' || !item.date) return false
  const start = parseISO(item.date).getTime() - 3_600_000
  const endIso = item.endDate ?? item.date
  const end = parseISO(endIso).getTime() + (item.endDate ? 3_600_000 : 6 * 3_600_000)
  const t = now.getTime()
  return t >= start && t <= end
}

export type Proximity = 'en-vivo' | 'esta-noche' | 'manana' | 'semana' | 'pronto' | 'pasado'

export function eventProximity(item: ContentItem, now: Date): Proximity {
  if (isLive(item, now)) return 'en-vivo'
  if (!item.date) return 'pronto'
  const d = parseISO(item.date)
  if (d.getTime() < now.getTime()) return 'pasado'
  const days = differenceInCalendarDays(d, now)
  if (days <= 0) return 'esta-noche'
  if (days === 1) return 'manana'
  if (days < 7) return 'semana'
  return 'pronto'
}

export const PROXIMITY_LABEL: Record<Proximity, string> = {
  'en-vivo': 'EN VIVO',
  'esta-noche': 'ESTA NOCHE',
  manana: 'MAÑANA',
  semana: 'ESTA SEMANA',
  pronto: 'PRÓXIMO',
  pasado: 'PASADO',
}

// ── formatting (Spanish) ────────────────────────────────────────────────────

export const fmt = {
  dayNum: (iso: string) => format(parseISO(iso), 'd'),
  month: (iso: string) => format(parseISO(iso), 'MMM', { locale: es }).replace('.', '').toUpperCase(),
  weekday: (iso: string) => format(parseISO(iso), 'EEE', { locale: es }).replace('.', '').toUpperCase(),
  weekdayLong: (iso: string) => format(parseISO(iso), 'EEEE', { locale: es }),
  time: (iso: string) => format(parseISO(iso), 'HH:mm'),
  short: (iso: string) => format(parseISO(iso), "d MMM", { locale: es }),
  long: (iso: string) => format(parseISO(iso), "d 'de' MMMM, yyyy", { locale: es }),
  full: (iso: string) => format(parseISO(iso), "EEEE d 'de' MMMM · HH:mm", { locale: es }),
  monthYear: (iso: string) => format(parseISO(iso), 'MMM yyyy', { locale: es }).toUpperCase(),
}

/** "hace 3 h", "hace 2 días", "ahora" — relative, coarse, honest. */
export function ago(iso: string, now: Date): string {
  const s = Math.max(0, (now.getTime() - parseISO(iso).getTime()) / 1000)
  if (s < 60) return 'ahora'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  const d = Math.floor(s / 86400)
  if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`
  const m = Math.floor(d / 30)
  if (m < 12) return `hace ${m} ${m === 1 ? 'mes' : 'meses'}`
  const y = Math.floor(d / 365)
  return `hace ${y} ${y === 1 ? 'año' : 'años'}`
}

/** "en 3 días", "en 5 h" — for upcoming things. */
export function until(iso: string, now: Date): string {
  const s = (parseISO(iso).getTime() - now.getTime()) / 1000
  if (s <= 0) return 'ya'
  if (s < 3600) return `en ${Math.ceil(s / 60)} min`
  if (s < 86400) return `en ${Math.round(s / 3600)} h`
  const d = Math.round(s / 86400)
  return `en ${d} ${d === 1 ? 'día' : 'días'}`
}
