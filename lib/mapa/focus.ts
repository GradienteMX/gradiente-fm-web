// Spatial Identity Canvas — franja focus reflow.
// Entering a franja focus rearranges the honeycomb: the franja's items
// gather into ONE compact self-contained cluster around a central identity
// hex (mockup: the CLUB JAPAN nucleus), placed in type-ordered arcs so the
// archive reads neatly by content type. Neighboring non-member terrain that
// would collide with the expanded cluster glides outward; everything else
// stays put, so the transition preserves the "same place" feel.
//
// Movement is TRANSLATION-ONLY: every item keeps its exact polyhex shape and
// orientation, so cells stay recognizable through the reflow animation (spec
// § zoom continuity). All pure and deterministic — same layout + cluster in,
// identical arrangement out.

import {
  HEX_DIRS,
  axialAdd,
  cellKey,
  cellsBBox,
  hexDistance,
  hexToPixel,
  pixelToHex,
  type Axial,
} from './hex'
import { outlinePath } from './polyhex'
import { HEX_GAP, HEX_R, type MapaLayout, type FranjaCluster } from './layout'
import {
  affinityScore,
  extractFeatures,
  type AffinityFeatures,
} from './affinity'
import type { ContentType, MarketplaceListing } from '@/lib/types'

// Exterior reassembly: how many of the most-affine non-member items gather
// into the relevance belt around the focused cluster, and the minimum
// pairwise affinity that counts as "related" (the time-proximity term alone
// tops out at 1, so 2 requires real shared metadata).
const RELATED_MAX = 18
const RELATED_MIN_AFFINITY = 2

// Neat type ordering for the focus cluster (mockup reading order). Placement
// walks this order, so same-type items land adjacent as arcs — a tidy
// archive, not hard category districts: the cluster remains one shape.
export const FOCUS_TYPE_ORDER: readonly ContentType[] = [
  'evento',
  'mix',
  'review',
  'editorial',
  'opinion',
  'articulo',
  'listicle',
  'noticia',
  'franja',
]

export interface ListingPlacement {
  listing: MarketplaceListing
  cell: Axial
  /** Plane-px geometry, same conventions as PlacedItem. */
  box: { x: number; y: number; width: number; height: number }
  outline: string
}

export interface FocusArrangement {
  /** Per-item plane-px translation from its global position (movers only). */
  deltas: Record<string, { dx: number; dy: number }>
  /** Center of the identity nucleus (lens: the anchor seed cell). */
  identityCell: Axial
  /**
   * Every cell the identity chrome claims — a full 7-cell ROSETTE during
   * franja focus (2026-08-20, Iker's call: a single-hex nucleus was too
   * small to read or hit; the identity now carries the franja image at
   * dominant-slab scale). Empty for topic lenses (no identity chrome).
   */
  identityCells: Axial[]
  /** Identity rosette geometry for rendering. */
  identityBox: { x: number; y: number; width: number; height: number }
  identityOutline: string
  /**
   * Marketplace listings as focus-cluster content nodes (spec § Marketplace
   * behavior). They exist only in the focus state for now — global-terrain
   * listing nodes remain a later phase.
   */
  listings: ListingPlacement[]
  /**
   * The relevance belt: non-member items reassembled by affinity to ring the
   * focused cluster (most affine first). They keep full color while the rest
   * of the terrain dims — the exterior becomes an affinity gradient.
   */
  relatedIds: string[]
  /** Focus cluster bbox in plane px (identity + members) — camera target. */
  bbox: { x: number; y: number; width: number; height: number }
  /** Ring drawn just outside the cluster, plane-space path. */
  perimeter: string
  /** Layout with focus-state cell positions — keyboard nav during focus. */
  derived: MapaLayout
}

function centroidOf(cells: readonly Axial[]): { x: number; y: number } {
  let x = 0
  let y = 0
  for (const c of cells) {
    const p = hexToPixel(c, HEX_R)
    x += p.x
    y += p.y
  }
  return { x: x / cells.length, y: y / cells.length }
}

