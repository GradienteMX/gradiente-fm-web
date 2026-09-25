/**
 * INSIGNIAS — distance fields, shared by the die (art.ts) and the page
 * (paper.ts): an exact Euclidean distance transform, a separable blur, and
 * a contour tracer that grows a silhouette robustly (convex corners round,
 * concave corners stay clean — no swallowtails at a bubble's tail).
 */

import type { Pt } from './shapes'

const INF = 1e20

function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    const dq = q - v[k]
    d[q] = dq * dq + f[v[k]]
  }
}

/**
 * Euclidean distance (px) from every pixel where `mask ≥ 0.5` to the
 * nearest pixel where it isn't (Felzenszwalb–Huttenlocher); 0 elsewhere.
 */
export function edt(mask: ArrayLike<number>, w: number, h: number, out = new Float32Array(w * h)): Float32Array {
  const n = Math.max(w, h)
  const f = new Float64Array(n)
  const d = new Float64Array(n)
  const v = new Int32Array(n)
  const z = new Float64Array(n + 1)
  const grid = new Float64Array(w * h)
  for (let i = 0; i < w * h; i++) grid[i] = mask[i] >= 0.5 ? INF : 0
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x]
    edt1d(f, h, d, v, z)
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y]
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x]
    edt1d(f, w, d, v, z)
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x])
  }
  return out
}

/** Separable box blur, clamped at the edges; `passes` ≈ gaussian. */
export function blur(src: Float32Array, w: number, h: number, r: number, passes = 3): Float32Array {
  const rr = Math.max(1, Math.round(r))
  // `a` is read by the horizontal pass and written by the vertical one, so
  // it always holds the latest result; `b` is the scratch buffer.
  const a = Float32Array.from(src)
  const b = new Float32Array(w * h)
  const inv = 1 / (2 * rr + 1)
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const o = y * w
      let acc = 0
      for (let k = -rr; k <= rr; k++) acc += a[o + Math.min(w - 1, Math.max(0, k))]
      for (let x = 0; x < w; x++) {
        b[o + x] = acc * inv
        acc += a[o + Math.min(w - 1, x + rr + 1)] - a[o + Math.max(0, x - rr)]
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0
      for (let k = -rr; k <= rr; k++) acc += b[Math.min(h - 1, Math.max(0, k)) * w + x]
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc * inv
        acc += b[Math.min(h - 1, y + rr + 1) * w + x] - b[Math.max(0, y - rr) * w + x]
      }
    }
  }
  return a
}

// ── growing a silhouette ────────────────────────────────────────────────────

/** Even–odd fill of a polygon on a grid (cell centres). */
function fill(p: readonly Pt[], n: number, x0: number, step: number): Uint8Array {
  const out = new Uint8Array(n * n)
  const xs: number[] = []
  for (let row = 0; row < n; row++) {
    const y = x0 + (row + 0.5) * step
    xs.length = 0
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [ax, ay] = p[j]
      const [bx, by] = p[i]
      if (ay > y !== by > y) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax))
    }
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - x0) / step - 0.5))
      const c1 = Math.min(n - 1, Math.floor((xs[k + 1] - x0) / step - 0.5))
      for (let c = c0; c <= c1; c++) out[row * n + c] = 1
    }
  }
  return out
}

/**
 * The silhouette grown by `d` units (d < 0 shrinks it), traced from its
 * distance field and resampled to `count` evenly spaced points (CCW).
 */
export function grow(p: readonly Pt[], d: number, count = 240, res = 360): Pt[] {
  const half = 0.5 + Math.max(0, d) + 0.04
  const step = (2 * half) / res
  const inside = fill(p, res, -half, step)
  // f > 0 inside the offset shape (distances in cells; ±0.5 for centres)
  const f = new Float32Array(res * res)
  if (d >= 0) {
    const outside = new Uint8Array(res * res)
    for (let i = 0; i < outside.length; i++) outside[i] = inside[i] ? 0 : 1
    const dOut = edt(outside, res, res)
    for (let i = 0; i < f.length; i++) f[i] = inside[i] ? d / step + 1 : d / step - dOut[i] + 0.5
  } else {
    const dIn = edt(inside, res, res)
    for (let i = 0; i < f.length; i++) f[i] = inside[i] ? dIn[i] - 0.5 + d / step : -1
  }
  const g = blur(f, res, res, 1, 1)
  return resample(trace(g, res, -half, step), count)
}

