/**
 * Scene entities — artists, venues, labels, promoters — derived from the
 * pieces themselves.
 *
 * Production resolves `entities` from a join table; the seed carries almost
 * none, so a ficha is also derived from what the pieces already say: an
 * event's line-up and venue, a mix's author and tracklist, a list's tracks.
 * Names are slugified the same way everywhere (`entitySlug`), so
 * `/e/surgeon` and `/e/club-japan` resolve without a table.
 *
 * Pure module (no React): the server uses it for metadata, the client for
 * the page. Other surfaces can link with `/e/${entitySlug(name)}`.
 */

import type { ContentItem } from '@/lib/types'
import type { EntityKind } from '@/lib/types'
import { effectiveBand } from '@/lib/vibe'
import { fold } from './texto'

/** How a piece points at an entity. Strongest wins when a piece says it twice. */
export type EntityVia = 'ficha' | 'autor' | 'lineup' | 'sede' | 'lista' | 'tracklist' | 'mencion'

const VIA_STRENGTH: Record<EntityVia, number> = {
  ficha: 6,
  autor: 5,
  lineup: 5,
  sede: 5,
  lista: 3,
  tracklist: 2,
  mencion: 1,
}

export const VIA_LABEL: Record<EntityVia, { one: string; many: string }> = {
  ficha: { one: 'ficha', many: 'fichas' },
  autor: { one: 'mix propio', many: 'mixes propios' },
  lineup: { one: 'line-up', many: 'line-ups' },
  sede: { one: 'noche como sede', many: 'noches como sede' },
  lista: { one: 'lista', many: 'listas' },
  tracklist: { one: 'tracklist', many: 'tracklists' },
  mencion: { one: 'mención', many: 'menciones' },
}

export const KIND_LABEL: Record<EntityKind, string> = {
  artist: 'Artista',
  label: 'Sello',
  venue: 'Venue',
  promoter: 'Promotora',
}

export interface Aparicion {
  item: ContentItem
  via: EntityVia
}

export interface Entidad {
  slug: string
  name: string
  kind: EntityKind
  /** Venue city / street line when a piece states it. */
  place?: string
  apariciones: Aparicion[]
}

// ── names ────────────────────────────────────────────────────────────────────

/** Performance qualifiers that belong to the night, not the name. */
const QUALIFIER = /\s*\((?=[^)]*\b(?:live|dj[\s-]?set|a\/?v|hybrid|all night long|extended|set)\b)[^)]*\)\s*$/i

/** Venue strings that are not places yet. */
const PLACEHOLDER_VENUE = /\bTBA\b|por anunciar|secret location|ubicaci[oó]n secreta/i

/** Tracklist artists that are not people. */
const NOT_A_NAME = /^(?:id|unknown|desconocid[oa]|\?+|-+|n\/a)$/i

/** "Debit (live A/V)" → "Debit". Country and disambiguation tags stay: "DECO (MX)". */
export function cleanEntityName(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim()
  let prev = ''
  while (prev !== s) {
    prev = s
    s = s.replace(QUALIFIER, '').trim()
  }
  return s
}

/** A billing like "Jackson b2b Bubu" is two people. */
export function splitBilling(raw: string): string[] {
  return raw
    .split(/\s+b2b\s+/i)
    .map(cleanEntityName)
    .filter((n) => n && !NOT_A_NAME.test(n))
}

/**
 * The one slug function for scene names. Pass a single name (not a b2b
 * billing): `entitySlug('Fünk')` → `funk`, `entitySlug('Debit (live)')` → `debit`.
 */
