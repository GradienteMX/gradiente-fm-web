import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createInspectArm } from '../../lib/overlay/inspectArm'

// The arming behind `?item=X&inspect=1`, which opens an item from /admin's
// CONTENIDO tab WITHOUT granting it HL. Measuring a piece must not move it.
//
// These tests exist because the first implementation was a boolean and the
// boolean was wrong in a way nothing visible would ever have revealed: a stale
// arm silently muted the NEXT genuine open, and the symptom is missing
// engagement — invisible, unattributable, and indistinguishable from "nobody
// read it". Every case below is that bug, approached from a different side.

describe('createInspectArm', () => {
  it('starts disarmed — the default must never suppress', () => {
    const arm = createInspectArm()
    assert.equal(arm.peek(), null)
    assert.equal(arm.consume('anything'), false)
  })

  it('suppresses exactly the slug it was armed for', () => {
    const arm = createInspectArm()
    arm.arm('games---that-we-can-play')
    assert.equal(arm.consume('games---that-we-can-play'), true)
  })

  it('is ONE-SHOT — a second open of the same item counts', () => {
    const arm = createInspectArm()
    arm.arm('dj')
    assert.equal(arm.consume('dj'), true)
    // The operator inspected it once; genuinely reading it afterwards is real
    // engagement and must be recorded.
    assert.equal(arm.consume('dj'), false)
  })

  it('never suppresses a DIFFERENT item', () => {
    const arm = createInspectArm()
    arm.arm('inspected-item')
    assert.equal(arm.consume('some-other-item'), false)
  })

  it('a non-matching consume DISARMS — the stale-arm leak', () => {
    // The real-world path: ?item=X&inspect=1 arms X, but X never resolves on a
    // cold load (resolveSlug reads a cache ContentGrid fills later), so X never
    // mounts and never consumes. The arm must not survive to mute the next
    // genuine open.
    const arm = createInspectArm()
    arm.arm('never-resolved')
    assert.equal(arm.consume('a-real-open'), false, 'must not suppress')
    assert.equal(arm.peek(), null, 'stale arm must be gone')
    assert.equal(arm.consume('another-real-open'), false)
  })

  it('disarm clears an arming that was never consumed', () => {
    const arm = createInspectArm()
    arm.arm('x')
    arm.disarm()
    assert.equal(arm.peek(), null)
    assert.equal(arm.consume('x'), false)
  })

  it('re-arming replaces rather than stacking', () => {
    const arm = createInspectArm()
    arm.arm('first')
    arm.arm('second')
    assert.equal(arm.consume('first'), false, 'the superseded arm is gone')
    // 'first' consumed and cleared it, which is the conservative direction:
    // at worst one inspection is recorded, never one reading lost.
    assert.equal(arm.peek(), null)
  })

  it('two providers do not share state', () => {
    // The factory is per-provider. A module-level singleton would leak an
    // arming across every consumer on the page.
    const a = createInspectArm()
    const b = createInspectArm()
    a.arm('x')
    assert.equal(b.consume('x'), false)
    assert.equal(a.consume('x'), true)
  })
})
