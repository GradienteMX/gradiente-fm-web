import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/listings/[lid]/comments/[cid] — remove a comment.
// RLS (listing_comments_own_delete / _admin_delete) gates this to the
// author or a site admin; the .eq('listing_id') keeps it scoped.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { lid: string; cid: string } },
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
