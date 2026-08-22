// «EL PLIEGO» — layout engine unit tests (BUILD_PLAN WP0-D).
// Run: npx tsx --test tests/dashboard/layout.test.ts
// (tsx resolves the @/ alias from tsconfig paths — same rig as tests/mapa.)
//
// Covers the properties the grid substrate must guarantee:
//   1. determinism (same input → same output, input-order-free)
//   2. forward-compat reads (unknown ids dropped, missing ids appended)
//   3. no-overlap invariant + column bounds
//   4. top-left gravity (widgets float up; vacated space collapses)
//   5. tablet halve-and-pack remap
//   6. mobileOrder derivation + normalization

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ALL_WIDGET_IDS,
  COMPACT_H,
  DEFAULT_DESKTOP_LAYOUT,
  DEFAULT_MOBILE_ORDER,
  DESKTOP_COLS,
  TABLET_COLS,
  TABLET_MIN_W,
  WIDGET_DEFS,
  applyCompactModes,
  defaultLayoutMeta,
  defaultSize,
  deriveMobileOrder,
  nextAllowedSize,
  normalizeLayoutMeta,
  packLayout,
  packedHeight,
  remapToTablet,
  snapToAllowedSize,
  visibleEntries,
  type LayoutEntry,
  type WidgetId,
} from '@/lib/dashboard/layout'

// ── Helpers ──────────────────────────────────────────────────────────────────

function assertNoOverlap(entries: readonly LayoutEntry[], cols: number) {
  for (const entry of entries) {
    assert.ok(entry.x >= 0, `${entry.id} x >= 0`)
    assert.ok(entry.y >= 0, `${entry.id} y >= 0`)
    assert.ok(entry.x + entry.w <= cols, `${entry.id} fits ${cols} cols`)
  }
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]
      const b = entries[j]
      const overlap =
        a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
      assert.ok(!overlap, `${a.id} overlaps ${b.id}`)
    }
  }
}

function shuffle<T>(input: readonly T[], seed: number): T[] {
  // Deterministic LCG shuffle — tests must not use Math.random.
  const out = [...input]
  let state = seed
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) % 2147483648
    const j = state % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ── Registry + defaults ──────────────────────────────────────────────────────

describe('registry and defaults', () => {
  it('every widget declares 2–6 allowed sizes within grid bounds', () => {
    for (const id of ALL_WIDGET_IDS) {
      const sizes = WIDGET_DEFS[id].allowedSizes
      assert.ok(sizes.length >= 2 && sizes.length <= 6, `${id} has ${sizes.length} states`)
      for (const size of sizes) {
        assert.ok(size.w >= 1 && size.w <= DESKTOP_COLS, `${id} width in bounds`)
        assert.ok(size.h >= 1, `${id} height positive`)
      }
    }
  })

  it('default desktop layout covers all widgets, matches allowedSizes, no overlap', () => {
    assert.deepEqual(
      [...DEFAULT_DESKTOP_LAYOUT].map((e) => e.id).sort(),
      [...ALL_WIDGET_IDS].sort()
    )
    assertNoOverlap(DEFAULT_DESKTOP_LAYOUT, DESKTOP_COLS)
    for (const entry of DEFAULT_DESKTOP_LAYOUT) {
      const snapped = snapToAllowedSize(entry.id, entry.w, entry.h)
      assert.deepEqual({ w: entry.w, h: entry.h }, snapped, `${entry.id} default size is a named state`)
    }
  })

  it('default layout is already packed (packer is a no-op on it)', () => {
    assert.deepEqual(packLayout(DEFAULT_DESKTOP_LAYOUT, DESKTOP_COLS), DEFAULT_DESKTOP_LAYOUT)
  })

  it('default mobile order matches §2.5 stack exactly', () => {
    assert.deepEqual(DEFAULT_MOBILE_ORDER, [
      'crear',
      'cultivar',
      'actividad',
      'reproductor',
      'guardados',
      'agenda',
      'novedades',
      'mapa',
      'mercado',
    ])
  })

  it('defaultSize is the first declared state', () => {
    assert.deepEqual(defaultSize('cultivar'), { w: 8, h: 3 })
    assert.deepEqual(defaultSize('mapa'), { w: 4, h: 3 })
  })

  it('nextAllowedSize cycles the declared states and wraps', () => {
    const first = defaultSize('actividad')
    let cursor = first
    const seen = [cursor]
    for (let i = 0; i < WIDGET_DEFS.actividad.allowedSizes.length - 1; i++) {
      cursor = nextAllowedSize('actividad', cursor)
      seen.push(cursor)
    }
    assert.deepEqual(seen, [...WIDGET_DEFS.actividad.allowedSizes])
    assert.deepEqual(nextAllowedSize('actividad', cursor), first)
  })
})

