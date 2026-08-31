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

// ── Synthetic HL (beta posture) ──────────────────────────────────────────────
// The HP writer side is deferred (nothing inserts hp_events yet — see wiki
// Next Session §C), so real scores are nearly flat: prod terrain reads
// 366×1 / 11×3 / 4×7 — a field of single hexes. Until real signals flow,
// /mapa opts into a deterministic synthetic variation layer: id-hashed tier
// PROMOTIONS that give the terrain the mockups' mixed-slab texture.
// Contract (tested):
//   - pure function of item id → same layout for every viewer (rule 9)
//   - never demotes a tier the real score earned (real HL keeps precedence)
//   - plain (non-curated) eventos still never take a rosette (rule 2)
//   - archive-era items promote at half rate (the rim stays quieter than the
//     living center, so "center is now, rim is memory" survives the injection)
// Remove this layer when apply_hp_rollup() has real traffic feeding it.
const SYNTH_P7 = 0.055 // ≈5.5% of flat items promote toward a rosette
const SYNTH_P3 = 0.28 // next ≈28% promote to a trihex
const SYNTH_ARCHIVE_DAMP = 0.5 // archive-era promotion probability multiplier
const MAX_DOMINANT_SYNTH = 8 // higher cap while sizes are synthetic

// Uniform [0,1) from an item id — djb2 + avalanche, seeded differently from
// identityBearing so cell size never correlates with map direction.
function synthHash01(id: string): number {
  let h = 0x9e3779b9
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) | 0
  }
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

export interface SizeTierOptions {
  /** Inject deterministic synthetic HL variation (see block comment above). */
  syntheticHl?: boolean
}

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
// and stable across dataset changes (a franja is always "to the north-east").
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
  opts: SizeTierOptions = {},
): Map<string, PolyhexSize> {
  const peaks = computePeakByType([...items], now)
  const scored = items
    .map((item) => ({
      item,
      s: score(item, peaks, now),
      p: prominence(item, peaks, now),
    }))
    .sort((a, b) => (b.p !== a.p ? b.p - a.p : a.item.id < b.item.id ? -1 : 1))

  const maxDominant = opts.syntheticHl ? MAX_DOMINANT_SYNTH : MAX_DOMINANT
  const out = new Map<string, PolyhexSize>()
  let dominants = 0

  // Pass 1 — REAL tiers only, in prominence order (identical to the
  // synthetic-off assignment apart from the higher cap). Real dominants
  // claim their cap slots first: a synthetic promotion must never consume a
  // slot a real-earned dominant needs — a stale-but-still-peak item (score
  // 1.0, low prominence) walked AFTER fresh flat content would otherwise be
  // demoted by the flat items' synthetic rosettes (review find, 2026-08-18).
  for (const { item, s } of scored) {
    const curated = item.editorial || item.elevated
    const rosetteEligible = item.type !== 'evento' || curated
    if (s >= DOMINANT_THRESHOLD && dominants < maxDominant && rosetteEligible) {
      out.set(item.id, 7)
      dominants++
    } else if (s >= ELEVATED_THRESHOLD) {
      out.set(item.id, 3)
    } else {
      out.set(item.id, 1)
    }
  }

  // Pass 2 — synthetic promotions, only ever upward from a flat tier,
  // spending whatever dominant budget pass 1 left, walked in the same
  // prominence order so which candidates win a capped rosette slot stays
  // deterministic.
  if (opts.syntheticHl) {
    for (const { item } of scored) {
      if (out.get(item.id) !== 1) continue
      const damp = item.source === 'archive:wayback' ? SYNTH_ARCHIVE_DAMP : 1
      const t = synthHash01(item.id)
      if (t < SYNTH_P7 * damp) {
        const rosetteEligible =
          item.type !== 'evento' || item.editorial || item.elevated
        if (rosetteEligible && dominants < maxDominant) {
          out.set(item.id, 7)
          dominants++
        } else {
          out.set(item.id, 3)
        }
      } else if (t < (SYNTH_P7 + SYNTH_P3) * damp) {
        out.set(item.id, 3)
      }
    }
  }
  return out
}

// ── Placement ────────────────────────────────────────────────────────────────
//
// Packed-grid internals (2026-08-18 perf pass). The greedy walk burns nearly
// all of its time in cell-key handling: profiled at archive scale (2,400
// items) the candidate loop was 95% of a 4.7s run, dominated by ~27.6M string
// `cellKey` builds, Map/Set hash probes on those strings, and a string-keyed
// affinity memo whose lookup overhead cost ~3× the affinity computation it
// saved. Cells are therefore packed into integers on every hot path:
//
//   pack(q, r) = (q + 2048) · 4096 + (r + 2048)
//
// The packing is additive against raw deltas — pack(a) + delta(b) =
// pack(a + b) for delta(q, r) = q · 4096 + r — so template offsets and hex
// directions become plain integer adds. Numeric ascending order of packed
// keys equals the old (q, r) lexicographic frontier sort, so the walk order —
// and every float-accumulation order behind it — is unchanged: same dataset
// in, byte-identical layout out (golden-verified against the string-keyed
// implementation in both synthetic-HL modes).

