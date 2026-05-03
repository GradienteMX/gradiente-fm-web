import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST   /api/foro/threads/[id]/tombstone { reason }
// DELETE /api/foro/threads/[id]/tombstone
//
// Mod-delete + revert. Mirrors /api/comments/[id]/tombstone exactly —
// gated by foro_threads_author_edit_window OR foro_threads_mod_edit at
// the policy layer.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
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
    .from('foro_threads')
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
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('foro_threads')
    .update({
      deletion_at: null,
      deletion_moderator_id: null,
      deletion_reason: null,
    })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
