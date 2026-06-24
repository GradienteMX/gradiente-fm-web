import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/listings/[lid]/view — bump the listing's view counter via the
// SECURITY DEFINER RPC (migration 0033). Best-effort: the counter only nudges
// invisible feed ordering, so a failure is non-fatal and never surfaced.

export async function POST(
  _request: NextRequest,
  { params }: { params: { lid: string } },
) {
  const supabase = createClient()
  const { error } = await supabase.rpc('increment_listing_views', {
    p_listing_id: params.lid,
  })
  if (error) {
    console.error('[POST listing view]', error)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
  return NextResponse.json({ ok: true })
}