const PACK_O = 2048
const PACK_M = 4096
const packCell = (q: number, r: number): number =>
  (q + PACK_O) * PACK_M + (r + PACK_O)
const packDelta = (q: number, r: number): number => q * PACK_M + r
const unpackQ = (k: number): number => Math.floor(k / PACK_M) - PACK_O
const unpackR = (k: number): number => (k % PACK_M) - PACK_O
const PACKED_DIRS = HEX_DIRS.map((d) => packDelta(d.q, d.r))

interface PackedVariant {
  offsets: readonly Axial[]
  deltas: number[]
}

function packVariants(size: PolyhexSize): PackedVariant[] {
  return templateVariants(size).map((v) => ({
    offsets: v,
    deltas: v.map((o) => packDelta(o.q, o.r)),
  }))
}

export function placeItems(
  items: readonly ContentItem[],
  now: Date,
  opts: SizeTierOptions = {},
): MapaLayout {
  const tiers = sizeTiers(items, now, opts)
  const peaks = computePeakByType([...items], now)

  // Placement order: prominence desc (big/alive first — they need room and
  // seed the neighborhood), stable id tie-break. Input order must not matter.
  // Decorated sort — prominence parses dates, so the comparator must not
  // recompute it O(n log n) times.
  const ordered = [...items]
    .map((item) => ({ item, p: prominence(item, peaks, now) }))
    .sort((a, b) =>
      a.p !== b.p ? b.p - a.p : a.item.id < b.item.id ? -1 : 1,
    )
    .map((d) => d.item)

  const n = ordered.length
  const features: AffinityFeatures[] = new Array(n)
  const types: (ContentItem['type'])[] = new Array(n)
  const anchors: ({ x: number; y: number } | null)[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const item = ordered[i]
    features[i] = extractFeatures(item)
    types[i] = item.type
    anchors[i] = item.franjaId ? identityAnchorPx(item.franjaId) : null
  }

  // Per-item affinity cache against already-placed neighbors, generation-
  // stamped so it resets for free between items. Values are identical to the
  // old global memo's — memoization never changed them.
  const affVal = new Float64Array(n)
  const affGen = new Int32Array(n)

  const variantsBySize = new Map<PolyhexSize, PackedVariant[]>([
    [1, packVariants(1)],
    [3, packVariants(3)],
    [7, packVariants(7)],
  ])

  const cellOwner = new Map<number, number>() // packed cell → item index
  // Frontier: empty cells adjacent to at least one occupied cell.
  const frontier = new Set<number>()

  const occupy = (packedCells: readonly number[], idx: number) => {
    for (const k of packedCells) {
      cellOwner.set(k, idx)
      frontier.delete(k)
    }
    for (const k of packedCells) {
      for (const d of PACKED_DIRS) {
        const nk = k + d
        if (!cellOwner.has(nk) && !frontier.has(nk)) frontier.add(nk)
      }
    }
  }

  const placed: PlacedItem[] = []
  const scratchAnchor: Axial = { q: 0, r: 0 }
  const candCells: number[] = []

  for (let i = 0; i < n; i++) {
    const item = ordered[i]
    const size = tiers.get(item.id)!
    const variants = variantsBySize.get(size)!
    const gen = i + 1
    const aPx = anchors[i]
    const myType = types[i]

    let bestScore = 0
    let bestDist = 0
    let bestAq = 0
    let bestAr = 0
    let bestVi = 0
    let bestCells: number[] | null = null

    if (cellOwner.size === 0) {
      const origin = packCell(0, 0)
      bestCells = variants[0].deltas.map((d) => origin + d)
    } else {
      // Frontier cells in deterministic (q, r)-ascending order — numeric
      // order of packed keys is exactly that.
      const frontierKeys = [...frontier].sort((a, b) => a - b)
      // Candidate anchors: every anchor whose template COVERS a frontier cell
      // (anchor = frontier − offset, per offset). Anchoring only ON frontier
      // cells would make rosettes unplaceable — a rosette centered next to
      // the terrain always overlaps it.
      const tried = new Set<number>()
      for (const f of frontierKeys) {
        for (let vi = 0; vi < variants.length; vi++) {
          const deltas = variants[vi].deltas
          for (const off of deltas) {
            const anchorKey = f - off
            const seenKey = anchorKey * 8 + vi
            if (tried.has(seenKey)) continue
            tried.add(seenKey)

            let valid = true
            candCells.length = 0
            for (const d of deltas) {
              const ck = anchorKey + d
              if (cellOwner.has(ck)) {
                valid = false
                break
              }
              candCells.push(ck)
            }
            if (!valid) continue

            // Score: walk every exterior contact edge of the candidate.
            // candCells is small (≤7) — linear membership beats a Set here.
            let s = 0
            let contact = 0
            for (const ck of candCells) {
              for (const pd of PACKED_DIRS) {
                const nk = ck + pd
                if (candCells.includes(nk)) continue
                const ownerIdx = cellOwner.get(nk)
                if (ownerIdx === undefined) continue
                contact++
                if (affGen[ownerIdx] !== gen) {
                  affGen[ownerIdx] = gen
                  affVal[ownerIdx] = affinityScore(
                    features[i],
                    features[ownerIdx],
                  )
                }
                s += W_AFFINITY * affVal[ownerIdx]
                if (types[ownerIdx] === myType) s -= W_TYPE_RUN
              }
            }
            if (contact === 0) continue // must attach to the terrain
            s += W_CONTACT * contact
            const aq = unpackQ(anchorKey)
            const ar = unpackR(anchorKey)
            scratchAnchor.q = aq
            scratchAnchor.r = ar
            const px = hexToPixel(scratchAnchor, HEX_R)
            const dist = Math.hypot(px.x, px.y)
            s -= W_RADIAL * (dist / HEX_R)
            // Identity gravity: attributed items drift toward their
            // identity's fixed bearing — the mindshare-section mechanism.
            if (aPx) {
              s -= W_ANCHOR * (Math.hypot(px.x - aPx.x, px.y - aPx.y) / HEX_R)
            }

            // Deterministic total order: score desc, dist asc, q, r, variant.
            if (
              bestCells === null ||
              s > bestScore ||
              (s === bestScore &&
                (dist < bestDist ||
                  (dist === bestDist &&
                    (aq < bestAq ||
                      (aq === bestAq &&
                        (ar < bestAr || (ar === bestAr && vi < bestVi)))))))
            ) {
              bestScore = s
              bestDist = dist
              bestAq = aq
              bestAr = ar
              bestVi = vi
              bestCells = candCells.slice()
            }
          }
        }
      }
    }

    // A valid candidate always exists (any template covering a frontier cell
    // from the open side fits) — but guard anyway: detach eastward of the
    // terrain, keeping the template's full size so cells.length === size.
    if (bestCells === null) {
      let maxQ = 0
      for (const k of cellOwner.keys()) {
        const q = unpackQ(k)
        if (q > maxQ) maxQ = q
      }
      bestAq = maxQ + 3
      bestAr = 0
      bestVi = 0
      const base = packCell(bestAq, bestAr)
      bestCells = variants[0].deltas.map((d) => base + d)
    }

    const cells = offsetTemplate(variants[bestVi].offsets, {
      q: bestAq,
      r: bestAr,
    })
    occupy(bestCells, i)
    const bbox = cellsBBox(cells, HEX_R)
    placed.push({
      item,
      size,
      cells,
      bbox,
      outline: outlinePath(cells, HEX_R, { x: bbox.x, y: bbox.y }, HEX_GAP),
    })
  }

  // String cell index for the output shape (overlays, keyboard nav) — built
  // once at the end, in placement order, same entries the old inline build
  // produced.
  const cellOwnerOut: Record<string, string> = {}
  for (const p of placed) {
    for (const c of p.cells) cellOwnerOut[cellKey(c)] = p.item.id
  }

  const allCells = placed.flatMap((p) => p.cells)
  return {
    placed,
    cellOwner: cellOwnerOut,
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

// ── Identity clusters (franja focus) ────────────────────────────────────────

export interface FranjaCluster {
  franja: ContentItem
  itemIds: string[]
  cells: Axial[]
  bbox: { x: number; y: number; width: number; height: number }
  /** Exterior boundary of the whole cluster, PLANE-space coordinates. */
  perimeter: string
}

// Focus eligibility is EXPLICIT attribution only: items.franjaId === franja
// id. Never inferred from venue strings, author strings, tags, or filenames
// (spec § Franja-focused content eligibility).
export function franjaClusters(
  layout: MapaLayout,
  franjas: readonly ContentItem[],
): FranjaCluster[] {
  const out: FranjaCluster[] = []
  for (const franja of franjas) {
    if (franja.type !== 'franja') continue
    const members = layout.placed.filter((p) => p.item.franjaId === franja.id)
    if (members.length === 0) continue
    const cells = members.flatMap((m) => m.cells)
    out.push({
      franja,
      itemIds: members.map((m) => m.item.id),
      cells,
      bbox: cellsBBox(cells, HEX_R),
      perimeter: outlinePath(cells, HEX_R), // plane-space (origin 0,0)
    })
  }
  // Deterministic order for chrome affordances.
  return out.sort((a, b) => (a.franja.slug < b.franja.slug ? -1 : 1))
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

  // Same packed-grid machinery as placeItems — this walk runs in the BROWSER
  // on every filter toggle, so the string-key overhead matters even more.
  const n = visible.length
  const features: AffinityFeatures[] = new Array(n)
  const types: (ContentItem['type'])[] = new Array(n)
  const anchors: ({ x: number; y: number } | null)[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const p = visible[i]
    features[i] = extractFeatures(p.item)
    types[i] = p.item.type
    anchors[i] = p.item.franjaId ? identityAnchorPx(p.item.franjaId) : null
  }
  const affVal = new Float64Array(n)
  const affGen = new Int32Array(n)

  const cellOwner = new Map<number, number>()
  const frontier = new Set<number>()
  const occupy = (packedCells: readonly number[], idx: number) => {
    for (const k of packedCells) {
      cellOwner.set(k, idx)
      frontier.delete(k)
    }
    for (const k of packedCells) {
      for (const d of PACKED_DIRS) {
        const nk = k + d
        if (!cellOwner.has(nk) && !frontier.has(nk)) frontier.add(nk)
      }
    }
  }

  const newCellsById = new Map<string, Axial[]>()
  const scratchAnchor: Axial = { q: 0, r: 0 }
  const candCells: number[] = []

  // Original array order IS the placement order (prominence-sorted).
  for (let i = 0; i < n; i++) {
    const p = visible[i]
    const base = p.cells[0]
    const shape = p.cells.map((c) => ({ q: c.q - base.q, r: c.r - base.r }))
    const deltas = shape.map((o) => packDelta(o.q, o.r))
    const gen = i + 1
    const aPx = anchors[i]
    const myType = types[i]

    if (cellOwner.size === 0) {
      // Seed stays exactly where the global layout put it — the compacted
      // terrain remains anchored to the same place on the plane.
      const cells = p.cells.map((c) => ({ q: c.q, r: c.r }))
      newCellsById.set(p.item.id, cells)
      occupy(cells.map((c) => packCell(c.q, c.r)), i)
      continue
    }

    const frontierKeys = [...frontier].sort((a, b) => a - b)
    let bestScore = 0
    let bestDist = 0
    let bestAq = 0
    let bestAr = 0
    let bestCells: number[] | null = null
    const tried = new Set<number>()
    for (const f of frontierKeys) {
      for (const off of deltas) {
        const anchorKey = f - off
        if (tried.has(anchorKey)) continue
        tried.add(anchorKey)

        let valid = true
        candCells.length = 0
        for (const d of deltas) {
          const ck = anchorKey + d
          if (cellOwner.has(ck)) {
            valid = false
            break
          }
          candCells.push(ck)
        }
        if (!valid) continue

        let s = 0
        let contact = 0
        for (const ck of candCells) {
          for (const pd of PACKED_DIRS) {
            const nk = ck + pd
            if (candCells.includes(nk)) continue
            const ownerIdx = cellOwner.get(nk)
            if (ownerIdx === undefined) continue
            contact++
            if (affGen[ownerIdx] !== gen) {
              affGen[ownerIdx] = gen
              affVal[ownerIdx] = affinityScore(features[i], features[ownerIdx])
            }
            s += W_AFFINITY * affVal[ownerIdx]
            if (types[ownerIdx] === myType) s -= W_TYPE_RUN
          }
        }
        if (contact === 0) continue
        s += W_CONTACT_COMPACT * contact
        const aq = unpackQ(anchorKey)
        const ar = unpackR(anchorKey)
        scratchAnchor.q = aq
        scratchAnchor.r = ar
        const px = hexToPixel(scratchAnchor, HEX_R)
        const dist = Math.hypot(px.x, px.y)
        s -= W_RADIAL_COMPACT * (dist / HEX_R)
        if (aPx) {
          s -= W_ANCHOR_COMPACT * (Math.hypot(px.x - aPx.x, px.y - aPx.y) / HEX_R)
        }

        if (
          bestCells === null ||
          s > bestScore ||
          (s === bestScore &&
            (dist < bestDist ||
              (dist === bestDist &&
                (aq < bestAq || (aq === bestAq && ar < bestAr)))))
        ) {
          bestScore = s
          bestDist = dist
          bestAq = aq
          bestAr = ar
          bestCells = candCells.slice()
        }
      }
    }
    const cells = bestCells
      ? shape.map((o) => ({ q: bestAq + o.q, r: bestAr + o.r }))
      : p.cells.map((c) => ({ q: c.q, r: c.r })) // deterministic fallback
    newCellsById.set(p.item.id, cells)
    occupy(
      bestCells ?? cells.map((c) => packCell(c.q, c.r)),
      i,
    )
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
