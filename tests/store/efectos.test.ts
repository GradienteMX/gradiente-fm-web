// EFECTOS — world action → the request its route takes (lib/store/efectos/mapping.ts)
// and the Spanish a refusal reads as (lib/store/efectos/http.ts).
// Run: npx tsx --test tests/store/efectos.test.ts
//
// Each contract here is the route's own (read from app/api/**): the body keys,
// the verbs, and who goes through which route. Nothing touches the network.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ContentItem, MarketplaceListing, User } from '@/lib/types'
import type { InviteRow } from '@/lib/store/world-core'
import {
  commentTombstoneRequest,
  followRequest,
  foroTombstoneRequest,
  franjaPatchRequest,
  inviteBody,
  listingBody,
  profileBody,
  publishBody,
  reactRequest,
  readingRequest,
  unresolvedEntities,
  userAdminRequests,
  voteRequest,
} from '@/lib/store/efectos/mapping'
import { isSpanish, refusal } from '@/lib/store/efectos/http'
import { isUuid } from '@/lib/store/ids'

const user = (over: Partial<User> = {}): User => ({ id: 'u1', username: 'ana', displayName: 'Ana', role: 'insider', joinedAt: '2026-01-01T00:00:00.000Z', ...over })
const piece = (over: Partial<ContentItem> = {}): ContentItem => ({
  id: 'local-mix-1790000000000-abc123',
  slug: 'un-mix',
  type: 'mix',
  title: 'Un mix',
  vibeMin: 3,
  vibeMax: 6,
  genres: ['techno'],
  tags: [],
  publishedAt: '2026-09-25T00:00:00.000Z',
  ...over,
})

describe('the reader', () => {
  it('reading: PUT integers 0–10, low first; null takes it back', () => {
    assert.deepEqual(readingRequest('it 1', [7.6, 2.2]), { method: 'PUT', url: '/api/vibe-checks/it%201', body: { vibeMin: 2, vibeMax: 8 } })
    assert.deepEqual(readingRequest('x', [-3, 14]), { method: 'PUT', url: '/api/vibe-checks/x', body: { vibeMin: 0, vibeMax: 10 } })
    assert.deepEqual(readingRequest('x', null), { method: 'DELETE', url: '/api/vibe-checks/x' })
  })

  it('vote: POST the picks; nothing left picked is a DELETE (choice_ids can’t be empty)', () => {
    assert.deepEqual(voteRequest('p', ['voy']), { method: 'POST', url: '/api/polls/p/vote', body: { choiceIds: ['voy'] } })
    assert.deepEqual(voteRequest('p', []), { method: 'DELETE', url: '/api/polls/p/vote' })
  })

  it('react: POST the kind (it replaces), DELETE to clear', () => {
    assert.deepEqual(reactRequest('c', 'signal'), { method: 'POST', url: '/api/comments/c/reactions', body: { kind: 'signal' } })
    assert.deepEqual(reactRequest('c', null), { method: 'DELETE', url: '/api/comments/c/reactions' })
  })

  it('follow: POST / DELETE on /api/follows/[franjaId]', () => {
    assert.deepEqual(followRequest('pa-club', true), { method: 'POST', url: '/api/follows/pa-club' })
    assert.deepEqual(followRequest('pa-club', false), { method: 'DELETE', url: '/api/follows/pa-club' })
  })
})

describe('stubs', () => {
  it('an author retiring their own comment sends an empty reason (production’s convention)', () => {
    assert.deepEqual(commentTombstoneRequest('c', 'eliminado por autor', true), { method: 'POST', url: '/api/comments/c/tombstone', body: { reason: '' } })
    assert.deepEqual(commentTombstoneRequest('c', 'spam', false), { method: 'POST', url: '/api/comments/c/tombstone', body: { reason: 'spam' } })
    assert.deepEqual(commentTombstoneRequest('c', null, false), { method: 'DELETE', url: '/api/comments/c/tombstone' })
  })

  it('foro stubs go to the thread or the reply route', () => {
    assert.equal(foroTombstoneRequest('thread', 't', 'x').url, '/api/foro/threads/t/tombstone')
    assert.equal(foroTombstoneRequest('reply', 'r', null).url, '/api/foro/replies/r/tombstone')
    assert.equal(foroTombstoneRequest('reply', 'r', null).method, 'DELETE')
  })
})

