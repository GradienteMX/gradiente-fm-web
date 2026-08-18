// Spatial Identity Canvas — deterministic honeycomb placement.
// Pure functions: same (items, now) in → identical layout out, on server and
// client, for every viewer. No randomness, no behavioral input. Affinity
// chooses neighbors; HL (the HP scalar) chooses polyhex area; type chooses
// only the rim color (rendering concern, not a placement input beyond the
// repeated-type penalty).

import type { ContentItem } from '@/lib/types'
import { computePeakByType, prominence, score } from '@/lib/curation'
import {
  affinityScore,
  extractFeatures,
  type AffinityFeatures,
} from './affinity'
import {
  HEX_DIRS,
  axialAdd,
  cellKey,
  cellsBBox,
  hexToPixel,
  type Axial,
} from './hex'
import {
  offsetTemplate,
  outlinePath,
  templateVariants,
  type PolyhexSize,
} from './polyhex'

// ── Tunables (global, editorial — mirrors lib/curation.ts style) ─────────────

// HL→area tier boundaries reuse the existing curation thresholds (score is the
// same normalized-HP scalar cardLayout reads): ≥1.0 → dominant 7, ≥0.5 →
// elevated 3, below → standard 1. Deliberate migration per spec — no new score.
const DOMINANT_THRESHOLD = 1.0
const ELEVATED_THRESHOLD = 0.5

// Rank-aware cap, mirroring the home mosaic's xl+MAX_LG(3) = 4 big cells:
// without it every fresh text-heavy item clears 1.0 and the terrain becomes a
// field of rosettes. Excess dominants demote to elevated.
const MAX_DOMINANT = 4

// Placement scoring weights.
const W_AFFINITY = 1.0 // per adjacent edge, item-pair affinity
const W_TYPE_RUN = 1.25 // penalty per adjacent edge whose owner shares type
const W_CONTACT = 0.35 // compactness: reward touching more occupied edges
const W_RADIAL = 0.02 // gentle centripetal pull → round, hole-poor terrain

// Compaction (filtered views) packs hard: centripetal + contact dominate so
// the visible terrain closes ranks, while affinity keeps neighborhoods and
// W_ANCHOR keeps mindshare bearings. See compactLayout below.
const W_RADIAL_COMPACT = 1.1
const W_CONTACT_COMPACT = 0.7
const W_ANCHOR_COMPACT = 1.4 // identity gravity holds clusters together while packing

// Mindshare geography — identity gravity (see wiki/70-Roadmap/Mapa Placement
// Rules.md). Every identity with attributed content owns a FIXED BEARING on
// the map, derived only from its id, and its attributed items feel a pull
// toward an anchor point on that bearing. Regions emerge around anchors as
// content accumulates; the bearing never moves, so the geography is learnable
// and stable across dataset changes (a partner is always "to the north-east").
const W_ANCHOR = 0.55 // per hex of distance between candidate and anchor
const ANCHOR_RADIUS = 8 // anchor ring radius, in hexes from origin

// Deterministic bearing for an identity id (djb2 + murmur-style avalanche →
// angle). The finalizer matters: raw djb2 mod N gives near-identical bearings
// for ids differing only in the last character. Exported for tests and for
// any future legend/minimap chrome.
export function identityBearing(id: string): number {
  let h = 5381
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) | 0
  }
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)
  h ^= h >>> 15
  const t = ((h >>> 0) % 3600) / 3600
  return t * Math.PI * 2
}

export function identityAnchorPx(id: string): { x: number; y: number } {
  const a = identityBearing(id)
  return {
    x: Math.cos(a) * ANCHOR_RADIUS * HEX_R,
    y: Math.sin(a) * ANCHOR_RADIUS * HEX_R,
  }
}

// Layout-space circumradius of one hex, in plane px at zoom 1. Rendering
// consumes the same constant so geometry and DOM agree.
export const HEX_R = 110

// Grout between neighboring slabs: each polyhex boundary insets by this much,
// so adjacent items are separated by 2×HEX_GAP of dark terrain. Cells INSIDE
// one polyhex stay fused (seams only) — the gap separates items, not units.
export const HEX_GAP = 5

