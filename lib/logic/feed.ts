/**
 * Home composition — a faithful port of espectro-fm-web `app/page.tsx` +
 * `lib/utils.ts` (Sept 2026). Ranking itself is the original `rankItems`
 * (`lib/seed/curation.ts`), untouched.
 *
 *  - Portada: every pinned non-franja piece, newest first; fallback = newest
 *    editorial-flagged text piece.
 *  - Events: rail = upcoming, not elevated. Mosaic = curator picks
 *    (editorial / elevated) + nearest scraped events under two flood guards:
 *    3 per day, 8 total (an absolute cap, never a ratio).
 *  - Franjas never enter the mosaic.
 */

import { parseISO } from 'date-fns'
import type { ContentItem, ContentType } from '@/lib/types'
import { rankAgenda, rankItems, type RankedItem } from '@/lib/curation'
import { itemMatchesGenreFilter } from '@/lib/genres'
import { bandOverlaps, type VibeRange } from '@/lib/vibe'
import { HOME_PAST_GRACE_DAYS, isRecentlyPast, isUpcoming, itemDate } from './time'

export const EVENTS_PER_DAY = 3
export const MAX_MOSAIC_EVENTS = 8

const FALLBACK_TYPES: ContentType[] = ['editorial', 'review', 'noticia', 'opinion', 'articulo']
const newestFirst = (a: ContentItem, b: ContentItem) =>
  new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()

export function getPortada(items: ContentItem[]): ContentItem[] {
  const pinned = items.filter((i) => i.pinned && i.type !== 'franja').sort(newestFirst)
  if (pinned.length > 0) return pinned
  const fallback = items.filter((i) => i.editorial && FALLBACK_TYPES.includes(i.type)).sort(newestFirst)[0]
  return fallback ? [fallback] : []
}

export function filterForHome(items: ContentItem[], now: Date, graceDays = HOME_PAST_GRACE_DAYS) {
  return items
    .filter((i) => isUpcoming(i, now) || isRecentlyPast(i, graceDays, now))
    .sort((a, b) => itemDate(a).getTime() - itemDate(b).getTime())
}

export interface HomeComposition {
  portada: ContentItem[]
  railEvents: ContentItem[]
  gridItems: ContentItem[]
  franjas: ContentItem[]
  marketFranjas: ContentItem[]
}

export function composeHome(all: ContentItem[], now: Date): HomeComposition {
  const published = all
  const homeItems = filterForHome(published, now)
  const portada = getPortada(published)
  const portadaIds = new Set(portada.map((i) => i.id))

  const franjas = published
    .filter((i) => i.type === 'franja')
    .sort(
      (a, b) =>
        parseISO(b.franjaLastUpdated ?? b.publishedAt).getTime() -
        parseISO(a.franjaLastUpdated ?? a.publishedAt).getTime(),
    )
  const marketFranjas = franjas.filter((f) => f.marketplaceEnabled)

  const chrono = (a: ContentItem, b: ContentItem) =>
    parseISO(a.date ?? a.publishedAt).getTime() - parseISO(b.date ?? b.publishedAt).getTime()
  const upcomingEvents = homeItems.filter((i) => i.type === 'evento' && isUpcoming(i, now)).sort(chrono)

  const perDay = new Map<string, number>()
  const mosaicEventIds = new Set<string>()
  let capped = 0
  for (const ev of upcomingEvents) {
    if (ev.editorial || ev.elevated) {
      mosaicEventIds.add(ev.id)
      continue
    }
    if (capped >= MAX_MOSAIC_EVENTS) continue
    const day = (ev.date ?? ev.publishedAt).slice(0, 10)
    const seen = perDay.get(day) ?? 0
    if (seen < EVENTS_PER_DAY) {
      mosaicEventIds.add(ev.id)
      perDay.set(day, seen + 1)
      capped++
    }
  }

  const railEvents = upcomingEvents.filter((i) => !i.elevated)
  const gridItems = homeItems.filter(
    (i) => i.type !== 'franja' && !portadaIds.has(i.id) && (i.type !== 'evento' || mosaicEventIds.has(i.id)),
  )

  return { portada, railEvents, gridItems, franjas, marketFranjas }
}

// ── filters ─────────────────────────────────────────────────────────────────

export interface FeedFilter {
  range: VibeRange
  type: ContentType | null
  genres: string[]
}

export function applyFilter(items: ContentItem[], f: FeedFilter, opts: { typeAndGenre: boolean }) {
  let out = items.filter((i) => bandOverlaps(i, f.range))
  if (opts.typeAndGenre) {
    if (f.type) out = out.filter((i) => i.type === f.type)
    if (f.genres.length) out = out.filter((i) => itemMatchesGenreFilter(i.genres, f.genres))
  }
  return out
}

export function rankHome(items: ContentItem[], now: Date): RankedItem[] {
  return rankItems(items, now)
}

export function rankCategory(items: ContentItem[], now: Date): RankedItem[] {
  // Home sizes, then chronological (newest first) — same as today.
  return rankItems(items, now).sort(
    (a, b) => itemDate(b.item).getTime() - itemDate(a.item).getTime(),
  )
}

export function rankAgendaItems(items: ContentItem[], now: Date): RankedItem[] {
  return rankAgenda(items, now)
}

export type { RankedItem }
