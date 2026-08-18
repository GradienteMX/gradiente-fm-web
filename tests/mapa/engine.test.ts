// Spatial Identity Canvas — layout engine unit tests.
// Run: npm run test:mapa  (tsx --test — no extra dependencies; tsx resolves
// the @/ alias from tsconfig paths).
//
// Covers the four properties the prototype must guarantee:
//   1. deterministic placement (same dataset → same layout, input-order-free)
//   2. affinity scoring from structured metadata only
//   3. polyhex connectivity (templates + placed items)
//   4. exterior-edge detection (rim geometry)

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { ContentItem } from '@/lib/types'
import {
  HEX_DIRS,
  axialAdd,
  cellKey,
  hexCorners,
  hexDistance,
  hexToPixel,
  neighbors,
} from '@/lib/mapa/hex'
import {
  exteriorEdges,
  insetLoop,
  interiorEdges,
  isConnected,
  outlineLoops,
  outlinePath,
  templateVariants,
} from '@/lib/mapa/polyhex'
import {
  affinityScore,
  extractFeatures,
  normalizeName,
} from '@/lib/mapa/affinity'
import {
  compactLayout,
  neighborItemId,
  partnerClusters,
  placeItems,
  sizeTiers,
} from '@/lib/mapa/layout'

const NOW = new Date('2026-08-18T12:00:00Z')

// ── Fixtures ─────────────────────────────────────────────────────────────────

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

function makeDataset(): ContentItem[] {
  seq = 0
  const items: ContentItem[] = []
  // A partner-attributed cluster (explicit attribution, mirrors prod).
  for (let i = 0; i < 3; i++) {
    items.push(
      makeItem({
        type: 'evento',
        partnerId: 'pa-club-japan',
        venue: 'Club Japan',
        venueCity: 'CDMX',
        genres: ['hard-techno'],
        date: `2026-08-2${i}T22:00:00Z`,
        imageUrl: '/flyers/x.jpg',
      }),
    )
  }
  items.push(
    makeItem({
      type: 'mix',
      partnerId: 'pa-club-japan',
      genres: ['techno-hard'],
      imageUrl: '/flyers/x.jpg',
    }),
  )
  // Editorial content, distinct neighborhoods.
  items.push(
    makeItem({ type: 'editorial', editorial: true, genres: ['ambient'], author: 'A' }),
  )
  items.push(makeItem({ type: 'review', genres: ['ambient'], author: 'A' }))
  items.push(makeItem({ type: 'opinion', genres: ['house'] }))
  for (let i = 0; i < 12; i++) {
    items.push(
      makeItem({
        type: i % 2 ? 'evento' : 'noticia',
        genres: i % 3 ? ['house'] : ['dub-reggae'],
        venue: i % 2 ? `Venue ${i}` : undefined,
        date: i % 2 ? '2026-08-25T22:00:00Z' : undefined,
        publishedAt: `2026-0${(i % 6) + 1}-05T12:00:00Z`,
      }),
    )
  }
  return items
}

// The partner row itself (never terrain).
const PARTNER_ROW = makeItem({
  id: 'pa-club-japan',
  slug: 'club-japan',
  type: 'partner',
  title: 'Club Japan',
  partnerKind: 'venue',
})

// ── hex geometry ─────────────────────────────────────────────────────────────

describe('hex', () => {
  it('six neighbors at distance 1', () => {
    const c = { q: 2, r: -1 }
    const ns = neighbors(c)
    assert.equal(ns.length, 6)
    for (const n of ns) assert.equal(hexDistance(c, n), 1)
    // All distinct.
    assert.equal(new Set(ns.map(cellKey)).size, 6)
  })

  it('edge i of a cell is geometrically shared with neighbor HEX_DIRS[i]', () => {
    const R = 100
    const cell = { q: 0, r: 0 }
    const corners = hexCorners(hexToPixel(cell, R), R)
    for (let i = 0; i < 6; i++) {
      const nb = axialAdd(cell, HEX_DIRS[i])
      const nbCorners = hexCorners(hexToPixel(nb, R), R)
      // The midpoint of edge i on `cell` must equal the midpoint of edge
      // (i+3)%6 on the neighbor (its opposite edge).
      const mid = {
        x: (corners[i].x + corners[(i + 1) % 6].x) / 2,
        y: (corners[i].y + corners[(i + 1) % 6].y) / 2,
      }
      const j = (i + 3) % 6
      const nbMid = {
        x: (nbCorners[j].x + nbCorners[(j + 1) % 6].x) / 2,
        y: (nbCorners[j].y + nbCorners[(j + 1) % 6].y) / 2,
      }
      assert.ok(Math.hypot(mid.x - nbMid.x, mid.y - nbMid.y) < 1e-6, `dir ${i}`)
    }
  })
})

