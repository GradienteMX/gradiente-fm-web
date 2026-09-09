import { afterEach, describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { saveDraftItem } from '@/lib/drafts'
import { getDraftSync } from '@/lib/draftsCache'
import type { ContentItem } from '@/lib/types'

const item: ContentItem = {
  id: 'test-incomplete-draft', slug: '', title: '', type: 'mix',
  vibeMin: 3, vibeMax: 6, genres: [], tags: [], publishedAt: '2026-09-09T12:00:00Z',
}

afterEach(() => mock.restoreAll())

describe('explicit draft save', () => {
  it('waits for the server while preserving an incomplete draft locally', async () => {
    let finish!: (response: Response) => void
    const response = new Promise<Response>((resolve) => { finish = resolve })
    mock.method(globalThis, 'fetch', () => response)
    let finished = false
    const saving = saveDraftItem(item).then((ok) => { finished = true; return ok })
    await Promise.resolve()
    assert.equal(finished, false)
    assert.equal(getDraftSync(item.id)?.title, '')
    finish(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    assert.equal(await saving, true)
  })
  it('reports a rejected save and retains the editable copy', async () => {
    mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'offline test' }), { status: 503 }))
    mock.method(console, 'error', () => {})
    assert.equal(await saveDraftItem(item), false)
    assert.equal(getDraftSync(item.id)?.id, item.id)
  })
  it('reports a network failure without losing the draft', async () => {
    mock.method(globalThis, 'fetch', async () => { throw new Error('network test') })
    mock.method(console, 'error', () => {})
    assert.equal(await saveDraftItem(item), false)
    assert.equal(getDraftSync(item.id)?.id, item.id)
  })
})