// ── Output shapes ────────────────────────────────────────────────────────────

export interface PlacedItem {
  item: ContentItem
  size: PolyhexSize
  cells: Axial[]
  /** Plane-space bbox of the polyhex (px, zoom 1). */
  bbox: { x: number; y: number; width: number; height: number }
  /**
   * SVG/CSS path of the exterior boundary, bbox-relative — rim + clip
   * source. A multi-unit item is ONE unbroken slab: no interior seams
   * (reverted 2026-08-18 — visible unit edges inside an item read as bugs).
   */
  outline: string
}

export interface MapaLayout {
  placed: PlacedItem[]
  /** cellKey → item id for every occupied cell. */
  cellOwner: Record<string, string>
  /** Plane-space bbox of the full terrain. */
  bounds: { x: number; y: number; width: number; height: number }
}

// ── HL → polyhex size ────────────────────────────────────────────────────────

// Exported for tests. Plain (non-editorial, non-elevated) events never take a
// dominant cell — same curator-intent rule the home mosaic applies, so the
// scraped firehose can't flood the terrain with rosettes on spawn HP alone.
export function sizeTiers(
  items: readonly ContentItem[],
  now: Date,
): Map<string, PolyhexSize> {
  const peaks = computePeakByType([...items], now)
  const scored = items
    .map((item) => ({
      item,
      s: score(item, peaks, now),
      p: prominence(item, peaks, now),
    }))
    .sort((a, b) => (b.p !== a.p ? b.p - a.p : a.item.id < b.item.id ? -1 : 1))

  const out = new Map<string, PolyhexSize>()
  let dominants = 0
  for (const { item, s } of scored) {
    const curated = item.editorial || item.elevated
    if (
      s >= DOMINANT_THRESHOLD &&
      dominants < MAX_DOMINANT &&
      (item.type !== 'evento' || curated)
    ) {
      out.set(item.id, 7)
      dominants++
    } else if (s >= ELEVATED_THRESHOLD) {
      out.set(item.id, 3)
    } else {
      out.set(item.id, 1)
    }
  }
  return out
}

// ── Placement ────────────────────────────────────────────────────────────────

interface Candidate {
  anchor: Axial
  variantIdx: number
  cells: Axial[]
  score: number
  dist: number
}

// Deterministic total order for candidate tie-breaks.
function candidateBefore(a: Candidate, b: Candidate): boolean {
  if (a.score !== b.score) return a.score > b.score
  if (a.dist !== b.dist) return a.dist < b.dist
  if (a.anchor.q !== b.anchor.q) return a.anchor.q < b.anchor.q
  if (a.anchor.r !== b.anchor.r) return a.anchor.r < b.anchor.r
  return a.variantIdx < b.variantIdx
}

