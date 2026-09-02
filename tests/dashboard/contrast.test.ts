// «EL PLIEGO» visual-system gates — WCAG contrast for the light-surface
// palette, token-collision guard, and hlBracket boundary parity with the
// two legacy copies. Run: npx tsx --test tests/dashboard/contrast.test.ts
//
// Covers three palettes, all of which render as TEXT on the two paper grounds:
// CATEGORY_ON_LIGHT (content types), KIND_ON_LIGHT (HL ledger kinds) and
// SERIES_ON_LIGHT (the FLUJO DE VIDA lines). The first two share a table row
// in /admin's CONTENIDO tab, so they are also checked for aliasing.

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
import {
  KIND_CODES,
  KIND_LABELS,
  KIND_ON_LIGHT,
  SERIES_LABELS,
  SERIES_ON_LIGHT,
} from '@/lib/hp/kinds'

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
        'franja',
        'listicle',
        'mix',
        'noticia',
        'opinion',
        'review',
      ],
    )
  })
})

// ── HL ledger kind swatches on both light grounds ─────────────────────────

describe('KIND_ON_LIGHT — the six ledger kinds', () => {
  for (const [kind, hex] of Object.entries(KIND_ON_LIGHT)) {
    it(`${kind} ${hex} ≥4.5:1 on paper and paper-raised`, () => {
      const onPaper = contrast(hex, DASH_PAPER)
      const onRaised = contrast(hex, DASH_PAPER_RAISED)
      assert.ok(onPaper >= 4.5, `${kind} on paper: ${onPaper.toFixed(2)}:1 < 4.5:1`)
      assert.ok(
        onRaised >= 4.5,
        `${kind} on paper-raised: ${onRaised.toFixed(2)}:1 < 4.5:1`,
      )
    })
  }

  it('all six ledger kinds are covered, no extras', () => {
    // Same exhaustiveness shape as CATEGORY_ON_LIGHT: a seventh kind added to
    // lib/hp/kinds.ts fails here before it can ship an unmeasured swatch.
    assert.deepEqual(Object.keys(KIND_ON_LIGHT).sort(), [
      'admin_adjust',
      'click',
      'comment',
      'decay',
      'open',
      'save',
    ])
  })

  it('every swatch travels with a label and a 2-letter code (§1.5)', () => {
    // Hue is never the only channel. GUARDADO (#9A3412) and AJUSTE ADMIN
    // (#8A5300) are two browns; the code is what separates them.
    for (const kind of Object.keys(KIND_ON_LIGHT)) {
      assert.ok(KIND_LABELS[kind as keyof typeof KIND_LABELS], `${kind} has no label`)
      const code = KIND_CODES[kind as keyof typeof KIND_CODES]
      assert.ok(code, `${kind} has no code`)
      assert.equal(code.length, 2, `${kind} code '${code}' is not 2 letters`)
    }
    assert.equal(new Set(Object.values(KIND_CODES)).size, Object.keys(KIND_CODES).length)
  })
})

// ── Cross-palette aliasing ────────────────────────────────────────────────

describe('KIND_ON_LIGHT × CATEGORY_ON_LIGHT', () => {
  it('shares no hex with the content-type palette', () => {
    // A CONTENIDO row carries a content-type swatch and a kind breakdown side
    // by side. If the two palettes alias, the row reads as one legend and the
    // colour stops meaning anything.
    const categories = new Map(
      Object.entries(CATEGORY_ON_LIGHT).map(([t, hex]) => [hex.toUpperCase(), t]),
    )
    for (const [kind, hex] of Object.entries(KIND_ON_LIGHT)) {
      const clash = categories.get(hex.toUpperCase())
      assert.equal(clash, undefined, `kind '${kind}' aliases content type '${clash}' at ${hex}`)
    }
  })
})

// ── FLUJO DE VIDA series lines ────────────────────────────────────────────

describe('SERIES_ON_LIGHT — the three chart lines', () => {
  for (const [series, hex] of Object.entries(SERIES_ON_LIGHT)) {
    it(`${series} ${hex} ≥4.5:1 on paper and paper-raised`, () => {
      // These are stroked lines AND their legend text, so the text threshold
      // is the one that governs — a 1px stroke is thinner than any glyph.
      const onPaper = contrast(hex, DASH_PAPER)
      const onRaised = contrast(hex, DASH_PAPER_RAISED)
      assert.ok(onPaper >= 4.5, `${series} on paper: ${onPaper.toFixed(2)}:1 < 4.5:1`)
      assert.ok(
        onRaised >= 4.5,
        `${series} on paper-raised: ${onRaised.toFixed(2)}:1 < 4.5:1`,
      )
    })
  }

  it('all three series are covered, no extras, each labelled', () => {
    assert.deepEqual(Object.keys(SERIES_ON_LIGHT).sort(), [
      'decaimiento',
      'hlNeto',
      'hpCreadores',
    ])
    assert.deepEqual(Object.keys(SERIES_LABELS).sort(), Object.keys(SERIES_ON_LIGHT).sort())
  })

  it('the three lines are mutually distinguishable', () => {
    // Three overlaid strokes on one chart. Identical hexes would make two of
    // them one line, and the legend would claim otherwise.
    const hexes = Object.values(SERIES_ON_LIGHT).map((h) => h.toUpperCase())
    assert.equal(new Set(hexes).size, hexes.length)
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
