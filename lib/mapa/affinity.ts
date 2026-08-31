// Spatial Identity Canvas — deterministic metadata affinity.
// Affinity chooses NEIGHBORS (adjacency), never prominence. Inputs are only
// structured metadata already on ContentItem — no behavioral signal, no
// personalization (see wiki/90-Decisions/No Algorithm.md). Weights are global
// editorial configuration, not learned.
//
// Signals used (spec § Affinity placement):
//   franja attribution · creator · entities · artists · venue · city ·
//   genres (exact + shared-root rollup) · curated tags · date proximity.
// Content type is NOT a positive input; the repeated-type penalty lives in
// the placement scorer (lib/mapa/layout.ts), not here.

import { parseISO } from 'date-fns'
import type { ContentItem } from '@/lib/types'
import { getGenreById, getTagById } from '@/lib/genres'

// ── Weights (global editorial config) ────────────────────────────────────────

export const AFFINITY_WEIGHTS = {
  franja: 8, // same explicit franja attribution — the cluster-forming signal
  entityEach: 4,
  entityCap: 8,
  artistEach: 3,
  artistCap: 6,
  venue: 3,
  city: 0.5,
  genreExactEach: 2,
  genreExactCap: 4,
  genreRootEach: 0.75,
  genreRootCap: 1.5,
  tagEach: 1,
  tagCap: 2,
  creator: 2,
  timeMax: 1, // decayed by e^(-Δdays/30)
} as const

const TIME_DECAY_DAYS = 30

// ── Feature extraction ───────────────────────────────────────────────────────
//
// Precomputed once per item so pairwise scoring is set-intersection cheap.

export interface AffinityFeatures {
  id: string
  franjaId: string | null
  creatorId: string | null
  entityIds: ReadonlySet<string>
  artists: ReadonlySet<string>
  venue: string | null
  city: string | null
  genreIds: ReadonlySet<string>
  genreRoots: ReadonlySet<string>
  tags: ReadonlySet<string>
  dateMs: number
}

// Lowercase, trim, strip diacritics — scraped artist/venue strings vary in
// casing and accents ("Héctor Oaks" vs "hector oaks").
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// A genre id expands to its root parents (roots expand to themselves). Legacy
// ids are parented to roots in lib/genres.ts, so legacy↔leaf pairs of the same
// concept ("hard-techno" vs "techno-hard") meet at the root level even though
// their raw ids differ.
function genreRootsOf(ids: readonly string[]): Set<string> {
  const roots = new Set<string>()
  for (const id of ids) {
    const g = getGenreById(id)
    if (!g) continue // unresolvable ids (e.g. 'footwork') carry no signal
    if (g.parents.length === 0) roots.add(g.id)
    else for (const p of g.parents) roots.add(p)
  }
  return roots
}

// Tags filtered to the curated taxonomy. Provenance/off-taxonomy tags ('ra' on
// every scraped event, '2026', 'curaduria', …) would otherwise glue the whole
// scraper firehose into one cluster.
function curatedTags(ids: readonly string[]): Set<string> {
  const out = new Set<string>()
  for (const id of ids) {
    if (getTagById(id)) out.add(id)
  }
  return out
}

export function extractFeatures(item: ContentItem): AffinityFeatures {
  const genreIds = new Set(
    (item.genres ?? []).filter((id) => getGenreById(id) != null),
  )
  return {
    id: item.id,
    franjaId: item.franjaId ?? null,
    creatorId: item.createdById ?? null,
    entityIds: new Set((item.entities ?? []).map((e) => e.id)),
    artists: new Set((item.artists ?? []).map(normalizeName)),
    venue: item.venue ? normalizeName(item.venue) : null,
    city: item.venueCity ? normalizeName(item.venueCity) : null,
    genreIds,
    genreRoots: genreRootsOf(item.genres ?? []),
    tags: curatedTags(item.tags ?? []),
    dateMs: parseISO(item.date ?? item.publishedAt).getTime(),
  }
}

// ── Pairwise score ───────────────────────────────────────────────────────────

function intersectionSize(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let n = 0
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  for (const v of small) if (large.has(v)) n++
  return n
}

export function affinityScore(a: AffinityFeatures, b: AffinityFeatures): number {
  const W = AFFINITY_WEIGHTS
  let s = 0

  if (a.franjaId && a.franjaId === b.franjaId) s += W.franja
  if (a.creatorId && a.creatorId === b.creatorId) s += W.creator

  s += Math.min(W.entityCap, intersectionSize(a.entityIds, b.entityIds) * W.entityEach)
  s += Math.min(W.artistCap, intersectionSize(a.artists, b.artists) * W.artistEach)

  if (a.venue && a.venue === b.venue) s += W.venue
  else if (a.city && a.city === b.city) s += W.city

  s += Math.min(W.genreExactCap, intersectionSize(a.genreIds, b.genreIds) * W.genreExactEach)
  s += Math.min(W.genreRootCap, intersectionSize(a.genreRoots, b.genreRoots) * W.genreRootEach)
  s += Math.min(W.tagCap, intersectionSize(a.tags, b.tags) * W.tagEach)

  const deltaDays = Math.abs(a.dateMs - b.dateMs) / 86_400_000
  s += W.timeMax * Math.exp(-deltaDays / TIME_DECAY_DAYS)

  return s
}