// ── polyhex templates + exterior edges ───────────────────────────────────────

describe('polyhex', () => {
  it('all template variants are connected and correctly sized', () => {
    for (const size of [1, 3, 7] as const) {
      for (const variant of templateVariants(size)) {
        assert.equal(variant.length, size)
        assert.ok(isConnected(variant))
        // No duplicate cells inside a template.
        assert.equal(new Set(variant.map(cellKey)).size, size)
      }
    }
  })

  it('exterior edge counts: single 6, trihex 12, rosette 18', () => {
    assert.equal(exteriorEdges(templateVariants(1)[0]).length, 6)
    for (const tri of templateVariants(3)) {
      assert.equal(exteriorEdges(tri).length, 12)
    }
    assert.equal(exteriorEdges(templateVariants(7)[0]).length, 18)
  })

  it('interior edge counts: single 0, trihex 3, rosette 12', () => {
    assert.equal(interiorEdges(templateVariants(1)[0]).length, 0)
    for (const tri of templateVariants(3)) {
      assert.equal(interiorEdges(tri).length, 3)
    }
    assert.equal(interiorEdges(templateVariants(7)[0]).length, 12)
  })

  it('exterior + 2·interior = 6·cells (every edge accounted once)', () => {
    for (const size of [1, 3, 7] as const) {
      const cells = templateVariants(size)[0]
      assert.equal(
        exteriorEdges(cells).length + 2 * interiorEdges(cells).length,
        6 * cells.length,
      )
    }
  })

  it('inset outline shrinks a single hex by exactly the gap (apothem check)', () => {
    const R = 100
    const gap = 6
    const [loop] = outlineLoops(templateVariants(1)[0], R)
    assert.equal(loop.length, 6)
    const inset = insetLoop(loop, gap)
    // The apothem (center → edge midpoint distance) must shrink by gap.
    const apothem = (Math.sqrt(3) / 2) * R
    for (let i = 0; i < 6; i++) {
      const a = inset[i]
      const b = inset[(i + 1) % 6]
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const d = Math.hypot(mid.x, mid.y)
      assert.ok(Math.abs(d - (apothem - gap)) < 0.01, `edge ${i}: ${d}`)
    }
  })

  it('inset outline of a trihex keeps vertex count and pulls every edge inward', () => {
    const R = 100
    const gap = 6
    for (const tri of templateVariants(3)) {
      const [loop] = outlineLoops(tri, R)
      const inset = insetLoop(loop, gap)
      assert.equal(inset.length, loop.length)
      // Every inset vertex sits strictly inside the original loop's bbox.
      const xs = loop.map((p) => p.x)
      const ys = loop.map((p) => p.y)
      for (const p of inset) {
        assert.ok(p.x > Math.min(...xs) - 0.01 && p.x < Math.max(...xs) + 0.01)
        assert.ok(p.y > Math.min(...ys) - 0.01 && p.y < Math.max(...ys) + 0.01)
      }
    }
  })

  it('outline path closes into loops covering every exterior edge', () => {
    for (const size of [1, 3, 7] as const) {
      const cells = templateVariants(size)[0]
      const path = outlinePath(cells, 100)
      assert.ok(path.startsWith('M '))
      assert.ok(path.endsWith('Z'))
      // Each loop emits N-1 'L' commands plus an implied closing edge via
      // 'Z', so L-count + loop-count must equal the exterior edge count.
      const lCount = (path.match(/L /g) ?? []).length
      const loopCount = (path.match(/M /g) ?? []).length
      assert.equal(lCount + loopCount, exteriorEdges(cells).length)
    }
  })
})

// ── affinity ─────────────────────────────────────────────────────────────────

