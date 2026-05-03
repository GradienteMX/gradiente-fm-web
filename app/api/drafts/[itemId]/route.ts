import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/drafts/[itemId] → remove the user's draft for this ContentItem.id
//
// `[itemId]` is the ContentItem id (the natural key from the composer's
// perspective), not the drafts.id uuid. Lookup matches by jsonb path. RLS
// (drafts_self_only) ensures we can only delete our own rows even if the
// itemId collides with someone else's.
//
// Idempotent: deleting a non-existent draft returns 200. The composer's
// reset flow may call this for an id that was never persisted (e.g. local
// draft never committed); a 404 there would be noise, not a real error.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('drafts')
    .delete()
    .eq('author_id', user.id)
    .eq('item_payload->>id', params.itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