export function entitySlug(name: string): string {
  return fold(cleanEntityName(name))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function entityHref(name: string): string {
  return `/e/${entitySlug(name)}`
}

// ── derivation ───────────────────────────────────────────────────────────────

interface Ref {
  name: string
  slug: string
  kind: EntityKind
  via: EntityVia
  place?: string
}

function refsOf(item: ContentItem): Ref[] {
  const out: Ref[] = []
  const add = (name: string, kind: EntityKind, via: EntityVia, place?: string) => {
    const slug = entitySlug(name)
    if (slug) out.push({ name: cleanEntityName(name), slug, kind, via, place })
  }

  for (const e of item.entities ?? []) {
    const slug = e.slug || entitySlug(e.name)
    if (slug) out.push({ name: e.name, slug, kind: e.kind, via: e.relation === 'mention' ? 'mencion' : 'ficha', place: e.address })
  }

  if (item.type === 'evento') {
    for (const billing of item.artists ?? []) for (const n of splitBilling(billing)) add(n, 'artist', 'lineup')
    if (item.venue && !PLACEHOLDER_VENUE.test(item.venue)) add(item.venue, 'venue', 'sede', item.venueCity)
  }

  if (item.type === 'mix') {
    if (item.author) for (const n of splitBilling(item.author)) add(n, 'artist', 'autor')
    for (const t of item.tracklist ?? []) for (const n of splitBilling(t.artist)) add(n, 'artist', 'tracklist')
  }

  for (const b of item.articleBody ?? []) {
    if (b.kind === 'track') for (const n of splitBilling(b.artist)) add(n, 'artist', 'lista')
  }
  return out
}

function mostFrequent<K>(counts: Map<K, number>): K {
  let best: K | undefined
  let n = -1
  for (const [k, c] of counts) {
    if (c > n) {
      best = k
      n = c
    }
  }
  return best as K
}

/** Every entity the pieces name, keyed by slug. */
export function collectEntities(items: ContentItem[]): Map<string, Entidad> {
  const acc = new Map<
    string,
    { names: Map<string, number>; kinds: Map<EntityKind, number>; place?: string; apar: Map<string, Aparicion> }
  >()
  for (const item of items) {
    if (item.type === 'franja') continue
    for (const r of refsOf(item)) {
      let a = acc.get(r.slug)
      if (!a) {
        a = { names: new Map(), kinds: new Map(), apar: new Map() }
        acc.set(r.slug, a)
      }
      a.names.set(r.name, (a.names.get(r.name) ?? 0) + 1)
      a.kinds.set(r.kind, (a.kinds.get(r.kind) ?? 0) + (r.via === 'ficha' ? 3 : 1))
      if (r.place && !a.place) a.place = r.place
      const prev = a.apar.get(item.id)
      if (!prev || VIA_STRENGTH[r.via] > VIA_STRENGTH[prev.via]) a.apar.set(item.id, { item, via: r.via })
    }
  }
  const out = new Map<string, Entidad>()
  for (const [slug, a] of acc) {
    out.set(slug, {
      slug,
      name: mostFrequent(a.names),
      kind: mostFrequent(a.kinds),
      place: a.place,
      apariciones: [...a.apar.values()],
    })
  }
  return out
}

export function findEntity(slug: string, items: ContentItem[]): Entidad | null {
  return collectEntities(items).get(slug) ?? null
}

/**
 * Pieces that name the entity in their headline or standfirst without
 * pointing at it structurally. Whole words only, and only for names long
 * enough not to collide with ordinary words.
 */
export function mencionesDe(ent: Entidad, items: ContentItem[]): Aparicion[] {
  const name = fold(ent.name).trim()
  if (name.replace(/[^a-z0-9]/g, '').length < 5) return []
  const have = new Set(ent.apariciones.map((a) => a.item.id))
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`)
  return items
    .filter((i) => i.type !== 'franja' && !have.has(i.id))
    .filter((i) => re.test(fold([i.title, i.subtitle, i.excerpt].filter(Boolean).join(' · '))))
    .map((item) => ({ item, via: 'mencion' as const }))
}

/** Mean of the pieces' mid energies — the entity's own temperature. */
export function energiaMedia(items: ContentItem[]): number {
  if (!items.length) return 5
  let sum = 0
  for (const i of items) {
    const b = effectiveBand(i)
    sum += (b.min + b.max) / 2
  }
  return sum / items.length
}

/** A franja with the same slug (a venue that is also a station on the dial). */
export function franjaHermana(slug: string, items: ContentItem[]): ContentItem | null {
  return items.find((i) => i.type === 'franja' && i.slug === slug) ?? null
}