export function computeFocusArrangement(
  layout: MapaLayout,
  cluster: FranjaCluster,
  listings: readonly MarketplaceListing[] = [],
): FocusArrangement {
  // Identity nucleus at the cell nearest the global cluster's centroid — the
  // reflow gathers content around where the cluster already lived.
  return gatherArrangement(
    layout,
    cluster.itemIds,
    pixelToHex(centroidOf(cluster.cells), HEX_R),
    { nucleus: true, listings },
  )
}

// Topic lens (REAGRUPAR filters): the same gather/belt/displacement machinery
// as franja focus but WITHOUT an identity nucleus — a filter has no identity
// row, so the first matching item seeds the arrangement at the set's own
// centroid. Filters never rebuild the global map; they borrow the focus
// contract (translation-only, reversible, deterministic).
export function computeLensArrangement(
  layout: MapaLayout,
  memberItemIds: readonly string[],
): FocusArrangement {
  const memberSet = new Set(memberItemIds)
  const cells = layout.placed
    .filter((p) => memberSet.has(p.item.id))
    .flatMap((p) => p.cells)
  const anchor = cells.length
    ? pixelToHex(centroidOf(cells), HEX_R)
    : { q: 0, r: 0 }
  return gatherArrangement(layout, memberItemIds, anchor, {
    nucleus: false,
    listings: [],
  })
}

