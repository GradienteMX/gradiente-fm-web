// Spatial Identity Canvas — affinity continents (AFINIDAD mode) tests.
// Run: npm run test:mapa

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { ContentItem } from '@/lib/types'
import { cellKey, hexDistance, hexToPixel } from '@/lib/mapa/hex'
import { HEX_R, placeItems } from '@/lib/mapa/layout'
import {
  CONTINENT_MIN_ITEMS,
  CONTINENT_MIN_OCEAN,
  ISLET_MIN_OCEAN,
  computeContinentArrangement,
} from '@/lib/mapa/continents'

const NOW = new Date('2026-08-18T12:00:00Z')

let seq = 0
function makeItem(overrides: Partial<ContentItem>): ContentItem {
  seq++
  return {
    id: `it-${String(seq).padStart(3, '0')}`,
    slug: `slug-${String(seq).padStart(3, '0')}`,
    type: 'noticia',
    title: `Item ${seq}`,
    vibeMin: 5,
    vibeMax: 5,
    genres: [],
    tags: [],
    publishedAt: '2026-08-10T12:00:00Z',
    ...overrides,
  }
}

// Three dense affinity communities bridged by a weak common genre (so the
// floor-level partition percolates into one mass and the threshold has to
// escalate), plus unrelated noise singles.
function makeDataset(): {
  items: ContentItem[]
  groupOf: Map<string, string>
} {
  seq = 0
  const items: ContentItem[] = []
  const groupOf = new Map<string, string>()
  const types: ContentItem['type'][] = ['evento', 'mix', 'review', 'noticia']
  const groups = [
    { name: 'alfa', venue: 'Salón Alfa', genre: 'salsa', n: 8 },
    { name: 'beta', venue: 'Club Beta', genre: 'hard-techno', n: 8 },
    { name: 'gama', venue: 'Foro Gama', genre: 'ambient', n: 6 },
  ]
  for (const g of groups) {
    for (let i = 0; i < g.n; i++) {
      const item = makeItem({
        type: types[i % types.length],
        venue: g.venue,
        // 'house' is the weak bridge every community shares.
        genres: [g.genre, 'house'],
        date: types[i % types.length] === 'evento' ? '2026-08-22T22:00:00Z' : undefined,
      })
      items.push(item)
      groupOf.set(item.id, g.name)
    }
  }
  const noiseGenres = ['dub-techno', 'ukg', 'idm', 'wave', 'downtempo']
  for (let i = 0; i < 10; i++) {
    const item = makeItem({
      type: types[i % types.length],
      genres: [noiseGenres[i % noiseGenres.length]],
      publishedAt: `2026-0${(i % 6) + 1}-05T12:00:00Z`,
    })
    items.push(item)
    groupOf.set(item.id, `noise-${i}`)
  }
  return { items, groupOf }
}

