// Spatial Identity Canvas — affinity continents (the AFINIDAD filter mode).
//
// Where the visibility column HIDES categories and compaction closes ranks,
// the affinity mode hides nothing: it reads the terrain's own affinity
// structure and lets it breathe. Contiguous high-affinity regions (adjacent
// items whose pairwise metadata affinity clears a floor) are detected as
// LANDMASSES; each landmass then drifts rigidly away from the terrain's
// center so ocean opens BETWEEN masses while every mass keeps its exact
// internal geography — the map separates into continents of mind.
//
// Contract (mirrors focus/compaction):
//   - translation-only: every item keeps its polyhex shape AND its exact
//     position relative to its continent neighbors (rigid-body drift)
//   - pure + deterministic: same layout in, identical arrangement out, for
//     every viewer — no behavioral input (No Algorithm holds)
//   - reversible: consumers drop the deltas to return to the global map
//   - nothing disappears: islets and singles drift too; they are simply not
//     ringed as continents

import {
  HEX_DIRS,
  cellKey,
  cellsBBox,
  hexToPixel,
  pixelToHex,
  type Axial,
} from './hex'
import { outlinePath } from './polyhex'
import { HEX_GAP, HEX_R, type MapaLayout } from './layout'
import { affinityScore, extractFeatures } from './affinity'

// ── Tunables (global editorial config, lib/curation.ts style) ────────────────

// Affinity floor for an ADJACENT pair to count as one landmass. 2 is the
// established "real shared metadata" line (focus belt) — the time-proximity
// term alone tops out at 1, so two items must actually share venue / artists /
// genres / franja / entities to fuse. The floor alone percolates, though:
// the dense center chains into one Pangaea (dev seed: a 150-item mass at
// t=2). The working threshold therefore ESCALATES from the floor until the
// largest mass holds at most CONTINENT_MAX_SHARE of the terrain — "great
// affinity" is read relative to the dataset, so the mode stays meaningful
// whether affinity leans genres (dev seed) or venue/artists/time (prod).
// Fully deterministic: the threshold is a pure function of the layout.
export const CONTINENT_AFFINITY_FLOOR = 2
export const CONTINENT_MAX_SHARE = 0.35
const ESCALATION_STEP = 1
const ESCALATION_MAX = 12

// Landmasses with at least this many ITEMS are "major areas" — they get the
// identifying perimeter ring. Smaller masses still drift (nothing is exempt
// from the separation), they just aren't ringed.
export const CONTINENT_MIN_ITEMS = 4

// How far each landmass drifts: its centroid offset from the terrain center
// scales by this factor. 1 = no movement.
export const CONTINENT_SPREAD = 1.5

// Minimum ocean between landmasses after the drift, in hex rings. The global
// map separates items by grout only; the affinity view guarantees visible
// water. Continents claim wider water than islets — uniform 2-ring oceans
// around every drifting single were measured to blow the terrain up ~3× in
// area (dev seed), which reads as emptiness, not structure.
export const CONTINENT_MIN_OCEAN = 2
export const ISLET_MIN_OCEAN = 1

// ── Output shape ─────────────────────────────────────────────────────────────

export interface Continent {
  /** Member item ids, sorted (stable identity for chrome/memoization). */
  itemIds: string[]
  /** Translated cells of the whole mass (plane grid). */
  cells: Axial[]
  /** Plane-space bbox of the translated mass. */
  bbox: { x: number; y: number; width: number; height: number }
  /** Identifying ring just outside the mass — plane-space path (origin 0,0). */
  perimeter: string
}

export interface ContinentArrangement {
  /** Per-item plane-px translation from global position (movers only). */
  deltas: Record<string, { dx: number; dy: number }>
  /** Major affinity areas (size ≥ CONTINENT_MIN_ITEMS), largest first. */
  continents: Continent[]
  /** Layout with drifted cell positions — keyboard nav while active. */
  derived: MapaLayout
  /** Expanded terrain bounds — camera fit/clamp while the mode is active. */
  bounds: { x: number; y: number; width: number; height: number }
}

// ── Packed-cell helpers (same packing as layout.ts, local to stay decoupled) ─

const PACK_O = 2048
const PACK_M = 4096
const packCell = (q: number, r: number): number =>
  (q + PACK_O) * PACK_M + (r + PACK_O)
const packDelta = (q: number, r: number): number => q * PACK_M + r
const PACKED_DIRS = HEX_DIRS.map((d) => packDelta(d.q, d.r))

function centroidPx(cells: readonly Axial[]): { x: number; y: number } {
  let x = 0
  let y = 0
  for (const c of cells) {
    const p = hexToPixel(c, HEX_R)
    x += p.x
    y += p.y
  }
  return { x: x / cells.length, y: y / cells.length }
}

// ── Arrangement ──────────────────────────────────────────────────────────────