/** Marching squares on f (level 0) → the longest closed contour, unit coords. */
function trace(f: Float32Array, n: number, x0: number, step: number): Pt[] {
  const pos = new Map<string, [number, number]>()
  const adj = new Map<string, string[]>()
  const at = (x: number, y: number) => f[y * n + x]
  const point = (key: string, ax: number, ay: number, bx: number, by: number) => {
    if (!pos.has(key)) {
      const fa = at(ax, ay)
      const fb = at(bx, by)
      const t = fa / (fa - fb)
      // rows run bottom → top, like the fill
      pos.set(key, [x0 + (ax + (bx - ax) * t + 0.5) * step, x0 + (ay + (by - ay) * t + 0.5) * step])
    }
    return key
  }
  const link = (a: string, b: string) => {
    ;(adj.get(a) ?? adj.set(a, []).get(a)!).push(b)
    ;(adj.get(b) ?? adj.set(b, []).get(b)!).push(a)
  }
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const a = at(x, y) > 0 ? 1 : 0
      const b = at(x + 1, y) > 0 ? 1 : 0
      const c = at(x + 1, y + 1) > 0 ? 1 : 0
      const e = at(x, y + 1) > 0 ? 1 : 0
      const code = a | (b << 1) | (c << 2) | (e << 3)
      if (code === 0 || code === 15) continue
      const top = () => point(`h${x},${y}`, x, y, x + 1, y)
      const right = () => point(`v${x + 1},${y}`, x + 1, y, x + 1, y + 1)
      const bottom = () => point(`h${x},${y + 1}`, x, y + 1, x + 1, y + 1)
      const left = () => point(`v${x},${y}`, x, y, x, y + 1)
      switch (code) {
        case 1:
        case 14:
          link(left(), top())
          break
        case 2:
        case 13:
          link(top(), right())
          break
        case 3:
        case 12:
          link(left(), right())
          break
        case 4:
        case 11:
          link(right(), bottom())
          break
        case 6:
        case 9:
          link(top(), bottom())
          break
        case 7:
        case 8:
          link(left(), bottom())
          break
        case 5:
        case 10: {
          const centre = (at(x, y) + at(x + 1, y) + at(x + 1, y + 1) + at(x, y + 1)) / 4 > 0
          if ((code === 5) === centre) {
            link(left(), bottom())
            link(top(), right())
          } else {
            link(left(), top())
            link(right(), bottom())
          }
          break
        }
      }
    }
  }
  const seen = new Set<string>()
  let best: Pt[] = []
  for (const start of adj.keys()) {
    if (seen.has(start)) continue
    const loop: Pt[] = []
    let prev = ''
    let cur = start
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      loop.push(pos.get(cur)!)
      const next = (adj.get(cur) ?? []).find((k) => k !== prev && !seen.has(k)) ?? ''
      prev = cur
      cur = next
    }
    if (loop.length > best.length) best = loop
  }
  return best
}

/** Evenly spaced points along a closed polyline, counter-clockwise. */
function resample(p: readonly Pt[], count: number): Pt[] {
  if (p.length < 3) return p.slice()
  const len: number[] = [0]
  for (let i = 1; i <= p.length; i++) {
    const a = p[i - 1]
    const b = p[i % p.length]
    len.push(len[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const total = len[len.length - 1]
  const out: [number, number][] = []
  let j = 0
  for (let k = 0; k < count; k++) {
    const s = (k / count) * total
    while (len[j + 1] < s) j++
    const a = p[j]
    const b = p[(j + 1) % p.length]
    const t = (s - len[j]) / Math.max(1e-9, len[j + 1] - len[j])
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
  }
  let area = 0
  for (let i = 0, k = out.length - 1; i < out.length; k = i++) area += out[k][0] * out[i][1] - out[i][0] * out[k][1]
  return area < 0 ? out.reverse() : out
}