// ── Packer ───────────────────────────────────────────────────────────────────

describe('packer', () => {
  it('is deterministic: identical input → identical output', () => {
    const input: LayoutEntry[] = [
      { id: 'guardados', x: 0, y: 4, w: 7, h: 2 },
      { id: 'agenda', x: 5, y: 9, w: 4, h: 2 },
      { id: 'cultivar', x: 0, y: 0, w: 8, h: 3 },
    ]
    assert.deepEqual(packLayout(input, DESKTOP_COLS), packLayout(input, DESKTOP_COLS))
  })

  it('is input-order-free: any permutation → same output (ties break on id)', () => {
    const base: LayoutEntry[] = [
      { id: 'novedades', x: 0, y: 2, w: 5, h: 2 },
      { id: 'agenda', x: 0, y: 2, w: 4, h: 2 }, // deliberate (y,x) tie with novedades
      { id: 'cultivar', x: 0, y: 0, w: 8, h: 3 },
      { id: 'actividad', x: 8, y: 0, w: 4, h: 3 },
      { id: 'mapa', x: 9, y: 6, w: 3, h: 2 },
    ]
    const reference = packLayout(base, DESKTOP_COLS)
    for (const seed of [1, 7, 23, 99]) {
      assert.deepEqual(packLayout(shuffle(base, seed), DESKTOP_COLS), reference)
    }
  })

  it('never produces overlaps, even from a fully colliding input', () => {
    const collided: LayoutEntry[] = ALL_WIDGET_IDS.map((id) => ({
      id,
      x: 0,
      y: 0,
      w: defaultSize(id).w,
      h: defaultSize(id).h,
    }))
    assertNoOverlap(packLayout(collided, DESKTOP_COLS), DESKTOP_COLS)
  })

  it('applies top-left gravity: a widget with empty rows above floats up', () => {
    const floating: LayoutEntry[] = [
      { id: 'cultivar', x: 0, y: 0, w: 8, h: 3 },
      { id: 'guardados', x: 0, y: 9, w: 7, h: 2 }, // gap of 6 empty rows above
    ]
    const packed = packLayout(floating, DESKTOP_COLS)
    const guardados = packed.find((e) => e.id === 'guardados')
    assert.equal(guardados?.y, 3)
  })

  it('lets a narrow widget float past a wide one into a side gap', () => {
    const input: LayoutEntry[] = [
      { id: 'cultivar', x: 0, y: 0, w: 8, h: 3 },
      { id: 'mapa', x: 9, y: 5, w: 3, h: 2 }, // cols 9–11 are free at y0
    ]
    const packed = packLayout(input, DESKTOP_COLS)
    const mapa = packed.find((e) => e.id === 'mapa')
    assert.deepEqual({ x: mapa?.x, y: mapa?.y }, { x: 9, y: 0 })
  })

  it('pushes a collided later widget down, preserving its column', () => {
    const input: LayoutEntry[] = [
      { id: 'cultivar', x: 0, y: 0, w: 8, h: 3 },
      { id: 'guardados', x: 0, y: 1, w: 7, h: 2 }, // collides inside cultivar
    ]
    const packed = packLayout(input, DESKTOP_COLS)
    const guardados = packed.find((e) => e.id === 'guardados')
    assert.deepEqual({ x: guardados?.x, y: guardados?.y }, { x: 0, y: 3 })
  })

  it('clamps out-of-bounds coordinates into the column span', () => {
    const input: LayoutEntry[] = [{ id: 'agenda', x: 11, y: -2, w: 4, h: 2 }]
    const packed = packLayout(input, DESKTOP_COLS)
    assert.deepEqual(packed[0], { id: 'agenda', x: 8, y: 0, w: 4, h: 2 })
  })

  it('packedHeight reports the bottom edge', () => {
    assert.equal(packedHeight(DEFAULT_DESKTOP_LAYOUT), 11)
    assert.equal(packedHeight([]), 0)
  })
})

// ── Tablet remap ─────────────────────────────────────────────────────────────

