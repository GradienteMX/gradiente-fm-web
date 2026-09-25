import type { ContentItem } from '@/lib/types'
import { canonicalizeGenre, getGenreById } from '@/lib/genres'
import { effectiveBand } from '@/lib/vibe'

/** Walk a (possibly legacy) genre id up to its first root. */
export function rootOf(id: string): string {
  let g = getGenreById(canonicalizeGenre(id)) ?? getGenreById(id)
  let guard = 0
  while (g && g.parents.length && guard++ < 6) {
    const next = getGenreById(g.parents[0])
    if (!next) break
    g = next
  }
  return g?.id ?? id
}

/** Short display name for a root (first segment of "Dub / Reggae"). */
export function shortGenreName(id: string): string {
  const name = getGenreById(id)?.name ?? id
  return name.split(' / ')[0]
}

/**
 * Genres present in a set of pieces, rolled up to roots, placed at the mean
 * energy where they actually are in this feed — not where the stereotype
 * says (Vibe Philosophy, idea 2).
 */
export function presentGenres(items: ContentItem[]) {
  const acc = new Map<string, { sum: number; count: number }>()
  for (const it of items) {
    const b = effectiveBand(it)
    const mid = (b.min + b.max) / 2
    const roots = new Set(it.genres.map(rootOf))
    for (const r of roots) {
      const a = acc.get(r) ?? { sum: 0, count: 0 }
      a.sum += mid
      a.count += 1
      acc.set(r, a)
    }
  }
  return [...acc.entries()].map(([id, a]) => ({ id, energy: a.sum / a.count, count: a.count }))
}
