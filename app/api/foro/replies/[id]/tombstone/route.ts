import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { WORLD_TAG } from '@/lib/data/tags'

// POST   /api/foro/replies/[id]/tombstone { reason }
// DELETE /api/foro/replies/[id]/tombstone
//
// Symmetric with the thread tombstone route — only the table differs.
// Gated by foro_replies_author_edit_window OR foro_replies_mod_edit; an
// UPDATE RLS filters out changes zero rows → 403 (or 404), never a false ok.

type Db = Awaited<ReturnType<typeof createClient>>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function refused(supabase: Db, id: string, restoring: boolean) {
  const { data } = await supabase.from('foro_replies').select('id').eq('id', id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Esa respuesta ya no está.' }, { status: 404 })
  return NextResponse.json({ error: restoring ? 'Solo moderación puede restaurar una respuesta.' : 'Solo moderación puede retirar esta respuesta.' }, { status: 403 })
}

export async function POST(
  request: NextRequest,
  { params: paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await paramsP
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { reason?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const reason = typeof body.reason === 'string' ? body.reason : ''
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Esa respuesta ya no está.' }, { status: 404 })

  const { data, error } = await supabase
    .from('foro_replies')
    .update({
      deletion_at: new Date().toISOString(),
      deletion_moderator_id: user.id,
      deletion_reason: reason,
    })
    .eq('id', params.id)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return refused(supabase, params.id, false)
  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params: paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await paramsP
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Esa respuesta ya no está.' }, { status: 404 })

  const { data, error } = await supabase
    .from('foro_replies')
    .update({
      deletion_at: null,
      deletion_moderator_id: null,
      deletion_reason: null,
    })
    .eq('id', params.id)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return refused(supabase, params.id, true)
  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ ok: true })
}
