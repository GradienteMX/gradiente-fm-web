import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { patchDraftContent, readingMinutes } from '@/lib/draftContent'
import { emphasizeSelection, linkSelection } from '@/lib/composeFormatting'
import { composeSteps, isOptionalComposeSection, sectionStep } from '@/lib/composeWorkflow'
import { DraftSaveQueue } from '@/lib/draftSaveQueue'
import { requiredFields, errorsFrom, meaningfulBlock, usableUrl } from '@/lib/contentReadiness'
import type { ContentItem } from '@/lib/types'

const draft: ContentItem = { id: 'draft-test', type: 'articulo', title: 'Una pieza', slug: 'una-pieza', vibeMin: 3, vibeMax: 6, genres: [], tags: [], publishedAt: '2026-09-09T00:00:00Z' }

describe('account autosave sequencing', () => {
  it('serializes changes made during a save and waits for the newest acknowledgement', async () => {
    const writes: string[] = []
    const finish: Array<(ok: boolean) => void> = []
    const queue = new DraftSaveQueue<string>('', async (value: string) => {
      writes.push(value)
      return new Promise<boolean>((resolve) => finish.push(resolve))
    })
    queue.update('first')
    const saving = queue.flush()
    queue.update('latest')
    const closing = queue.flush()
    assert.equal(saving, closing)
    assert.deepEqual(writes, ['first'])
    finish[0](true)
    await new Promise<void>((resolve) => setImmediate(resolve))
    assert.deepEqual(writes, ['first', 'latest'])
    assert.equal(queue.pending, true)
    finish[1](true)
    assert.equal(await closing, true)
    assert.equal(queue.pending, false)
  })
  it('retains a failed version and retries the latest content', async () => {
    let succeeds = false
    const writes: string[] = []
    const queue = new DraftSaveQueue<string>('', async (value: string) => { writes.push(value); return succeeds })
    queue.update('unfinished')
    assert.equal(await queue.flush(), false)
    assert.equal(queue.pending, true)
    queue.update('recovered with more text')
    succeeds = true
    assert.equal(await queue.flush(), true)
    assert.deepEqual(writes, ['unfinished', 'recovered with more text'])
  })
  it('does not save an untouched draft and stops queued writes after leaving the session', async () => {
    const writes: string[] = []
    let finish!: (ok: boolean) => void
    const queue = new DraftSaveQueue<string>('', async (value: string) => { writes.push(value); return new Promise<boolean>((resolve) => { finish = resolve }) })
    assert.equal(await queue.flush(), true)
    assert.equal(writes.length, 0)
    queue.update('one')
    const saving = queue.flush()
    queue.update('two')
    queue.stop()
    finish(true)
    assert.equal(await saving, false)
    assert.deepEqual(writes, ['one'])
  })
})

describe('publication readiness', () => {
  it('rejects whitespace titles, empty blocks and separators as article content', () => {
    const missing = errorsFrom(requiredFields('articulo', { ...draft, title: '   ', articleBody: [{ kind: 'p', text: ' ' }, { kind: 'divider' }] }))
    assert.ok(missing.includes('Título'))
    assert.ok(missing.includes('Contenido de la pieza'))
    assert.equal(meaningfulBlock({ kind: 'list', items: ['', '  '] }), false)
  })
  it('allows a meaningful article or an intentional image feature', () => {
    assert.deepEqual(errorsFrom(requiredFields('articulo', { ...draft, articleBody: [{ kind: 'p', text: 'Texto' }] })), [])
    assert.equal(meaningfulBlock({ kind: 'image', src: '/flyers/example.jpg', alt: '' }), true)
  })
  it('requires a source for an available mix but permits an announced or archived mix', () => {
    assert.ok(errorsFrom(requiredFields('mix', { ...draft, type: 'mix' })).includes('Enlace del audio'))
    for (const mixStatus of ['proximamente', 'archivo'] as const) assert.deepEqual(errorsFrom(requiredFields('mix', { ...draft, type: 'mix', mixStatus })), [])
    assert.deepEqual(errorsFrom(requiredFields('mix', { ...draft, type: 'mix', embeds: [{ platform: 'soundcloud', url: 'https://soundcloud.com/example/mix' }] })), [])
    assert.equal(usableUrl('javascript:alert(1)'), false)
  })
  it('checks event chronology and vibe bounds', () => {
    const errors = errorsFrom(requiredFields('evento', { ...draft, type: 'evento', date: '2026-09-18T21:00', endDate: '2026-09-18T02:00', vibeMin: 8, vibeMax: 4 }))
    assert.ok(errors.includes('Cierre posterior al inicio'))
    assert.ok(errors.includes('Ambiente entre 0 y 10'))
  })
  it('requires an actual list entry, while permitting short news text', () => {
    assert.ok(errorsFrom(requiredFields('listicle', { ...draft, type: 'listicle', articleBody: [{ kind: 'p', text: 'Introducción' }] })).length)
    assert.deepEqual(errorsFrom(requiredFields('listicle', { ...draft, type: 'listicle', articleBody: [{ kind: 'track', artist: 'Artista', title: 'Tema' }] })), [])
    assert.deepEqual(errorsFrom(requiredFields('noticia', { ...draft, type: 'noticia', excerpt: 'Una noticia breve.' })), [])
  })
})


