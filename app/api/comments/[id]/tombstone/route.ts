import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST   /api/comments/[id]/tombstone { reason } → set deletion fields
// DELETE /api/comments/[id]/tombstone             → clear deletion fields
//
// Two RLS paths gate this UPDATE:
//   - `comments_author_edit_window` — author within 15 min of post AND while
//     deletion_at is null. (Lets the author self-tombstone; clearing requires
//     mod role — author-side undo of a self-delete after the fact is not
//     supported by RLS today, even though the UI exposes the affordance.)
//   - `comments_mod_edit` — mods + admins, any time.
//
// `reason` is allowed to be empty: the UI uses an empty reason for author
// self-delete (Tombstone discriminates on moderator_id === author_id, not on
// reason text).

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
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

  const { error } = await supabase
    .from('comments')
    .update({
      deletion_at: new Date().toISOString(),
      deletion_moderator_id: user.id,
      deletion_reason: reason,
    })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('comments')
    .update({
      deletion_at: null,
      deletion_moderator_id: null,
      deletion_reason: null,
    })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
