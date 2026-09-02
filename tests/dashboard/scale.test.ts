// «EL PLIEGO» — chart math unit tests (lib/dashboard/scale).
// Run: npx tsx --test tests/dashboard/scale.test.ts
// (tsx resolves the @/ alias from tsconfig paths — same rig as tests/mapa.)
//
// /admin is the first surface in the repo that draws computed geometry, so
// these are the assertions that stop a chart from lying:
//
//   1. niceTicks' returned domain always CONTAINS the data. The series is
//      plotted against that domain and the gridlines are labelled from the
//      same ticks — a domain narrower than the data draws the line outside
//      its own axis, which reads as a rendering glitch, not as data.
//   2. No float-noise ticks. `0.30000000000000004` under a gridline is the
//      cheapest possible way for the panel to look broken.
//   3. dayRange is UTC-only. CDMX observed DST until 2022-10-30 and a
//      local-time day walk duplicates that Sunday; the fix is not to be
//      clever about it but to never touch local time at all.
//   4. bucketByDay gap-fills. A sparkline that skips silent days draws a
//      smooth line over a week of nothing.
//   5. shares/toPath survive day one — zero total, empty series, one sample.
//      LEDGER_EPOCH is 2026-09-02, so "nothing has happened yet" is the
//      normal case for this panel, not the edge case.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  bucketByDay,
  clamp,
  dayKey,
  dayRange,
  mapRange,
  niceTicks,
  project,
  round,
  shares,
  toPath,
  type PlotBox,
} from '@/lib/dashboard/scale'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Decimal places in a number's default string form. Exponential ⇒ Infinity. */
function fractionDigits(v: number): number {
  const s = String(v)
  if (s.includes('e') || s.includes('E')) return Number.POSITIVE_INFINITY
  const dot = s.indexOf('.')
  return dot === -1 ? 0 : s.length - dot - 1
}

// Ranges the panel actually produces: HL sums (0–hundreds), counts (small
// integers), shares (0–100), signed net deltas, and the flat/near-flat series
// a two-day-old ledger emits.
const REAL_RANGES: Array<[number, number]> = [
  [0, 97],
  [0, 1],
  [0, 3],
  [0, 7],
  [1, 9],
  [0, 10],
  [0, 0.4],
  [0, 0.7],
  [12, 13],
  [3.3, 88.8],
  [0, 1000],
  [-12, 34],
  [-1, 1],
  [-88, -3],
  [0.5, 0.5],
  [42, 42],
  [-7, -7],
  [0, 0],
]

const BOX: PlotBox = { width: 100, height: 40, pad: [4, 4, 4, 4] }

// ── Primitives ───────────────────────────────────────────────────────────────

describe('clamp', () => {
  it('pins outside the bounds and passes through inside', () => {
    assert.equal(clamp(-3, 0, 10), 0)
    assert.equal(clamp(13, 0, 10), 10)
    assert.equal(clamp(4, 0, 10), 4)
    assert.equal(clamp(0, 0, 10), 0)
    assert.equal(clamp(10, 0, 10), 10)
  })

  it('handles a zero-width range without producing NaN', () => {
    assert.equal(clamp(5, 2, 2), 2)
    assert.equal(clamp(-5, 2, 2), 2)
  })
})

describe('mapRange', () => {
  it('maps linearly and extrapolates past the domain', () => {
    assert.equal(mapRange(5, 0, 10, 0, 100), 50)
    assert.equal(mapRange(0, 0, 10, 20, 40), 20)
    assert.equal(mapRange(15, 0, 10, 0, 100), 150)
  })

  it('inverts when the range is reversed (SVG y grows downward)', () => {
    assert.equal(mapRange(0, 0, 10, 40, 0), 40)
    assert.equal(mapRange(10, 0, 10, 40, 0), 0)
  })

  it('pins a zero-width domain to r0 instead of dividing by zero', () => {
    // Every value in a flat series maps to the same pixel; the alternative is
    // NaN in a `d=` attribute and a path that vanishes.
    assert.equal(mapRange(7, 7, 7, 0, 40), 0)
    assert.ok(Number.isFinite(mapRange(7, 7, 7, 0, 40)))
  })
})

