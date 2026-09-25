/**
 * FRANJA — the catalog, derived.
 *
 * Three relations between a franja and the rest of the world, kept apart on
 * purpose because they mean different things:
 *
 *   presenta  items whose `franjaId` is this franja — authorship. This is the
 *             catalog: every count on a franja page is taken from it.
 *   sobre     items that list the franja in `franjaRefs` — subject links.
 *             Somebody wrote *about* it; it didn't publish them.
 *   aquí      (venues and clubs only) events whose `venue` is literally this
 *             place. Until the scraper writes `franjaRefs` for them, a
 *             folded name match is the same fact the listing already states.
 *
 * Nothing here ranks by HL, reads the fader or counts followers. Franjas are
 * ordered by their last signal; their pages show catalog facts only.
 */

import { parseISO } from 'date-fns'
import type { ContentItem, ContentType, FranjaKind } from '@/lib/types'
import { isExpired } from '@/lib/logic/time'
import { effectiveBand } from '@/lib/vibe'

// ── kind → what the Estación leads with ─────────────────────────────────────

export interface KindSlot {
  /** Section title, sentence case. */
  label: string
  /** Honest empty line. */
  empty: string
  /** `eventos` = upcoming events; `piezas` = latest of `types`; `inventario` = listings. */
  mode: 'eventos' | 'piezas' | 'inventario'
  types: ContentType[]
  /** Poster ratio for the peeks in this slot. */
  ratio: '4 / 5' | '1 / 1'
}

const EVENT_TYPES: ContentType[] = ['evento']
const TEXT_TYPES: ContentType[] = ['noticia', 'editorial', 'opinion', 'articulo', 'review', 'listicle']

export const KIND_SLOT: Record<FranjaKind, KindSlot> = {
  venue: { label: 'Próximos eventos aquí', empty: 'Sin fechas anunciadas en este lugar.', mode: 'eventos', types: EVENT_TYPES, ratio: '4 / 5' },
  club: { label: 'Próximos eventos aquí', empty: 'Sin fechas anunciadas en este club.', mode: 'eventos', types: EVENT_TYPES, ratio: '4 / 5' },
  promoter: { label: 'Próximas fiestas', empty: 'Sin fiestas anunciadas por ahora.', mode: 'eventos', types: EVENT_TYPES, ratio: '4 / 5' },
  colectivo: { label: 'Próximas fiestas', empty: 'Sin fiestas anunciadas por ahora.', mode: 'eventos', types: EVENT_TYPES, ratio: '4 / 5' },
  festival: { label: 'Próximas ediciones', empty: 'Sin ediciones anunciadas.', mode: 'eventos', types: EVENT_TYPES, ratio: '4 / 5' },
  label: { label: 'Lanzamientos y mixes', empty: 'Sin lanzamientos ni mixes en Gradiente todavía.', mode: 'piezas', types: ['mix', 'review'], ratio: '1 / 1' },
  'mix-series': { label: 'Episodios', empty: 'Sin episodios publicados todavía.', mode: 'piezas', types: ['mix'], ratio: '1 / 1' },
  dealer: { label: 'Inventario', empty: 'Sin piezas en su inventario ahora mismo.', mode: 'inventario', types: [], ratio: '1 / 1' },
  medios: { label: 'Publicaciones recientes', empty: 'Sin publicaciones en Gradiente todavía.', mode: 'piezas', types: TEXT_TYPES, ratio: '4 / 5' },
  plataforma: { label: 'Publicaciones recientes', empty: 'Sin publicaciones en Gradiente todavía.', mode: 'piezas', types: TEXT_TYPES, ratio: '4 / 5' },
}

/** Past-tense name for the event archive, by kind. */
export const ARCHIVE_LABEL: Record<FranjaKind, string> = {
  venue: 'Noches pasadas aquí',
  club: 'Noches pasadas aquí',
  promoter: 'Fiestas pasadas',
  colectivo: 'Fiestas pasadas',
  festival: 'Ediciones pasadas',
  label: 'Eventos pasados',
  'mix-series': 'Eventos pasados',
  dealer: 'Eventos pasados',
  medios: 'Eventos pasados',
  plataforma: 'Eventos pasados',
}

/** Archive tabs on the dossier — the same families the catalog facts count. */
export const ARCHIVE_TABS = [
  { key: 'todo', label: 'Todo', types: [] as ContentType[] },
  { key: 'eventos', label: 'Eventos', types: ['evento'] as ContentType[] },
  { key: 'lanzamientos', label: 'Lanzamientos', types: ['mix', 'review'] as ContentType[] },
  { key: 'articulos', label: 'Artículos', types: ['articulo', 'listicle'] as ContentType[] },
  { key: 'noticias', label: 'Noticias', types: ['noticia', 'editorial', 'opinion'] as ContentType[] },
] as const

export type ArchiveKey = (typeof ARCHIVE_TABS)[number]['key']

// ── helpers ─────────────────────────────────────────────────────────────────

/** Accent- and case-insensitive name key: "Fünk" and "funk" are one place. */
export function foldName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const ts = (iso: string | undefined) => (iso ? parseISO(iso).getTime() : 0)
const eventTime = (i: ContentItem) => ts(i.date ?? i.publishedAt)
const newestPublished = (a: ContentItem, b: ContentItem) => ts(b.publishedAt) - ts(a.publishedAt)