function gatherArrangement(
  layout: MapaLayout,
  memberItemIds: readonly string[],
  anchorCell: Axial,
  opts: { nucleus: boolean; listings: readonly MarketplaceListing[] },
): FocusArrangement {
  const listings = opts.listings
  const memberIds = new Set(memberItemIds)
  const members = layout.placed.filter((p) => memberIds.has(p.item.id))
  const nonMembers = layout.placed.filter((p) => !memberIds.has(p.item.id))
  const identityCell = anchorCell
  // Franja focus: the identity claims a full rosette (center + six
  // neighbors) so the franja reads at dominant-slab scale.
  const identityCells = opts.nucleus
    ? [identityCell, ...HEX_DIRS.map((d) => axialAdd(identityCell, d))]
    : []

  // ── 1. Gather members around the anchor, type-ordered ─────────────────────

  const ordered = [...members].sort((a, b) => {
    const ta = FOCUS_TYPE_ORDER.indexOf(a.item.type)
    const tb = FOCUS_TYPE_ORDER.indexOf(b.item.type)
    if (ta !== tb) return ta - tb
    if (a.size !== b.size) return b.size - a.size
    return a.item.id < b.item.id ? -1 : 1
  })

  const focusOwner = new Map<string, string>() // cellKey → itemId
  for (const c of identityCells) focusOwner.set(cellKey(c), '__identity__')
  const typeById = new Map(members.map((m) => [m.item.id, m.item.type]))
  const newCellsById = new Map<string, Axial[]>()
  const identityPx = hexToPixel(identityCell, HEX_R)

  for (const member of ordered) {
    // Shape relative to the item's first cell — translation-only.
    const base = member.cells[0]
    const shape = member.cells.map((c) => ({
      q: c.q - base.q,
      r: c.r - base.r,
    }))

    // No nucleus (topic lens): the first member seeds the arrangement
    // directly at the anchor cell.
    if (focusOwner.size === 0) {
      const cells = shape.map((o) => axialAdd(identityCell, o))
      newCellsById.set(member.item.id, cells)
      for (const c of cells) focusOwner.set(cellKey(c), member.item.id)
      continue
    }

    // Frontier of the focus cluster, deterministic order.
    const frontier = new Map<string, Axial>()
    for (const k of focusOwner.keys()) {
      const cell = { q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) }
      for (const d of HEX_DIRS) {
        const n = axialAdd(cell, d)
        const nk = cellKey(n)
        if (!focusOwner.has(nk) && !frontier.has(nk)) frontier.set(nk, n)
      }
    }
    const frontierCells = [...frontier.values()].sort((a, b) =>
      a.q !== b.q ? a.q - b.q : a.r - b.r,
    )

    let best: {
      cells: Axial[]
      score: number
      dist: number
      anchor: Axial
    } | null = null
    const tried = new Set<string>()
    for (const f of frontierCells) {
      for (const offset of shape) {
        const anchor = { q: f.q - offset.q, r: f.r - offset.r }
        const tk = `${anchor.q},${anchor.r}`
        if (tried.has(tk)) continue
        tried.add(tk)
        const cells = shape.map((o) => axialAdd(anchor, o))
        if (cells.some((c) => focusOwner.has(cellKey(c)))) continue

        const cellSet = new Set(cells.map(cellKey))
        let contactAny = 0
        let contactSameType = 0
        let distSum = 0
        for (const c of cells) {
          const px = hexToPixel(c, HEX_R)
          distSum += Math.hypot(px.x - identityPx.x, px.y - identityPx.y)
          for (const d of HEX_DIRS) {
            const nk = cellKey(axialAdd(c, d))
            if (cellSet.has(nk)) continue
            const owner = focusOwner.get(nk)
            if (!owner) continue
            contactAny++
            if (
              owner !== '__identity__' &&
              typeById.get(owner) === member.item.type
            ) {
              contactSameType++
            }
          }
        }
        const avgDist = distSum / cells.length / HEX_R
        const score = 3 * contactSameType + contactAny - 0.35 * avgDist
        const cand = { cells, score, dist: avgDist, anchor }
        if (
          !best ||
          cand.score > best.score ||
          (cand.score === best.score &&
            (cand.dist < best.dist ||
              (cand.dist === best.dist &&
                (cand.anchor.q < best.anchor.q ||
                  (cand.anchor.q === best.anchor.q &&
                    cand.anchor.r < best.anchor.r)))))
        ) {
          best = cand
        }
      }
    }
    // Frontier always offers a valid translation on an open plane.
    const cells = best!.cells
    newCellsById.set(member.item.id, cells)
    for (const c of cells) focusOwner.set(cellKey(c), member.item.id)
  }

  // ── 1b. Marketplace listings — one hex each, a MERCADO arc after content ──

  const listingPlacements: ListingPlacement[] = []
  const orderedListings = [...listings].sort((a, b) =>
    a.publishedAt !== b.publishedAt
      ? a.publishedAt > b.publishedAt
        ? -1
        : 1
      : a.id < b.id
        ? -1
        : 1,
  )
  for (const listing of orderedListings) {
    // Same frontier walk as members: prefer touching other listings (the
    // arc), then any cluster contact, then closeness to the nucleus.
    const frontier = new Map<string, Axial>()
    for (const k of focusOwner.keys()) {
      const cell = { q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) }
      for (const d of HEX_DIRS) {
        const n = axialAdd(cell, d)
        const nk = cellKey(n)
        if (!focusOwner.has(nk) && !frontier.has(nk)) frontier.set(nk, n)
      }
    }
    let best: { cell: Axial; score: number; dist: number } | null = null
    for (const f of [...frontier.values()].sort((a, b) =>
      a.q !== b.q ? a.q - b.q : a.r - b.r,
    )) {
      let contactAny = 0
      let contactListing = 0
      for (const d of HEX_DIRS) {
        const owner = focusOwner.get(cellKey(axialAdd(f, d)))
        if (!owner) continue
        contactAny++
        if (owner.startsWith('__listing__')) contactListing++
      }
      const px = hexToPixel(f, HEX_R)
      const dist = Math.hypot(px.x - identityPx.x, px.y - identityPx.y) / HEX_R
      const score = 3 * contactListing + contactAny - 0.35 * dist
      if (
        !best ||
        score > best.score ||
        (score === best.score &&
          (dist < best.dist ||
            (dist === best.dist &&
              (f.q < best.cell.q ||
                (f.q === best.cell.q && f.r < best.cell.r)))))
      ) {
        best = { cell: f, score, dist }
      }
    }
    if (!best) continue
    const cell = best.cell
    focusOwner.set(cellKey(cell), `__listing__:${listing.id}`)
    const box = cellsBBox([cell], HEX_R)
    listingPlacements.push({
      listing,
      cell,
      box,
      outline: outlinePath([cell], HEX_R, { x: box.x, y: box.y }, HEX_GAP),
    })
  }

  // ── 2. Reassemble the exterior: the relevance belt ────────────────────────

  // Reserve: the focus cells plus a one-ring buffer, so neighboring terrain
  // stays visible BEYOND the perimeter with clean grout around the cluster.
  const reserve = new Set<string>(focusOwner.keys())
  for (const k of [...focusOwner.keys()]) {
    const cell = { q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) }
    for (const d of HEX_DIRS) reserve.add(cellKey(axialAdd(cell, d)))
  }

  // Rank the exterior by affinity to the focused members — the belt gathers
  // the most related content just outside the buffer ring, preserving each
  // item's original bearing from the nucleus so it slides inward rather than
  // teleporting around the cluster.
  const memberFeatures = members.map((m) => extractFeatures(m.item))
  const affinityToFocus = (f: AffinityFeatures) => {
    let best = 0
    for (const mf of memberFeatures) {
      const s = affinityScore(f, mf)
      if (s > best) best = s
    }
    return best
  }
  const relatedRanked = nonMembers
    .map((p) => ({ p, score: affinityToFocus(extractFeatures(p.item)) }))
    .filter((r) => r.score >= RELATED_MIN_AFFINITY)
    .sort((a, b) =>
      a.score !== b.score
        ? b.score - a.score
        : a.p.item.id < b.p.item.id
          ? -1
          : 1,
    )
    .slice(0, RELATED_MAX)

  const relatedCellsById = new Map<string, Axial[]>()
  const ringOccupied = new Set<string>()
  const angleFrom = (px: { x: number; y: number }) =>
    Math.atan2(px.y - identityPx.y, px.x - identityPx.x)
  const circDiff = (a: number, b: number) => {
    const d = Math.abs(a - b) % (Math.PI * 2)
    return Math.min(d, Math.PI * 2 - d)
  }

  for (const { p } of relatedRanked) {
    const base = p.cells[0]
    const shape = p.cells.map((c) => ({ q: c.q - base.q, r: c.r - base.r }))
    const origAngle = angleFrom(centroidOf(p.cells))

    // Outer frontier: empty cells adjacent to the reserve or the belt so far.
    const boundary = new Set<string>([...reserve, ...ringOccupied])
    const frontier = new Map<string, Axial>()
    for (const k of boundary) {
      const cell = { q: Number(k.split(',')[0]), r: Number(k.split(',')[1]) }
      for (const d of HEX_DIRS) {
        const n = axialAdd(cell, d)
        const nk = cellKey(n)
        if (!boundary.has(nk) && !frontier.has(nk)) frontier.set(nk, n)
      }
    }
    const frontierCells = [...frontier.values()].sort((a, b) =>
      a.q !== b.q ? a.q - b.q : a.r - b.r,
    )

    let best: { cells: Axial[]; score: number; anchor: Axial } | null = null
    const tried = new Set<string>()
    for (const f of frontierCells) {
      for (const offset of shape) {
        const anchor = { q: f.q - offset.q, r: f.r - offset.r }
        const tk = `${anchor.q},${anchor.r}`
        if (tried.has(tk)) continue
        tried.add(tk)
        const cells = shape.map((o) => axialAdd(anchor, o))
        if (
          cells.some(
            (c) => reserve.has(cellKey(c)) || ringOccupied.has(cellKey(c)),
          )
        ) {
          continue
        }
        const centroid = centroidOf(cells)
        const angDiff = circDiff(angleFrom(centroid), origAngle)
        const dist =
          Math.hypot(centroid.x - identityPx.x, centroid.y - identityPx.y) /
          HEX_R
        const score = -2 * angDiff - 0.4 * dist
        if (
          !best ||
          score > best.score ||
          (score === best.score &&
            (anchor.q < best.anchor.q ||
              (anchor.q === best.anchor.q && anchor.r < best.anchor.r)))
        ) {
          best = { cells, score, anchor }
        }
      }
    }
    if (!best) continue
    relatedCellsById.set(p.item.id, best.cells)
    for (const c of best.cells) ringOccupied.add(cellKey(c))
  }

  // ── 3. Displace remaining static terrain that collides with focus + belt ──

  // Occupancy of everything that stays put: non-members that did NOT join
  // the belt. Member + belt global cells are vacated (they moved).
  const staticItems = nonMembers.filter((p) => !relatedCellsById.has(p.item.id))
  const occupied = new Map<string, string>()
  for (const p of staticItems) {
    for (const c of p.cells) occupied.set(cellKey(c), p.item.id)
  }
  const keepOut = new Set<string>([...reserve, ...ringOccupied])

  const displacedCells = new Map<string, Axial[]>()
  const collides = (p: (typeof nonMembers)[number]) =>
    (displacedCells.get(p.item.id) ?? p.cells).some((c) =>
      keepOut.has(cellKey(c)),
    )

  const conflicted = staticItems
    .filter(collides)
    .map((p) => {
      const centroid = centroidOf(p.cells)
      return {
        p,
        dist: Math.hypot(centroid.x - identityPx.x, centroid.y - identityPx.y),
        centroid,
      }
    })
    .sort((a, b) => (a.dist !== b.dist ? a.dist - b.dist : a.p.item.id < b.p.item.id ? -1 : 1))

  for (const { p, centroid } of conflicted) {
    // Push along the hex direction closest to "away from the nucleus".
    let vx = centroid.x - identityPx.x
    let vy = centroid.y - identityPx.y
    if (Math.hypot(vx, vy) < 1e-6) {
      vx = 1
      vy = 0
    }
    let bestDir = HEX_DIRS[0]
    let bestDot = -Infinity
    for (const d of HEX_DIRS) {
      const dp = hexToPixel(d, HEX_R)
      const dot = (dp.x * vx + dp.y * vy) / Math.hypot(dp.x, dp.y)
      if (dot > bestDot) {
        bestDot = dot
        bestDir = d
      }
    }
    // Vacate current cells while probing.
    for (const c of p.cells) occupied.delete(cellKey(c))
    let placedCells: Axial[] | null = null
    for (let j = 1; j <= 80; j++) {
      const cells = p.cells.map((c) => ({
        q: c.q + bestDir.q * j,
        r: c.r + bestDir.r * j,
      }))
      const free = cells.every((c) => {
        const k = cellKey(c)
        return !keepOut.has(k) && !occupied.has(k)
      })
      if (free) {
        placedCells = cells
        break
      }
    }
    if (placedCells) {
      displacedCells.set(p.item.id, placedCells)
      for (const c of placedCells) occupied.set(cellKey(c), p.item.id)
    } else {
      // Give up deterministically — restore original occupancy.
      for (const c of p.cells) occupied.set(cellKey(c), p.item.id)
    }
  }

  // ── 4. Assemble output ────────────────────────────────────────────────────

  const deltas: Record<string, { dx: number; dy: number }> = {}
  const derivedPlaced = layout.placed.map((p) => {
    const next =
      newCellsById.get(p.item.id) ??
      relatedCellsById.get(p.item.id) ??
      displacedCells.get(p.item.id)
    if (!next) return p
    const from = hexToPixel(p.cells[0], HEX_R)
    const to = hexToPixel(next[0], HEX_R)
    deltas[p.item.id] = { dx: to.x - from.x, dy: to.y - from.y }
    return { ...p, cells: next }
  })
  const derivedOwner: Record<string, string> = {}
  for (const p of derivedPlaced) {
    for (const c of p.cells) derivedOwner[cellKey(c)] = p.item.id
  }

  const focusCells = [
    ...identityCells,
    ...[...newCellsById.values()].flat(),
    ...listingPlacements.map((l) => l.cell),
  ]
  const identityGeomCells = identityCells.length ? identityCells : [identityCell]
  const identityBox = cellsBBox(identityGeomCells, HEX_R)

  return {
    deltas,
    identityCell,
    identityCells,
    identityBox,
    identityOutline: outlinePath(
      identityGeomCells,
      HEX_R,
      { x: identityBox.x, y: identityBox.y },
      HEX_GAP,
    ),
    listings: listingPlacements,
    relatedIds: relatedRanked
      .filter((r) => relatedCellsById.has(r.p.item.id))
      .map((r) => r.p.item.id),
    bbox: cellsBBox(focusCells, HEX_R),
    // Negative gap = outset: the ring sits just outside the slab grout.
    perimeter: outlinePath(focusCells, HEX_R, { x: 0, y: 0 }, -HEX_GAP * 1.6),
    derived: {
      placed: derivedPlaced,
      cellOwner: derivedOwner,
      bounds: layout.bounds,
    },
  }
}

