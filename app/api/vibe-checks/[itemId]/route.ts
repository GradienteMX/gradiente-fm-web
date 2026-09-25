import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { WORLD_TAG } from '@/lib/data/tags'

// PUT    /api/vibe-checks/[itemId] { vibeMin, vibeMax }  → upsert vote
// DELETE /api/vibe-checks/[itemId]                       → revoke vote
//
// `vibe_checks` PK is (item_id, user_id). RLS gates self-only via
// `vibe_checks_self_write`. Revoting upserts the same PK row in place.
// Constraints enforce 0 <= vibe_min <= vibe_max <= 10; we guard up front
// for a clean 400 instead of a Postgres constraint error. The crowd band
// (vibe_check_aggregates) travels on every item of the public world, so
// both writes expire it.

function parseRange(body: unknown): { vibeMin: number; vibeMax: number } | null {
  if (typeof body !== 'object' || body === null) return null
  const { vibeMin, vibeMax } = body as { vibeMin?: unknown; vibeMax?: unknown }
  if (
    typeof vibeMin !== 'number' ||
    typeof vibeMax !== 'number' ||
    !Number.isInteger(vibeMin) ||
    !Number.isInteger(vibeMax) ||
    vibeMin < 0 ||
    vibeMax > 10 ||
    vibeMin > vibeMax
  ) {
    return null
  }
  return { vibeMin, vibeMax }
}

export async function PUT(
  request: NextRequest,
  { params: paramsP }: { params: Promise<{ itemId: string }> },
) {
  const params = await paramsP
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const range = parseRange(body)
  if (!range) {
    return NextResponse.json(
      { error: 'vibeMin and vibeMax must be integers 0..10 with vibeMin <= vibeMax' },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from('vibe_checks')
    .upsert(
      {
        item_id: params.itemId,
        user_id: user.id,
        vibe_min: range.vibeMin,
        vibe_max: range.vibeMax,
      },
      { onConflict: 'item_id,user_id' },
    )

  if (error) {
    // 23503: the piece is gone.
    if (error.code === '23503') return NextResponse.json({ error: 'Esa pieza ya no está.' }, { status: 404 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: NextRequest,
  { params: paramsP }: { params: Promise<{ itemId: string }> },
) {
  const params = await paramsP
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('vibe_checks')
    .delete()
    .eq('item_id', params.itemId)
    .eq('user_id', user.id)
  if (error) {
    // 23503: the piece is gone.
    if (error.code === '23503') return NextResponse.json({ error: 'Esa pieza ya no está.' }, { status: 404 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ ok: true })
}
