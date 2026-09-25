/**
 * INSIGNIAS — the dies. One silhouette per family, in unit coordinates
 * (every pin fits the square −0.5…0.5, y up). The same polygons build the
 * GL body, strike the relief and enamel masks on canvas, press the beds
 * into the page and draw the flat printed fallback — so the four agree.
 *
 *   craft       hexagon, point up — a cell of work, the maker's nut
 *   reception   a speech bubble with its tail — what came back to you
 *   community   a heater shield — what a group holds up together
 *   presence    a disc with a rayed rim — a state of being, a small sun
 */

export type Pt = readonly [number, number]
export type Family = 'craft' | 'reception' | 'community' | 'presence'

export const FAMILIES: readonly Family[] = ['craft', 'reception', 'community', 'presence']

/**
 * The struck blank (units): its thickness and the polished bevel, which
 * stands `bevelS` outside the die line — the pin's footprint on the page.
 */
export const BLANK = { thick: 0.075, bevelT: 0.014, bevelS: 0.011 } as const

export interface Silhouette {
  family: Family
  /** The die-cut edge (CCW). */
  outline: Pt[]
  /** The field the enamel zones are laid out in (= outline, or the presence disc). */
  body: Pt[]
  /** Centre of the field: the sigil, the post and the engraving hang from it. */
  center: Pt
  /** Size of the sigil's 20-grid box, in units. */
  sigil: number
  /** Presence only: the rayed rim. */
  rays?: { n: number; inner: number }
}

// ── a tiny path sampler ─────────────────────────────────────────────────────

class Pen {
  pts: [number, number][] = []
  private x = 0
  private y = 0

  move(x: number, y: number) {
    this.pts.push([x, y])
    this.x = x
    this.y = y
    return this
  }

  line(x: number, y: number) {
    this.pts.push([x, y])
    this.x = x
    this.y = y
    return this
  }

  /** Arc around (cx, cy) from angle a0 to a1 (radians), excluding the start. */
  arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 10) {
    for (let i = 1; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n
      this.pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
    }
    this.x = cx + Math.cos(a1) * r
    this.y = cy + Math.sin(a1) * r
    return this
  }

  quad(qx: number, qy: number, x: number, y: number, n = 14) {
    const x0 = this.x
    const y0 = this.y
    for (let i = 1; i <= n; i++) {
      const t = i / n
      const u = 1 - t
      this.pts.push([u * u * x0 + 2 * u * t * qx + t * t * x, u * u * y0 + 2 * u * t * qy + t * t * y])
    }
    this.x = x
    this.y = y
    return this
  }

  cubic(ax: number, ay: number, bx: number, by: number, x: number, y: number, n = 22) {
    const x0 = this.x
    const y0 = this.y
    for (let i = 1; i <= n; i++) {
      const t = i / n
      const u = 1 - t
      this.pts.push([
        u * u * u * x0 + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * x,
        u * u * u * y0 + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y,
      ])
    }
    this.x = x
    this.y = y
    return this
  }

  /** Closed polygon without a duplicated last point. */
  done(): Pt[] {
    const p = this.pts
    const a = p[0]
    const b = p[p.length - 1]
    if (p.length > 1 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) p.pop()
    return ccw(p)
  }
}

function area(p: readonly Pt[]): number {
  let s = 0
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][0] * p[i][1] - p[i][0] * p[j][1]
  return s / 2
}

function ccw(p: Pt[]): Pt[] {
  return area(p) < 0 ? p.slice().reverse() : p
}

// ── the four dies ───────────────────────────────────────────────────────────

/** Pointy-top hexagon, circumradius 0.5, corners eased like a struck blank. */
function hexagon(): Pt[] {
  const R = 0.5
  const rc = 0.045
  const dc = R - rc / Math.sin(Math.PI / 3)
  const pen = new Pen()
  for (let k = 0; k < 6; k++) {
    const t = Math.PI / 2 + (k * Math.PI) / 3
    const cx = Math.cos(t) * dc
    const cy = Math.sin(t) * dc
    const a0 = t - Math.PI / 6
    const a1 = t + Math.PI / 6
    if (k === 0) pen.move(cx + Math.cos(a0) * rc, cy + Math.sin(a0) * rc)
    else pen.line(cx + Math.cos(a0) * rc, cy + Math.sin(a0) * rc)
    pen.arc(cx, cy, rc, a0, a1, 7)
  }
  return pen.done()
}

