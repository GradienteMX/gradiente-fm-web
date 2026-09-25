// THE WORLD STORE — dispatch, the write seam, and snapshots (lib/store/world.tsx).
// Run: npx tsx --test tests/store/world-store.test.ts
//
// The effects here are stand-ins registered over the real ones (the registry
// is last-wins), so nothing reaches the network:
//
//   1. A row the server names (a report) is called by the server's id as soon
//      as the create answers — in the world and in what is replayed later.
//   2. A refusal undoes the gesture.
//   3. A newer snapshot drops a confirmed action only once the snapshot that
//      holds its row was read after the confirmation (private rows settle on
//      the private overlay's instant).
//   4. The «visto» watermark is device-local: no snapshot ever drops it.
//   5. Central's ledgers are laid in and taken out (attachAdmin).

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { User } from '@/lib/types'
import { EffectError, effectOptions, registerEffect, registeredEffects } from '@/lib/store/effects'
import { createWorldStore } from '@/lib/store/world'
import { emptyPublicWorld, type AdminWorld, type PrivateWorld, type PublicWorld } from '@/lib/store/snapshot'
import type { ActionType, ReportRow } from '@/lib/store/world-core'

// The stand-ins replace the real effects; the duplicate warning is expected.
const warn = console.warn
console.warn = () => {}

const me: User = { id: 'u-me', username: 'yo', displayName: 'Yo', role: 'user', joinedAt: '2026-01-01T00:00:00.000Z' }

function pub(at: number): PublicWorld {
  return { ...emptyPublicWorld(at), users: [me] }
}