describe('tablet remap', () => {
  it('halves widths with a floor of 3, fits 6 cols, no overlap', () => {
    const remapped = remapToTablet(DEFAULT_DESKTOP_LAYOUT)
    assert.equal(remapped.length, DEFAULT_DESKTOP_LAYOUT.length)
    assertNoOverlap(remapped, TABLET_COLS)
    for (const entry of remapped) {
      const original = DEFAULT_DESKTOP_LAYOUT.find((e) => e.id === entry.id)
      assert.ok(original)
      const expectedW = Math.min(
        TABLET_COLS,
        Math.max(TABLET_MIN_W, Math.ceil(original.w / 2))
      )
      assert.equal(entry.w, expectedW, `${entry.id} width halved`)
      assert.equal(entry.h, original.h, `${entry.id} height preserved`)
    }
  })

  it('is deterministic and derived (never depends on input order)', () => {
    const reference = remapToTablet(DEFAULT_DESKTOP_LAYOUT)
    assert.deepEqual(remapToTablet(shuffle(DEFAULT_DESKTOP_LAYOUT, 42)), reference)
  })

  it('keeps reading order stable: crear still leads', () => {
    const remapped = remapToTablet(DEFAULT_DESKTOP_LAYOUT)
    assert.equal(deriveMobileOrder(remapped)[0], 'crear')
  })
})

// ── Mobile order ─────────────────────────────────────────────────────────────

describe('mobileOrder', () => {
  it('derives reading order (y, then x) from a layout', () => {
    assert.deepEqual(deriveMobileOrder(DEFAULT_DESKTOP_LAYOUT), [
      'crear',
      'cultivar',
      'guardados',
      'mapa',
      'reproductor',
      'novedades',
      'agenda',
      'actividad',
      'mercado',
    ])
  })

  it('is input-order-free', () => {
    assert.deepEqual(
      deriveMobileOrder(shuffle(DEFAULT_DESKTOP_LAYOUT, 13)),
      deriveMobileOrder(DEFAULT_DESKTOP_LAYOUT)
    )
  })
})

// ── normalizeLayoutMeta (§2.4 forward-compat) ────────────────────────────────

describe('normalizeLayoutMeta', () => {
  it('unknown v → defaults win', () => {
    // v1 = pre-ship judging schema (round-3 bump); v2 = the pre-scale-pass
    // schema, retired by the round-4 bump. Both normalize to v3 defaults.
    assert.deepEqual(normalizeLayoutMeta({ v: 1, layout: [] }), defaultLayoutMeta())
    assert.deepEqual(normalizeLayoutMeta({ v: 2, layout: [] }), defaultLayoutMeta())
    assert.deepEqual(normalizeLayoutMeta({ v: 99, layout: [] }), defaultLayoutMeta())
    assert.deepEqual(normalizeLayoutMeta(null), defaultLayoutMeta())
    assert.deepEqual(normalizeLayoutMeta(undefined), defaultLayoutMeta())
    assert.deepEqual(normalizeLayoutMeta('garbage'), defaultLayoutMeta())
  })

  it('drops unknown widget ids everywhere', () => {
    const meta = normalizeLayoutMeta({
      v: 4,
      layout: [
        { id: 'cultivar', x: 0, y: 0, w: 8, h: 3 },
        { id: 'widgetzilla', x: 0, y: 3, w: 4, h: 2 },
      ],
      hidden: ['widgetzilla', 'mapa'],
      mobileOrder: ['widgetzilla', 'cultivar'],
    })
    const ids = meta.layout.map((e) => e.id)
    assert.ok(!ids.includes('widgetzilla' as WidgetId))
    assert.deepEqual(meta.hidden, ['mapa'])
    assert.ok(!meta.mobileOrder.includes('widgetzilla' as WidgetId))
  })

  it('appends missing widgets at the bottom at their default size', () => {
    const meta = normalizeLayoutMeta({
      v: 4,
      layout: [{ id: 'cultivar', x: 0, y: 0, w: 8, h: 3 }],
      hidden: [],
      mobileOrder: [],
    })
    assert.deepEqual([...meta.layout.map((e) => e.id)].sort(), [...ALL_WIDGET_IDS].sort())
    assertNoOverlap(meta.layout, DESKTOP_COLS)
    // Every appended widget sits at or below cultivar's bottom edge — except
    // narrow ones the packer legitimately floats into the free right columns.
    const cultivar = meta.layout.find((e) => e.id === 'cultivar')
    assert.deepEqual({ x: cultivar?.x, y: cultivar?.y }, { x: 0, y: 0 })
    for (const entry of meta.layout) {
      const size = defaultSize(entry.id)
      assert.deepEqual({ w: entry.w, h: entry.h }, size, `${entry.id} at default size`)
    }
  })

  it('snaps stored sizes to the nearest allowed state', () => {
    const meta = normalizeLayoutMeta({
      v: 4,
      layout: [{ id: 'guardados', x: 0, y: 0, w: 9, h: 2 }], // 9 is not a state; 7 or 12
      hidden: [],
      mobileOrder: [],
    })
    const guardados = meta.layout.find((e) => e.id === 'guardados')
    assert.deepEqual({ w: guardados?.w, h: guardados?.h }, { w: 7, h: 2 })
  })

  it('drops duplicate entries (first wins) and malformed rows', () => {
    const meta = normalizeLayoutMeta({
      v: 4,
      layout: [
        { id: 'agenda', x: 0, y: 0, w: 4, h: 2 },
        { id: 'agenda', x: 4, y: 0, w: 6, h: 2 },
        { id: 'crear', x: 'NaNsense', y: 0, w: 6, h: 2 },
        42,
      ],
      hidden: [],
      mobileOrder: [],
    })
    assert.equal(meta.layout.filter((e) => e.id === 'agenda').length, 1)
    const agenda = meta.layout.find((e) => e.id === 'agenda')
    assert.deepEqual({ x: agenda?.x, y: agenda?.y }, { x: 0, y: 0 })
    // crear's malformed row is dropped, then crear re-appends at default.
    assert.equal(meta.layout.filter((e) => e.id === 'crear').length, 1)
  })

  it('preserves a stored mobileOrder and appends missing ids in reading order', () => {
    const meta = normalizeLayoutMeta({
      v: 4,
      layout: [...DEFAULT_DESKTOP_LAYOUT],
      hidden: [],
      mobileOrder: ['mapa', 'agenda'],
    })
    assert.deepEqual(meta.mobileOrder.slice(0, 2), ['mapa', 'agenda'])
    assert.deepEqual([...meta.mobileOrder].sort(), [...ALL_WIDGET_IDS].sort())
  })

  it('scopes the registry: non-partner accounts have no mercado anywhere', () => {
    const registry = ALL_WIDGET_IDS.filter((id) => id !== 'mercado')
    const meta = normalizeLayoutMeta(
      {
        v: 4,
        layout: [...DEFAULT_DESKTOP_LAYOUT],
        hidden: ['mercado'],
        mobileOrder: [...DEFAULT_MOBILE_ORDER],
      },
      registry
    )
    assert.ok(!meta.layout.some((e) => e.id === 'mercado'))
    assert.ok(!meta.hidden.includes('mercado'))
    assert.ok(!meta.mobileOrder.includes('mercado'))
  })

  it('round-trips the default meta unchanged', () => {
    const defaults = defaultLayoutMeta()
    assert.deepEqual(normalizeLayoutMeta(defaults), defaults)
  })

  it('is deterministic for identical raw input', () => {
    const raw = {
      v: 4,
      layout: shuffle(DEFAULT_DESKTOP_LAYOUT, 5),
      hidden: ['mapa'],
      mobileOrder: ['crear'],
    }
    assert.deepEqual(normalizeLayoutMeta(raw), normalizeLayoutMeta(raw))
  })
})

