import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { WORLD_TAG } from '@/lib/data/tags'

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
  { params: paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await paramsP
  const supabase = await createClient()

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
    return NextResponse.json({ error: result.error ?? 'harvest_failed', message: HARVEST_MESSAGE[result.error ?? ''] }, { status })
  }

  // The piece's HL, its decay and its «cosechada» mark are public.
  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ ok: true, echo: result.echo })
}

const HARVEST_MESSAGE: Record<string, string> = {
  item_not_found: 'Esa pieza ya no está.',
  not_publisher: 'Solo quien publicó la pieza puede cosecharla.',
  already_harvested: 'Esta pieza ya se cosechó.',
}
