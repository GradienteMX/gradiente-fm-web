import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/franjas/[id]/inbox — which of this franja's listings have an
// UNANSWERED buyer comment/offer (the INBOX/OFERTA indicator in the seller's
// listings table).
//
// "Unanswered" = in any comment thread of the listing, the latest comment is
// from a non-seller (a user NOT on this franja's team). A new top-level
// buyer comment counts; a buyer reply after a seller reply re-arms it; a
// seller reply clears that thread. Listing is flagged if ANY thread is open.
//
// Gated to the franja team / site admin (same as the listings write gate).

type Row = {
  listing_id: string
  parent_id: string | null
  id: string
  created_at: string
  author: { franja_id: string | null } | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, franja_id')
    .eq('id', user.id)
    .maybeSingle()
  const prof = profile as { role?: string; franja_id?: string | null } | null
  if (!prof || (prof.role !== 'admin' && prof.franja_id !== params.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Listing ids for this franja.
  const { data: listings } = await supabase
    .from('marketplace_listings')
    .select('id')
    .eq('franja_id', params.id)
  const listingIds = ((listings ?? []) as { id: string }[]).map((l) => l.id)
  if (listingIds.length === 0) return NextResponse.json({ unanswered: [] })

  const { data, error } = await supabase
    .from('listing_comments')
    .select(
      'id, listing_id, parent_id, created_at, author:users(franja_id)',
    )
    .in('listing_id', listingIds)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[GET franja inbox]', error)
    return NextResponse.json({ error: 'Failed to load inbox' }, { status: 500 })
  }
  const rows = (data ?? []) as unknown as Row[]

  // For each listing, group by thread (parent_id ?? id) and keep the latest
  // comment per thread (rows are already created_at-ascending, so the last one
  // seen wins). A thread is "open" if its latest author isn't a seller.
  const threadLatest = new Map<string, Row>() // key = `${listing_id}::${threadId}`
  for (const r of rows) {
    const threadId = r.parent_id ?? r.id
    threadLatest.set(`${r.listing_id}::${threadId}`, r)
  }
  const unanswered = new Set<string>()
  for (const r of threadLatest.values()) {
    const isSeller = r.author?.franja_id === params.id
    if (!isSeller) unanswered.add(r.listing_id)
  }
  return NextResponse.json({ unanswered: Array.from(unanswered) })
}
