import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// /api/items/[id]/harvest
// POST → the COSECHAR gesture. One per item, ever. The DB function
// `harvest_item(text)` does the atomic work (drains the item's HP,
// credits the publisher, sets the harvested_at sentinel + 1.7x decay
// multiplier). This route is a thin wrapper that:
//   1. Auth-gates the request (the function rechecks via auth.uid())
//   2. Calls the RPC
//   3. Maps the function's error strings to HTTP status codes for the UI
//
// Idempotent: a duplicate POST after the first success hits
// already_harvested and returns 409 — the client uses that to refresh
// its cached card state without panicking.

const ERROR_STATUS: Record<string, number> = {
  unauthorized: 401,
  item_not_found: 404,
  not_publisher: 403,
  already_harvested: 409,
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // harvest_item() is a SECURITY DEFINER fn returning a jsonb result shaped
  // { ok, error?, echo? }. The RPC name + args are typed; the jsonb payload is
  // opaque to the type system, so we shape it explicitly.
  const { data, error } = await supabase.rpc('harvest_item', {
    p_item_id: params.id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const result = data as unknown as { ok: boolean; error?: string; echo?: number }
  if (!result.ok) {
    const status = ERROR_STATUS[result.error ?? ''] ?? 400
    return NextResponse.json({ error: result.error ?? 'harvest_failed' }, { status })
  }

  return NextResponse.json({ ok: true, echo: result.echo })
}
