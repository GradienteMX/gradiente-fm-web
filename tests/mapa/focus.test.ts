// Spatial Identity Canvas — franja focus reflow tests.
// Run: npm run test:mapa

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { ContentItem, MarketplaceListing } from '@/lib/types'
import {
  HEX_DIRS,
  axialAdd,
  cellKey,
  hexDistance,
  hexToPixel,
  pixelToHex,
} from '@/lib/mapa/hex'
import { isConnected } from '@/lib/mapa/polyhex'
import {
  HEX_R,
  identityBearing,
  franjaClusters,
  placeItems,
} from '@/lib/mapa/layout'
import {
  computeFocusArrangement,
  computeLensArrangement,
  placeGlobalListings,
  rankRelatedFranjas,
} from '@/lib/mapa/focus'

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

// Franja archive across many types + surrounding unrelated terrain.
function makeDataset(): ContentItem[] {
  seq = 0
  const items: ContentItem[] = []
  const memberTypes: ContentItem['type'][] = [
    'evento',
    'evento',
    'evento',
    'mix',
    'review',
    'review',
    'editorial',
    'noticia',
    'articulo',
    'listicle',
  ]
  for (const type of memberTypes) {
    items.push(
      makeItem({
        type,
        franjaId: 'pa-test',
        venue: type === 'evento' ? 'Test Club' : undefined,
        date: type === 'evento' ? '2026-08-22T22:00:00Z' : undefined,
        genres: ['hard-techno'],
      }),
    )
  }
  for (let i = 0; i < 18; i++) {
    items.push(
      makeItem({
        type: i % 3 === 0 ? 'evento' : i % 3 === 1 ? 'mix' : 'review',
        genres: i % 2 ? ['house'] : ['ambient'],
        date: i % 3 === 0 ? '2026-08-25T22:00:00Z' : undefined,
      }),
    )
  }
  // Related-but-unattributed exterior — same venue/genre as the members but
  // NO franjaId. Feeds the relevance belt during focus.
  for (let i = 0; i < 4; i++) {
    items.push(
      makeItem({
        type: 'evento',
        venue: 'Test Club',
        genres: ['hard-techno'],
        date: '2026-08-23T22:00:00Z',
      }),
    )
  }
  return items
}

const FRANJA_ROW = makeItem({
  id: 'pa-test',
  slug: 'test-franja',
  type: 'franja',
  title: 'Test Franja',
})

function build() {
  const items = makeDataset()
  const layout = placeItems(items, NOW)
  const [cluster] = franjaClusters(layout, [FRANJA_ROW])
  return { items, layout, cluster }
}

describe('global marketplace satellites', () => {
  const LISTINGS: MarketplaceListing[] = [
    {
      id: 'gmk-1',
      title: 'Global LP',
      category: 'vinyl',
      price: 500,
      condition: 'NEW',
      images: [],
      status: 'available',
      publishedAt: '2026-04-14T12:00:00',
    },
    {
      id: 'gmk-2',
      title: 'Global Deck',
      category: 'turntable',
      price: 9000,
      condition: 'VG+',
      images: [],
      status: 'available',
      publishedAt: '2026-04-10T12:00:00',
    },
    {
      id: 'gmk-3',
      title: 'Global Tee',
      category: 'merch',
      price: 300,
      condition: 'NEW',
      images: [],
      status: 'sold',
      publishedAt: '2026-04-05T12:00:00',
    },
  ]
  function buildWithMarketplace() {
    const items = makeDataset()
    const layout = placeItems(items, NOW)
    const row = {
      ...FRANJA_ROW,
      marketplaceEnabled: true,
      marketplaceListings: LISTINGS,
    }
    const clusters = franjaClusters(layout, [row])
    return { layout, clusters }
  }

  it('places every listing on a free cell, deterministically', () => {
    const a = buildWithMarketplace()
    const b = buildWithMarketplace()
    const ga = placeGlobalListings(a.layout, a.clusters)
    const gb = placeGlobalListings(b.layout, b.clusters)
    assert.equal(ga.length, LISTINGS.length)
    assert.deepEqual(
      ga.map((g) => ({ id: g.placement.listing.id, cell: g.placement.cell })),
      gb.map((g) => ({ id: g.placement.listing.id, cell: g.placement.cell })),
    )
    const seen = new Set<string>()
    for (const g of ga) {
      const k = cellKey(g.placement.cell)
      assert.ok(!a.layout.cellOwner[k], `${k} collides with terrain`)
      assert.ok(!seen.has(k), `${k} doubly-claimed by listings`)
      seen.add(k)
    }
  })

  it('keeps satellites near their cluster and anchored to real members', () => {
    const { layout, clusters } = buildWithMarketplace()
    const globals = placeGlobalListings(layout, clusters)
    const memberIds = new Set(clusters[0].itemIds)
    for (const g of globals) {
      let min = Infinity
      for (const c of clusters[0].cells) {
        const d = hexDistance(c, g.placement.cell)
        if (d < min) min = d
      }
      assert.ok(min <= 6, `satellite ${g.placement.listing.id} drifted ${min} hexes out`)
      assert.ok(memberIds.has(g.anchorItemId), 'anchor is a cluster member')
    }
  })

  it('skips franjas without marketplace', () => {
    const { layout } = buildWithMarketplace()
    const bare = franjaClusters(layout, [FRANJA_ROW])
    assert.equal(placeGlobalListings(layout, bare).length, 0)
  })
})