describe('people', () => {
  it('profile: snake_case; an emptied field is cleared, the name is sent trimmed', () => {
    assert.deepEqual(profileBody({ displayName: '  Ana  ', bio: '  ', firma: 'Desde el sótano', avatarUrl: '' }), {
      display_name: 'Ana',
      bio: null,
      firma: 'Desde el sótano',
      avatar_url: null,
    })
    assert.deepEqual(profileBody({}), {})
  })

  it('a site admin goes through /api/admin/users — a removed franja is null', () => {
    const r = userAdminRequests('u2', { role: 'curator', isMod: true, isOG: false, franjaId: undefined, franjaAdmin: false }, { viewerIsAdmin: true, targetFranjaId: 'pa-x' })
    assert.deepEqual(r, [{ method: 'PATCH', url: '/api/admin/users/u2', body: { role: 'curator', is_mod: true, is_og: false, franja_id: null, franja_admin: false } }])
  })

  it('a franja’s admin goes through the team route: add, retire, toggle admin', () => {
    const ctx = { viewerIsAdmin: false, targetFranjaId: null }
    assert.deepEqual(userAdminRequests('u2', { franjaId: 'pa-x', franjaAdmin: false }, ctx), [{ method: 'POST', url: '/api/franjas/pa-x/team', body: { user_id: 'u2' } }])
    // Retiring names the franja they were on BEFORE ('' is how Taller writes «none»).
    assert.deepEqual(userAdminRequests('u2', { franjaId: '', franjaAdmin: false }, { viewerIsAdmin: false, targetFranjaId: 'pa-x' }), [
      { method: 'DELETE', url: '/api/franjas/pa-x/team', body: { user_id: 'u2' } },
    ])
    assert.deepEqual(userAdminRequests('u2', { franjaAdmin: true }, { viewerIsAdmin: false, targetFranjaId: 'pa-x' }), [
      { method: 'PATCH', url: '/api/franjas/pa-x/team', body: { user_id: 'u2', franja_admin: true } },
    ])
  })

  it('a franja’s admin can never touch a role or a flag', () => {
    const r = userAdminRequests('u2', { role: 'admin' }, { viewerIsAdmin: false, targetFranjaId: 'pa-x' })
    assert.ok('refused' in r && isSpanish(r.refused))
  })
})

describe('franjas', () => {
  it('Central (admin) takes every card field through the admin route, emptied ones cleared', () => {
    const r = franjaPatchRequest('pa-x', { title: 'Club X', franjaKind: 'club', subtitle: 'Club · CDMX', imageUrl: undefined, franjaUrl: '', marketplaceEnabled: false }, true)
    assert.ok(!('refused' in r))
    assert.deepEqual(r, {
      method: 'PATCH',
      url: '/api/admin/franjas/pa-x',
      body: { title: 'Club X', franja_kind: 'club', subtitle: 'Club · CDMX', image_url: null, franja_url: null, marketplace_enabled: false },
    })
  })

  it('the team takes its links and storefront through /api/franjas/[id]', () => {
    const r = franjaPatchRequest('pa-x', { marketplaceEnabled: true, marketplaceCurrency: '', marketplaceDescription: 'Vinilos' }, false)
    assert.deepEqual(r, { method: 'PATCH', url: '/api/franjas/pa-x', body: { marketplace_enabled: true, marketplace_currency: null, marketplace_description: 'Vinilos' } })
  })

  it('the team can’t rename its franja; nobody can set a field no route takes', () => {
    const a = franjaPatchRequest('pa-x', { title: 'Otro' }, false)
    const b = franjaPatchRequest('pa-x', { verified: true }, true)
    assert.ok('refused' in a && isSpanish(a.refused))
    assert.ok('refused' in b && isSpanish(b.refused))
  })

  it('a listing: POST carries the client id and date; PATCH never re-sends them', () => {
    const l: MarketplaceListing = {
      id: 'mkl-lz3k9ab-x1y2z',
      title: 'LP',
      category: 'vinyl',
      price: 350,
      condition: 'VG+',
      images: ['https://x/a.webp'],
      status: 'available',
      email: 'a@b.mx',
      publishedAt: '2026-09-25T00:00:00.000Z',
    }
    const post = listingBody(l, true)
    assert.equal(post.id, l.id)
    assert.equal(post.published_at, l.publishedAt)
    assert.equal(post.contact_email, 'a@b.mx')
    assert.deepEqual(post.embeds, [])
    const patch = listingBody(l, false)
    assert.equal('id' in patch, false)
    assert.equal('published_at' in patch, false)
  })
})

describe('invitations', () => {
  const row: InviteRow = {
    code: 'INV-0123456789abcdef',
    name: '  Allan ',
    role: 'user',
    folio: '062/150',
    issued: 'SEP 2026',
    createdAt: '2026-09-25T00:00:00.000Z',
    expiresAt: '2026-10-25T00:00:00.000Z',
  }

  it('the copied code travels; expiry as days from issue', () => {
    assert.deepEqual(inviteBody(row), {
      code: 'INV-0123456789abcdef',
      card_name: 'Allan',
      intended_role: 'user',
      intended_is_mod: false,
      intended_franja_id: null,
      intended_franja_admin: false,
      expires_in_days: 30,
    })
  })

  it('no expiry is null (never expires); franja admin only with a franja', () => {
    const b = inviteBody({ ...row, expiresAt: undefined, franjaAdmin: true })
    assert.equal(b.expires_in_days, null)
    assert.equal(b.intended_franja_admin, false)
  })
})