describe('round', () => {
  it('kills float noise at the requested precision', () => {
    assert.equal(round(0.1 + 0.2), 0.3)
    assert.equal(round(2.675, 2), 2.68)
    assert.equal(round(1 / 3, 6), 0.333333)
  })

  it('normalises negative zero', () => {
    // round() IS the place this is fixed, because it is upstream of every
    // reader: axis bounds, ticks, the ΔHL and DECAIMIENTO columns, and the
    // sparkline buckets all pass through it. Intl.NumberFormat prints -0 as
    // «-0», so without this a piece that lost nothing shows «-0.0» decay and
    // an all-negative series gets a gridline labelled «-0».
    assert.ok(Object.is(round(-0.004, 2), 0))
    assert.ok(Object.is(round(-0), 0))
    // Genuinely negative values keep their sign — this normalises zero, it
    // does not clamp.
    assert.equal(round(-0.04, 2), -0.04)
  })
})

// ── niceTicks ────────────────────────────────────────────────────────────────

describe('niceTicks — containment', () => {
  for (const [min, max] of REAL_RANGES) {
    it(`[${min}, ${max}] domain contains the data`, () => {
      const t = niceTicks(min, max)
      assert.ok(
        t.min <= min,
        `domain min ${t.min} clips data min ${min}`,
      )
      assert.ok(
        t.max >= max,
        `domain max ${t.max} clips data max ${max}`,
      )
      assert.ok(t.min < t.max, `domain [${t.min}, ${t.max}] has no width`)
    })
  }

  it('the first and last tick ARE the domain bounds', () => {
    // The axis labels and the plot geometry must come from the same numbers.
    // If the ticks and the domain drift apart the top gridline stops meaning
    // what its label says.
    //
    // Compared with `===`, not assert.equal: assert.equal is SameValue and so
    // separates -0 from 0, which is a formatting concern, not a geometry one.
    // The -0 case has its own test below.
    for (const [min, max] of REAL_RANGES) {
      const t = niceTicks(min, max)
      const last = t.ticks[t.ticks.length - 1]
      assert.ok(t.ticks[0] === t.min, `[${min}, ${max}] first tick ≠ min`)
      assert.ok(last === t.max, `[${min}, ${max}] last tick ≠ max`)
    }
  })

  it('never returns a negative-zero bound', () => {
    // Reachable, and not cosmetic. DECAIMIENTO is an all-negative series, so
    // its domain is [-100, ceil(-3/50)*50] and that upper bound is -0.
    // String(-0) is '0', but Intl.NumberFormat('es-MX') — which is what
    // ResumenTab's NUM formatter is — renders it as '-0'. An axis whose top
    // gridline reads «-0» is the panel visibly fumbling its own arithmetic.
    const fmt = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 })
    for (const [min, max] of REAL_RANGES) {
      const t = niceTicks(min, max)
      const named: Array<[string, number]> = [
        ['min', t.min],
        ['max', t.max],
        ...t.ticks.map((tick, i): [string, number] => [`tick[${i}]`, tick]),
      ]
      for (const [name, v] of named) {
        assert.ok(
          !Object.is(v, -0),
          `[${min}, ${max}] ${name} is -0, which es-MX prints as «${fmt.format(v)}»`,
        )
      }
    }
  })

  it('emits ascending, evenly spaced ticks', () => {
    for (const [min, max] of REAL_RANGES) {
      const { ticks } = niceTicks(min, max)
      assert.ok(ticks.length >= 2, `[${min}, ${max}] needs ≥2 ticks`)
      const step = ticks[1] - ticks[0]
      assert.ok(step > 0, `[${min}, ${max}] step ${step} is not positive`)
      for (let i = 1; i < ticks.length; i++) {
        assert.ok(
          Math.abs(ticks[i] - ticks[i - 1] - step) < 1e-9,
          `[${min}, ${max}] uneven gap at index ${i}`,
        )
      }
    }
  })
})

