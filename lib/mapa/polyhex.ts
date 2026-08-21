// Spatial Identity Canvas — polyhex templates + exterior-edge geometry.
// Pure functions. A polyhex is a connected set of axial cells representing ONE
// content item; HL picks the allowed size (1 / 3 / 7 base units). Only the
// exterior boundary of the polyhex receives the type-colored rim, so exterior
// edge detection is the load-bearing primitive here.

import {
  HEX_DIRS,
  axialAdd,
  cellKey,
  hexCorners,
  hexToPixel,
  type Axial,
  type Point,
} from './hex'

export type PolyhexSize = 1 | 3 | 7

// ── Templates ────────────────────────────────────────────────────────────────
//
// A finite template vocabulary (spec: "shapes must be compact, connected, and
// chosen from a finite template set"). Offsets are relative to the anchor cell
// (0,0), which is always part of the shape.

// Compact trihex (triangle). Six rotational variants — placement tries each
// and picks the best-scoring one deterministically.
const TRIHEX_VARIANTS: readonly (readonly Axial[])[] = [
  [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }],
  [{ q: 0, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 }],
  [{ q: 0, r: 0 }, { q: -1, r: 1 }, { q: -1, r: 0 }],
  [{ q: 0, r: 0 }, { q: -1, r: 0 }, { q: 0, r: -1 }],
  [{ q: 0, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 }],
  [{ q: 0, r: 0 }, { q: 1, r: -1 }, { q: 1, r: 0 }],
]

// Rosette: center + all six neighbors. One orientation.
const ROSETTE: readonly Axial[] = [
  { q: 0, r: 0 },
  ...HEX_DIRS.map((d) => ({ q: d.q, r: d.r })),
]

const SINGLE: readonly Axial[] = [{ q: 0, r: 0 }]

// All orientation variants for a polyhex size. Deterministic order — variant
// index is a tie-break key during placement.
export function templateVariants(size: PolyhexSize): readonly (readonly Axial[])[] {
  switch (size) {
    case 1:
      return [SINGLE]
    case 3:
      return TRIHEX_VARIANTS
    case 7:
      return [ROSETTE]
  }
}

export function offsetTemplate(
  template: readonly Axial[],
  anchor: Axial,
): Axial[] {
  return template.map((c) => axialAdd(c, anchor))
}

// ── Connectivity ─────────────────────────────────────────────────────────────

// True when every cell is reachable from the first via edge adjacency.
export function isConnected(cells: readonly Axial[]): boolean {
  if (cells.length === 0) return false
  const keys = new Set(cells.map(cellKey))
  const seen = new Set<string>([cellKey(cells[0])])
  const stack: Axial[] = [cells[0]]
  while (stack.length > 0) {
    const c = stack.pop()!
    for (const d of HEX_DIRS) {
      const n = axialAdd(c, d)
      const k = cellKey(n)
      if (keys.has(k) && !seen.has(k)) {
        seen.add(k)
        stack.push(n)
      }
    }
  }
  return seen.size === keys.size
}

// ── Exterior edges ───────────────────────────────────────────────────────────

export interface HexEdge {
  cell: Axial
  // Direction index into HEX_DIRS: the edge between corner dir and dir+1,
  // facing the neighbor at HEX_DIRS[dir].
  dir: number
}

// An edge of a member cell is exterior when the neighbor across it is NOT in
// the set. This is the definition of the polyhex boundary; the type-colored
// rim renders exactly these edges and nothing else.
export function exteriorEdges(cells: readonly Axial[]): HexEdge[] {
  const keys = new Set(cells.map(cellKey))
  const out: HexEdge[] = []
  for (const c of cells) {
    for (let dir = 0; dir < 6; dir++) {
      const n = axialAdd(c, HEX_DIRS[dir])
      if (!keys.has(cellKey(n))) out.push({ cell: c, dir })
    }
  }
  return out
}

// Interior edges (shared between two member cells), each reported once.
export function interiorEdges(cells: readonly Axial[]): HexEdge[] {
  const keys = new Set(cells.map(cellKey))
  const out: HexEdge[] = []
  for (const c of cells) {
    // Only the first three directions — the opposite cell reports the other
    // three, so each shared edge is emitted exactly once.
    for (let dir = 0; dir < 3; dir++) {
      const n = axialAdd(c, HEX_DIRS[dir])
      if (keys.has(cellKey(n))) out.push({ cell: c, dir })
    }
  }
  return out
}

// ── SVG path builders ────────────────────────────────────────────────────────

const COORD_EPS = 0.5 // px — corner snap tolerance when chaining edge loops

