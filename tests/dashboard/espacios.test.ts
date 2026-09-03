// «EL PLIEGO» fase D/F — spaces model + paper-ground route matcher.
// Run: npx tsx --test tests/dashboard/espacios.test.ts
//
// Two small modules with outsized blast radius:
//
//   1. lib/dashboard/espacios — decides which dashboard tabs a viewer gets.
//      The recon's predicted fase-D bug was a tab that renders with an empty
//      body, so the gating rule ("no grant, no tab") is pinned here, together
//      with the fallback that a stale or forged ?espacio= never errors.
//      Since RECEPCIÓN the gate is data (`FRANJA_ONLY_ESPACIOS`) rather than a
//      boolean chain, so the assertions below are written against that list:
//      a space added later inherits the ungated default AND the coverage,
//      instead of needing a new hand-written case per space.
//
//   2. lib/chrome/paperRoutes — decides which routes wear the paper ground.
//      This one had a live trap: with a prefix match, '/foro'.startsWith('/f')
//      is true, so adding the franja dossier ('/f') would have silently
//      flipped the foro's masthead too. The matcher is segment-bounded now and
//      the collision is pinned below so it cannot come back.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_ESPACIO,
  ESPACIO_IDS,
  ESPACIO_LABELS,
  FRANJA_ONLY_ESPACIOS,
  espacioHref,
  isEspacioId,
  resolveEspacio,
  visibleEspacios,
} from '@/lib/dashboard/espacios'
import { PAPER_ROUTES, isPaperRoute } from '@/lib/chrome/paperRoutes'

const TEAM = { isFranjaTeam: true }
const SOLO = { isFranjaTeam: false }

/** Everything the gate list does NOT name — universal by default. */
const UNGATED = ESPACIO_IDS.filter((id) => !FRANJA_ONLY_ESPACIOS.includes(id))

describe('visibleEspacios', () => {
  it('gives a plain account every ungated space, in tab order', () => {
    assert.deepEqual(visibleEspacios(SOLO), ['panel', 'publicar', 'recepcion'])
    // Property form, so a space added later is covered without editing this:
    // the only thing that may be missing from a solo account's tabs is a
    // space the gate list actually names.
    assert.deepEqual(visibleEspacios(SOLO), UNGATED)
  })

  it('gives a franja-team account all five, in tab order', () => {
    assert.deepEqual(visibleEspacios(TEAM), [
      'panel',
      'publicar',
      'franja',
      'mercado',
      'recepcion',
    ])
    assert.deepEqual(visibleEspacios(TEAM), ESPACIO_IDS)
  })

  it('shows RECEPCIÓN to a viewer with no franja — it needs no grant', () => {
    // The universal claim spelled out on its own, because it is the one thing
    // that separates this space from FRANJA/MERCADO: every account accrues HP,
    // so there is no viewer for whom the sheet is empty by construction.
    assert.ok(visibleEspacios(SOLO).includes('recepcion'))
    assert.ok(visibleEspacios(TEAM).includes('recepcion'))
    assert.ok(!FRANJA_ONLY_ESPACIOS.includes('recepcion'))
  })

  it('hides EVERY gated space from a viewer with no franja, and only those', () => {
    const solo = visibleEspacios(SOLO)
    for (const id of ESPACIO_IDS) {
      assert.equal(
        solo.includes(id),
        !FRANJA_ONLY_ESPACIOS.includes(id),
        `${id} visibility must follow the gate list, nothing else`,
      )
    }
  })

  it('never returns a space without a label (no unnamed tab can render)', () => {
    for (const id of visibleEspacios(TEAM)) {
      assert.ok(ESPACIO_LABELS[id], `missing label for ${id}`)
    }
  })

  it('keeps tab order stable — a space is appended, never inserted', () => {
    // DashTabBar renders in this order and users navigate by muscle memory;
    // a new space belongs at the end.
    assert.equal(ESPACIO_IDS[0], DEFAULT_ESPACIO)
    assert.equal(ESPACIO_IDS.indexOf('recepcion'), ESPACIO_IDS.length - 1)
    assert.ok(ESPACIO_IDS.indexOf('recepcion') > ESPACIO_IDS.indexOf('mercado'))
  })
})