export function placeItems(items: readonly ContentItem[], now: Date): MapaLayout {
  const tiers = sizeTiers(items, now)
  const peaks = computePeakByType([...items], now)

  // Placement order: prominence desc (big/alive first — they need room and
  // seed the neighborhood), stable id tie-break. Input order must not matter.
  const ordered = [...items].sort((a, b) => {
    const pa = prominence(a, peaks, now)
    const pb = prominence(b, peaks, now)
    if (pa !== pb) return pb - pa
    return a.id < b.id ? -1 : 1
  })

  const features = new Map<string, AffinityFeatures>()
  for (const item of ordered) features.set(item.id, extractFeatures(item))
  const itemsById = new Map(ordered.map((i) => [i.id, i]))

  // Pairwise affinity memo (order-independent key).
  const affMemo = new Map<string, number>()
  const affinity = (aId: string, bId: string): number => {
    const key = aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`
    const hit = affMemo.get(key)
    if (hit !== undefined) return hit
    const v = affinityScore(features.get(aId)!, features.get(bId)!)
    affMemo.set(key, v)
    return v
  }

  const cellOwner = new Map<string, string>()
  // Frontier: empty cells adjacent to at least one occupied cell. Kept sorted
  // lazily — we iterate it fully per item anyway.
  const frontier = new Map<string, Axial>()

  const occupy = (cells: readonly Axial[], id: string) => {
    for (const c of cells) {
      const k = cellKey(c)
      cellOwner.set(k, id)
      frontier.delete(k)
    }
    for (const c of cells) {
      for (const d of HEX_DIRS) {
        const n = axialAdd(c, d)
        const k = cellKey(n)
        if (!cellOwner.has(k) && !frontier.has(k)) frontier.set(k, n)
      }
    }
  }

  const placed: PlacedItem[] = []

  for (const item of ordered) {
    const size = tiers.get(item.id)!
    const variants = templateVariants(size)

    let best: Candidate | null = null

    if (cellOwner.size === 0) {
      best = {
        anchor: { q: 0, r: 0 },
        variantIdx: 0,
        cells: offsetTemplate(variants[0], { q: 0, r: 0 }),
        score: 0,
        dist: 0,
      }
    } else {
      // Frontier cells in deterministic order (insertion order of a Map is
      // already deterministic given deterministic inserts, but sort anyway so
      // the walk order is independent of bookkeeping details).
      const frontierCells = [...frontier.values()].sort((a, b) =>
        a.q !== b.q ? a.q - b.q : a.r - b.r,
      )
      // Candidate anchors: every anchor whose template COVERS a frontier cell
      // (anchor = frontier − offset, per offset). Anchoring only ON frontier
      // cells would make rosettes unplaceable — a rosette centered next to
      // the terrain always overlaps it.
      const tried = new Set<string>()
      for (const f of frontierCells) {
        for (let vi = 0; vi < variants.length; vi++) {
          for (const offset of variants[vi]) {
            const anchor = { q: f.q - offset.q, r: f.r - offset.r }
            const seenKey = `${anchor.q},${anchor.r}#${vi}`
            if (tried.has(seenKey)) continue
            tried.add(seenKey)
            const cells = offsetTemplate(variants[vi], anchor)
            let valid = true
            for (const c of cells) {
              if (cellOwner.has(cellKey(c))) {
                valid = false
                break
              }
            }
            if (!valid) continue

            // Score: walk every exterior contact edge of the candidate.
            const cellSet = new Set(cells.map(cellKey))
            let s = 0
            let contact = 0
            for (const c of cells) {
              for (const d of HEX_DIRS) {
                const n = axialAdd(c, d)
                const nk = cellKey(n)
                if (cellSet.has(nk)) continue
                const ownerId = cellOwner.get(nk)
                if (!ownerId) continue
                contact++
                s += W_AFFINITY * affinity(item.id, ownerId)
                if (itemsById.get(ownerId)!.type === item.type) s -= W_TYPE_RUN
              }
            }
            if (contact === 0) continue // must attach to the terrain
            s += W_CONTACT * contact
            const px = hexToPixel(anchor, HEX_R)
            const dist = Math.hypot(px.x, px.y)
            s -= W_RADIAL * (dist / HEX_R)
            // Identity gravity: attributed items drift toward their
            // identity's fixed bearing — the mindshare-section mechanism.
            if (item.partnerId) {
              const ap = identityAnchorPx(item.partnerId)
              s -= W_ANCHOR * (Math.hypot(px.x - ap.x, px.y - ap.y) / HEX_R)
            }

            const cand: Candidate = { anchor, variantIdx: vi, cells, score: s, dist }
            if (!best || candidateBefore(cand, best)) best = cand
          }
        }
      }
    }

    // A valid candidate always exists (any template covering a frontier cell
    // from the open side fits) — but guard anyway: detach eastward of the
    // terrain, keeping the template's full size so cells.length === size.
    if (!best) {
      let maxQ = 0
      for (const k of cellOwner.keys()) {
        const q = Number(k.split(',')[0])
        if (q > maxQ) maxQ = q
      }
      const anchor = { q: maxQ + 3, r: 0 }
      best = {
        anchor,
        variantIdx: 0,
        cells: offsetTemplate(variants[0], anchor),
        score: 0,
        dist: 0,
      }
    }

    occupy(best.cells, item.id)
    const bbox = cellsBBox(best.cells, HEX_R)
    placed.push({
      item,
      size,
      cells: best.cells,
      bbox,
      outline: outlinePath(best.cells, HEX_R, { x: bbox.x, y: bbox.y }, HEX_GAP),
    })
  }

  const allCells = placed.flatMap((p) => p.cells)
  return {
    placed,
    cellOwner: Object.fromEntries(cellOwner),
    bounds: allCells.length
      ? cellsBBox(allCells, HEX_R)
      : { x: 0, y: 0, width: 0, height: 0 },
  }
}

