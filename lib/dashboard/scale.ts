// ── scale — the chart math the repo never had ───────────────────────────────
//
// /admin is the first surface in the project to draw computed geometry. There
// was no clamp, no lerp, no tick generator, no day-bucketing helper anywhere
// in lib/ — the only normalizer was vibeToPercent. Rather than let each chart
// invent its own, everything numeric lives here: pure functions, no React, no
// DOM, no Tailwind (lib/ is outside the Tailwind content globs), unit-tested
// in tests/dashboard/scale.test.ts.
//
// Everything is deliberately small. A 30-day line and a 7-day sparkline do not
// need a charting library, and adding one would be the heaviest dependency in
// package.json for two shapes.

// ── Primitives ──────────────────────────────────────────────────────────────

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

/** Map v from [d0,d1] onto [r0,r1]. A zero-width domain pins to r0. */
export function mapRange(v: number, d0: number, d1: number, r0: number, r1: number): number {
  if (d1 === d0) return r0
  return r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)
}

// ── Nice ticks ──────────────────────────────────────────────────────────────

/**
 * Axis bounds a person would have chosen: round numbers, `count`-ish of them,
 * always containing the data. Standard 1/2/5/10 ladder.
 *
 * Returns the padded domain alongside the ticks because the chart must plot
 * against the SAME bounds the axis labels describe — computing them separately
 * is how a series ends up drawn a few pixels outside its own gridlines.
 */
export function niceTicks(
  min: number,
  max: number,
  count = 4,
): { ticks: number[]; min: number; max: number } {
  // A flat series (every value identical, very common early in the ledger)
  // has no range to divide. Give it a symmetric window so the line lands in
  // the middle of the panel instead of on the floor.
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    const v = Number.isFinite(min) ? min : 0
    const pad = Math.abs(v) > 0 ? Math.abs(v) : 1
    return { ticks: [v - pad, v, v + pad], min: v - pad, max: v + pad }
  }

  const raw = (max - min) / Math.max(1, count)
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag

  // round() normalizes -0 here too: an all-negative series like [-88, -3]
  // ceils to exactly 0 for its upper bound, and that product carries the sign
  // of the operands.
  const lo = round(Math.floor(min / step) * step, 6)
  const hi = round(Math.ceil(max / step) * step, 6)

  const ticks: number[] = []
  // Accumulate by index rather than by repeated addition: `t += step` drifts
  // on non-representable steps (0.1) and yields ticks like 0.30000000000000004.
  const n = Math.round((hi - lo) / step)
  for (let i = 0; i <= n; i++) ticks.push(round(lo + i * step, 6))

  return { ticks, min: lo, max: hi }
}

/**
 * Round to `places` decimals without float noise, and never return NEGATIVE
 * ZERO. Math.round(-0.2) is -0, and Intl.NumberFormat prints that as «-0» —
 * an axis whose gridline reads -0, or a delta column showing «-0.0» on an item
 * that lost nothing, is the panel visibly fumbling its own arithmetic.
 * `r === 0` is true for -0, so this catches it without a special case.
 */
export function round(v: number, places = 2): number {
  const f = Math.pow(10, places)
  const r = Math.round(v * f) / f
  return r === 0 ? 0 : r
}

// ── Day bucketing ───────────────────────────────────────────────────────────

/** A UTC day key, `YYYY-MM-DD`. */
export type DayKey = string

export function dayKey(d: Date): DayKey {
  return d.toISOString().slice(0, 10)
}

/**
 * Every day key from `start` to `end` inclusive, ascending.
 * Built by adding whole days in UTC — local-time arithmetic drops or repeats a
 * day across a DST boundary, and CDMX observed DST until 2022.
 */
export function dayRange(start: Date, end: Date): DayKey[] {
  const out: DayKey[] = []
  const cur = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  for (let t = cur; t <= last; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}

/**
 * Bucket timestamped rows into a dense, gap-filled day series.
 *
 * Gap-filling is the whole point. A sparkline that silently omits days with no
 * events draws a smooth line over a week of silence and lies about the shape;
 * a zero-filled one shows the silence. Days outside [start,end] are dropped,
 * not clamped into the edge buckets.
 */
export function bucketByDay<T>(
  rows: readonly T[],
  at: (row: T) => string | Date,
  value: (row: T) => number,
  start: Date,
  end: Date,
): { day: DayKey; value: number }[] {
  const keys = dayRange(start, end)
  const acc = new Map<DayKey, number>(keys.map((k) => [k, 0]))
  for (const row of rows) {
    const raw = at(row)
    const key = (typeof raw === 'string' ? raw : raw.toISOString()).slice(0, 10)
    const prev = acc.get(key)
    if (prev === undefined) continue // outside the window
    acc.set(key, prev + value(row))
  }
  return keys.map((day) => ({ day, value: acc.get(day) ?? 0 }))
}

// ── Path emission ───────────────────────────────────────────────────────────

export interface PlotBox {
  width: number
  height: number
  /** Inset in px: [top, right, bottom, left]. */
  pad: [number, number, number, number]
}

/**
 * Project a value series onto pixel coordinates inside a plot box.
 * X is the index (evenly spaced days), Y is the value against [min,max],
 * inverted because SVG y grows downward.
 */
export function project(
  values: readonly number[],
  domain: { min: number; max: number },
  box: PlotBox,
): { x: number; y: number }[] {
  const [pt, pr, pb, pl] = box.pad
  const w = box.width - pl - pr
  const h = box.height - pt - pb
  const last = Math.max(1, values.length - 1)
  return values.map((v, i) => ({
    x: round(pl + (i / last) * w),
    y: round(pt + h - mapRange(clamp(v, domain.min, domain.max), domain.min, domain.max, 0, h)),
  }))
}

/**
 * `M x y L x y …` from projected points. Two-decimal, origin-relative — the
 * same formatting convention as loopsToPath in the trophy glyphs, so path
 * strings stay small and diffable.
 *
 * Returns '' for an empty series so a consumer can render nothing rather than
 * an `<path d="">` that some engines warn about.
 */
export function toPath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) {
    // A single sample has no line. Emit a 1px horizontal tick so the series is
    // visible at all — an invisible path reads as "no data" when there is data.
    const p = points[0]
    return `M${p.x.toFixed(2)} ${p.y.toFixed(2)} L${(p.x + 1).toFixed(2)} ${p.y.toFixed(2)}`
  }
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ')
}

// ── Shares ──────────────────────────────────────────────────────────────────

/**
 * Percentage share of each value in a set, as 0–100 numbers.
 * A zero total returns all zeros rather than NaN — the INTERACCIONES → HL
 * table renders on day one, when nothing has happened yet.
 */
export function shares(values: readonly number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0)
  if (total <= 0) return values.map(() => 0)
  return values.map((v) => round((v / total) * 100, 1))
}