describe('computeContinentArrangement', () => {
  it('is deterministic', () => {
    const { items } = makeDataset()
    const layout = placeItems(items, NOW)
    const a = computeContinentArrangement(layout)
    const b = computeContinentArrangement(layout)
    assert.deepEqual(a, b)
  })

  it('separates the venue communities into distinct continents', () => {
    const { items, groupOf } = makeDataset()
    const layout = placeItems(items, NOW)
    const arr = computeContinentArrangement(layout)
    assert.ok(arr, 'arrangement should exist for a multi-community dataset')
    assert.ok(
      arr.continents.length >= 2,
      `expected ≥2 continents, got ${arr.continents.length}`,
    )
    for (const c of arr.continents) {
      assert.ok(c.itemIds.length >= CONTINENT_MIN_ITEMS)
      // A continent never mixes two dense communities: the escalated
      // threshold must cut the weak shared-genre bridges.
      const communities = new Set(
        c.itemIds
          .map((id) => groupOf.get(id)!)
          .filter((g) => !g.startsWith('noise')),
      )
      assert.ok(
        communities.size <= 1,
        `continent mixes communities: ${[...communities].join(', ')}`,
      )
    }
  })

  it('keeps every mass ocean-separated in the derived layout', () => {
    const { items } = makeDataset()
    const layout = placeItems(items, NOW)
    const arr = computeContinentArrangement(layout)
    assert.ok(arr)
    // No doubly-owned cells.
    const seen = new Set<string>()
    for (const p of arr.derived.placed) {
      for (const c of p.cells) {
        const k = cellKey(c)
        assert.ok(!seen.has(k), `cell ${k} owned twice`)
        seen.add(k)
      }
    }
    // Continents pairwise keep at least CONTINENT_MIN_OCEAN water hexes.
    for (let a = 0; a < arr.continents.length; a++) {
      for (let b = a + 1; b < arr.continents.length; b++) {
        let min = Infinity
        for (const ca of arr.continents[a].cells) {
          for (const cb of arr.continents[b].cells) {
            const d = hexDistance(ca, cb)
            if (d < min) min = d
          }
        }
        assert.ok(
          min > CONTINENT_MIN_OCEAN,
          `continents ${a},${b} gap ${min} ≤ ${CONTINENT_MIN_OCEAN}`,
        )
      }
    }
    // Every pair of distinct items from different masses keeps islet water.
    // (Same-mass items may touch — they are one landmass.)
    const massOf = new Map<string, number>()
    arr.continents.forEach((c, i) => c.itemIds.forEach((id) => massOf.set(id, i)))
    for (const p of arr.derived.placed) {
      for (const q of arr.derived.placed) {
        if (p.item.id >= q.item.id) continue
        const mp = massOf.get(p.item.id)
        const mq = massOf.get(q.item.id)
        if (mp !== undefined && mp === mq) continue
        // Items outside listed continents may still share an (unlisted)
        // islet mass — only assert when the pair moved differently, which
        // proves they belong to different masses.
        const dp = arr.deltas[p.item.id]
        const dq = arr.deltas[q.item.id]
        const same =
          (dp?.dx ?? 0) === (dq?.dx ?? 0) && (dp?.dy ?? 0) === (dq?.dy ?? 0)
        if (same && mp === undefined && mq === undefined) continue
        let min = Infinity
        for (const ca of p.cells) {
          for (const cb of q.cells) {
            const d = hexDistance(ca, cb)
            if (d < min) min = d
          }
        }
        assert.ok(
          min > ISLET_MIN_OCEAN,
          `${p.item.id} / ${q.item.id} gap ${min} ≤ ${ISLET_MIN_OCEAN}`,
        )
      }
    }
  })

  it('drifts rigidly: shapes and same-mass relative geometry are preserved', () => {
    const { items } = makeDataset()
    const layout = placeItems(items, NOW)
    const arr = computeContinentArrangement(layout)
    assert.ok(arr)
    const globalById = new Map(layout.placed.map((p) => [p.item.id, p]))
    for (const p of arr.derived.placed) {
      const g = globalById.get(p.item.id)!
      assert.equal(p.cells.length, g.cells.length)
      // Same shape: constant (dq, dr) across all cells.
      const dq = p.cells[0].q - g.cells[0].q
      const dr = p.cells[0].r - g.cells[0].r
      for (let i = 0; i < p.cells.length; i++) {
        assert.equal(p.cells[i].q - g.cells[i].q, dq)
        assert.equal(p.cells[i].r - g.cells[i].r, dr)
      }
      // The px delta matches the axial drift exactly.
      const d: { dx: number; dy: number } | undefined =
        arr.deltas[p.item.id]
      const px = hexToPixel({ q: dq, r: dr }, HEX_R)
      assert.equal(d?.dx ?? 0, px.x)
      assert.equal(d?.dy ?? 0, px.y)
    }
    // Same-continent items keep their exact relative geometry.
    for (const c of arr.continents) {
      const deltas: { dx: number; dy: number }[] = c.itemIds.map(
        (id) => arr.deltas[id] ?? { dx: 0, dy: 0 },
      )
      for (const d of deltas) {
        assert.equal(d.dx, deltas[0].dx)
        assert.equal(d.dy, deltas[0].dy)
      }
    }
  })

  it('expands the bounds and keeps every item on the map', () => {
    const { items } = makeDataset()
    const layout = placeItems(items, NOW)
    const arr = computeContinentArrangement(layout)
    assert.ok(arr)
    assert.equal(arr.derived.placed.length, layout.placed.length)
    assert.ok(
      arr.bounds.width * arr.bounds.height >=
        layout.bounds.width * layout.bounds.height,
    )
  })

  it('returns null when there is nothing to separate', () => {
    seq = 0
    // One dense community only — a single connected mass.
    const items = Array.from({ length: 6 }, () =>
      makeItem({ venue: 'Salón Alfa', genres: ['salsa'] }),
    )
    const layout = placeItems(items, NOW)
    assert.equal(computeContinentArrangement(layout), null)
  })
})
