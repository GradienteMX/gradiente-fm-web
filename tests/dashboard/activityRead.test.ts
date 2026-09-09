import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isActivityUnread } from '@/lib/dashboard/activityRead'

describe('activity exposure', () => {
  const first = { key: 'first', createdAt: '2026-09-09T10:00:00Z' }
  const hidden = { key: 'hidden', createdAt: '2026-09-08T10:00:00Z' }
  it('reading a recent row does not mark an older hidden row as read', () => {
    const seen = { [first.key]: first.createdAt }
    assert.equal(isActivityUnread(first, null, seen), false)
    assert.equal(isActivityUnread(hidden, null, seen), true)
  })
  it('honors explicit mark-all without hiding future arrivals', () => {
    assert.equal(isActivityUnread(hidden, hidden.createdAt, {}), false)
    assert.equal(isActivityUnread(first, hidden.createdAt, {}), true)
  })
  it('an updated aggregation becomes unread again', () => {
    assert.equal(isActivityUnread({ ...first, createdAt: '2026-09-09T11:00:00Z' }, null, { first: first.createdAt }), true)
  })
})