export function lastSignal(f: ContentItem): string {
  return f.franjaLastUpdated ?? f.publishedAt
}

/** The dial's order: by last signal, newest first — never by HL. */
export function sortByLastSignal(franjas: ContentItem[]): ContentItem[] {
  return [...franjas].sort((a, b) => ts(lastSignal(b)) - ts(lastSignal(a)))
}

/** Same frequency the Dial prints next to a station (88.0 → 108.0). */
export function frequencyAt(index: number, n: number): number {
  return 88 + (Math.max(0, index) * 20) / Math.max(1, n - 1)
}

export function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
}

// ── the catalog ─────────────────────────────────────────────────────────────

export type Relation = 'presenta' | 'aqui' | 'sobre'

export interface Linked {
  item: ContentItem
  relation: Relation
}

export interface CatalogFacts {
  eventos: number
  lanzamientos: number
  articulos: number
  noticias: number
  publicaciones: number
  productos: number
  /** `declared` = the franja's own year; otherwise the first piece in the archive. */
  desde: { year: number; declared: boolean } | null
}

export interface FranjaCatalog {
  presenta: ContentItem[]
  sobre: ContentItem[]
  aqui: ContentItem[]
  /** Upcoming events, soonest first (presenta ∪ aquí). */
  upcoming: Linked[]
  /** Past events, newest first (presenta ∪ aquí). */
  past: Linked[]
  /** Newest-first catalog pieces for a `piezas` slot. */
  slotPieces: ContentItem[]
  /** Latest non-event pieces (for event-led kinds, so the rest of the catalog shows). */
  latest: ContentItem[]
  facts: CatalogFacts
  /** Mid energies of the catalog, for the band strip. Null when empty. */
  spectrum: { mids: number[]; min: number; max: number } | null
}

export function franjaCatalog(franja: ContentItem, items: ContentItem[], now: Date): FranjaCatalog {
  const kind = franja.franjaKind ?? 'colectivo'
  const slot = KIND_SLOT[kind]
  const place = kind === 'venue' || kind === 'club' ? foldName(franja.title) : null

  const presenta: ContentItem[] = []
  const sobre: ContentItem[] = []
  const aqui: ContentItem[] = []
  for (const i of items) {
    if (i.type === 'franja' || i.id === franja.id) continue
    if (i.franjaId === franja.id) presenta.push(i)
    else if (i.franjaRefs?.some((r) => r.id === franja.id)) sobre.push(i)
    else if (place && i.type === 'evento' && i.venue && foldName(i.venue) === place) aqui.push(i)
  }
  presenta.sort(newestPublished)
  sobre.sort(newestPublished)

  const events: Linked[] = [
    ...presenta.filter((i) => i.type === 'evento').map((item) => ({ item, relation: 'presenta' as const })),
    ...aqui.map((item) => ({ item, relation: 'aqui' as const })),
  ]
  const upcoming = events.filter((e) => !isExpired(e.item, now)).sort((a, b) => eventTime(a.item) - eventTime(b.item))
  const past = events.filter((e) => isExpired(e.item, now)).sort((a, b) => eventTime(b.item) - eventTime(a.item))
  aqui.sort((a, b) => eventTime(b) - eventTime(a))

  const slotPieces = slot.mode === 'piezas' ? presenta.filter((i) => slot.types.includes(i.type)) : []
  const latest = presenta.filter((i) => i.type !== 'evento')

  const count = (types: ContentType[]) => presenta.filter((i) => types.includes(i.type)).length
  const listings = franja.marketplaceEnabled ? franja.marketplaceListings ?? [] : []
  let first: number | null = null
  for (const i of presenta) {
    for (const iso of [i.date, i.publishedAt]) {
      if (!iso) continue
      const y = parseISO(iso).getFullYear()
      if (!Number.isNaN(y)) first = first === null ? y : Math.min(first, y)
    }
  }
  const facts: CatalogFacts = {
    eventos: count(['evento']),
    lanzamientos: count(['mix', 'review']),
    articulos: count(['articulo', 'listicle']),
    noticias: count(['noticia', 'editorial', 'opinion']),
    publicaciones: presenta.length,
    productos: listings.length,
    desde: franja.year ? { year: franja.year, declared: true } : first !== null ? { year: first, declared: false } : null,
  }

  const mids = presenta.map((i) => {
    const b = effectiveBand(i)
    return (b.min + b.max) / 2
  })
  const spectrum = mids.length
    ? {
        mids,
        min: Math.min(...presenta.map((i) => effectiveBand(i).min)),
        max: Math.max(...presenta.map((i) => effectiveBand(i).max)),
      }
    : null

  return { presenta, sobre, aqui, upcoming, past, slotPieces, latest, facts, spectrum }
}

export function archiveCounts(presenta: ContentItem[]): Record<ArchiveKey, number> {
  const out = {} as Record<ArchiveKey, number>
  for (const t of ARCHIVE_TABS) out[t.key] = t.types.length ? presenta.filter((i) => (t.types as readonly ContentType[]).includes(i.type)).length : presenta.length
  return out
}