function pointKey(p: Point): string {
  return `${Math.round(p.x / COORD_EPS)}:${Math.round(p.y / COORD_EPS)}`
}

function edgeSegment(e: HexEdge, R: number): [Point, Point] {
  const corners = hexCorners(hexToPixel(e.cell, R), R)
  return [corners[e.dir], corners[(e.dir + 1) % 6]]
}

// Chain the exterior edges into ordered closed point loops. Exported for
// tests; the SVG builders below consume it.
export function outlineLoops(cells: readonly Axial[], R: number): Point[][] {
  const edges = exteriorEdges(cells)
  const byStart = new Map<string, [Point, Point][]>()
  for (const e of edges) {
    const seg = edgeSegment(e, R)
    const k = pointKey(seg[0])
    const list = byStart.get(k)
    if (list) list.push(seg)
    else byStart.set(k, [seg])
  }
  const consumed = new Set<[Point, Point]>()
  const loops: Point[][] = []
  for (const e of edges) {
    const first = edgeSegment(e, R)
    const startList = byStart.get(pointKey(first[0]))!
    const seg0 = startList.find(
      (s) => !consumed.has(s) && pointKey(s[1]) === pointKey(first[1]),
    )
    if (!seg0) continue
    let current = seg0
    consumed.add(current)
    const loop: Point[] = [current[0]]
    const loopStart = pointKey(current[0])
    let guard = 0
    while (pointKey(current[1]) !== loopStart && guard < edges.length + 1) {
      guard++
      loop.push(current[1])
      const nextList = byStart.get(pointKey(current[1])) ?? []
      const next = nextList.find((s) => !consumed.has(s))
      if (!next) break
      consumed.add(next)
      current = next
    }
    loops.push(loop)
  }
  return loops
}

// Inward polygon offset by `gap` px. Our loops wind clockwise in y-down
// screen space, so the interior of each directed edge (dx,dy) lies along
// (-dy,dx). Each vertex slides along the bisector of its two edge normals by
// gap / cos(θ/2) — exact for the 120°/240° corners a hex boundary produces.
export function insetLoop(loop: readonly Point[], gap: number): Point[] {
  if (gap === 0) return [...loop]
  const n = loop.length
  const out: Point[] = []
  for (let i = 0; i < n; i++) {
    const prev = loop[(i - 1 + n) % n]
    const v = loop[i]
    const next = loop[(i + 1) % n]
    const e1 = { x: v.x - prev.x, y: v.y - prev.y }
    const e2 = { x: next.x - v.x, y: next.y - v.y }
    const l1 = Math.hypot(e1.x, e1.y) || 1
    const l2 = Math.hypot(e2.x, e2.y) || 1
    const n1 = { x: -e1.y / l1, y: e1.x / l1 }
    const n2 = { x: -e2.y / l2, y: e2.x / l2 }
    let mx = n1.x + n2.x
    let my = n1.y + n2.y
    const ml = Math.hypot(mx, my)
    if (ml < 1e-6) {
      // Opposite normals (degenerate spike) — fall back to the first normal.
      mx = n1.x
      my = n1.y
    } else {
      mx /= ml
      my /= ml
    }
    const cosHalf = Math.max(0.35, mx * n1.x + my * n1.y)
    const d = gap / cosHalf
    out.push({ x: v.x + mx * d, y: v.y + my * d })
  }
  return out
}

function loopsToPath(loops: readonly (readonly Point[])[], origin: Point): string {
  const fmt = (p: Point) =>
    `${(p.x - origin.x).toFixed(2)} ${(p.y - origin.y).toFixed(2)}`
  let path = ''
  for (const loop of loops) {
    if (loop.length === 0) continue
    path += `M ${fmt(loop[0])} `
    for (let i = 1; i < loop.length; i++) path += `L ${fmt(loop[i])} `
    path += 'Z '
  }
  return path.trim()
}

// SVG path of the polyhex exterior boundary in plane pixel coordinates
// (offset by `origin`, typically the bbox min). `gap` insets the outline so
// neighboring slabs read as separate pieces with dark grout between them.
export function outlinePath(
  cells: readonly Axial[],
  R: number,
  origin: Point = { x: 0, y: 0 },
  gap = 0,
): string {
  const loops = outlineLoops(cells, R).map((l) => insetLoop(l, gap))
  return loopsToPath(loops, origin)
}

// (Interior "graphite seam" rendering was removed 2026-08-18: visible unit
// edges inside one multi-hex item read as rendering bugs, not texture. The
// interiorEdges primitive above remains — tests use it to prove edge
// accounting, and exteriorEdges is defined against it.)