describe('affinity', () => {
  it('same explicit partner outranks unrelated content', () => {
    seq = 100
    const a = extractFeatures(makeItem({ partnerId: 'pa-x' }))
    const b = extractFeatures(makeItem({ partnerId: 'pa-x' }))
    const c = extractFeatures(makeItem({}))
    assert.ok(affinityScore(a, b) > affinityScore(a, c) + 5)
  })

  it('legacy and leaf ids of the same genre concept meet at the root', () => {
    seq = 200
    // 'hard-techno' is a legacy id, 'techno-hard' the taxonomy leaf — both
    // parented to the 'techno' root in lib/genres.ts.
    const legacy = extractFeatures(makeItem({ genres: ['hard-techno'] }))
    const leaf = extractFeatures(makeItem({ genres: ['techno-hard'] }))
    const unrelated = extractFeatures(makeItem({ genres: ['dub-reggae'] }))
    assert.ok(affinityScore(legacy, leaf) > affinityScore(legacy, unrelated))
  })

  it('provenance tags (ra) carry no signal', () => {
    seq = 300
    const a = extractFeatures(makeItem({ tags: ['ra'] }))
    const b = extractFeatures(makeItem({ tags: ['ra'] }))
    const c = extractFeatures(makeItem({ tags: [] }))
    assert.equal(affinityScore(a, b), affinityScore(a, c))
  })

  it('artist names match across casing and diacritics', () => {
    assert.equal(normalizeName('Héctor Oaks '), 'hector oaks')
    seq = 400
    const a = extractFeatures(makeItem({ artists: ['Héctor Oaks'] }))
    const b = extractFeatures(makeItem({ artists: ['hector oaks'] }))
    const c = extractFeatures(makeItem({ artists: ['Someone Else'] }))
    assert.ok(affinityScore(a, b) > affinityScore(a, c))
  })

  it('same venue outranks same city outranks neither', () => {
    seq = 500
    const a = extractFeatures(
      makeItem({ venue: 'Club Japan', venueCity: 'CDMX' }),
    )
    const sameVenue = extractFeatures(
      makeItem({ venue: 'club japan', venueCity: 'CDMX' }),
    )
    const sameCity = extractFeatures(
      makeItem({ venue: 'Otro Lugar', venueCity: 'CDMX' }),
    )
    const neither = extractFeatures(makeItem({}))
    assert.ok(affinityScore(a, sameVenue) > affinityScore(a, sameCity))
    assert.ok(affinityScore(a, sameCity) > affinityScore(a, neither))
  })
})

// ── deterministic placement ──────────────────────────────────────────────────

describe('placement', () => {
  it('same dataset → byte-identical layout', () => {
    const layoutA = placeItems(makeDataset(), NOW)
    const layoutB = placeItems(makeDataset(), NOW)
    assert.deepEqual(
      layoutA.placed.map((p) => ({ id: p.item.id, cells: p.cells, size: p.size })),
      layoutB.placed.map((p) => ({ id: p.item.id, cells: p.cells, size: p.size })),
    )
    assert.deepEqual(layoutA.cellOwner, layoutB.cellOwner)
  })

  it('input order does not matter', () => {
    const base = makeDataset()
    const reversed = [...base].reverse()
    // Deterministic interleave — no randomness in tests either.
    const shuffled = base.filter((_, i) => i % 2 === 0).concat(
      base.filter((_, i) => i % 2 === 1).reverse(),
    )
    const a = placeItems(base, NOW)
    const b = placeItems(reversed, NOW)
    const c = placeItems(shuffled, NOW)
    for (const other of [b, c]) {
      assert.deepEqual(a.cellOwner, other.cellOwner)
    }
  })

  it('every item placed exactly once, no cell owned twice, shapes connected', () => {
    const items = makeDataset()
    const layout = placeItems(items, NOW)
    assert.equal(layout.placed.length, items.length)
    const seen = new Set<string>()
    let totalCells = 0
    for (const p of layout.placed) {
      assert.ok([1, 3, 7].includes(p.size))
      assert.equal(p.cells.length, p.size)
      assert.ok(isConnected(p.cells), `${p.item.id} connected`)
      for (const c of p.cells) {
        const k = cellKey(c)
        assert.ok(!seen.has(k), `cell ${k} owned twice`)
        seen.add(k)
        totalCells++
      }
    }
    assert.equal(Object.keys(layout.cellOwner).length, totalCells)
  })

  it('terrain is a single connected mass (no floating islands)', () => {
    const layout = placeItems(makeDataset(), NOW)
    const allCells = layout.placed.flatMap((p) => p.cells)
    assert.ok(isConnected(allCells))
  })
})

// ── size tiers ───────────────────────────────────────────────────────────────

describe('sizeTiers', () => {
  it('caps dominant polyhexes and never gives a plain event 7 units', () => {
    seq = 600
    const items: ContentItem[] = []
    for (let i = 0; i < 8; i++) {
      items.push(
        makeItem({
          type: 'editorial',
          editorial: true,
          publishedAt: '2026-08-17T12:00:00Z',
        }),
      )
    }
    // A fresh plain event sits at its type peak — must still cap at 3.
    items.push(
      makeItem({
        type: 'evento',
        date: '2026-08-19T22:00:00Z',
        publishedAt: '2026-08-17T12:00:00Z',
      }),
    )
    const tiers = sizeTiers(items, NOW)
    const dominants = [...tiers.values()].filter((s) => s === 7).length
    assert.ok(dominants <= 4, `dominants ${dominants} <= 4`)
    const plainEvent = items[items.length - 1]
    assert.notEqual(tiers.get(plainEvent.id), 7)
  })
})