describe('resolveEspacio', () => {
  it('resolves a granted space to itself', () => {
    assert.equal(resolveEspacio('mercado', TEAM), 'mercado')
    assert.equal(resolveEspacio('publicar', SOLO), 'publicar')
    assert.equal(resolveEspacio('recepcion', SOLO), 'recepcion')
  })

  it('falls back to PANEL for an UNGRANTED space, never an error', () => {
    // The case that matters: a franja member loses team access mid-session
    // and their bookmarked ?espacio=franja must land somewhere real.
    assert.equal(resolveEspacio('franja', SOLO), DEFAULT_ESPACIO)
    assert.equal(resolveEspacio('mercado', SOLO), DEFAULT_ESPACIO)
  })

  it('resolves every id against the gate list, for both viewers', () => {
    // Property form of the two cases above: granted → itself, ungranted →
    // PANEL, for every space that exists now or is added later.
    for (const id of ESPACIO_IDS) {
      assert.equal(resolveEspacio(id, TEAM), id, `${id} is granted to a team account`)
      assert.equal(
        resolveEspacio(id, SOLO),
        FRANJA_ONLY_ESPACIOS.includes(id) ? DEFAULT_ESPACIO : id,
        `${id} must follow the gate list for a solo account`,
      )
    }
  })

  it('falls back to PANEL for junk, empty and missing values', () => {
    for (const raw of [
      '',
      '  ',
      'PANEL',
      'ajustes',
      '../panel',
      // The label carries an accent, the id does not. A hand-typed
      // ?espacio=recepción must resolve, not 404 into an empty sheet.
      'recepción',
      'RECEPCION',
      null,
      undefined,
    ]) {
      assert.equal(resolveEspacio(raw as string | null, TEAM), DEFAULT_ESPACIO)
    }
  })

  it('is idempotent', () => {
    for (const id of ESPACIO_IDS) {
      const once = resolveEspacio(id, TEAM)
      assert.equal(resolveEspacio(once, TEAM), once)
    }
  })
})

describe('isEspacioId', () => {
  it('accepts exactly the listed ids and nothing else', () => {
    for (const id of ESPACIO_IDS) assert.equal(isEspacioId(id), true)
    for (const bad of ['', 'Panel', 'mercadoo', 'recepción', 'recepciones', null, undefined]) {
      assert.equal(isEspacioId(bad as string | null), false)
    }
  })
})

describe('espacioHref', () => {
  it('renders PANEL as the bare path (no redundant param)', () => {
    assert.equal(espacioHref('panel'), '/dashboard')
  })

  it('renders every other space as a deep link', () => {
    assert.equal(espacioHref('publicar'), '/dashboard?espacio=publicar')
    assert.equal(espacioHref('franja'), '/dashboard?espacio=franja')
    assert.equal(espacioHref('mercado'), '/dashboard?espacio=mercado')
    assert.equal(espacioHref('recepcion'), '/dashboard?espacio=recepcion')
  })

  it('emits a URL-safe param for every space (no encoding round-trip loss)', () => {
    // The ids stay unaccented so the href needs no escaping — pinned as a
    // property so an accented id can never be added silently.
    for (const id of ESPACIO_IDS) {
      assert.equal(encodeURIComponent(id), id, `${id} must be URL-safe as written`)
    }
  })

  it('round-trips through resolveEspacio', () => {
    for (const id of ESPACIO_IDS) {
      const qs = espacioHref(id).split('?')[1] ?? ''
      const raw = new URLSearchParams(qs).get('espacio')
      assert.equal(resolveEspacio(raw, TEAM), id)
    }
  })

  it('round-trips for a solo account too, on every space it can reach', () => {
    for (const id of visibleEspacios(SOLO)) {
      const qs = espacioHref(id).split('?')[1] ?? ''
      const raw = new URLSearchParams(qs).get('espacio')
      assert.equal(resolveEspacio(raw, SOLO), id)
    }
  })
})

describe('isPaperRoute', () => {
  it('matches the home route exactly', () => {
    assert.equal(isPaperRoute('/'), true)
  })

  it('matches a listed route and its children', () => {
    assert.equal(isPaperRoute('/agenda'), true)
    assert.equal(isPaperRoute('/u'), true)
    assert.equal(isPaperRoute('/u/iker'), true)
    assert.equal(isPaperRoute('/u/Rev.'), true) // dots in usernames are legal
    assert.equal(isPaperRoute('/f/noche-negra'), true)
    assert.equal(isPaperRoute('/e/club-japan'), true)
  })

  it('REGRESSION: /f must not swallow /foro', () => {
    // With a bare startsWith matcher, '/foro'.startsWith('/f') is true and the
    // foro would inherit the franja dossier's ground by accident. Both are
    // paper today, so the bug would be invisible until one of them moved —
    // which is exactly why it is pinned as a segment-boundary assertion.
    assert.equal(isPaperRoute('/foro'), true) // on its own merit, listed
    assert.equal(isPaperRoute('/forogotten'), false) // not a segment match
    assert.equal(isPaperRoute('/fake'), false)
    assert.equal(isPaperRoute('/female'), false)
  })

  it('leaves the dark instrument surfaces alone', () => {
    // /mapa's terrain void is design, not un-converted chrome; /dashboard
    // runs its own html.dash-route ground.
    assert.equal(isPaperRoute('/mapa'), false)
    assert.equal(isPaperRoute('/dashboard'), false)
    assert.equal(isPaperRoute('/lab/dashboard'), false)
    assert.equal(isPaperRoute('/welcome'), false)
  })

  it('never matches on a partial segment for ANY listed route', () => {
    // Property form of the regression above: appending characters to a listed
    // route must never keep matching, for every entry in the list.
    for (const route of PAPER_ROUTES) {
      if (route === '/') continue
      assert.equal(isPaperRoute(route), true, `${route} should match itself`)
      assert.equal(
        isPaperRoute(`${route}xyz`),
        false,
        `${route}xyz must not match ${route}`,
      )
    }
  })
})