export function computeContinentArrangement(
  layout: MapaLayout,
): ContinentArrangement | null {
  const placed = layout.placed
  const n = placed.length
  if (n < 2) return null

  // 1. Affinity graph over ADJACENT items: an edge exists where two polyhexes
  //    share a hex edge AND their metadata affinity clears the floor. The
  //    placement already made affinity choose neighbors, so contiguous
  //    high-affinity regions are exactly the map's own neighborhoods.
  const indexById = new Map<string, number>()
  for (let i = 0; i < n; i++) indexById.set(placed[i].item.id, i)
  const owner = new Map<number, number>() // packed cell → item index
  for (let i = 0; i < n; i++) {
    for (const c of placed[i].cells) owner.set(packCell(c.q, c.r), i)
  }
  const features = placed.map((p) => extractFeatures(p.item))

  // Unique adjacent edges with their affinity, in deterministic (placement,
  // cell, direction) walk order.
  const edges: { a: number; b: number; s: number }[] = []
  const edgeSeen = new Set<number>()
  for (let i = 0; i < n; i++) {
    for (const c of placed[i].cells) {
      const k = packCell(c.q, c.r)
      for (const d of PACKED_DIRS) {
        const j = owner.get(k + d)
        if (j === undefined || j === i) continue
        const a = Math.min(i, j)
        const b = Math.max(i, j)
        const key = a * n + b
        if (edgeSeen.has(key)) continue
        edgeSeen.add(key)
        edges.push({ a, b, s: affinityScore(features[a], features[b]) })
      }
    }
  }

  // Partition at a given threshold — union-find (path halving). Unions are
  // order-insensitive for the resulting partition, so this is deterministic.
  const partitionAt = (threshold: number): Map<number, number[]> => {
    const parent = new Int32Array(n)
    for (let i = 0; i < n; i++) parent[i] = i
    const find = (start: number): number => {
      let x = start
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]]
        x = parent[x]
      }
      return x
    }
    for (const e of edges) {
      if (e.s < threshold) continue
      const ra = find(e.a)
      const rb = find(e.b)
      if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb)
    }
    const byRoot = new Map<number, number[]>()
    for (let i = 0; i < n; i++) {
      const r = find(i)
      const list = byRoot.get(r)
      if (list) list.push(i)
      else byRoot.set(r, [i])
    }
    return byRoot
  }
  const largestShare = (parts: Map<number, number[]>): number => {
    let max = 0
    for (const m of parts.values()) if (m.length > max) max = m.length
    return max / n
  }
  const majorCount = (parts: Map<number, number[]>): number => {
    let count = 0
    for (const m of parts.values()) if (m.length >= CONTINENT_MIN_ITEMS) count++
    return count
  }

  // 2. Landmass partition. Escalate the threshold from the floor until the
  //    largest mass respects the share cap; if that over-fragments (no major
  //    areas left — sparse datasets), walk back down to the last threshold
  //    that still had one.
  const partitions: Map<number, number[]>[] = []
  let byRoot = partitionAt(CONTINENT_AFFINITY_FLOOR)
  partitions.push(byRoot)
  for (
    let t = CONTINENT_AFFINITY_FLOOR + ESCALATION_STEP;
    largestShare(byRoot) > CONTINENT_MAX_SHARE && t <= ESCALATION_MAX;
    t += ESCALATION_STEP
  ) {
    byRoot = partitionAt(t)
    partitions.push(byRoot)
  }
  while (majorCount(byRoot) === 0 && partitions.length > 1) {
    partitions.pop()
    byRoot = partitions[partitions.length - 1]
  }
  if (majorCount(byRoot) === 0) return null // no identifiable affinity areas
  if (byRoot.size < 2) return null // one connected mass — nothing to separate

  interface Mass {
    memberIdx: number[]
    cells: Axial[]
    cellCount: number
    minId: string
    centroid: { x: number; y: number }
  }
  const masses: Mass[] = [...byRoot.values()].map((memberIdx) => {
    const cells = memberIdx.flatMap((i) => placed[i].cells)
    let minId = placed[memberIdx[0]].item.id
    for (const i of memberIdx) {
      if (placed[i].item.id < minId) minId = placed[i].item.id
    }
    return {
      memberIdx,
      cells,
      cellCount: cells.length,
      minId,
      centroid: centroidPx(cells),
    }
  })
  masses.sort((a, b) =>
    a.cellCount !== b.cellCount
      ? b.cellCount - a.cellCount
      : a.minId < b.minId
        ? -1
        : 1,
  )

  const allCells = placed.flatMap((p) => p.cells)
  const center = centroidPx(allCells)

  // 3. Rigid drift + ocean repair. Each mass translates by the rounded axial
  //    delta of (centroid − center)·(SPREAD − 1); masses are then walked in
  //    order and pushed further along their own radial hex direction until no
  //    cell sits within CONTINENT_MIN_OCEAN rings of an already-placed mass.
  const occupiedDilated = new Set<number>()
  const settle = (packedCells: readonly number[], ocean: number) => {
    // BFS dilation by `ocean` rings — cells within that distance of a placed
    // mass are water no later mass may claim.
    let ring: number[] = [...packedCells]
    for (const k of ring) occupiedDilated.add(k)
    for (let depth = 0; depth < ocean; depth++) {
      const next: number[] = []
      for (const k of ring) {
        for (const d of PACKED_DIRS) {
          const nk = k + d
          if (!occupiedDilated.has(nk)) {
            occupiedDilated.add(nk)
            next.push(nk)
          }
        }
      }
      ring = next
    }
  }

  // Repair-search offsets by growing hex ring, deterministic (d, q, r) order.
  // Nearest-fit around the scaled target keeps the ocean tight and the
  // terrain round — a pure radial push was measured to stack crowded bearings
  // into long rays (dev seed: bounds height ×2).
  const REPAIR_MAX_RADIUS = 80
  const ringOffsets: Axial[][] = [[{ q: 0, r: 0 }]]
  const offsetsAt = (d: number): Axial[] => {
    for (let need = ringOffsets.length; need <= d; need++) {
      const ring: Axial[] = []
      for (let q = -need; q <= need; q++) {
        for (
          let r = Math.max(-need, -q - need);
          r <= Math.min(need, -q + need);
          r++
        ) {
          if ((Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2 === need) {
            ring.push({ q, r })
          }
        }
      }
      ringOffsets.push(ring)
    }
    return ringOffsets[d]
  }

  const shiftByMass = new Map<Mass, Axial>()
  for (const mass of masses) {
    const vx = (mass.centroid.x - center.x) * (CONTINENT_SPREAD - 1)
    const vy = (mass.centroid.y - center.y) * (CONTINENT_SPREAD - 1)
    const target = pixelToHex({ x: vx, y: vy }, HEX_R)

    const packedBase = mass.cells.map((c) => packCell(c.q, c.r))
    const fits = (s: Axial): boolean => {
      const pd = packDelta(s.q, s.r)
      for (const k of packedBase) {
        if (occupiedDilated.has(k + pd)) return false
      }
      return true
    }
    let shift = target
    search: for (let d = 0; d <= REPAIR_MAX_RADIUS; d++) {
      for (const o of offsetsAt(d)) {
        const cand = { q: target.q + o.q, r: target.r + o.r }
        if (fits(cand)) {
          shift = cand
          break search
        }
      }
    }
    shiftByMass.set(mass, shift)
    const pd = packDelta(shift.q, shift.r)
    settle(
      packedBase.map((k) => k + pd),
      mass.memberIdx.length >= CONTINENT_MIN_ITEMS
        ? CONTINENT_MIN_OCEAN
        : ISLET_MIN_OCEAN,
    )
  }

  // 4. Assemble: px deltas, drifted derived layout, continent chrome.
  const deltas: Record<string, { dx: number; dy: number }> = {}
  const newCellsById = new Map<string, Axial[]>()
  for (const mass of masses) {
    const s = shiftByMass.get(mass)!
    if (s.q === 0 && s.r === 0) continue
    const px = hexToPixel(s, HEX_R) // linear mapping: delta cells → delta px
    for (const i of mass.memberIdx) {
      const p = placed[i]
      deltas[p.item.id] = { dx: px.x, dy: px.y }
      newCellsById.set(
        p.item.id,
        p.cells.map((c) => ({ q: c.q + s.q, r: c.r + s.r })),
      )
    }
  }

  const derivedPlaced = placed.map((p) => {
    const next = newCellsById.get(p.item.id)
    return next ? { ...p, cells: next } : p
  })
  const derivedOwner: Record<string, string> = {}
  for (const p of derivedPlaced) {
    for (const c of p.cells) derivedOwner[cellKey(c)] = p.item.id
  }
  const derivedCells = derivedPlaced.flatMap((p) => p.cells)
  const bounds = cellsBBox(derivedCells, HEX_R)

  const continents: Continent[] = masses
    .filter((m) => m.memberIdx.length >= CONTINENT_MIN_ITEMS)
    .map((m) => {
      const s = shiftByMass.get(m)!
      const cells = m.cells.map((c) => ({ q: c.q + s.q, r: c.r + s.r }))
      return {
        itemIds: m.memberIdx.map((i) => placed[i].item.id).sort(),
        cells,
        bbox: cellsBBox(cells, HEX_R),
        // Negative gap = outset ring just outside the slab grout (same
        // convention as the focus perimeter).
        perimeter: outlinePath(cells, HEX_R, { x: 0, y: 0 }, -HEX_GAP * 1.6),
      }
    })

  return {
    deltas,
    continents,
    derived: {
      placed: derivedPlaced,
      cellOwner: derivedOwner,
      bounds,
    },
    bounds,
  }
}