// ── Global marketplace nodes ─────────────────────────────────────────────────
//
// Listings on the GLOBAL terrain, not just in focus (2026-08-20, Iker's
// review: filtering the map down to MERCADO showed nothing, because listing
// nodes only materialized during franja focus). Each marketplace-enabled
// clustered franja gets its listings placed as single-hex satellites on the
// FREE cells nearest its cluster — a BFS through the occupied terrain finds
// the closest coast, so the stable global layout is never displaced (rule 9
// holds; the interspersed center often has zero free neighbors). Nodes
// prefer to chain into a MERCADO arc. Pure + deterministic: clusters walk in
// slug order, listings in the canonical publishedAt-desc order, candidates
// tie-break by (q, r). Each node records the nearest member as its ANCHOR so
// view arrangements (continent drift, focus displacement) can carry it with
// its franja's mass.

const GLOBAL_LISTING_BFS_MAX = 40 // hex rings; safety bound, never hit in practice

export interface GlobalListingPlacement {
  placement: ListingPlacement
  franjaId: string
  franjaSlug: string
  currency: string
  /** Member item whose view-arrangement delta this node follows. */
  anchorItemId: string
}

export function placeGlobalListings(
  layout: MapaLayout,
  clusters: readonly FranjaCluster[],
): GlobalListingPlacement[] {
  const out: GlobalListingPlacement[] = []
  const occupied = new Set<string>(Object.keys(layout.cellOwner))

  for (const cluster of clusters) {
    // clusters arrive slug-sorted (franjaClusters contract)
    const p = cluster.franja
    if (!p.marketplaceEnabled) continue
    const listings = [...(p.marketplaceListings ?? [])].sort((a, b) =>
      a.publishedAt !== b.publishedAt
        ? a.publishedAt > b.publishedAt
          ? -1
          : 1
        : a.id < b.id
          ? -1
          : 1,
    )
    if (listings.length === 0) continue

    const clusterKeys = new Set(cluster.cells.map(cellKey))
    const centroid = centroidOf(cluster.cells)
    const ownCells: Axial[] = []
    const ownKeys = new Set<string>()

    for (const listing of listings) {
      // Multi-source BFS from the cluster (and the arc so far) through the
      // occupied terrain to the nearest FREE cells. All free cells at the
      // minimal depth (+1 ring of slack) are candidates.
      const visited = new Set<string>([...clusterKeys, ...ownKeys])
      let ring: Axial[] = [...cluster.cells, ...ownCells]
      const candidates: Axial[] = []
      let freeDepth = -1
      for (let depth = 1; depth <= GLOBAL_LISTING_BFS_MAX; depth++) {
        if (freeDepth >= 0 && depth > freeDepth + 1) break
        const next: Axial[] = []
        for (const cell of ring) {
          for (const d of HEX_DIRS) {
            const n = axialAdd(cell, d)
            const nk = cellKey(n)
            if (visited.has(nk)) continue
            visited.add(nk)
            next.push(n)
            if (!occupied.has(nk)) {
              if (freeDepth < 0) freeDepth = depth
              candidates.push(n)
            }
          }
        }
        ring = next
        if (ring.length === 0) break
      }
      if (candidates.length === 0) continue // landlocked beyond the bound

      let best: { cell: Axial; score: number; dist: number } | null = null
      for (const f of [...candidates].sort((a, b) =>
        a.q !== b.q ? a.q - b.q : a.r - b.r,
      )) {
        let contactCluster = 0
        let contactListing = 0
        for (const d of HEX_DIRS) {
          const nk = cellKey(axialAdd(f, d))
          if (clusterKeys.has(nk)) contactCluster++
          if (ownKeys.has(nk)) contactListing++
        }
        const px = hexToPixel(f, HEX_R)
        const dist = Math.hypot(px.x - centroid.x, px.y - centroid.y) / HEX_R
        const score = 3 * contactListing + contactCluster - 0.35 * dist
        if (
          !best ||
          score > best.score ||
          (score === best.score &&
            (dist < best.dist ||
              (dist === best.dist &&
                (f.q < best.cell.q ||
                  (f.q === best.cell.q && f.r < best.cell.r)))))
        ) {
          best = { cell: f, score, dist }
        }
      }
      const cell = best!.cell
      const ck = cellKey(cell)
      occupied.add(ck)
      ownCells.push(cell)
      ownKeys.add(ck)

      // Anchor: the member owning the nearest cluster cell.
      let anchorItemId = cluster.itemIds[0]
      let bestD = Infinity
      for (const c of cluster.cells) {
        const d = hexDistance(c, cell)
        if (d < bestD) {
          bestD = d
          anchorItemId = layout.cellOwner[cellKey(c)] ?? anchorItemId
        }
      }

      const box = cellsBBox([cell], HEX_R)
      out.push({
        placement: {
          listing,
          cell,
          box,
          outline: outlinePath([cell], HEX_R, { x: box.x, y: box.y }, HEX_GAP),
        },
        franjaId: p.id,
        franjaSlug: p.slug,
        currency: p.marketplaceCurrency ?? 'MXN',
        anchorItemId,
      })
    }
  }
  return out
}