describe('niceTicks — normal ranges', () => {
  it('rounds a 0–97 series onto the 1/2/5 ladder', () => {
    assert.deepEqual(niceTicks(0, 97), { ticks: [0, 50, 100], min: 0, max: 100 })
  })

  it('crosses zero with a tick ON zero', () => {
    // The zero line is the read for a signed series (HL NETO): gains above,
    // losses below. It has to be a real gridline, not an interpolated guess.
    const t = niceTicks(-12, 34)
    assert.deepEqual(t.ticks, [-20, 0, 20, 40])
    assert.ok(t.ticks.includes(0))
  })

  it('handles an all-negative series (decay-only window)', () => {
    const t = niceTicks(-88, -3)
    assert.ok(t.min <= -88 && t.max >= -3)
    assert.ok(t.ticks.includes(0), 'a loss-only chart still shows its zero')
  })

  it('honours the count hint approximately', () => {
    // "count-ish", not exact: the 1/2/5 ladder wins over the requested count.
    for (const count of [3, 4, 6, 8]) {
      const { ticks } = niceTicks(0, 97, count)
      assert.ok(ticks.length >= 2 && ticks.length <= count * 2 + 1)
    }
  })
})

describe('niceTicks — degenerate input', () => {
  it('gives a flat non-zero series a symmetric window', () => {
    // Very common on a young ledger: seven days, same value every day. The
    // line must land mid-panel, not welded to the floor.
    const t = niceTicks(2.5, 2.5)
    assert.deepEqual(t, { ticks: [0, 2.5, 5], min: 0, max: 5 })
    assert.ok(t.min <= 2.5 && t.max >= 2.5)
  })

  it('gives an all-zero series a window around zero', () => {
    const t = niceTicks(0, 0)
    assert.deepEqual(t, { ticks: [-1, 0, 1], min: -1, max: 1 })
  })

  it('gives a flat negative series a window that still contains it', () => {
    const t = niceTicks(-7, -7)
    assert.equal(t.min, -14)
    assert.equal(t.max, 0)
    assert.ok(t.min <= -7 && t.max >= -7)
  })

  it('never returns NaN or Infinity for non-finite input', () => {
    // An empty series reduced with Math.min/Math.max yields ±Infinity, and a
    // sum over a column of NULLs yields NaN. Neither may reach a `d=` string.
    // Containment is not assertable here — no finite domain contains Infinity
    // — so the contract is narrower: finite, ordered, three ticks, no NaN.
    const nonFinite: Array<[number, number]> = [
      [NaN, NaN],
      [NaN, 10],
      [0, NaN],
      [0, Infinity],
      [-Infinity, Infinity],
      [Infinity, -Infinity],
    ]
    for (const [min, max] of nonFinite) {
      const t = niceTicks(min, max)
      assert.ok(Number.isFinite(t.min), `min not finite for [${min}, ${max}]`)
      assert.ok(Number.isFinite(t.max), `max not finite for [${min}, ${max}]`)
      assert.ok(t.min < t.max)
      assert.equal(t.ticks.length, 3)
      for (const tick of t.ticks) assert.ok(Number.isFinite(tick))
    }
  })
})

describe('niceTicks — no float noise', () => {
  it('emits 0.6, not 0.30000000000000004-class ticks', () => {
    // Accumulating `t += 0.2` from 0 produces 0.6000000000000001 on the
    // fourth step. Index-multiplied accumulation is what keeps this clean.
    assert.deepEqual(niceTicks(0, 1, 10).ticks, [0, 0.2, 0.4, 0.6, 0.8, 1])
    assert.deepEqual(niceTicks(0, 0.7).ticks, [0, 0.2, 0.4, 0.6, 0.8])
  })

  it('keeps every tick to ≤6 decimals across every real range', () => {
    for (const [min, max] of REAL_RANGES) {
      for (const count of [3, 4, 6, 10]) {
        for (const tick of niceTicks(min, max, count).ticks) {
          assert.ok(
            fractionDigits(tick) <= 6,
            `[${min}, ${max}] count=${count} emitted ${tick}`,
          )
        }
      }
    }
  })
})

// ── dayKey / dayRange ────────────────────────────────────────────────────────

