/**
 * TERRITORIO — the terrain model.
 *
 * Pure data, no GL. The production layout engine (`lib/seed/mapa/*`) places
 * every piece; this module turns its output into what the GPU draws:
 *
 *   node  — one thing on the land: a pieza (its polyhex), a mercado listing
 *           (one hex) or, only while focused, a franja's identity rosette.
 *   cell  — one hex of a node. Each cell knows which of its six edges are
 *           EXTERIOR to its node (a 6-bit mask), so the shader prints the ink
 *           seam and the energy rim on the slab's outline only — a multi-hex
 *           piece stays one unbroken slab.
 *
 * Rules that hold here by construction:
 *   · franjas are never terrain (only the focused nucleus, which is chrome)
 *   · area comes from the engine's HL tiers; hue from the effective band
 *   · every node is a pure function of (dataset, now bucket) — no viewer input
 */

import type { ContentItem, ContentType, MarketplaceListing } from '@/lib/types'
import { HEX_DIRS, cellKey, hexToPixel, type Axial } from '@/lib/mapa/hex'
import { HEX_GAP, HEX_R, type CompactArrangement, type FranjaCluster, type MapaLayout } from '@/lib/mapa/layout'
import type { FocusArrangement, GlobalListingPlacement } from '@/lib/mapa/focus'
import type { ContinentArrangement } from '@/lib/mapa/continents'
import { computePeakByType, score } from '@/lib/curation'
import { HOME_PAST_GRACE_DAYS } from '@/lib/logic/time'
import { effectiveBand } from '@/lib/vibe'

export const R = HEX_R
export const GAP = HEX_GAP
export const APOTHEM = (Math.sqrt(3) / 2) * HEX_R

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export type NodeKind = 'pieza' | 'mercado' | 'franja'

export interface TerrainNode {
  /** Stable identity across rebuilds (item id, `mercado:…`, `franja:…`). */
  key: string
  kind: NodeKind
  item: ContentItem | null
  listing: MarketplaceListing | null
  /** Owner of a listing / the focused identity. */
  franja: ContentItem | null
  /** Cells at the node's home position (global layout, or focus space). */
  cells: Axial[]
  bbox: Box
  size: 1 | 3 | 7
  image: string | null
  band: [number, number]
  /** Normalized life (HL score within its type), 0..1.2 — ink density only. */
  life: number
  archive: boolean
  /** Satellites ride the reflow of the member they sit beside. */
  anchor: number
  /** Identity + focus listings exist only inside this franja's focus. */
  focusOf: string | null
  /** Global mercado satellites: the franja whose coast they sit on. */
  satelliteOf: string | null
}

export interface CellRec {
  node: number
  /** Cell center at the node's home position (plane px). */
  x: number
  y: number
  mask: number
  /** Cell center relative to the node bbox origin; bbox size. */
  lx: number
  ly: number
  w: number
  h: number
}

export interface TerrainModel {
  nodes: TerrainNode[]
  cells: CellRec[]
  byKey: Map<string, number>
  /** Plane bbox of the global layout. */
  bounds: Box
}

// ── rules ────────────────────────────────────────────────────────────────────

const DAY = 86_400_000
/** Writing older than this has settled into memory. */
export const ARCHIVE_TEXT_DAYS = 365

/**
 * Era. «Ahora» is what the living field still holds; «Archivo» is what has
 * settled out of it: an event past the home's grace window (the same 30
 * days the mosaic keeps a past night), writing older than a year, or the
 * reconstructed Archivo Vivo. Dates only — HL stays private.
 */
export function isArchive(item: ContentItem, nowMs: number): boolean {
  if (item.source === 'archive:wayback') return true
  if (item.type === 'evento') {
    // Same clock as the home (lib/logic/time): an event's own end, plus the
    // grace the mosaic gives a past night. expiresAt is not an event's clock.
    const end = Date.parse(item.endDate ?? item.date ?? item.publishedAt)
    return end < nowMs - HOME_PAST_GRACE_DAYS * DAY
  }
  if (item.expiresAt && Date.parse(item.expiresAt) < nowMs) return true
  return Date.parse(item.date ?? item.publishedAt) < nowMs - ARCHIVE_TEXT_DAYS * DAY
}

/** The land: every published piece with artwork. Franjas are never terrain. */
export function isTerrain(item: ContentItem): boolean {
  return item.type !== 'franja' && Boolean(item.imageUrl)
}