// ── Mindshare geography — identity bearings ─────────────────────────────────

function circularDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2)
  return Math.min(d, Math.PI * 2 - d)
}

function clusterAngle(cells: readonly { q: number; r: number }[]): number {
  let x = 0
  let y = 0
  for (const c of cells) {
    const p = hexToPixel(c, HEX_R)
    x += p.x
    y += p.y
  }
  return Math.atan2(y / cells.length, x / cells.length)
}

describe('identity bearings', () => {
  // Pick two identity ids whose hashed bearings genuinely oppose, so the
  // geographic assertion tests the mechanism rather than hash luck.
  const candidates = ['pa-a', 'pa-b', 'pa-c', 'pa-d', 'pa-e', 'pa-f', 'pa-g']
  let idA = candidates[0]
  let idB = candidates[1]
  for (const x of candidates) {
    for (const y of candidates) {
      if (
        circularDiff(identityBearing(x), identityBearing(y)) >
        circularDiff(identityBearing(idA), identityBearing(idB))
      ) {
        idA = x
        idB = y
      }
    }
  }

  function twoFranjaDataset(extraFiller: number): ContentItem[] {
    seq = 500
    const items: ContentItem[] = []
    for (let i = 0; i < 6; i++) {
      items.push(
        makeItem({
          type: i % 2 ? 'evento' : 'mix',
          franjaId: i % 2 ? idA : idB,
          genres: [i % 2 ? 'hard-techno' : 'ambient'],
          date: i % 2 ? '2026-08-22T22:00:00Z' : undefined,
        }),
      )
    }
    for (let i = 0; i < 14 + extraFiller; i++) {
      items.push(
        makeItem({
          type: 'noticia',
          genres: ['house'],
          publishedAt: `2026-0${(i % 6) + 1}-05T12:00:00Z`,
        }),
      )
    }
    return items
  }

  it('bearing depends only on the identity id', () => {
    assert.equal(identityBearing('pa-club-japan'), identityBearing('pa-club-japan'))
    assert.ok(circularDiff(identityBearing(idA), identityBearing(idB)) > 1.5)
  })

  it('two identities with opposing bearings grow clusters in different directions', () => {
    const layout = placeItems(twoFranjaDataset(0), NOW)
    const cellsA = layout.placed
      .filter((p) => p.item.franjaId === idA)
      .flatMap((p) => p.cells)
    const cellsB = layout.placed
      .filter((p) => p.item.franjaId === idB)
      .flatMap((p) => p.cells)
    const sep = circularDiff(clusterAngle(cellsA), clusterAngle(cellsB))
    assert.ok(sep > Math.PI / 4, `angular separation ${sep.toFixed(2)} rad`)
  })

  it('an identity keeps its direction when unrelated content is added', () => {
    const before = placeItems(twoFranjaDataset(0), NOW)
    const after = placeItems(twoFranjaDataset(10), NOW)
    for (const id of [idA, idB]) {
      const angleOf = (layout: typeof before) =>
        clusterAngle(
          layout.placed
            .filter((p) => p.item.franjaId === id)
            .flatMap((p) => p.cells),
        )
      const drift = circularDiff(angleOf(before), angleOf(after))
      assert.ok(drift < Math.PI / 3, `${id} drifted ${drift.toFixed(2)} rad`)
    }
  })
})