describe('dayKey', () => {
  it('is the UTC calendar day, not the local one', () => {
    assert.equal(dayKey(new Date('2026-09-02T00:00:00Z')), '2026-09-02')
    assert.equal(dayKey(new Date('2026-09-02T23:59:59Z')), '2026-09-02')
    assert.equal(dayKey(new Date('2026-09-03T00:00:00Z')), '2026-09-03')
  })
})

describe('dayRange', () => {
  it('is inclusive at both ends', () => {
    const keys = dayRange(new Date('2026-09-01T00:00:00Z'), new Date('2026-09-03T00:00:00Z'))
    assert.deepEqual(keys, ['2026-09-01', '2026-09-02', '2026-09-03'])
  })

  it('returns a single day when start and end are the same day', () => {
    const keys = dayRange(new Date('2026-09-02T01:00:00Z'), new Date('2026-09-02T22:00:00Z'))
    assert.deepEqual(keys, ['2026-09-02'])
  })

  it('returns empty when end precedes start', () => {
    assert.deepEqual(
      dayRange(new Date('2026-09-05T00:00:00Z'), new Date('2026-09-01T00:00:00Z')),
      [],
    )
  })

  it('crosses a month boundary', () => {
    assert.deepEqual(
      dayRange(new Date('2026-01-30T12:00:00Z'), new Date('2026-02-02T12:00:00Z')),
      ['2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02'],
    )
  })

  it('crosses a year boundary and a leap day', () => {
    assert.deepEqual(
      dayRange(new Date('2026-12-30T12:00:00Z'), new Date('2027-01-01T12:00:00Z')),
      ['2026-12-30', '2026-12-31', '2027-01-01'],
    )
    assert.deepEqual(
      dayRange(new Date('2028-02-28T12:00:00Z'), new Date('2028-03-01T12:00:00Z')),
      ['2028-02-28', '2028-02-29', '2028-03-01'],
    )
  })

  it('produces a 30-day window with exactly 30 unique ascending keys', () => {
    const end = new Date('2026-09-02T00:00:00Z')
    const start = new Date(end.getTime() - 29 * 86_400_000)
    const keys = dayRange(start, end)
    assert.equal(keys.length, 30)
    assert.equal(new Set(keys).size, 30)
    assert.deepEqual(keys, [...keys].sort())
  })

  it('DST: America/Mexico_City fall-back neither drops nor duplicates a day', () => {
    // 2022-10-30 was CDMX's last DST transition (02:00 CDT → 01:00 CST) before
    // Mexico abolished it. A local-time walk that adds 86 400 000 ms from local
    // midnight lands back on Oct 30 and emits the day twice. dayRange reads and
    // writes UTC only, so the transition is invisible to it — pinned here by
    // running the same instants under three zones on either side of the
    // transition and demanding byte-identical output.
    const prev = process.env.TZ
    const start = new Date('2022-10-28T12:00:00Z')
    const end = new Date('2022-11-01T12:00:00Z')
    const expected = ['2022-10-28', '2022-10-29', '2022-10-30', '2022-10-31', '2022-11-01']
    try {
      for (const tz of ['UTC', 'America/Mexico_City', 'Pacific/Kiritimati', 'Etc/GMT+12']) {
        process.env.TZ = tz
        const keys = dayRange(start, end)
        assert.deepEqual(keys, expected, `TZ=${tz} disagrees`)
        assert.equal(new Set(keys).size, keys.length, `TZ=${tz} duplicated a day`)
      }
    } finally {
      if (prev === undefined) delete process.env.TZ
      else process.env.TZ = prev
    }
  })

  it('DST: the spring-forward boundary is equally invisible', () => {
    // 2022-04-03: 02:00 CST → 03:00 CDT, the mirror-image failure (a dropped
    // day under naive local arithmetic).
    const prev = process.env.TZ
    try {
      process.env.TZ = 'America/Mexico_City'
      assert.deepEqual(
        dayRange(new Date('2022-04-02T12:00:00Z'), new Date('2022-04-05T12:00:00Z')),
        ['2022-04-02', '2022-04-03', '2022-04-04', '2022-04-05'],
      )
    } finally {
      if (prev === undefined) delete process.env.TZ
      else process.env.TZ = prev
    }
  })
})