// ── Visible entries + compact mode ───────────────────────────────────────────

describe('visibleEntries', () => {
  it('excludes hidden widgets and collapses their space', () => {
    const meta = normalizeLayoutMeta({
      v: 4,
      layout: [...DEFAULT_DESKTOP_LAYOUT],
      hidden: ['crear', 'cultivar'], // the whole first band
      mobileOrder: [],
    })
    const visible = visibleEntries(meta)
    assert.ok(!visible.some((e) => e.id === 'crear' || e.id === 'cultivar'))
    assertNoOverlap(visible, DESKTOP_COLS)
    // guardados floats up into the vacated rows.
    assert.equal(visible.find((e) => e.id === 'guardados')?.y, 0)
  })
})

describe('applyCompactModes', () => {
  it('collapses empty widgets to h=1 and re-packs the space', () => {
    const { entries, compact } = applyCompactModes(DEFAULT_DESKTOP_LAYOUT, {
      guardados: false,
      mapa: false,
      reproductor: false,
    })
    assert.deepEqual([...compact].sort(), ['guardados', 'mapa', 'reproductor'])
    const guardados = entries.find((e) => e.id === 'guardados')
    assert.equal(guardados?.h, COMPACT_H)
    assertNoOverlap(entries, DESKTOP_COLS)
    // The row below the collapsed band floats up by the freed height.
    const novedades = entries.find((e) => e.id === 'novedades')
    assert.equal(novedades?.y, 4)
    assert.ok(packedHeight(entries) < packedHeight(DEFAULT_DESKTOP_LAYOUT))
  })

  it('never compacts CREAR (the chips are unconditional content)', () => {
    const { entries, compact } = applyCompactModes(DEFAULT_DESKTOP_LAYOUT, {
      crear: false,
    })
    assert.equal(compact.size, 0)
    assert.equal(entries.find((e) => e.id === 'crear')?.h, 3)
  })

  it('treats undefined presence as has-data (no compaction on unknown)', () => {
    const { entries, compact } = applyCompactModes(DEFAULT_DESKTOP_LAYOUT, {})
    assert.equal(compact.size, 0)
    assert.deepEqual(entries, DEFAULT_DESKTOP_LAYOUT)
  })
})
