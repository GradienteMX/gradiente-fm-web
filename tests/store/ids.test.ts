// IDS — which name a row goes by (lib/store/ids.ts).
// Run: npx tsx --test tests/store/ids.test.ts
//
//   1. newUuid mints what the uuid columns and the routes accept.
//   2. remapIds rewrites exactly the renamed ids, deep, and allocates nothing
//      when nothing changes (a replay of an untouched log stays free).
//   3. trackId / serverId: a follow-up filed while the create is in flight
//      waits for the server's name; a failed create leaves the client id.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isUuid, knownIds, newUuid, rememberIds, remapIds, serverId, trackId } from '@/lib/store/ids'
import type { Action } from '@/lib/store/world-core'

describe('uuids', () => {
  it('newUuid is a v4 uuid the routes accept, never twice the same', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const id = newUuid()
      assert.ok(isUuid(id), id)
      assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      seen.add(id)
    }
    assert.equal(seen.size, 200)
  })

  it('isUuid refuses the client-side names that uuid columns would reject', () => {
    for (const bad of ['cm-lz3k9-abc12', 'fr-s01', 'lc-x', 'rp-1', '', 'local-mix-1786999148562-1f8fln'])
      assert.equal(isUuid(bad), false, bad)
    assert.equal(isUuid('7B0B7A36-1D0C-4E0B-9C5A-3E0E4F1A2B3C'), true)
  })
})

describe('remapIds', () => {
  const map = new Map([['rp-temp', '42']])

  it('rewrites every exact occurrence, deep, and leaves look-alikes alone', () => {
    const a: Action = { t: 'report-resolve', id: 'rp-temp', status: 'resuelto', resolution: 'rp-temp quedó revisado', at: '2026-09-25T00:00:00.000Z' }
    const b = remapIds(a, map)
    assert.equal(b.t === 'report-resolve' && b.id, '42')
    // Only whole strings are ids: text that merely contains one is text.
    assert.equal(b.t === 'report-resolve' && b.resolution, 'rp-temp quedó revisado')
    const nested = remapIds({ list: [{ id: 'rp-temp' }, { id: 'other' }] }, map)
    assert.deepEqual(nested, { list: [{ id: '42' }, { id: 'other' }] })
  })

  it('returns the very same object when nothing is renamed (no allocation on replay)', () => {
    const a: Action = { t: 'save', userId: 'u', itemId: 'i', on: true, at: '2026-09-25T00:00:00.000Z' }
    assert.equal(remapIds(a, map), a)
    const deep = { a: [{ b: 'x' }], c: 'y' }
    assert.equal(remapIds(deep, map), deep)
    assert.equal(remapIds(a, new Map()), a)
  })

  it('shares untouched branches of a rewritten action', () => {
    const untouched = { kind: 'artist', name: 'Ro Pax' }
    const v = { poll: { id: 'rp-temp' }, entities: [untouched] }
    const out = remapIds(v, map)
    assert.notEqual(out, v)
    assert.equal(out.entities, v.entities)
  })
})

describe('trackId / serverId', () => {
  it('a follow-up waits for the create in flight and gets the server name', async () => {
    let answer!: (id: string) => void
    const create = trackId('rp-flight', new Promise<string>((r) => (answer = r)))
    const followUp = serverId('rp-flight')
    answer('77')
    assert.equal(await create, '77')
    assert.equal(await followUp, '77')
    // Afterwards it answers at once, and the store's replay map has it.
    assert.equal(await serverId('rp-flight'), '77')
    assert.equal(knownIds().get('rp-flight'), '77')
  })

  it('a failed create leaves the client id (the follow-up then fails on its own)', async () => {
    const create = trackId('rp-failed', Promise.reject(new Error('500')))
    await assert.rejects(create)
    assert.equal(await serverId('rp-failed'), 'rp-failed')
    assert.equal(knownIds().has('rp-failed'), false)
  })

  it('ids nobody renamed are the server’s already', async () => {
    const id = newUuid()
    assert.equal(await serverId(id), id)
  })

  it('rememberIds reports whether anything new was learned', () => {
    assert.equal(rememberIds({ 'pl-old': newUuid() }), true)
    assert.equal(rememberIds({ 'pl-old': knownIds().get('pl-old')! }), false)
    assert.equal(rememberIds({ same: 'same' }), false)
  })
})
