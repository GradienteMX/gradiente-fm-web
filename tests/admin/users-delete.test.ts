import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

// Execute the actual route with isolated session and Auth service boundaries.
const source = ts.transpileModule(
  readFileSync('app/api/admin/users/[id]/route.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText
const targetId = '12345678-1234-1234-1234-123456789012'

async function remove(options: {
  denied?: number; self?: boolean; username?: string; missing?: boolean
  lookupError?: boolean; authError?: boolean; malformed?: boolean; id?: string
} = {}) {
  const deleted: string[] = []
  const expired: string[] = []
  let adminClients = 0
  const json = (body: unknown, init?: { status: number }) => ({ body, status: init?.status ?? 200 })
  const query = {
    select: () => query, eq: () => query,
    maybeSingle: async () => ({
      data: options.missing ? null : { username: 'listener' },
      error: options.lookupError ? { message: 'db failed' } : null,
    }),
  }
  const exports: Record<string, (request: unknown, context: unknown) => Promise<{ status: number; body: unknown }>> = {}
  runInNewContext(source, {
    exports, console: { error: () => {} },
    require: (name: string) => {
      if (name === 'next/server') return { NextResponse: { json } }
      if (name === 'next/cache') return { revalidateTag: (tag: string) => expired.push(tag) }
      if (name === '@/lib/data/tags') return { WORLD_TAG: 'world' }
      if (name === '@/lib/supabase/server') return {}
      if (name === '@/lib/api/requireAdmin') return {
        requireAdmin: async () => options.denied
          ? { ok: false, response: json({}, { status: options.denied }) }
          : { ok: true, userId: options.self ? targetId : 'another-admin', supabase: { from: () => query } },
      }
      if (name === '@/lib/supabase/admin') return {
        createAdminClient: () => {
          adminClients++
          return { auth: { admin: { deleteUser: async (id: string) => {
            deleted.push(id)
            return { error: options.authError ? { message: 'dependency failure' } : null }
          } } } }
        },
      }
      throw new Error(`Unexpected import: ${name}`)
    },
  })
  const response = await exports.DELETE({ json: async () => {
    if (options.malformed) throw new Error('invalid json')
    return { username: options.username ?? 'listener' }
  } }, { params: { id: options.id ?? targetId } })
  return { response, deleted, adminClients, expired }
}

for (const denied of [401, 403]) {
  test(`rejects ${denied} before creating a privileged client`, async () => {
    const result = await remove({ denied })
    assert.equal(result.response.status, denied)
    assert.equal(result.adminClients, 0)
  })
}
for (const [name, options, status] of [
  ['self deletion', { self: true }, 403],
  ['invalid id', { id: 'bad-id' }, 400],
  ['invalid body', { malformed: true }, 400],
  ['wrong confirmation', { username: 'someone-else' }, 400],
  ['missing profile', { missing: true }, 404],
  ['lookup failure', { lookupError: true }, 500],
] as const) {
  test(`rejects ${name} without deleting anything`, async () => {
    const result = await remove(options)
    assert.equal(result.response.status, status)
    assert.equal(result.adminClients, 0)
    assert.deepEqual(result.expired, [])
  })
}
test('deletes the confirmed Auth account', async () => {
  const result = await remove()
  assert.equal(result.response.status, 200)
  assert.deepEqual(result.deleted, [targetId])
  // The person leaves the public world every member reads.
  assert.deepEqual(result.expired, ['world'])
})
test('reports Auth deletion failure instead of success', async () => {
  const result = await remove({ authError: true })
  assert.equal(result.response.status, 500)
  assert.deepEqual(result.expired, [])
})
