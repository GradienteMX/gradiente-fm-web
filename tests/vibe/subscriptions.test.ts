import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSharedSubscription } from '@/lib/sharedSubscription'

test('dashboard and overlay share a channel until the last reader leaves', () => {
  const events: string[] = []
  const acquire = createSharedSubscription(key => {
    events.push(`start:${key}`)
    return () => { events.push(`stop:${key}`) }
  })
  const dashboard = acquire('mix-a')
  const overlay = acquire('mix-a')
  assert.deepEqual(events, ['start:mix-a'])
  overlay()
  overlay() // stale cleanup cannot close the dashboard subscription
  assert.deepEqual(events, ['start:mix-a'])
  dashboard()
  assert.deepEqual(events, ['start:mix-a', 'stop:mix-a'])
})

test('changing mixes and Strict Mode remounts own separate lifetimes', () => {
  let sequence = 0
  const stopped: number[] = []
  const acquire = createSharedSubscription(() => {
    const lifetime = ++sequence
    return () => { stopped.push(lifetime) }
  })
  const first = acquire('a')
  first()
  const remount = acquire('a')
  const other = acquire('b')
  first()
  assert.deepEqual(stopped, [1])
  remount()
  assert.deepEqual(stopped, [1, 2])
  other()
  assert.deepEqual(stopped, [1, 2, 3])
})

test('a failed start does not leave a phantom subscriber', () => {
  let attempts = 0
  let stops = 0
  const acquire = createSharedSubscription(() => {
    if (++attempts === 1) throw new Error('unavailable')
    return () => { stops += 1 }
  })
  assert.throws(() => acquire('a'), /unavailable/)
  const release = acquire('a')
  release()
  assert.equal(attempts, 2)
  assert.equal(stops, 1)
})