/** A rounded speech bubble; the tail leaves from the lower left. */
function bubble(): Pt[] {
  const L = -0.47
  const Rr = 0.47
  const B = -0.25
  const T = 0.44
  const r = 0.2
  const pen = new Pen()
  pen.move(-0.02, B)
  pen.line(Rr - r, B)
  pen.arc(Rr - r, B + r, r, -Math.PI / 2, 0, 12)
  pen.line(Rr, T - r)
  pen.arc(Rr - r, T - r, r, 0, Math.PI / 2, 12)
  pen.line(L + r, T)
  pen.arc(L + r, T - r, r, Math.PI / 2, Math.PI, 12)
  pen.line(L, B + r)
  pen.arc(L + r, B + r, r, Math.PI, (3 * Math.PI) / 2, 12)
  pen.line(-0.24, B)
  // the tail: a curved blade down to the left, back up to the body
  pen.quad(-0.25, -0.39, -0.39, -0.485, 12)
  pen.quad(-0.17, -0.36, -0.02, B, 14)
  return pen.done()
}

/** A heater shield with a faintly dipped top. */
function shield(): Pt[] {
  const W = 0.43
  const T = 0.46
  const rc = 0.045
  const pen = new Pen()
  pen.move(0, -0.49)
  pen.cubic(0.2, -0.4, W, -0.27, W, 0.02, 24)
  pen.line(W, T - rc)
  pen.quad(W, T, W - rc, T, 6)
  pen.quad(0, T - 0.05, -W + rc, T, 20)
  pen.quad(-W, T, -W, T - rc, 6)
  pen.line(-W, 0.02)
  pen.cubic(-W, -0.27, -0.2, -0.4, 0, -0.49, 24)
  return pen.done()
}

/** A disc with a rayed rim: n rays, their tips at 0.5, the valleys at `inner`. */
function rayed(n: number, inner: number): Pt[] {
  const pts: [number, number][] = []
  const per = 12
  const total = n * per
  for (let i = 0; i < total; i++) {
    const a = Math.PI / 2 + (i / total) * Math.PI * 2
    const u = (((a - Math.PI / 2) * n) / (Math.PI * 2)) % 1
    const tri = 1 - Math.abs(2 * ((u + 0.5) % 1) - 1) // 1 on a ray, 0 in a valley
    const soft = tri * tri * (3 - 2 * tri) * 0.35 + tri * 0.65 // eased tips
    const r = inner + (0.5 - inner) * soft
    pts.push([Math.cos(a) * r, Math.sin(a) * r])
  }
  return ccw(pts)
}

function circle(r: number, n = 128, cx = 0, cy = 0): Pt[] {
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return pts
}

let cache: Record<Family, Silhouette> | null = null

export function silhouettes(): Record<Family, Silhouette> {
  if (cache) return cache
  const hex = hexagon()
  const bub = bubble()
  const shi = shield()
  const RAYS = 24
  const INNER = 0.44
  cache = {
    craft: { family: 'craft', outline: hex, body: hex, center: [0, 0], sigil: 0.44 },
    reception: { family: 'reception', outline: bub, body: bub, center: [0, 0.095], sigil: 0.43 },
    community: { family: 'community', outline: shi, body: shi, center: [0, 0.05], sigil: 0.42 },
    presence: { family: 'presence', outline: rayed(RAYS, INNER), body: circle(0.405, 160), center: [0, 0], sigil: 0.5, rays: { n: RAYS, inner: INNER } },
  }
  return cache
}

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Offset a CCW polygon along its vertex normals (δ > 0 grows it). Mitres are
 * clamped so the dense outlines here stay clean at their few sharp corners.
 */
export function offsetPolygon(p: readonly Pt[], d: number): Pt[] {
  const n = p.length
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = p[(i - 1 + n) % n]
    const b = p[i]
    const c = p[(i + 1) % n]
    let e1x = b[0] - a[0]
    let e1y = b[1] - a[1]
    let e2x = c[0] - b[0]
    let e2y = c[1] - b[1]
    const l1 = Math.hypot(e1x, e1y) || 1
    const l2 = Math.hypot(e2x, e2y) || 1
    e1x /= l1
    e1y /= l1
    e2x /= l2
    e2y /= l2
    // outward normals of a CCW polygon: (dy, −dx)
    const n1x = e1y
    const n1y = -e1x
    const n2x = e2y
    const n2y = -e2x
    let mx = n1x + n2x
    let my = n1y + n2y
    const ml = Math.hypot(mx, my) || 1
    mx /= ml
    my /= ml
    const cos = Math.max(0.45, mx * n1x + my * n1y)
    out.push([b[0] + (mx * d) / cos, b[1] + (my * d) / cos])
  }
  return out
}

/** SVG path (y down) for a unit polygon, scaled by k around the origin. */
export function svgPath(p: readonly Pt[], k = 1, mirror = false): string {
  let d = ''
  for (let i = 0; i < p.length; i++) {
    const x = (mirror ? -p[i][0] : p[i][0]) * k
    const y = -p[i][1] * k
    d += `${i ? 'L' : 'M'}${x.toFixed(4)} ${y.toFixed(4)}`
  }
  return d + 'Z'
}
