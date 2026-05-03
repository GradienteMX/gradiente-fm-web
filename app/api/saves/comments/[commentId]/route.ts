import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST   /api/saves/comments/[commentId] → save
// DELETE /api/saves/comments/[commentId] → unsave
//
// `saved_comments` PK is (user_id, comment_id). RLS gates self-only via
// saved_comments_self_only policy.

export async function POST(
  _request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Idempotent insert — if already saved, the unique violation is caught and
  // treated as success (re-saving is a no-op).
  const { error } = await supabase
    .from('saved_comments')
    .insert({ user_id: user.id, comment_id: params.commentId })

  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('saved_comments')
    .delete()
    .eq('user_id', user.id)
    .eq('comment_id', params.commentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
