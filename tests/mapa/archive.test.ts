// Archivo Vivo seed validation — the contract between
// scripts/buildArchiveSeed.ts and the /mapa terrain (+ MANUAL.md's
// visible-credit rules). Run: npm run test:mapa

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ContentItem } from '@/lib/types'

const seed = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), 'lib/data/archiveSeed.json'),
    'utf8',
  ),
) as ContentItem[]

describe('archive seed', () => {
  it('is populated and image-only', () => {
    assert.ok(seed.length > 0, 'seed is empty — run scripts/buildArchiveSeed.ts')
    for (const item of seed) {
      assert.ok(item.imageUrl?.startsWith('https://'), `${item.id} imageless`)
    }
  })

  it('ids and slugs are az-prefixed and unique', () => {
    const ids = new Set<string>()
    const slugs = new Set<string>()
    for (const item of seed) {
      assert.ok(item.id.startsWith('az-'), item.id)
      assert.ok(item.slug.startsWith('az-'), item.slug)
      assert.ok(!ids.has(item.id), `dup id ${item.id}`)
      assert.ok(!slugs.has(item.slug), `dup slug ${item.slug}`)
      ids.add(item.id)
      slugs.add(item.slug)
    }
  })

  it('carries the visible-credit contract (MANUAL.md §6)', () => {
    for (const item of seed) {
      assert.equal(item.source, 'archive:wayback', item.id)
      assert.ok(item.author, `${item.id} missing author blog`)
      const year = Number(item.publishedAt.slice(0, 4))
      assert.ok(year >= 2005 && year <= 2013, `${item.id} outside era: ${year}`)
      const hasWayback = (item.links ?? []).some((l) =>
        l.url.includes('web.archive.org'),
      )
      assert.ok(hasWayback, `${item.id} missing Wayback source link`)
      // Excerpt-only republication — never the full body.
      assert.ok(!('articleBody' in item), `${item.id} carries a full body`)
    }
  })

  it('entity refs are well-formed first-class rows', () => {
    let refs = 0
    for (const item of seed) {
      for (const e of item.entities ?? []) {
        refs++
        assert.ok(e.id.startsWith('az:'), e.id)
        assert.ok(['artist', 'label'].includes(e.kind), `${e.id} kind ${e.kind}`)
        assert.ok(e.name.length > 0 && e.slug.length > 0)
      }
      // No hp — archive mass comes from era decay, never from `mentions`.
      assert.ok(item.hp === undefined, `${item.id} carries hp`)
    }
    assert.ok(refs > 20, `suspiciously few entity refs: ${refs}`)
  })

  it('is deterministically ordered by source post id', () => {
    const nums = seed.map((i) => Number(i.id.replace('az-', '')))
    for (let i = 1; i < nums.length; i++) {
      assert.ok(nums[i] > nums[i - 1], `order break at ${nums[i]}`)
    }
  })
})
