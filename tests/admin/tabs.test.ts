// «CENTRAL DE ADMINISTRACIÓN» — tab model unit tests (lib/admin/tabs).
// Run: npx tsx --test tests/admin/tabs.test.ts
// (tsx resolves the @/ alias from tsconfig paths — same rig as tests/mapa.)
//
// Small module, large blast radius. Three things are pinned here:
//
//   1. The legacy ?tab= aliases still land somewhere real. `/admin?tab=franjas`
//      is a live link from app/dashboard/page.tsx and the team has months of
//      bookmarks on the pre-redesign values; a silent fall to RESUMEN reads as
//      "the panel lost my page".
//   2. adminTabHref → resolveAdminTab round-trips for EVERY tab. Before the
//      redesign the page fell back to 'invites' while the tab bar cast the raw
//      param straight to its union, so an unknown ?tab= rendered one tab's
//      content with NO tab latched. Round-tripping is the regression that
//      catches the page and the bar disagreeing about where you are.
//   3. resolveAdminTab is total: whatever arrives in the query string, the
//      value handed to the renderer is a member of ADMIN_TABS.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ADMIN_TABS,
  ADMIN_TAB_LABELS,
  LEGACY_SUBTAB,
  adminTabHref,
  resolveAdminTab,
  type AdminTab,
} from '@/lib/admin/tabs'

const DEFAULT_TAB: AdminTab = 'resumen'
const TABS = new Set<string>(ADMIN_TABS)

/**
 * The pre-redesign ?tab= values and where they must land.
 *
 * Mirrored here because LEGACY is module-private in lib/admin/tabs.ts. Every
 * assertion below iterates THIS table rather than naming cases inline, so an
 * alias added to both sides is covered without editing a test body — and the
 * drift guard further down fails if the exported half of the alias table
 * (LEGACY_SUBTAB) grows a key this mirror does not know about.
 */
const LEGACY_ALIASES: Record<string, AdminTab> = {
  invites: 'acceso',
  espera: 'acceso',
  users: 'usuarios',
  events: 'eventos',
  franjas: 'franjas',
}

/** The ?tab= value a canonical href actually carries. */
function paramOf(href: string): string | null {
  const qs = href.split('?')[1] ?? ''
  return new URLSearchParams(qs).get('tab')
}

// ── The tab set itself ───────────────────────────────────────────────────────

describe('ADMIN_TABS', () => {
  it('has no duplicates', () => {
    assert.equal(new Set(ADMIN_TABS).size, ADMIN_TABS.length)
  })

  it('opens on the default tab', () => {
    assert.equal(ADMIN_TABS[0], DEFAULT_TAB)
  })

  it('labels every tab and labels nothing else', () => {
    // A tab with no label renders an empty button in the bar — the same class
    // of bug tests/dashboard/espacios.test.ts pins for the dashboard spaces.
    assert.deepEqual(Object.keys(ADMIN_TAB_LABELS).sort(), [...ADMIN_TABS].sort())
    for (const tab of ADMIN_TABS) {
      assert.ok(ADMIN_TAB_LABELS[tab].length > 0, `${tab} has an empty label`)
      assert.equal(
        ADMIN_TAB_LABELS[tab],
        ADMIN_TAB_LABELS[tab].toUpperCase(),
        `${tab} label is not mono-uppercase chrome`,
      )
    }
  })
})

// ── Legacy aliases ───────────────────────────────────────────────────────────

describe('resolveAdminTab — legacy ?tab= values', () => {
  for (const [legacy, expected] of Object.entries(LEGACY_ALIASES)) {
    it(`?tab=${legacy} → ${expected}`, () => {
      const got = resolveAdminTab(legacy)
      assert.ok(TABS.has(got), `${legacy} resolved outside ADMIN_TABS: ${got}`)
      assert.equal(got, expected)
    })
  }

  it('no legacy value silently falls to the default', () => {
    // The property that matters more than any single mapping: an old bookmark
    // must land where it meant to, not on the overview.
    for (const legacy of Object.keys(LEGACY_ALIASES)) {
      assert.notEqual(
        resolveAdminTab(legacy),
        DEFAULT_TAB,
        `${legacy} lost its destination and fell to ${DEFAULT_TAB}`,
      )
    }
  })

  it('every sub-tab-selecting alias is a real alias, not a real tab', () => {
    // Drift guard on the module-private LEGACY table. A key in LEGACY_SUBTAB
    // that is ALSO in ADMIN_TABS would take the direct-match branch and its
    // sub-tab would never be selected; a key this mirror does not carry means
    // the alias table grew and this file went stale.
    for (const key of LEGACY_SUBTAB.keys()) {
      assert.ok(!TABS.has(key), `'${key}' is a real tab — its sub-tab is dead`)
      assert.ok(
        key in LEGACY_ALIASES,
        `LEGACY_SUBTAB has '${key}' but this test's alias mirror does not`,
      )
      assert.ok(TABS.has(resolveAdminTab(key)), `'${key}' resolves nowhere real`)
    }
  })
})