// ── Affine franja ranking (focus carousel) ─────────────────────────────────
//
// From a focused franja, the other clustered identities ranked by how much
// their content resonates with the focused members — mean of the top-3
// cross-cluster pairwise affinities. Drives the obi's franja carousel:
// stepping ‹ › moves the focus to the next most-affine identity. Pure and
// deterministic; viewer behavior plays no part.
export interface RankedFranja {
  cluster: FranjaCluster
  score: number
}

export function rankRelatedFranjas(
  layout: MapaLayout,
  clusters: readonly FranjaCluster[],
  focused: FranjaCluster,
): RankedFranja[] {
  const byId = new Map(layout.placed.map((p) => [p.item.id, p.item]))
  const featuresOf = (c: FranjaCluster) =>
    c.itemIds
      .map((id) => byId.get(id))
      .filter((i) => i !== undefined)
      .map((i) => extractFeatures(i))
  const focusedFeatures = featuresOf(focused)

  return clusters
    .filter((c) => c.franja.id !== focused.franja.id)
    .map((cluster) => {
      const pair: number[] = []
      for (const of of featuresOf(cluster)) {
        for (const ff of focusedFeatures) pair.push(affinityScore(of, ff))
      }
      pair.sort((a, b) => b - a)
      const top = pair.slice(0, 3)
      const score = top.length
        ? top.reduce((s, v) => s + v, 0) / top.length
        : 0
      return { cluster, score }
    })
    .sort((a, b) =>
      a.score !== b.score
        ? b.score - a.score
        : a.cluster.franja.slug < b.cluster.franja.slug
          ? -1
          : 1,
    )
}