// ── bucketByDay ──────────────────────────────────────────────────────────────

interface LedgerRow {
  created_at: string
  weight: number
}

const at = (r: LedgerRow) => r.created_at
const weight = (r: LedgerRow) => r.weight

describe('bucketByDay', () => {
  const start = new Date('2026-09-01T00:00:00Z')
  const end = new Date('2026-09-05T00:00:00Z')

  it('gap-fills silent days with 0 rather than skipping them', () => {
    // The whole reason this helper exists. A series that omits Sep 2–4 draws
    // a straight line from Sep 1 to Sep 5 and claims steady engagement across
    // three days of silence.
    const rows: LedgerRow[] = [
      { created_at: '2026-09-01T10:00:00Z', weight: 2 },
      { created_at: '2026-09-05T23:00:00Z', weight: 3 },
    ]
    assert.deepEqual(bucketByDay(rows, at, weight, start, end), [
      { day: '2026-09-01', value: 2 },
      { day: '2026-09-02', value: 0 },
      { day: '2026-09-03', value: 0 },
      { day: '2026-09-04', value: 0 },
      { day: '2026-09-05', value: 3 },
    ])
  })

  it('returns a dense series for zero rows', () => {
    const out = bucketByDay([] as LedgerRow[], at, weight, start, end)
    assert.equal(out.length, 5)
    assert.ok(out.every((d) => d.value === 0))
  })

  it('sums multiple rows landing on one day', () => {
    const rows: LedgerRow[] = [
      { created_at: '2026-09-03T00:00:01Z', weight: 0.5 },
      { created_at: '2026-09-03T12:00:00Z', weight: 1.5 },
      { created_at: '2026-09-03T23:59:59Z', weight: 4 },
    ]
    const out = bucketByDay(rows, at, weight, start, end)
    assert.equal(out.find((d) => d.day === '2026-09-03')?.value, 6)
  })

  it('sums negative values (decay rows) without special-casing', () => {
    const rows: LedgerRow[] = [
      { created_at: '2026-09-02T04:00:00Z', weight: 8 },
      { created_at: '2026-09-02T05:00:00Z', weight: -3 },
    ]
    assert.equal(
      bucketByDay(rows, at, weight, start, end).find((d) => d.day === '2026-09-02')?.value,
      5,
    )
  })

  it('DROPS rows outside the window instead of clamping them into the edges', () => {
    // Clamping would pile every pre-window event onto day one and invent a
    // spike that never happened — the exact shape of the pre-LEDGER_EPOCH lie.
    const rows: LedgerRow[] = [
      { created_at: '2026-08-31T23:59:59Z', weight: 100 },
      { created_at: '2026-09-03T00:00:00Z', weight: 1 },
      { created_at: '2026-09-06T00:00:00Z', weight: 100 },
    ]
    const out = bucketByDay(rows, at, weight, start, end)
    assert.equal(out.length, 5)
    assert.equal(
      out.reduce((a, b) => a + b.value, 0),
      1,
      'an out-of-window row leaked into the series',
    )
  })

  it('accepts Date accessors as well as ISO strings', () => {
    const rows = [{ ts: new Date('2026-09-04T09:00:00Z'), n: 7 }]
    const out = bucketByDay(rows, (r) => r.ts, (r) => r.n, start, end)
    assert.equal(out.find((d) => d.day === '2026-09-04')?.value, 7)
  })

  it('keys off the UTC day for both accessor forms', () => {
    // A Postgres `timestamptz` arrives as '2026-09-05T02:00:00+00:00'; the
    // string path slices the first 10 chars, so the two forms must agree.
    const iso = [{ created_at: '2026-09-05T02:00:00.000Z', weight: 1 }]
    const dat = [{ created_at: new Date('2026-09-05T02:00:00.000Z'), weight: 1 }]
    assert.deepEqual(
      bucketByDay(iso, at, weight, start, end),
      bucketByDay(dat, (r) => r.created_at, (r) => r.weight, start, end),
    )
  })
})

// ── project / toPath ─────────────────────────────────────────────────────────