describe('draft content preservation', () => {
  it('updates generated URLs only with title edits and preserves custom URLs', () => {
    assert.equal(patchDraftContent(draft, { title: 'Otra pieza' }, false).slug, 'otra-pieza')
    assert.equal(patchDraftContent({ ...draft, slug: 'enlace-curado' }, { title: 'Otra pieza' }, false).slug, 'enlace-curado')
    assert.equal(patchDraftContent(draft, { title: 'Otra pieza' }, true).slug, draft.slug)
    assert.equal(patchDraftContent(draft, { subtitle: 'Un subtítulo' }, false).slug, draft.slug)
  })
  it('estimates reading time without overriding an explicit duration', () => {
    const prose = { ...draft, bodyPreview: Array(441).fill('palabra').join(' ') }
    assert.equal(readingMinutes(prose), 3)
    assert.equal(readingMinutes({ ...prose, readTime: 8 }), 8)
    assert.equal(readingMinutes(draft), undefined)
    assert.equal(readingMinutes({ ...draft, articleBody: [{ kind: 'p', text: 'Un párrafo.' }] }), 1)
  })
  it('keeps summaries in presentation and type-specific essentials in content', () => {
    for (const type of ['opinion', 'editorial', 'review', 'mix'] as const) assert.equal(sectionStep(type, 'summary'), 'presentation')
    assert.equal(sectionStep('evento', '02'), 'content')
    assert.equal(sectionStep('articulo', '02'), 'content')
    assert.equal(sectionStep('articulo', '03'), 'details')
  })
})


describe('contextual workflows', () => {
  it('keeps news short and longer formats task-specific without unreachable sections', () => {
    assert.equal(composeSteps('noticia').length, 2)
    assert.equal(composeSteps('mix').length, 3)
    assert.equal(composeSteps('articulo').length, 4)
    assert.equal(composeSteps('evento')[0].label, 'Lo esencial')
    const counts = { articulo: 8, evento: 9, mix: 8, listicle: 7, noticia: 6, review: 7, opinion: 6, editorial: 6 } as const
    for (const [type, count] of Object.entries(counts)) {
      const kind = type as keyof typeof counts
      const stages = composeSteps(kind).map((stage) => stage.id)
      for (let i = 1; i <= count; i++) assert.ok(stages.includes(sectionStep(kind, String(i).padStart(2, '0'))), `${kind} section ${i}`)
      assert.ok(stages.includes(sectionStep(kind, 'summary')))
      assert.ok(stages.includes(sectionStep(kind, 'meta')))
    }
    assert.equal(isOptionalComposeSection('noticia', '02'), false)
    assert.equal(isOptionalComposeSection('noticia', 'summary'), true)
    assert.equal(sectionStep('review', '02'), 'content')
  })
})

describe('selection formatting', () => {
  it('formats a selected phrase and removes the same format without losing surrounding text', () => {
    const original = 'Una noche en la ciudad.'
    const bold = emphasizeSelection(original, { start: 4, end: 9 }, '**')
    assert.equal(bold.text, 'Una **noche** en la ciudad.')
    assert.equal(bold.text.slice(bold.start, bold.end), 'noche')
    assert.equal(emphasizeSelection(bold.text, bold, '**').text, original)
  })
  it('combines and independently removes bold and italic', () => {
    const bold = emphasizeSelection('noche', { start: 0, end: 5 }, '**')
    const both = emphasizeSelection(bold.text, bold, '*')
    assert.equal(both.text, '***noche***')
    assert.equal(emphasizeSelection(both.text, both, '*').text, '**noche**')
    assert.equal(emphasizeSelection(both.text, both, '**').text, '*noche*')
  })
  it('inserts selectable text at an empty caret', () => {
    const result = emphasizeSelection('Una ', { start: 4, end: 4 }, '*')
    assert.equal(result.text, 'Una *texto*')
    assert.equal(result.text.slice(result.start, result.end), 'texto')
  })
  it('preserves surrounding content and encodes link syntax delimiters', () => {
    const edit = linkSelection('Lee aquí para saber más.', { start: 4, end: 8 }, 'fuente [oficial]', 'https://example.com/a(b)')!
    assert.equal(edit.text, 'Lee [fuente ［oficial］](https://example.com/a%28b%29) para saber más.')
    assert.equal(edit.start, edit.end)
    assert.equal(edit.text.slice(edit.end), ' para saber más.')
  })
  it('rejects unsafe or incomplete links without modifying the draft', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,test', 'not a URL', '']) assert.equal(linkSelection('Texto', { start: 0, end: 5 }, 'Enlace', url), null)
    assert.equal(linkSelection('Texto', { start: 0, end: 5 }, ' ', 'https://example.com'), null)
  })
})