function priv(at: number, over: Partial<PrivateWorld> = {}): PrivateWorld {
  return { at, me, presence: null, presenceRows: [], drafts: [], saves: {}, savedComments: {}, votes: {}, readings: {}, follows: [], reports: [], ...over }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('the write seam', () => {
  it('every world action has its backend call — nothing is left tab-only', () => {
    // Every ActionType in lib/store/world-core.ts.
    const all = [
      'touch', 'save', 'reading', 'comment', 'comment-edit', 'comment-tombstone', 'comment-restore', 'react', 'save-comment', 'vote',
      'thread', 'reply', 'foro-tombstone', 'draft-save', 'draft-delete', 'publish', 'item-delete', 'pin', 'harvest', 'hp-adjust',
      'profile', 'user-admin', 'follow', 'report', 'report-resolve', 'waitlist-status', 'waitlist-delete', 'invite', 'franja-patch',
      'listing-upsert', 'listing-delete', 'listing-comment', 'seen', 'listing-comment-delete', 'sticker-get', 'sticker-apply', 'sticker-scrape',
    ] as const
    // A new action type fails typecheck here until it is listed (and wired).
    const exhaustive: [Exclude<ActionType, (typeof all)[number]>] extends [never] ? true : false = true
    assert.equal(exhaustive, true)
    const registered = new Set(registeredEffects())
    assert.deepEqual(
      all.filter((t) => !registered.has(t)),
      [],
    )
    // Only the «visto» watermark stays on the device.
    assert.deepEqual(
      all.filter((t) => effectOptions(t).local),
      ['seen'],
    )
  })
})

describe('ids the server names', () => {
  it('a report is renamed to its bigserial the moment the route answers', async () => {
    let answer!: (id: string) => void
    registerEffect('report', (a) => new Promise((resolve) => (answer = (id) => resolve({ ids: { [a.report.id]: id } }))))
    const resolvedIds: string[] = []
    registerEffect('report-resolve', async (a) => {
      resolvedIds.push(a.id)
    })
    const store = createWorldStore(pub(1), priv(1))
    const report: ReportRow = { id: 'rp-client', reporterId: me.id, targetType: 'comment', targetId: 'c1', reason: 'spam', at: '2026-09-25T00:00:00.000Z', status: 'abierto' }
    store.getState().dispatch({ t: 'report', report, at: report.at })
    assert.deepEqual(
      store.getState().world.reports.map((r) => r.id),
      ['rp-client'],
    )
    answer('9001')
    await tick()
    assert.deepEqual(
      store.getState().world.reports.map((r) => r.id),
      ['9001'],
    )
    // A gesture that still names the old id lands on the renamed row.
    store.getState().dispatch({ t: 'report-resolve', id: 'rp-client', status: 'resuelto', resolution: 'hecho', at: '2026-09-25T00:01:00.000Z' })
    const r = store.getState().world.reports[0]
    assert.equal(r.id, '9001')
    assert.equal(r.status, 'resuelto')
    // …and its effect is handed the server's name.
    await tick()
    assert.deepEqual(resolvedIds, ['9001'])
  })
})

describe('refusals', () => {
  it('a refused save is undone', async () => {
    registerEffect('save', () => {
      throw new EffectError('403', 'No.')
    })
    const store = createWorldStore(pub(1), priv(1))
    store.getState().dispatch({ t: 'save', userId: me.id, itemId: 'i1', on: true, at: '2026-09-25T00:00:00.000Z' })
    assert.equal(Boolean(store.getState().world.saves[me.id]?.i1), true)
    await tick()
    assert.equal(Boolean(store.getState().world.saves[me.id]?.i1), false)
    assert.equal(store.getState().log.length, 0)
  })
})

describe('rebase', () => {
  it('a confirmed private write settles on the private overlay’s read, not the public one', async () => {
    registerEffect('save-comment', async () => {})
    const store = createWorldStore(pub(1), priv(1))
    store.getState().dispatch({ t: 'save-comment', userId: me.id, commentId: 'c1', on: true, at: '2026-09-25T00:00:00.000Z' })
    await tick()
    const confirmedBy = Date.now()
    // A cached public world from long ago, a private overlay read now: the save is in it.
    store.getState().rebase(pub(0), priv(confirmedBy + 1, { savedComments: { c1: '2026-09-25T00:00:00.000Z' } }))
    assert.equal(store.getState().log.length, 0)
    assert.equal(Boolean(store.getState().world.savedComments[me.id]?.c1), true)
  })

  it('a confirmed public write stays until a public world read after it arrives', async () => {
    registerEffect('vote', async () => {})
    const store = createWorldStore(pub(1), priv(1))
    store.getState().dispatch({ t: 'vote', userId: me.id, pollId: 'p1', choiceIds: ['voy'], at: '2026-09-25T00:00:00.000Z' })
    await tick()
    const t = Date.now()
    store.getState().rebase(pub(0), priv(t + 1))
    assert.equal(store.getState().log.length, 1, 'the cached public world predates the vote')
    assert.equal(store.getState().world.pollTally.p1?.voters, 1)
    store.getState().rebase(pub(t + 2), priv(t + 2, { votes: { p1: ['voy'] } }))
    assert.equal(store.getState().log.length, 0)
  })

  it('the «visto» watermark is device-local: no snapshot drops it', async () => {
    const store = createWorldStore(pub(1), priv(1))
    store.getState().dispatch({ t: 'seen', userId: me.id, at: '2026-09-25T00:00:00.000Z' })
    await tick()
    store.getState().rebase(pub(Date.now() + 10), priv(Date.now() + 10))
    assert.equal(store.getState().world.activitySeen[me.id], '2026-09-25T00:00:00.000Z')
    // A newer mark replaces the older one in the log.
    store.getState().dispatch({ t: 'seen', userId: me.id, at: '2026-09-26T00:00:00.000Z' })
    assert.equal(store.getState().log.filter((a) => a.t === 'seen').length, 1)
  })

  it('follows arrive with the private overlay', () => {
    const store = createWorldStore(pub(1), priv(1, { follows: ['pa-club'] }))
    assert.deepEqual(store.getState().world.follows[me.id], ['pa-club'])
  })
})

describe('Central’s ledgers', () => {
  it('are laid in while /central is open and taken out after', () => {
    const admin: AdminWorld = {
      at: 1,
      ledger: [{ itemId: 'i1', kind: 'click', baseWeight: 0.5, weight: 0.5, at: '2026-09-25T00:00:00.000Z' }],
      presence: [],
      waitlist: [],
      invites: [],
      saveCounts: { i1: 3 },
    }
    const store = createWorldStore(pub(1), priv(1, { me: { ...me, role: 'admin' } }))
    assert.equal(store.getState().world.admin, false)
    assert.equal(store.getState().world.ledger.length, 0)
    store.getState().attachAdmin(admin)
    assert.equal(store.getState().world.admin, true)
    assert.equal(store.getState().world.ledger.length, 1)
    assert.equal(store.getState().world.saveCounts?.i1, 3)
    store.getState().attachAdmin(null)
    assert.equal(store.getState().world.admin, false)
    assert.equal(store.getState().world.saveCounts, null)
  })

  it('never for nobody', () => {
    const store = createWorldStore(pub(1), null)
    store.getState().attachAdmin({ at: 1, ledger: [], presence: [], waitlist: [], invites: [], saveCounts: {} })
    assert.equal(store.getState().world.admin, false)
  })
})

process.on('exit', () => {
  console.warn = warn
})