/**
 * Cheap rolling key over what feeds placement. Deliberately NOT energy
 * (hue ≠ place) and NOT HL: a touch renews HL, and the land must not
 * reshuffle under the reader who just opened a piece — HL reshapes the
 * terrain at the next 10-minute bucket (the placement rules' hysteresis).
 */
export function datasetKey(items: readonly ContentItem[], bucketMs: number): string {
  let h = 5381
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  for (const i of items) {
    mix(i.id)
    mix(i.franjaId ?? '')
    mix(i.imageUrl ?? '')
    mix(i.date ?? '')
    mix(i.publishedAt)
    mix(i.type)
  }
  return `${bucketMs}:${items.length}:${h >>> 0}`
}

export const FILTER_TYPES: ContentType[] = ['evento', 'mix', 'review', 'editorial', 'articulo', 'listicle', 'noticia', 'opinion']

/** Is this node switched off by the Capas (formats, era, mercado)? */
export function filteredOut(node: TerrainNode, hidden: ReadonlySet<string>): boolean {
  if (!hidden.size) return false
  if (node.kind === 'mercado') return hidden.has('mercado')
  if (node.kind === 'franja') return false
  const item = node.item!
  if (hidden.has(item.type)) return true
  if (node.archive ? hidden.has('era:archivo') : hidden.has('era:ahora')) return true
  return false
}

// ── geometry helpers ─────────────────────────────────────────────────────────

function exteriorMasks(cells: readonly Axial[]): number[] {
  const keys = new Set(cells.map(cellKey))
  return cells.map((c) => {
    let m = 0
    for (let d = 0; d < 6; d++) {
      const n = { q: c.q + HEX_DIRS[d].q, r: c.r + HEX_DIRS[d].r }
      if (!keys.has(cellKey(n))) m |= 1 << d
    }
    return m
  })
}

// ── build ────────────────────────────────────────────────────────────────────

export interface FocusExtra {
  slug: string
  franja: ContentItem
  arr: FocusArrangement
}

export function buildModel(args: {
  layout: MapaLayout
  itemsById: ReadonlyMap<string, ContentItem>
  nowMs: number
  clusters: readonly FranjaCluster[]
  globalListings: readonly GlobalListingPlacement[]
  focus: readonly FocusExtra[]
}): TerrainModel {
  const { layout, itemsById, nowMs, clusters, globalListings, focus } = args
  const now = new Date(nowMs)
  const nodes: TerrainNode[] = []
  const byKey = new Map<string, number>()
  const fresh = layout.placed.map((p) => itemsById.get(p.item.id) ?? p.item)
  const peaks = computePeakByType(fresh, now)

  const push = (n: TerrainNode) => {
    byKey.set(n.key, nodes.length)
    nodes.push(n)
  }

  layout.placed.forEach((p, i) => {
    const item = fresh[i]
    const band = effectiveBand(item)
    push({
      key: item.id,
      kind: 'pieza',
      item,
      listing: null,
      franja: null,
      cells: p.cells,
      bbox: p.bbox,
      size: p.size,
      image: item.imageUrl ?? null,
      band: [band.min, band.max],
      life: Math.max(0, Math.min(1.2, score(item, peaks, now))),
      archive: isArchive(item, nowMs),
      anchor: -1,
      focusOf: null,
      satelliteOf: null,
    })
  })

  const franjaBySlug = new Map(clusters.map((c) => [c.franja.slug, c.franja]))
  for (const g of globalListings) {
    const l = g.placement.listing
    push({
      key: `mercado:${l.id}`,
      kind: 'mercado',
      item: null,
      listing: l,
      franja: franjaBySlug.get(g.franjaSlug) ?? null,
      cells: [g.placement.cell],
      bbox: g.placement.box,
      size: 1,
      image: l.images[0] ?? null,
      band: [5, 5],
      life: 0.5,
      archive: false,
      anchor: byKey.get(g.anchorItemId) ?? -1,
      focusOf: null,
      satelliteOf: g.franjaSlug,
    })
  }

  for (const f of focus) {
    push({
      key: `franja:${f.slug}`,
      kind: 'franja',
      item: null,
      listing: null,
      franja: f.franja,
      cells: f.arr.identityCells,
      bbox: f.arr.identityBox,
      size: 7,
      image: f.franja.imageUrl ?? null,
      band: [5, 5],
      life: 1,
      archive: false,
      anchor: -1,
      focusOf: f.slug,
      satelliteOf: null,
    })
    for (const lp of f.arr.listings) {
      push({
        key: `mercado-foco:${f.slug}:${lp.listing.id}`,
        kind: 'mercado',
        item: null,
        listing: lp.listing,
        franja: f.franja,
        cells: [lp.cell],
        bbox: lp.box,
        size: 1,
        image: lp.listing.images[0] ?? null,
        band: [5, 5],
        life: 0.5,
        archive: false,
        anchor: -1,
        focusOf: f.slug,
        satelliteOf: null,
      })
    }
  }

  const cells: CellRec[] = []
  nodes.forEach((n, ni) => {
    const masks = exteriorMasks(n.cells)
    n.cells.forEach((c, ci) => {
      const p = hexToPixel(c, R)
      cells.push({
        node: ni,
        x: p.x,
        y: p.y,
        mask: masks[ci],
        lx: p.x - n.bbox.x,
        ly: p.y - n.bbox.y,
        w: n.bbox.width,
        h: n.bbox.height,
      })
    })
  })

  return { nodes, cells, byKey, bounds: layout.bounds }
}

