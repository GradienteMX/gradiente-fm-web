import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { WORLD_TAG } from '@/lib/data/tags'

// DELETE /api/listings/[lid]/comments/[cid] — remove a comment.
// RLS (listing_comments_own_delete / _admin_delete) gates this to the
// author or a site admin; the .eq('listing_id') keeps it scoped. A question
// takes its answers with it (parent_id … on delete cascade, migration 0033).
//
// A DELETE that RLS filters out removes nothing and reports no error, so
// "nothing deleted" is told apart: the row still readable → 403 (not yours),
// gone → 404 (the client treats that as done).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  _request: NextRequest,
  { params: paramsP }: { params: Promise<{ lid: string; cid: string }> },
) {
  const params = await paramsP
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID_RE.test(params.cid)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('listing_comments')
    .delete()
    .eq('id', params.cid)
    .eq('listing_id', params.lid)
    .select('id')
    .maybeSingle()
  if (error) {
    console.error('[DELETE listing comment]', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
  if (!data) {
    const { data: still } = await supabase
      .from('listing_comments')
      .select('id')
      .eq('id', params.cid)
      .eq('listing_id', params.lid)
      .maybeSingle()
    if (still) return NextResponse.json({ error: 'Solo quien lo escribió puede borrarlo.' }, { status: 403 })
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ ok: true })
}
