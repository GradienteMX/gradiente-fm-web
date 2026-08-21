// «EL PLIEGO» visual-system gates — WCAG contrast for the light-surface
// palette, token-collision guard, and hlBracket boundary parity with the
// two legacy copies. Run: npx tsx --test tests/dashboard/contrast.test.ts

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import defaultTheme from 'tailwindcss/defaultTheme'
import colors from 'tailwindcss/colors'

import {
  CATEGORY_ON_LIGHT,
  DASH_ACID,
  DASH_INK,
  DASH_INK_FAINT,
  DASH_INK_SOFT,
  DASH_PANEL,
  DASH_PANEL_TEXT,
  DASH_PAPER,
  DASH_PAPER_RAISED,
  DASH_SYS_RED,
} from '@/lib/dashboard/palette'
import { hlBracket } from '@/lib/dashboard/hl'

// ── WCAG 2.1 relative luminance + contrast ratio ──────────────────────────

function channel(hex8: number): number {
  const c = hex8 / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  assert.ok(m, `not a 6-digit hex: ${hex}`)
  const n = parseInt(m[1], 16)
  return (
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff)
  )
}

function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// ── §1.5 category colors on both light grounds ────────────────────────────

describe('categoryColorOnLight — §1.5 map', () => {
  for (const [type, hex] of Object.entries(CATEGORY_ON_LIGHT)) {
    it(`${type} ${hex} ≥4.5:1 on paper and paper-raised`, () => {
      const onPaper = contrast(hex, DASH_PAPER)
      const onRaised = contrast(hex, DASH_PAPER_RAISED)
      assert.ok(
        onPaper >= 4.5,
        `${type} on paper: ${onPaper.toFixed(2)}:1 < 4.5:1`,
      )
      assert.ok(
        onRaised >= 4.5,
        `${type} on paper-raised: ${onRaised.toFixed(2)}:1 < 4.5:1`,
      )
    })
  }

  it('all nine content types are covered, no extras', () => {
    assert.deepEqual(
      Object.keys(CATEGORY_ON_LIGHT).sort(),
      [
        'articulo',
        'editorial',
        'evento',
        'listicle',
        'mix',
        'noticia',
        'opinion',
        'partner',
        'review',
      ],
    )
  })
})

// ── §1.1 measured pairs ───────────────────────────────────────────────────

describe('§1.1 palette pairs', () => {
  const pairs: Array<[string, string, string, number]> = [
    ['ink on paper', DASH_INK, DASH_PAPER, 15],
    ['ink on paper-raised', DASH_INK, DASH_PAPER_RAISED, 15],
    ['ink-soft on paper', DASH_INK_SOFT, DASH_PAPER, 7], // AAA
    ['ink-faint on paper', DASH_INK_FAINT, DASH_PAPER, 4.5],
    ['ink-faint on paper-raised', DASH_INK_FAINT, DASH_PAPER_RAISED, 4.5],
    ['sys-red-paper on paper', DASH_SYS_RED, DASH_PAPER, 4.5],
    ['panel-text on panel', DASH_PANEL_TEXT, DASH_PANEL, 15],
    ['ink on acid (fill block)', DASH_INK, DASH_ACID, 7],
    ['acid on panel', DASH_ACID, DASH_PANEL, 7],
  ]
  for (const [name, fg, bg, min] of pairs) {
    it(`${name} ≥${min}:1`, () => {
      const r = contrast(fg, bg)
      assert.ok(r >= min, `${name}: ${r.toFixed(2)}:1 < ${min}:1`)
    })
  }

  it('acid is illegible as text on paper (whitelist rationale holds)', () => {
    assert.ok(contrast(DASH_ACID, DASH_PAPER) < 3)
  })
})

// ── Token-collision guard ─────────────────────────────────────────────────
// New tailwind.config.ts keys must not shadow a default-theme scale entry or
// a stock color family name.

describe('tailwind token names', () => {
  const newColorTokens = [
    'paper',
    'paper-raised',
    'ink',
    'ink-soft',
    'ink-faint',
    'acid',
    'sys-red-paper',
    'panel',
    'panel-text',
  ]
  const newFontSizeTokens = ['d11', 'd13', 'd15', 'd18', 'd28', 'display']
  const newShadowTokens = ['lift', 'lift-deep']

  it('color tokens collide with no stock color family', () => {
    const stock = new Set(Object.keys(colors))
    for (const t of newColorTokens) {
      assert.ok(!stock.has(t), `color token '${t}' shadows a stock color`)
    }
  })

  it('fontSize tokens collide with no default fontSize key', () => {
    const stock = new Set(Object.keys(defaultTheme.fontSize ?? {}))
    for (const t of newFontSizeTokens) {
      assert.ok(!stock.has(t), `fontSize token '${t}' shadows a default size`)
    }
  })

  it('boxShadow tokens collide with no default boxShadow key', () => {
    const stock = new Set(Object.keys(defaultTheme.boxShadow ?? {}))
    for (const t of newShadowTokens) {
      assert.ok(!stock.has(t), `boxShadow token '${t}' shadows a default`)
    }
  })
})

// ── hlBracket parity with the legacy copies ───────────────────────────────
// ContentCard.tsx HL_TIERS and HarvestConfirmModal.tsx hlBracket both use
// strict `<` against 5/15/30/60. Boundary values therefore land in the
// UPPER bracket (hp=5 → MODESTO). These fixtures encode that behavior.

describe('hlBracket boundaries (=== legacy)', () => {
  const cases: Array<[number, string]> = [
    [0, 'DÉBIL'],
    [4.99, 'DÉBIL'],
    [5, 'MODESTO'],
    [14.99, 'MODESTO'],
    [15, 'NOTABLE'],
    [29.99, 'NOTABLE'],
    [30, 'FUERTE'],
    [59.99, 'FUERTE'],
    [60, 'PLENO'],
    [1000, 'PLENO'],
    [Infinity, 'PLENO'],
  ]
  for (const [hp, label] of cases) {
    it(`hp=${hp} → ${label}`, () => {
      assert.equal(hlBracket(hp), label)
    })
  }
})
