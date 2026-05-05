import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/items/[id]
//
// Hard-deletes an item row. Authorization is layered:
//   - Auth check here rejects unauthenticated requests up front (401).
//   - RLS at the DB layer (migration 0013) only allows DELETE when
//     (created_by = auth.uid()) OR (role = 'admin'). Non-owner non-admin
//     requests return 0 affected rows — we surface that as 403.
//
// Cascades per the FK definitions in 0001_init: comments, user_saves,
// polls, vibe_checks, hp_events tied to this item all cascade-delete.
// Marketplace listings cascade as well when type === 'partner'.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // .select() after .delete() returns the rows that were actually deleted.
  // Empty array = either the row didn't exist OR RLS blocked the delete.
  // We disambiguate with a follow-up existence probe so 404 vs 403 is
  // reportable to the client.
  const { data: deleted, error } = await supabase
    .from('items')
    .delete()
    .eq('id', params.id)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (deleted && deleted.length > 0) {
    return NextResponse.json({ ok: true, itemId: params.id })
  }

  // Nothing deleted — figure out why.
  const { data: stillThere } = await supabase
    .from('items')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()
  if (!stillThere) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