describe('project', () => {
  it('spreads the series across the inset plot box and inverts y', () => {
    const pts = project([0, 10], { min: 0, max: 10 }, BOX)
    assert.deepEqual(pts, [
      { x: 4, y: 36 }, // min → bottom of the box (height 40, pad 4/4)
      { x: 96, y: 4 }, // max → top
    ])
  })

  it('clamps out-of-domain values into the box instead of drawing outside it', () => {
    const pts = project([-5, 15], { min: 0, max: 10 }, BOX)
    assert.equal(pts[0].y, 36)
    assert.equal(pts[1].y, 4)
  })

  it('places a single sample at the left edge without dividing by zero', () => {
    const pts = project([3], { min: 0, max: 10 }, BOX)
    assert.equal(pts.length, 1)
    assert.ok(Number.isFinite(pts[0].x) && Number.isFinite(pts[0].y))
  })

  it('returns nothing for an empty series', () => {
    assert.deepEqual(project([], { min: 0, max: 10 }, BOX), [])
  })

  it('never emits NaN for a zero-width domain (flat series)', () => {
    for (const p of project([5, 5, 5], { min: 5, max: 5 }, BOX)) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y))
    }
  })
})

describe('toPath', () => {
  it('returns an empty string for an empty series', () => {
    // '' lets the caller skip the <path> entirely; d="" warns in some engines.
    assert.equal(toPath([]), '')
  })

  it('gives a single point a visible 1px tick, not an empty path', () => {
    // One sample is still data. An invisible path reads as "nothing here".
    const d = toPath([{ x: 10, y: 20 }])
    assert.equal(d, 'M10.00 20.00 L11.00 20.00')
    assert.ok(d.includes('L'), 'a lone sample must still draw something')
  })

  it('emits M once and L thereafter, two decimals', () => {
    const d = toPath([
      { x: 0, y: 0 },
      { x: 5.125, y: 10 },
      { x: 10, y: 2 },
    ])
    assert.equal(d, 'M0.00 0.00 L5.13 10.00 L10.00 2.00')
    assert.equal(d.match(/M/g)?.length, 1)
  })

  it('round-trips a real 7-day series without NaN in the path', () => {
    const values = [0, 0, 4.5, 0, 12, 3, 0]
    const domain = niceTicks(Math.min(...values), Math.max(...values))
    const d = toPath(project(values, domain, BOX))
    assert.ok(!d.includes('NaN'), d)
    assert.match(d, /^M[\d.-]+ [\d.-]+( L[\d.-]+ [\d.-]+)+$/)
  })
})

// ── shares ───────────────────────────────────────────────────────────────────

describe('shares', () => {
  it('splits a normal set into percentages', () => {
    assert.deepEqual(shares([1, 1, 2]), [25, 25, 50])
    assert.deepEqual(shares([3, 1]), [75, 25])
  })

  it('returns zeros — never NaN — for a zero total', () => {
    // Day one of the ledger: the INTERACCIONES → HL table renders before a
    // single event exists. NaN% in a cell is worse than 0%.
    assert.deepEqual(shares([0, 0, 0, 0]), [0, 0, 0, 0])
    for (const v of shares([0, 0, 0, 0])) assert.ok(!Number.isNaN(v))
  })

  it('returns an empty array for an empty set', () => {
    assert.deepEqual(shares([]), [])
  })

  it('returns zeros for a non-positive total rather than a negative percentage', () => {
    // Decay rows carry negative weights. If one is ever handed to shares() the
    // honest answer is "no share", not −137 %.
    assert.deepEqual(shares([-5, -3]), [0, 0])
  })

  it('rounds to one decimal and does NOT force the set to sum to 100', () => {
    // Thirds sum to 99.9. Consumers must print the parts, never derive a
    // remainder from 100 − Σ.
    const s = shares([1, 1, 1])
    assert.deepEqual(s, [33.3, 33.3, 33.3])
    assert.equal(round(s.reduce((a, b) => a + b, 0), 1), 99.9)
  })

  it('gives a single non-zero entry the whole 100', () => {
    assert.deepEqual(shares([7]), [100])
    assert.deepEqual(shares([0, 9, 0]), [0, 100, 0])
  })
})
