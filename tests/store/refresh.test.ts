// REFRESH — one router.refresh() per burst of writes (lib/store/refresh.ts).
// Run: npx tsx --test tests/store/refresh.test.ts
//
// A refresh re-reads the viewer's rows and, after a write expired it, the
// whole public world (~0.9 MB): the scheduler must never turn a burst of
// writes into a storm of refreshes, and must never drop the last one.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRefreshScheduler, REFRESH_TIMING } from '@/lib/store/refresh'

/** A fake clock: timers fire when `advance` passes them. */
function rig() {
  let now = 0
  let hidden = false
  let seq = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  const fired: number[] = []
  const s = createRefreshScheduler({
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = ++seq
      timers.set(id, { at: now + ms, fn })
      return id
    },
    clearTimeout: (h) => {
      timers.delete(h as number)
    },
    hidden: () => hidden,
  })
  s.setRefresher(() => fired.push(now))
  const advance = (ms: number) => {
    const end = now + ms
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      timers.delete(due[0])
      now = due[1].at
      due[1].fn()
    }
    now = end
  }
  return { s, fired, advance, setHidden: (h: boolean) => (hidden = h) }
}

const { debounceMs, maxWaitMs, minGapMs } = REFRESH_TIMING

describe('requestRefresh', () => {
  it('a single write refreshes once, after the debounce', () => {
    const { s, fired, advance } = rig()
    s.request()
    advance(debounceMs - 1)
    assert.deepEqual(fired, [])
    advance(1)
    assert.deepEqual(fired, [debounceMs])
    advance(10_000)
    assert.equal(fired.length, 1)
  })

  it('a burst folds into one refresh after the last write', () => {
    const { s, fired, advance } = rig()
    for (let i = 0; i < 5; i++) {
      s.request()
      advance(200)
    }
    advance(10_000)
    assert.equal(fired.length, 1)
    assert.equal(fired[0], 800 + debounceMs)
  })

  it('a long burst still lands by the max wait', () => {
    const { s, fired, advance } = rig()
    for (let t = 0; t < 6000; t += 400) {
      s.request()
      advance(400)
    }
    assert.ok(fired.length >= 1, 'refreshed during the burst')
    assert.equal(fired[0], maxWaitMs)
  })

  it('never refreshes twice within the minimum gap', () => {
    const { s, fired, advance } = rig()
    for (let t = 0; t < 20_000; t += 100) {
      s.request()
      advance(100)
    }
    advance(10_000)
    for (let i = 1; i < fired.length; i++) assert.ok(fired[i] - fired[i - 1] >= minGapMs, `gap ${fired[i] - fired[i - 1]}`)
    // …and the last write is still covered by a refresh after it.
    assert.ok(fired[fired.length - 1] >= 20_000 - 100)
  })

  it('a hidden tab holds the refresh until it is looked at again', () => {
    const { s, fired, advance, setHidden } = rig()
    setHidden(true)
    s.request()
    advance(10_000)
    assert.deepEqual(fired, [])
    assert.equal(s.pending(), true)
    setHidden(false)
    s.visible()
    advance(debounceMs)
    assert.equal(fired.length, 1)
    assert.equal(s.pending(), false)
  })

  it('nothing mounted: requests are dropped, not queued forever', () => {
    const { s, fired, advance } = rig()
    s.setRefresher(null)
    s.request()
    advance(10_000)
    assert.deepEqual(fired, [])
    assert.equal(s.pending(), false)
  })
})