describe('pixelToHex', () => {
  it('inverts hexToPixel for a spread of cells', () => {
    for (let q = -6; q <= 6; q += 2) {
      for (let r = -6; r <= 6; r += 3) {
        const px = hexToPixel({ q, r }, HEX_R)
        assert.deepEqual(pixelToHex(px, HEX_R), { q, r })
      }
    }
  })
})

describe('focus reflow', () => {
  it('is deterministic', () => {
    const a = build()
    const b = build()
    const arrA = computeFocusArrangement(a.layout, a.cluster)
    const arrB = computeFocusArrangement(b.layout, b.cluster)
    assert.deepEqual(arrA.deltas, arrB.deltas)
    assert.deepEqual(arrA.identityCell, arrB.identityCell)
    assert.deepEqual(arrA.identityCells, arrB.identityCells)
    assert.deepEqual(arrA.derived.cellOwner, arrB.derived.cellOwner)
  })

  it('identity claims a full rosette centered on the nucleus cell', () => {
    const { layout, cluster } = build()
    const arr = computeFocusArrangement(layout, cluster)
    assert.equal(arr.identityCells.length, 7)
    assert.deepEqual(arr.identityCells[0], arr.identityCell)
    for (const d of HEX_DIRS) {
      const n = axialAdd(arr.identityCell, d)
      assert.ok(
        arr.identityCells.some((c) => c.q === n.q && c.r === n.r),
        `rosette missing neighbor ${cellKey(n)}`,
      )
    }
  })

  it('gathers all members into one contiguous cluster around the identity rosette', () => {
    const { layout, cluster } = build()
    const arr = computeFocusArrangement(layout, cluster)
    const memberIds = new Set(cluster.itemIds)
    const focusCells = [...arr.identityCells]
    for (const p of arr.derived.placed) {
      if (memberIds.has(p.item.id)) focusCells.push(...p.cells)
    }
    assert.ok(isConnected(focusCells), 'identity + members contiguous')
  })

  it('moves items by translation only — polyhex shapes preserved', () => {
    const { layout, cluster } = build()
    const arr = computeFocusArrangement(layout, cluster)
    const beforeById = new Map(layout.placed.map((p) => [p.item.id, p.cells]))
    for (const p of arr.derived.placed) {
      const before = beforeById.get(p.item.id)!
      assert.equal(p.cells.length, before.length)
      const shape = (cells: readonly { q: number; r: number }[]) =>
        cells
          .map((c) => `${c.q - cells[0].q},${c.r - cells[0].r}`)
          .sort()
          .join('|')
      assert.equal(shape(p.cells), shape(before), p.item.id)
    }
  })

  it('derived layout has no doubly-owned cells and covers every item', () => {
    const { layout, cluster } = build()
    const arr = computeFocusArrangement(layout, cluster)
    const seen = new Set<string>()
    let total = 0
    for (const p of arr.derived.placed) {
      for (const c of p.cells) {
        const k = cellKey(c)
        assert.ok(!seen.has(k), `cell ${k} owned twice`)
        seen.add(k)
        total++
      }
    }
    assert.equal(arr.derived.placed.length, layout.placed.length)
    assert.equal(Object.keys(arr.derived.cellOwner).length, total)
    // The identity rosette is chrome, never content-owned.
    for (const c of arr.identityCells) {
      assert.ok(!arr.derived.cellOwner[cellKey(c)])
    }
  })

  it('non-members end up fully outside the cluster + buffer ring', () => {
    const { layout, cluster } = build()
    const arr = computeFocusArrangement(layout, cluster)
    const memberIds = new Set(cluster.itemIds)
    const reserve = new Set<string>(arr.identityCells.map(cellKey))
    for (const p of arr.derived.placed) {
      if (memberIds.has(p.item.id)) {
        for (const c of p.cells) reserve.add(cellKey(c))
      }
    }
    for (const k of [...reserve]) {
      const [q, r] = k.split(',').map(Number)
      for (const d of HEX_DIRS) reserve.add(cellKey(axialAdd({ q, r }, d)))
    }
    for (const p of arr.derived.placed) {
      if (memberIds.has(p.item.id)) continue
      for (const c of p.cells) {
        assert.ok(
          !reserve.has(cellKey(c)),
          `${p.item.id} still inside the focus reserve`,
        )
      }
    }
  })

  it('marketplace listings join the cluster as single-hex nodes, no overlap', () => {
    const { layout, cluster } = build()
    const listings: MarketplaceListing[] = [
      {
        id: 'mk-1',
        title: 'Test LP',
        category: 'vinyl',
        price: 500,
        condition: 'NEW',
        images: [],
        status: 'available',
        publishedAt: '2026-04-14T12:00:00',
      },
      {
        id: 'mk-2',
        title: 'Test Tee',
        category: 'merch',
        price: 300,
        condition: 'NEW',
        images: [],
        status: 'sold',
        publishedAt: '2026-04-05T12:00:00',
      },
    ]
    const arr = computeFocusArrangement(layout, cluster, listings)
    assert.equal(arr.listings.length, 2)
    const memberIds = new Set(cluster.itemIds)
    const occupied = new Set<string>(arr.identityCells.map(cellKey))
    for (const p of arr.derived.placed) {
      if (memberIds.has(p.item.id)) {
        for (const c of p.cells) occupied.add(cellKey(c))
      }
    }
    const focusCells = [...occupied].map((k) => {
      const [q, r] = k.split(',').map(Number)
      return { q, r }
    })
    for (const lp of arr.listings) {
      assert.ok(!occupied.has(cellKey(lp.cell)), 'listing overlaps content')
      // Attached to the cluster: at least one neighbor is a focus cell.
      const touches = HEX_DIRS.some((d) =>
        occupied.has(cellKey(axialAdd(lp.cell, d))),
      )
      const touchesListing = arr.listings.some(
        (other) =>
          other !== lp &&
          HEX_DIRS.some((d) =>
            cellKey(axialAdd(lp.cell, d)) === cellKey(other.cell),
          ),
      )
      assert.ok(touches || touchesListing, 'listing detached from cluster')
      occupied.add(cellKey(lp.cell))
      focusCells.push(lp.cell)
    }
    assert.ok(isConnected(focusCells), 'cluster + listings contiguous')
  })

  it('the relevance belt gathers affine exterior content around the cluster', () => {
    const { items, layout, cluster } = build()
    const arr = computeFocusArrangement(layout, cluster)
    const expected = items
      .filter((i) => !i.franjaId && i.venue === 'Test Club')
      .map((i) => i.id)
    assert.ok(expected.length >= 4)
    for (const id of expected) {
      assert.ok(arr.relatedIds.includes(id), `${id} missing from belt`)
      assert.ok(id in arr.deltas, `${id} has no reflow delta entry`)
    }
    // Belt cells sit OUTSIDE the focus reserve (cluster + one-ring buffer)
    // but within a short walk of the cluster.
    const memberIds = new Set(cluster.itemIds)
    const focusCells = [...arr.identityCells]
    for (const p of arr.derived.placed) {
      if (memberIds.has(p.item.id)) focusCells.push(...p.cells)
    }
    const reserve = new Set(focusCells.map(cellKey))
    for (const k of [...reserve]) {
      const [q, r] = k.split(',').map(Number)
      for (const d of HEX_DIRS) reserve.add(cellKey(axialAdd({ q, r }, d)))
    }
    for (const id of arr.relatedIds) {
      const p = arr.derived.placed.find((pp) => pp.item.id === id)!
      for (const c of p.cells) {
        assert.ok(!reserve.has(cellKey(c)), `${id} inside the buffer ring`)
      }
      const near = p.cells.some((c) =>
        focusCells.some((f) => hexDistance(c, f) <= 4),
      )
      assert.ok(near, `${id} belt cell too far from the cluster`)
    }
  })

  it('unrelated exterior content stays out of the belt', () => {
    const { items, layout, cluster } = build()
    const arr = computeFocusArrangement(layout, cluster)
    const unrelated = items.filter(
      (i) =>
        !i.franjaId &&
        i.venue !== 'Test Club' &&
        i.type !== 'franja' &&
        (i.genres[0] === 'house' || i.genres[0] === 'ambient'),
    )
    assert.ok(unrelated.length > 0)
    for (const i of unrelated) {
      assert.ok(!arr.relatedIds.includes(i.id), `${i.id} wrongly in belt`)
    }
  })

  it('members with the same type sit adjacent to at least one same-type peer', () => {
    const { layout, cluster } = build()
    const arr = computeFocusArrangement(layout, cluster)
    const memberIds = new Set(cluster.itemIds)
    const typeById = new Map(
      arr.derived.placed.map((p) => [p.item.id, p.item.type]),
    )
    const owner = new Map<string, string>()
    for (const p of arr.derived.placed) {
      if (!memberIds.has(p.item.id)) continue
      for (const c of p.cells) owner.set(cellKey(c), p.item.id)
    }
    const typeCounts = new Map<string, number>()
    for (const id of memberIds) {
      const t = typeById.get(id)!
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
    }
    for (const p of arr.derived.placed) {
      if (!memberIds.has(p.item.id)) continue
      if ((typeCounts.get(p.item.type) ?? 0) < 2) continue
      let touchesSameType = false
      for (const c of p.cells) {
        for (const d of HEX_DIRS) {
          const n = owner.get(cellKey(axialAdd(c, d)))
          if (n && n !== p.item.id && typeById.get(n) === p.item.type) {
            touchesSameType = true
          }
        }
      }
      assert.ok(touchesSameType, `${p.item.id} (${p.item.type}) isolated from its type arc`)
    }
  })
})