describe('publishing', () => {
  it('server-side fields and the wrapping never travel', () => {
    const it0 = piece({ hp: 99, hpLastUpdatedAt: 'x', vibeCheckCount: 7, creator: { id: 'u1', username: 'ana', displayName: 'Ana' }, harvestedAmount: 3, _draftState: 'draft' })
    const { item } = publishBody(it0, { me: user(), existing: null })
    for (const k of ['hp', 'hpLastUpdatedAt', 'vibeCheckCount', 'creator', 'harvestedAmount', '_draftState'] as const) assert.equal(k in item, false, k)
    assert.equal(item.title, 'Un mix')
  })

  it('an edit that empties links, entities or a subject field says so (the route leaves absent ones alone)', () => {
    const existing = piece({
      links: [{ label: 'Bandcamp', url: 'https://x.bandcamp.com' }],
      entities: [{ id: '7b0b7a36-1d0c-4e0b-9c5a-3e0e4f1a2b3c', kind: 'artist', name: 'Ro Pax', slug: 'ro-pax' }],
      country: 'México',
      year: 1996,
    })
    const { item } = publishBody(piece({ links: undefined, entities: undefined, country: undefined, year: undefined }), { me: user(), existing })
    assert.deepEqual(item.links, [])
    assert.deepEqual(item.entities, [])
    assert.equal(item.country, null)
    assert.equal(item.year, null)
    // Nothing to clear: nothing extra is sent (a new piece, or fields that were never set).
    const fresh = publishBody(piece(), { me: user(), existing: null }).item
    assert.equal('links' in fresh, false)
    const untouched = publishBody(piece(), { me: user(), existing: piece() }).item
    assert.equal('entities' in untouched, false)
    assert.equal('country' in untouched, false)
  })

  it('create vs edit comes from whether the piece already exists', () => {
    assert.equal(publishBody(piece(), { me: user(), existing: null }).mode, 'create')
    assert.equal(publishBody(piece(), { me: user(), existing: piece() }).mode, 'edit')
  })

  it('franja attribution is the explicit attributeFranja the route stamps from', () => {
    const me = user({ franjaId: 'pa-club' })
    // On: the piece carries the author's own franja.
    assert.equal(publishBody(piece({ franjaId: 'pa-club' }), { me, existing: null }).item.attributeFranja, true)
    // Off: an edit takes the author's franja away.
    assert.equal(publishBody(piece(), { me, existing: piece({ franjaId: 'pa-club' }) }).item.attributeFranja, false)
    // Untouched: no franja either way, a house-voice type, or someone without one.
    assert.equal('attributeFranja' in publishBody(piece(), { me, existing: null }).item, false)
    assert.equal('attributeFranja' in publishBody(piece({ type: 'review', franjaId: 'pa-club' }), { me, existing: null }).item, false)
    assert.equal('attributeFranja' in publishBody(piece({ franjaId: 'pa-club' }), { me: user(), existing: null }).item, false)
  })

  it('entities the composer named but that aren’t rows yet are the ones to resolve', () => {
    const list = [
      { id: 'ent-artist-ro-pax', kind: 'artist' as const, name: 'Ro Pax', slug: 'ro-pax' },
      { id: '7b0b7a36-1d0c-4e0b-9c5a-3e0e4f1a2b3c', kind: 'venue' as const, name: 'Japan', slug: 'japan' },
    ]
    assert.deepEqual(
      unresolvedEntities(list, isUuid).map((e) => e.id),
      ['ent-artist-ro-pax'],
    )
    assert.deepEqual(unresolvedEntities(undefined, isUuid), [])
  })
})

describe('refusals read in Spanish', () => {
  it('a route’s own Spanish reason wins — it knows why', () => {
    assert.equal(refusal(403, { error: 'forbidden', message: 'No puedes editar este ítem.' }, { messages: { 403: 'otra cosa' } }), 'No puedes editar este ítem.')
    assert.equal(refusal(409, { error: 'Ya existe un comentario con ese identificador.' }), 'Ya existe un comentario con ese identificador.')
  })

  it('English developer messages never reach the person', () => {
    assert.equal(refusal(403, { error: 'Forbidden' }, { messages: { 403: 'La portada la decide administración.' } }), 'La portada la decide administración.')
    assert.equal(refusal(401, { error: 'Unauthorized' }), 'Tu sesión se cerró. Entra de nuevo y vuelve a intentarlo.')
    assert.equal(refusal(500, { error: 'duplicate key value violates unique constraint "items_slug_key"' }, { fallback: 'No se pudo publicar.' }), 'No se pudo publicar.')
    assert.equal(refusal(500, null), 'No se pudo guardar. El cambio se deshizo.')
  })

  it('isSpanish tells the house’s sentences from PostgREST’s', () => {
    for (const es of ['Solo un administrador puede crear franjas.', 'Ya existe un ítem con este id.', 'No autorizado', 'Entrada no encontrada', 'Falta id', 'delta debe ser un número distinto de cero'])
      assert.equal(isSpanish(es), true, es)
    for (const en of ['Forbidden', 'Unauthorized', 'item not found', 'kind must be one of: click, open, save, comment', 'image_url required', 'comment too long (max 4000 chars)'])
      assert.equal(isSpanish(en), false, en)
  })
})
