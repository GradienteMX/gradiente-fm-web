// Spatial Identity Canvas — flat-top axial hex math.
// Pure functions only: no React, no DOM, no Date.now(). Every consumer passes
// explicit inputs so layout stays deterministic between server and client.
// See wiki/70-Roadmap/Spatial Identity Canvas.md.
//
// Coordinate system: axial (q, r), flat-top orientation (horizontal top edge,
// vertices at left/right). Screen space is y-down. Pixel mapping:
//   x = R * 3/2 * q
//   y = R * sqrt(3) * (r + q/2)
// where R is the hex circumradius (center → vertex).

export interface Axial {
  q: number
  r: number
}

export interface Point {
  x: number
  y: number
}

// The six edge-neighbor directions of a flat-top hex, ordered so that
// direction i shares the edge between corner i and corner i+1 (see corners()).
// Order: SE, S, SW, NW, N, NE.
export const HEX_DIRS: readonly Axial[] = [
  { q: 1, r: 0 },   // SE
  { q: 0, r: 1 },   // S
  { q: -1, r: 1 },  // SW
  { q: -1, r: 0 },  // NW
  { q: 0, r: -1 },  // N
  { q: 1, r: -1 },  // NE
] as const

// Named indexes into HEX_DIRS for readable call sites (keyboard nav).
export const DIR_SE = 0
export const DIR_S = 1
export const DIR_SW = 2
export const DIR_NW = 3
export const DIR_N = 4
export const DIR_NE = 5

export function axial(q: number, r: number): Axial {
  return { q, r }
}

export function axialAdd(a: Axial, b: Axial): Axial {
  return { q: a.q + b.q, r: a.r + b.r }
}

export function axialEquals(a: Axial, b: Axial): boolean {
  return a.q === b.q && a.r === b.r
}

// Stable string key for Maps/Sets. The canonical cell identity everywhere.
export function cellKey(c: Axial): string {
  return `${c.q},${c.r}`
}

export function parseCellKey(key: string): Axial {
  const [q, r] = key.split(',').map(Number)
  return { q, r }
}

export function neighbors(c: Axial): Axial[] {
  return HEX_DIRS.map((d) => axialAdd(c, d))
}

// Hex (cube) distance between two axial cells.
export function hexDistance(a: Axial, b: Axial): number {
  const dq = a.q - b.q
  const dr = a.r - b.r
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

// Center of a cell in pixel space for circumradius R.
export function hexToPixel(c: Axial, R: number): Point {
  return {
    x: R * 1.5 * c.q,
    y: R * Math.sqrt(3) * (c.r + c.q / 2),
  }
}

// Round fractional axial coordinates to the containing cell (cube rounding).
export function axialRound(qf: number, rf: number): Axial {
  const sf = -qf - rf
  let q = Math.round(qf)
  let r = Math.round(rf)
  const s = Math.round(sf)
  const dq = Math.abs(q - qf)
  const dr = Math.abs(r - rf)
  const ds = Math.abs(s - sf)
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s
  return { q, r }
}

// Inverse of hexToPixel: the cell containing a plane-pixel point.
export function pixelToHex(p: Point, R: number): Axial {
  const qf = (2 / 3) * (p.x / R)
  const rf = (Math.sqrt(3) / 3) * (p.y / R) - (1 / 3) * (p.x / R)
  return axialRound(qf, rf)
}

// The six corners of a flat-top hex centered at `center`, y-down screen space.
// Corner i sits at angle 60°·i from the +x axis: 0=right, 1=down-right,
// 2=down-left, 3=left, 4=up-left, 5=up-right. Edge i (between corner i and
// corner i+1) faces HEX_DIRS[i].
export function hexCorners(center: Point, R: number): Point[] {
  const out: Point[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i
    out.push({
      x: center.x + R * Math.cos(angle),
      y: center.y + R * Math.sin(angle),
    })
  }
  return out
}

// Bounding box of a set of cells in pixel space, including the hex bodies
// (not just the centers).
export function cellsBBox(
  cells: readonly Axial[],
  R: number,
): { x: number; y: number; width: number; height: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const h = (Math.sqrt(3) / 2) * R
  for (const c of cells) {
    const p = hexToPixel(c, R)
    minX = Math.min(minX, p.x - R)
    maxX = Math.max(maxX, p.x + R)
    minY = Math.min(minY, p.y - h)
    maxY = Math.max(maxY, p.y + h)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
