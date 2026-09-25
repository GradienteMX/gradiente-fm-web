import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { WORLD_TAG } from '@/lib/data/tags'

// POST   /api/comments/[id]/reactions  body { kind: 'signal' | 'provocative' }
//         → idempotent set: clears any prior reaction by this user, then inserts the new one.
//
// DELETE /api/comments/[id]/reactions
//         → clears any reaction by this user on this comment.
//
// `comment_reactions` PK is (comment_id, user_id) so mutual exclusivity is
// enforced — a user has at most one reaction per comment. RLS gates writes
// to `user_id = auth.uid()` (comment_reactions_self_insert/_delete).
// Reactions travel with the comments in the public world, so both expire it.

interface PostBody {
  kind: 'signal' | 'provocative'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  request: NextRequest,
  { params: paramsP }: { params: Promise<{ id: string }> }
) {
  const params = await paramsP
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: PostBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (body.kind !== 'signal' && body.kind !== 'provocative') {
    return NextResponse.json({ error: 'kind must be signal or provocative' }, { status: 400 })
  }
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Ese comentario ya no está.' }, { status: 404 })

  // Mutual exclusivity: drop any existing reaction by this user, then insert.
  const { error: delErr } = await supabase
    .from('comment_reactions')
    .delete()
    .eq('comment_id', params.id)
    .eq('user_id', user.id)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  const { error: insErr } = await supabase
    .from('comment_reactions')
    .insert({ comment_id: params.id, user_id: user.id, kind: body.kind })
  if (insErr) {
    // 23503: the comment is gone.
    if (insErr.code === '23503') return NextResponse.json({ error: 'Ese comentario ya no está.' }, { status: 404 })
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params: paramsP }: { params: Promise<{ id: string }> }
) {
  const params = await paramsP
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID_RE.test(params.id)) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('comment_reactions')
    .delete()
    .eq('comment_id', params.id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ ok: true })
}