// ── Keyboard navigation ──────────────────────────────────────────────────────

// The neighboring ITEM in a logical hex direction: walk from the polyhex's
// leading cell in `dir` until a cell owned by another item (bounded scan so
// map edges terminate). Deterministic.
export function neighborItemId(
  layout: MapaLayout,
  fromItemId: string,
  dir: number,
  maxSteps = 60,
): string | null {
  const placedItem = layout.placed.find((p) => p.item.id === fromItemId)
  if (!placedItem) return null
  const d = HEX_DIRS[dir]
  // Leading cell: the member cell furthest along the direction vector.
  const dirPx = hexToPixel(d, HEX_R)
  let start = placedItem.cells[0]
  let bestDot = -Infinity
  for (const c of placedItem.cells) {
    const px = hexToPixel(c, HEX_R)
    const dot = px.x * dirPx.x + px.y * dirPx.y
    if (dot > bestDot) {
      bestDot = dot
      start = c
    }
  }
  let cursor = start
  for (let i = 0; i < maxSteps; i++) {
    cursor = axialAdd(cursor, d)
    const owner = layout.cellOwner[cellKey(cursor)]
    if (owner && owner !== fromItemId) return owner
  }
  return null
}

// ── Identity clusters (partner focus) ────────────────────────────────────────

export interface PartnerCluster {
  partner: ContentItem
  itemIds: string[]
  cells: Axial[]
  bbox: { x: number; y: number; width: number; height: number }
  /** Exterior boundary of the whole cluster, PLANE-space coordinates. */
  perimeter: string
}

// Focus eligibility is EXPLICIT attribution only: items.partnerId === partner
// id. Never inferred from venue strings, author strings, tags, or filenames
// (spec § Partner-focused content eligibility).
export function partnerClusters(
  layout: MapaLayout,
  partners: readonly ContentItem[],
): PartnerCluster[] {
  const out: PartnerCluster[] = []
  for (const partner of partners) {
    if (partner.type !== 'partner') continue
    const members = layout.placed.filter((p) => p.item.partnerId === partner.id)
    if (members.length === 0) continue
    const cells = members.flatMap((m) => m.cells)
    out.push({
      partner,
      itemIds: members.map((m) => m.item.id),
      cells,
      bbox: cellsBBox(cells, HEX_R),
      perimeter: outlinePath(cells, HEX_R), // plane-space (origin 0,0)
    })
  }
  // Deterministic order for chrome affordances.
  return out.sort((a, b) => (a.partner.slug < b.partner.slug ? -1 : 1))
}

// ── Compaction (visibility filters) ─────────────────────────────────────────
//
// When categories are toggled off, the remaining terrain re-tessellates:
// the same greedy walk (same order, same affinity + identity gravity) runs
// over only the visible items with shapes FROZEN, but with PACKING-DOMINANT
// weights — centripetal pull and contact boosted hard. Same-weights re-runs
// were measured to reproduce the original spots exactly (interspersion
// keeps visible content mutually adjacent, so affinity re-wins every
// original position and nothing closes); a filtered view is allowed to
// trade global stability for tightness, so here compactness leads while
// affinity still arranges who sits next to whom and bearings keep identity
// sections directional. Shapes frozen ⇒ translation-only glide. Only
// defined for filtered views: returns null when nothing is hidden.

export interface CompactArrangement {
  /** Per-item plane-px translation from global position (visible items). */
  deltas: Record<string, { dx: number; dy: number }>
  /** Layout with compacted cell positions — keyboard nav while filtered. */
  derived: MapaLayout
}

