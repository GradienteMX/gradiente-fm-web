import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getPortada, getPinnedHero } from '@/lib/utils'
import { deltaToReachTier, feedTier, hpToReachTier } from '@/lib/hp/feedProjection'
import type { ContentItem } from '@/lib/types'

const base = (over: Partial<ContentItem>): ContentItem => ({
  id: over.id ?? 'x', slug: over.id ?? 'x', type: 'review', title: 't', vibeMin: 4, vibeMax: 6,
  genres: [], tags: [], publishedAt: '2026-09-01T00:00:00Z', ...over,
})

describe('portada selection', () => {
  it('returns every pinned item of any type, newest first, never a franja', () => {
    const items = [
      base({ id: 'old-mix', type: 'mix', pinned: true, publishedAt: '2026-08-01T00:00:00Z' }),
      base({ id: 'event', type: 'evento', pinned: true, publishedAt: '2026-09-05T00:00:00Z' }),
      base({ id: 'franja', type: 'franja', pinned: true }),
      base({ id: 'plain', editorial: true }),
    ]
    assert.deepEqual(getPortada(items).map((i) => i.id), ['event', 'old-mix'])
    assert.equal(getPinnedHero(items)?.id, 'event')
  })
  it('falls back to the newest editorial text piece when nothing is pinned', () => {
    const items = [
      base({ id: 'a', editorial: true, publishedAt: '2026-08-01T00:00:00Z' }),
      base({ id: 'b', editorial: true, publishedAt: '2026-09-01T00:00:00Z' }),
      base({ id: 'mix', type: 'mix', editorial: true, publishedAt: '2026-09-09T00:00:00Z' }),
    ]
    assert.deepEqual(getPortada(items).map((i) => i.id), ['b'])
    assert.deepEqual(getPortada([base({ id: 'none' })]), [])
  })
})

describe('feed projection for the HL lever', () => {
  it('tiers against the type peak and the type multiplier', () => {
    assert.equal(feedTier(20, 70, 1.3), 'sm')
    assert.equal(feedTier(30, 70, 1.3), 'md')
    assert.equal(feedTier(60, 70, 1.3), 'lg')
    assert.equal(feedTier(90, 70, 1.3), 'lg')
  })
  it('computes the HL needed for a tier, or reports it unreachable', () => {
    assert.equal(hpToReachTier('md', 70, 1.3), 35 / 1.3)
    assert.equal(hpToReachTier('lg', 70, 1.3), 70 / 1.3)
    // A noticia (0.8×) can top its type and still never read lg.
    assert.equal(hpToReachTier('md', 50, 0.8), 31.25)
    assert.equal(hpToReachTier('lg', 50, 0.8), null)
    // A 1.0× type reads lg exactly at its type's peak.
    assert.equal(hpToReachTier('lg', 50, 1.0), 50)
  })
  it('turns the target into a non-negative delta with a rounding hair', () => {
    assert.equal(deltaToReachTier('md', 20, 70, 1.3), 6.98)
    assert.equal(deltaToReachTier('md', 40, 70, 1.3), 0)
    assert.equal(deltaToReachTier('lg', 10, 50, 0.8), null)
  })
})