// ── views ────────────────────────────────────────────────────────────────────

export interface ViewInput {
  focus: { slug: string; arr: FocusArrangement; members: ReadonlySet<string>; related: ReadonlySet<string> } | null
  continents: ContinentArrangement | null
  compact: CompactArrangement | null
  hidden: ReadonlySet<string>
}

export interface ViewTargets {
  tx: Float32Array
  ty: Float32Array
  dim: Float32Array
  vis: Float32Array
  emph: Float32Array
  /** Plane bbox of everything visible in this view (fit + clamp). */
  bounds: Box
  /** Where reflow motion radiates from (stagger pivot). */
  pivot: { x: number; y: number }
}

/** How far the land recedes around a focus: dim, not gone. */
const FOCUS_DIM = 0.84

export function computeView(model: TerrainModel, v: ViewInput): ViewTargets {
  const n = model.nodes.length
  const tx = new Float32Array(n)
  const ty = new Float32Array(n)
  const dim = new Float32Array(n)
  const vis = new Float32Array(n)
  const emph = new Float32Array(n)
  const deltas = v.focus?.arr.deltas ?? v.continents?.deltas ?? v.compact?.deltas ?? null

  for (let i = 0; i < n; i++) {
    const node = model.nodes[i]
    if (node.kind === 'pieza') {
      const d = deltas?.[node.key]
      tx[i] = d?.dx ?? 0
      ty[i] = d?.dy ?? 0
      vis[i] = filteredOut(node, v.hidden) ? 0 : 1
      if (v.focus) {
        const member = v.focus.members.has(node.key)
        dim[i] = member || v.focus.related.has(node.key) ? 0 : FOCUS_DIM
        emph[i] = member ? 1 : 0
      }
    } else if (node.satelliteOf) {
      // Offsets are inherited from the anchor at runtime.
      const own = v.focus?.slug === node.satelliteOf
      vis[i] = filteredOut(node, v.hidden) || v.compact || own ? 0 : 1
      dim[i] = v.focus ? FOCUS_DIM : 0
    } else if (node.focusOf) {
      const on = v.focus?.slug === node.focusOf
      vis[i] = on && !filteredOut(node, v.hidden) ? 1 : 0
      emph[i] = node.kind === 'franja' ? 1 : 0
    }
  }

  // Satellites follow their anchor's target.
  for (let i = 0; i < n; i++) {
    const a = model.nodes[i].anchor
    if (a >= 0) {
      tx[i] = tx[a]
      ty[i] = ty[a]
    }
  }

  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i < n; i++) {
    if (vis[i] < 0.5) continue
    const b = model.nodes[i].bbox
    x0 = Math.min(x0, b.x + tx[i])
    y0 = Math.min(y0, b.y + ty[i])
    x1 = Math.max(x1, b.x + b.width + tx[i])
    y1 = Math.max(y1, b.y + b.height + ty[i])
  }
  const bounds = Number.isFinite(x0) ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : model.bounds

  const pivot = v.focus
    ? hexToPixel(v.focus.arr.identityCell, R)
    : { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }

  return { tx, ty, dim, vis, emph, bounds, pivot }
}