export function compactLayout(
  layout: MapaLayout,
  hiddenItemIds: ReadonlySet<string>,
): CompactArrangement | null {
  if (hiddenItemIds.size === 0) return null // only defined for filtered views
  const visible = layout.placed.filter((p) => !hiddenItemIds.has(p.item.id))
  if (visible.length === 0) return null

  const features = new Map(
    visible.map((p) => [p.item.id, extractFeatures(p.item)]),
  )
  const itemsById = new Map(visible.map((p) => [p.item.id, p.item]))
  const affMemo = new Map<string, number>()
  const affinity = (aId: string, bId: string): number => {
    const key = aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`
    const hit = affMemo.get(key)
    if (hit !== undefined) return hit
    const v = affinityScore(features.get(aId)!, features.get(bId)!)
    affMemo.set(key, v)
    return v
  }

  const cellOwner = new Map<string, string>()
  const frontier = new Map<string, Axial>()
  const occupy = (cells: readonly Axial[], id: string) => {
    for (const c of cells) {
      const k = cellKey(c)
      cellOwner.set(k, id)
      frontier.delete(k)
    }
    for (const c of cells) {
      for (const d of HEX_DIRS) {
        const n = axialAdd(c, d)
        const k = cellKey(n)
        if (!cellOwner.has(k) && !frontier.has(k)) frontier.set(k, n)
      }
    }
  }

  const newCellsById = new Map<string, Axial[]>()

  // Original array order IS the placement order (prominence-sorted).
  for (const p of visible) {
    const base = p.cells[0]
    const shape = p.cells.map((c) => ({ q: c.q - base.q, r: c.r - base.r }))

    if (cellOwner.size === 0) {
      // Seed stays exactly where the global layout put it — the compacted
      // terrain remains anchored to the same place on the plane.
      const cells = p.cells.map((c) => ({ q: c.q, r: c.r }))
      newCellsById.set(p.item.id, cells)
      occupy(cells, p.item.id)
      continue
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
        let valid = true
        for (const c of cells) {
          if (cellOwner.has(cellKey(c))) {
            valid = false
            break
          }
        }
        if (!valid) continue

        const cellSet = new Set(cells.map(cellKey))
        let s = 0
        let contact = 0
        for (const c of cells) {
          for (const d of HEX_DIRS) {
            const n = axialAdd(c, d)
            const nk = cellKey(n)
            if (cellSet.has(nk)) continue
            const ownerId = cellOwner.get(nk)
            if (!ownerId) continue
            contact++
            s += W_AFFINITY * affinity(p.item.id, ownerId)
            if (itemsById.get(ownerId)!.type === p.item.type) s -= W_TYPE_RUN
          }
        }
        if (contact === 0) continue
        s += W_CONTACT_COMPACT * contact
        const px = hexToPixel(anchor, HEX_R)
        const dist = Math.hypot(px.x, px.y)
        s -= W_RADIAL_COMPACT * (dist / HEX_R)
        if (p.item.partnerId) {
          const ap = identityAnchorPx(p.item.partnerId)
          s -= W_ANCHOR_COMPACT * (Math.hypot(px.x - ap.x, px.y - ap.y) / HEX_R)
        }

        const cand = { cells, score: s, dist, anchor }
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
    const cells = best
      ? best.cells
      : p.cells.map((c) => ({ q: c.q, r: c.r })) // deterministic fallback
    newCellsById.set(p.item.id, cells)
    occupy(cells, p.item.id)
  }

  const deltas: Record<string, { dx: number; dy: number }> = {}
  const derivedPlaced = layout.placed.map((p) => {
    const next = newCellsById.get(p.item.id)
    if (!next) return p
    const from = hexToPixel(p.cells[0], HEX_R)
    const to = hexToPixel(next[0], HEX_R)
    if (to.x !== from.x || to.y !== from.y) {
      deltas[p.item.id] = { dx: to.x - from.x, dy: to.y - from.y }
    }
    return { ...p, cells: next }
  })
  const derivedOwner: Record<string, string> = {}
  for (const p of derivedPlaced) {
    if (hiddenItemIds.has(p.item.id)) continue
    for (const c of p.cells) derivedOwner[cellKey(c)] = p.item.id
  }

  return {
    deltas,
    derived: {
      placed: derivedPlaced,
      cellOwner: derivedOwner,
      bounds: layout.bounds,
    },
  }
}
