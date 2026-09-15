import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { overlayTargetUrl } from '@/lib/overlay/targetUrl'

describe('addressed comment navigation', () => {
  it('writes the publication and comment atomically while keeping dashboard filters', () => {
    const url = new URL(overlayTargetUrl('https://gradiente.org/dashboard?collection=drafts&collectionSort=title', 'set-nocturno', 'comment-1'))
    assert.equal(url.searchParams.get('item'), 'set-nocturno')
    assert.equal(url.searchParams.get('comment'), 'comment-1')
    assert.equal(url.searchParams.get('collection'), 'drafts')
    assert.equal(url.searchParams.get('collectionSort'), 'title')
    assert.equal(overlayTargetUrl(url.href, 'set-nocturno'), url.href, 'the overlay state mirror preserves the addressed comment')
  })

  it('does not carry a comment into the next publication', () => {
    const url = new URL(overlayTargetUrl('https://gradiente.org/dashboard?item=one&comment=old', 'two'))
    assert.equal(url.searchParams.get('item'), 'two')
    assert.equal(url.searchParams.has('comment'), false)
  })

  it('clears the address on close and on an explicit ordinary open', () => {
    const href = 'https://gradiente.org/dashboard?espacio=recepcion&item=one&comment=old'
    const closed = new URL(overlayTargetUrl(href, null))
    assert.equal(closed.searchParams.has('item'), false)
    assert.equal(closed.searchParams.has('comment'), false)
    assert.equal(closed.searchParams.get('espacio'), 'recepcion')
    assert.equal(new URL(overlayTargetUrl(href, 'one', null)).searchParams.has('comment'), false)
  })
})