describe('franja carousel ranking', () => {
  it('ranks affine franjas first', () => {
    seq = 800
    const items: ContentItem[] = []
    for (let i = 0; i < 3; i++) {
      items.push(
        makeItem({
          type: 'evento',
          franjaId: 'pa-aa',
          venue: 'Shared Venue',
          genres: ['hard-techno'],
          date: '2026-08-22T22:00:00Z',
        }),
      )
    }
    for (let i = 0; i < 2; i++) {
      items.push(
        makeItem({ type: 'mix', franjaId: 'pa-bb', genres: ['hard-techno'] }),
      )
    }
    for (let i = 0; i < 2; i++) {
      items.push(
        makeItem({
          type: 'noticia',
          franjaId: 'pa-cc',
          genres: ['dub-reggae'],
          publishedAt: '2026-01-01T12:00:00Z',
        }),
      )
    }
    for (let i = 0; i < 8; i++) {
      items.push(makeItem({ type: 'review', genres: ['house'] }))
    }
    const layout = placeItems(items, NOW)
    seq = 900
    const rows = ['pa-aa', 'pa-bb', 'pa-cc'].map((id) =>
      makeItem({ id, slug: id, type: 'franja', title: id.toUpperCase() }),
    )
    const clusters = franjaClusters(layout, rows)
    const focused = clusters.find((c) => c.franja.id === 'pa-aa')!
    const ranked = rankRelatedFranjas(layout, clusters, focused)
    assert.equal(ranked.length, 2)
    assert.equal(ranked[0].cluster.franja.id, 'pa-bb')
    assert.ok(ranked[0].score > ranked[1].score)
  })
})