// ── partner clusters + keyboard navigation ───────────────────────────────────

describe('partner focus', () => {
  it('cluster contains exactly the explicitly attributed items', () => {
    const items = makeDataset()
    const layout = placeItems(items, NOW)
    const clusters = partnerClusters(layout, [PARTNER_ROW])
    assert.equal(clusters.length, 1)
    const cluster = clusters[0]
    const expected = items
      .filter((i) => i.partnerId === 'pa-club-japan')
      .map((i) => i.id)
      .sort()
    assert.deepEqual([...cluster.itemIds].sort(), expected)
    assert.ok(cluster.perimeter.length > 0)
  })

  it('attributed items form a contiguous cluster (affinity wins)', () => {
    const layout = placeItems(makeDataset(), NOW)
    const [cluster] = partnerClusters(layout, [PARTNER_ROW])
    assert.ok(isConnected(cluster.cells))
  })

  it('a partner with no attributed items gets no cluster', () => {
    const layout = placeItems(makeDataset(), NOW)
    seq = 700
    const emptyPartner = makeItem({ id: 'pa-empty', type: 'partner' })
    assert.equal(partnerClusters(layout, [emptyPartner]).length, 0)
  })

  it('neighborItemId walks to another item and never returns self', () => {
    const layout = placeItems(makeDataset(), NOW)
    const first = layout.placed[0]
    let found = 0
    for (let dir = 0; dir < 6; dir++) {
      const n = neighborItemId(layout, first.item.id, dir)
      if (n) {
        assert.notEqual(n, first.item.id)
        found++
      }
    }
    // The most prominent item sits mid-terrain — it must have neighbors.
    assert.ok(found >= 3)
  })
})

describe('compaction', () => {
  it('is only defined for filtered views (null when nothing is hidden)', () => {
    const layout = placeItems(makeDataset(), NOW)
    assert.equal(compactLayout(layout, new Set()), null)
  })

  it('actually closes ranks: items move and the visible mass tightens', () => {
    const layout = placeItems(makeDataset(), NOW)
    const hiddenIds = new Set(
      layout.placed
        .filter((p) => p.item.type === 'evento')
        .map((p) => p.item.id),
    )
    const arr = compactLayout(layout, hiddenIds)!
    assert.ok(Object.keys(arr.deltas).length > 0, 'no movement at all')
    // Compactness metric: mean distance from the visible centroid shrinks.
    const spread = (placed: typeof layout.placed) => {
      const pts = placed
        .filter((p) => !hiddenIds.has(p.item.id))
        .map((p) => hexToPixel(p.cells[0], 110))
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
      return (
        pts.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / pts.length
      )
    }
    assert.ok(
      spread(arr.derived.placed) < spread(layout.placed),
      `spread did not shrink: ${spread(arr.derived.placed).toFixed(0)} vs ${spread(layout.placed).toFixed(0)}`,
    )
  })

  it('closes gaps deterministically, preserving shapes and connectivity', () => {
    const items = makeDataset()
    const layout = placeItems(items, NOW)
    const hiddenIds = new Set(
      layout.placed
        .filter((p) => p.item.type === 'evento')
        .map((p) => p.item.id),
    )
    assert.ok(hiddenIds.size > 3)
    const a = compactLayout(layout, hiddenIds)!
    const b = compactLayout(placeItems(makeDataset(), NOW), hiddenIds)!
    assert.deepEqual(a.deltas, b.deltas)

    const seen = new Set<string>()
    const cells: { q: number; r: number }[] = []
    for (const p of a.derived.placed) {
      if (hiddenIds.has(p.item.id)) continue
      for (const c of p.cells) {
        const k = cellKey(c)
        assert.ok(!seen.has(k), `cell ${k} owned twice after compaction`)
        seen.add(k)
        cells.push(c)
      }
    }
    assert.ok(isConnected(cells), 'compacted terrain is one connected mass')

    const before = new Map(layout.placed.map((p) => [p.item.id, p.cells]))
    const shapeOf = (cs: readonly { q: number; r: number }[]) =>
      cs.map((c) => `${c.q - cs[0].q},${c.r - cs[0].r}`).join('|')
    for (const p of a.derived.placed) {
      if (hiddenIds.has(p.item.id)) continue
      assert.equal(shapeOf(p.cells), shapeOf(before.get(p.item.id)!), p.item.id)
    }
    // Hidden items never enter the compacted cell index.
    for (const id of Object.values(a.derived.cellOwner)) {
      assert.ok(!hiddenIds.has(id))
    }
  })
})
