// Comment routes: the author's edit window, and refusals that used to read as success.
// Run: npx tsx --test tests/api/comments.test.ts
//
// Same rig as tests/admin/users-delete.test.ts: the real route source,
// transpiled and run with stubbed module boundaries (no network, no database).
//
//   PATCH /api/comments/[id]            only the author edits the words, for
//                                       15 minutes, never a retired comment;
//                                       the update is filtered on author_id too
//   POST|DELETE /api/comments/[id]/tombstone
//                                       an UPDATE RLS filters out changes zero
//                                       rows: that is a 403 (or a 404), not ok

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const ID = '7b0b7a36-1d0c-4e0b-9c5a-3e0e4f1a2b3c'
const ME = 'user-me'

type Res = { status: number; body: { error?: string; ok?: boolean } }
type Handler = (request: unknown, context: unknown) => Promise<Res>

function load(file: string, db: { user: string | null; row?: Record<string, unknown> | null; updated?: unknown[] | null }) {
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const calls = { filters: [] as Array<[string, unknown]>, updates: [] as unknown[], expired: [] as string[] }
  const json = (body: unknown, init?: { status: number }) => ({ body, status: init?.status ?? 200 })
  const query = () => {
    let updating = false
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => {
        calls.filters.push([k, v])
        return q
      },
      update: (patch: unknown) => {
        updating = true
        calls.updates.push(patch)
        return q
      },
      maybeSingle: async () => (updating ? { data: db.updated?.[0] ?? null, error: null } : { data: db.row ?? null, error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ data: updating ? (db.updated ?? []) : db.row ? [db.row] : [], error: null }),
    }
    return q
  }
  const exports: Record<string, Handler> = {}
  runInNewContext(source, {
    exports,
    Date,
    require: (name: string) => {
      if (name === 'next/server') return { NextResponse: { json } }
      if (name === 'next/cache') return { revalidateTag: (tag: string) => calls.expired.push(tag) }
      if (name === '@/lib/data/tags') return { WORLD_TAG: 'world' }
      if (name === '@/lib/supabase/server')
        return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: db.user ? { id: db.user } : null } }) }, from: () => query() }) }
      throw new Error(`Unexpected import: ${name}`)
    },
  })
  return { exports, calls }
}

const req = (body: unknown) => ({ json: async () => body })
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) })
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

// ── PATCH /api/comments/[id] ────────────────────────────────────────────────

const EDIT = 'app/api/comments/[id]/route.ts'

test('edit: signed out is 401', async () => {
  const { exports } = load(EDIT, { user: null })
  assert.equal((await exports.PATCH(req({ body: 'x' }), ctx())).status, 401)
})

test('edit: someone else’s comment is 403 — moderators retire, they don’t rewrite', async () => {
  const { exports, calls } = load(EDIT, { user: ME, row: { id: ID, author_id: 'someone', created_at: minutesAgo(1), deletion_at: null } })
  const res = await exports.PATCH(req({ body: 'x' }), ctx())
  assert.equal(res.status, 403)
  assert.equal(calls.updates.length, 0)
})

test('edit: after 15 minutes the window is closed', async () => {
  const { exports, calls } = load(EDIT, { user: ME, row: { id: ID, author_id: ME, created_at: minutesAgo(16), deletion_at: null } })
  const res = await exports.PATCH(req({ body: 'x' }), ctx())
  assert.equal(res.status, 403)
  assert.match(res.body.error ?? '', /15 minutos/)
  assert.equal(calls.updates.length, 0)
})

test('edit: a retired comment is not edited', async () => {
  const { exports } = load(EDIT, { user: ME, row: { id: ID, author_id: ME, created_at: minutesAgo(1), deletion_at: minutesAgo(0) } })
  assert.equal((await exports.PATCH(req({ body: 'x' }), ctx())).status, 409)
})

test('edit: missing, malformed or empty are refused before any write', async () => {
  const missing = load(EDIT, { user: ME, row: null })
  assert.equal((await missing.exports.PATCH(req({ body: 'x' }), ctx())).status, 404)
  const malformed = load(EDIT, { user: ME })
  assert.equal((await malformed.exports.PATCH(req({ body: 'x' }), ctx('cm-lz3k9-abc12'))).status, 404)
  const empty = load(EDIT, { user: ME, row: { id: ID, author_id: ME, created_at: minutesAgo(1), deletion_at: null } })
  assert.equal((await empty.exports.PATCH(req({ body: '   ' }), ctx())).status, 400)
  assert.equal(empty.calls.updates.length, 0)
})

test('edit: the author, in time — stamped, filtered on author_id, world expired', async () => {
  const { exports, calls } = load(EDIT, {
    user: ME,
    row: { id: ID, author_id: ME, created_at: minutesAgo(3), deletion_at: null },
    updated: [{ id: ID, body: 'nuevo', edited_at: 'x' }],
  })
  const res = await exports.PATCH(req({ body: '  nuevo  ' }), ctx())
  assert.equal(res.status, 200)
  const patch = calls.updates[0] as { body: string; edited_at: string }
  assert.equal(patch.body, 'nuevo')
  assert.ok(!Number.isNaN(Date.parse(patch.edited_at)))
  assert.ok(calls.filters.some(([k, v]) => k === 'author_id' && v === ME))
  assert.deepEqual(calls.expired, ['world'])
})

test('edit: RLS closing the window mid-flight (nothing updated) is 403, not ok', async () => {
  const { exports, calls } = load(EDIT, { user: ME, row: { id: ID, author_id: ME, created_at: minutesAgo(3), deletion_at: null }, updated: [] })
  assert.equal((await exports.PATCH(req({ body: 'nuevo' }), ctx())).status, 403)
  assert.deepEqual(calls.expired, [])
})

// ── /api/comments/[id]/tombstone ────────────────────────────────────────────

const STONE = 'app/api/comments/[id]/tombstone/route.ts'

test('tombstone: an UPDATE RLS filtered out is a 403 when the comment exists', async () => {
  const { exports, calls } = load(STONE, { user: ME, row: { id: ID }, updated: [] })
  const res = await exports.POST(req({ reason: 'spam' }), ctx())
  assert.equal(res.status, 403)
  assert.deepEqual(calls.expired, [])
})

test('tombstone: … and a 404 when it doesn’t', async () => {
  const { exports } = load(STONE, { user: ME, row: null, updated: [] })
  assert.equal((await exports.DELETE(req(undefined), ctx())).status, 404)
})

test('tombstone: a restore only moderation may do reads as such', async () => {
  const { exports } = load(STONE, { user: ME, row: { id: ID }, updated: [] })
  const res = await exports.DELETE(req(undefined), ctx())
  assert.equal(res.status, 403)
  assert.match(res.body.error ?? '', /moderación/)
})

test('tombstone: a real change expires the world', async () => {
  const { exports, calls } = load(STONE, { user: ME, row: { id: ID }, updated: [{ id: ID }] })
  assert.equal((await exports.POST(req({ reason: '' }), ctx())).status, 200)
  assert.deepEqual(calls.expired, ['world'])
})
