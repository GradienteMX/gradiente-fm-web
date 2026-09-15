import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveActivityItem, type ActivityItemRef } from '@/lib/dashboard/activityTargets'
import type { ActivityRow } from '@/lib/dashboard/activity'

describe('activity publication targets', () => {
  const publication: ActivityItemRef = { id: 'someone-elses-publication', slug: 'club-mix', title: 'Club mix', image_url: '/cover.gif', type: 'mix' }
  const items = new Map([[publication.id, publication]])
  const comments = new Map([['incoming-reply', publication.id], ['my-comment', publication.id]])
  const reply: ActivityRow = { key: 'reply:incoming-reply', kind: 'reply_to_comment', source: 'COMENTARIO', actorId: 'another-person', commentId: 'incoming-reply', targetTitle: '', createdAt: '2026-09-15T10:00:00Z' }

  it('opens an incoming reply on another author’s publication at that reply', () => {
    const result = resolveActivityItem(reply, items, comments)
    assert.equal(result.itemSlug, 'club-mix')
    assert.equal(result.commentId, 'incoming-reply')
    assert.equal(result.targetTitle, 'Club mix')
    assert.equal(result.imageUrl, '/cover.gif')
    assert.equal(result.itemType, 'mix')
    assert.equal(reply.itemSlug, undefined)
  })

  it('keeps reactions linked to the viewer’s own comment', () => {
    const result = resolveActivityItem({ ...reply, kind: 'reaction', source: 'REACCION', commentId: 'my-comment', count: 3 }, items, comments)
    assert.equal(result.itemSlug, publication.slug)
    assert.equal(result.commentId, 'my-comment')
    assert.equal(result.count, 3)
  })

  it('does not invent a destination when the publication is deleted or unavailable', () => {
    assert.equal(resolveActivityItem(reply, new Map(), comments), reply)
    assert.equal(resolveActivityItem(reply, items, new Map()), reply)
  })

  it('preserves listing destinations for non-comment activity', () => {
    const offer: ActivityRow = { ...reply, key: 'offer', kind: 'oferta', source: 'OFERTA', commentId: undefined, listingId: 'listing-1' }
    assert.equal(resolveActivityItem(offer, items, comments), offer)
  })
})
