import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST   /api/saves/items/[itemId] → save
// DELETE /api/saves/items/[itemId] → unsave
//
// `user_saves` PK is (user_id, item_id). RLS gates self-only via
// user_saves_self_only policy.

export async function POST(
  _request: NextRequest,
  { params: paramsP }: { params: Promise<{ itemId: string }> }
) {
  const params = await paramsP
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Idempotent insert — if already saved, the unique violation is caught and
  // treated as success (re-saving is a no-op).
  const { error } = await supabase
    .from('user_saves')
    .insert({ user_id: user.id, item_id: params.itemId })

  // 23503: the piece is gone.
  if (error?.code === '23503') return NextResponse.json({ error: 'Esa pieza ya no está.' }, { status: 404 })
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params: paramsP }: { params: Promise<{ itemId: string }> }
) {
  const params = await paramsP
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('user_saves')
    .delete()
    .eq('user_id', user.id)
    .eq('item_id', params.itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