// ── Fallback ─────────────────────────────────────────────────────────────────

describe('resolveAdminTab — fallback', () => {
  it('falls to RESUMEN for empty, blank and missing values', () => {
    for (const raw of ['', '   ', null, undefined]) {
      assert.equal(resolveAdminTab(raw), DEFAULT_TAB, `${JSON.stringify(raw)}`)
    }
  })

  it('falls to RESUMEN for unknown values', () => {
    for (const raw of ['bogus', 'INVITACIONES', 'Usuarios', 'acceso ', '../acceso', 'tab']) {
      assert.equal(resolveAdminTab(raw), DEFAULT_TAB, raw)
    }
  })

  it('is case-sensitive — an uppercased tab id is not a tab id', () => {
    assert.equal(resolveAdminTab('USUARIOS'), DEFAULT_TAB)
    assert.equal(resolveAdminTab('Acceso'), DEFAULT_TAB)
  })

  it('is idempotent', () => {
    for (const raw of [...ADMIN_TABS, ...Object.keys(LEGACY_ALIASES), 'bogus', '']) {
      const once = resolveAdminTab(raw)
      assert.equal(resolveAdminTab(once), once, raw)
    }
  })

  it('is TOTAL — every input resolves to a member of ADMIN_TABS', () => {
    // ?tab= is raw URL input. Anything that escapes ADMIN_TABS reaches the
    // renderer as an active tab id that no tab matches: content panel blank,
    // nothing latched in the bar.
    const corpus = [
      ...ADMIN_TABS,
      ...Object.keys(LEGACY_ALIASES),
      '',
      '   ',
      'bogus',
      '0',
      'false',
      '__proto__',
      'constructor',
      'prototype',
      'toString',
      'valueOf',
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
      'toLocaleString',
    ]
    for (const raw of corpus) {
      const got: unknown = resolveAdminTab(raw)
      assert.equal(typeof got, 'string', `?tab=${raw} resolved to a ${typeof got}`)
      assert.ok(
        TABS.has(got as string),
        `?tab=${raw} escaped ADMIN_TABS as ${JSON.stringify(String(got)).slice(0, 60)}`,
      )
    }
  })
})

// ── Hrefs ────────────────────────────────────────────────────────────────────

describe('adminTabHref', () => {
  it('gives the default tab the bare /admin URL', () => {
    assert.equal(adminTabHref(DEFAULT_TAB), '/admin')
    assert.equal(paramOf(adminTabHref(DEFAULT_TAB)), null)
  })

  it('gives every other tab a deep link on its own id', () => {
    for (const tab of ADMIN_TABS) {
      if (tab === DEFAULT_TAB) continue
      assert.equal(adminTabHref(tab), `/admin?tab=${tab}`)
    }
  })

  it('exactly one tab claims the bare /admin URL', () => {
    // Two tabs on '/admin' means the bar latches whichever is checked first
    // and the other is unreachable by link.
    const bare = ADMIN_TABS.filter((t) => adminTabHref(t) === '/admin')
    assert.deepEqual(bare, [DEFAULT_TAB])
  })

  it('the bare /admin URL resolves to the default tab', () => {
    assert.equal(resolveAdminTab(paramOf('/admin')), DEFAULT_TAB)
    assert.equal(resolveAdminTab(new URLSearchParams('').get('tab')), DEFAULT_TAB)
  })

  it('ROUND-TRIP: resolveAdminTab(param of href) === tab, for every tab', () => {
    // The regression. The page and the tab bar both derive the active tab from
    // the URL; if the href a tab emits does not resolve back to that same tab,
    // clicking it lands the reader somewhere the bar does not admit to.
    for (const tab of ADMIN_TABS) {
      assert.equal(
        resolveAdminTab(paramOf(adminTabHref(tab))),
        tab,
        `${tab} does not survive its own href`,
      )
    }
  })

  it('hrefs are unique per tab', () => {
    const hrefs = ADMIN_TABS.map(adminTabHref)
    assert.equal(new Set(hrefs).size, hrefs.length)
  })

  it('every href stays under /admin and needs no encoding', () => {
    for (const tab of ADMIN_TABS) {
      const href = adminTabHref(tab)
      assert.ok(href.startsWith('/admin'), href)
      assert.equal(href, encodeURI(href), `${href} would be re-encoded by the router`)
    }
  })
})
