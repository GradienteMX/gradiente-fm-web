import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { WORLD_TAG } from '@/lib/data/tags'

// POST   /api/comments/[id]/tombstone { reason } → set deletion fields
// DELETE /api/comments/[id]/tombstone             → clear deletion fields
//
// Two RLS paths gate this UPDATE:
//   - `comments_author_edit_window` — author within 15 min of post AND while
//     deletion_at is null. (Lets the author self-tombstone; clearing requires
//     mod role — author-side undo of a self-delete after the fact is not
//     supported by RLS.)
//   - `comments_mod_edit` — mods + admins, any time.
//
// An UPDATE that RLS filters out matches zero rows and reports no error, so
// the rows actually changed are selected back: none means refused (403) or
// gone (404) — the client undoes the gesture and says why, instead of
// believing a write that never happened.
//
// `reason` is allowed to be empty: the UI uses an empty reason for author
// self-delete (Tombstone discriminates on moderator_id === author_id, not on
// reason text).

type Db = Awaited<ReturnType<typeof createClient>>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Nothing changed: was the comment there at all? */
async function refused(supabase: Db, id: string, restoring: boolean) {
  const { data } = await supabase.from('comments').select('id').eq('id', id).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Ese comentario ya no está.' }, { status: 404 })
  return NextResponse.json(
    {
      error: restoring
        ? 'Solo moderación puede restaurar un comentario retirado.'
        : 'Solo moderación puede retirarlo ahora (quien lo escribió tiene 15 minutos).',
    },
    { status: 403 },
  )
}

export async function POST(request: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
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
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Ese comentario ya no está.' }, { status: 404 })

  const { data, error } = await supabase
    .from('comments')
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

export async function DELETE(_request: NextRequest, { params: paramsP }: { params: Promise<{ id: string }> }) {
  const params = await paramsP
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Ese comentario ya no está.' }, { status: 404 })

  const { data, error } = await supabase
    .from('comments')
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