describe('lens arrangement (topic regroup)', () => {
  it('gathers a topic set contiguously without an identity nucleus', () => {
    const { layout } = build()
    const memberIds = layout.placed
      .filter((p) => p.item.type === 'evento')
      .map((p) => p.item.id)
    assert.ok(memberIds.length > 3)
    const arr = computeLensArrangement(layout, memberIds)
    const set = new Set(memberIds)
    const cells = arr.derived.placed
      .filter((p) => set.has(p.item.id))
      .flatMap((p) => p.cells)
    assert.ok(isConnected(cells), 'topic set contiguous')
    // No identity chrome: the anchor cell is owned by a MEMBER item.
    const anchorOwner = arr.derived.cellOwner[cellKey(arr.identityCell)]
    assert.ok(anchorOwner && set.has(anchorOwner), 'anchor owned by a member')
    assert.equal(arr.listings.length, 0)
  })

  it('is deterministic', () => {
    const a = build()
    const b = build()
    const idsOf = (l: ReturnType<typeof build>) =>
      l.layout.placed
        .filter((p) => p.item.type === 'mix')
        .map((p) => p.item.id)
    const arrA = computeLensArrangement(a.layout, idsOf(a))
    const arrB = computeLensArrangement(b.layout, idsOf(b))
    assert.deepEqual(arrA.deltas, arrB.deltas)
    assert.deepEqual(arrA.derived.cellOwner, arrB.derived.cellOwner)
  })
})
