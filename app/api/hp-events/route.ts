import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// /api/hp-events
// POST → emit one engagement event for an item. The pg_cron `apply_hp_rollup`
// job batches events into items.hp every 5 min. RLS already restricts inserts
// to authenticated users (hp_events_authenticated_insert in 0002_rls.sql);
// this route exists so we can stamp weight + kind on the server, validate
// against an allowlist, and fire-and-forget from any client surface without
// each one carrying the supabase client.
//
// Anonymous viewers don't write events — the engagement signal is gated on
// login the same way comments / saves / vibe checks are. This is consistent
// with [[Guides Not Gatekeepers]]: HP feedback comes from people who chose
// to be present in the system, not from drive-by clicks.

// Weights chosen to roughly match commitment level. See
// wiki/20-Domain/HP Curation System.md → § 1 (spawn HP) for context: spawn
// is 20 (or 50 for editorial). A single click adds 0.5 — meaningful but
// nowhere near a republish. A save adds 3 — about the value of a single
// item half-life tick.
const KIND_WEIGHTS: Record<string, number> = {
  click: 0.5,
  open: 1,
  save: 3,
  comment: 2,
}

interface PostBody {
  item_id?: string
  kind?: string
}

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: PostBody = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.item_id || typeof body.item_id !== 'string') {
    return NextResponse.json({ error: 'item_id required' }, { status: 400 })
  }
  if (!body.kind || !(body.kind in KIND_WEIGHTS)) {
    return NextResponse.json(
      { error: `kind must be one of: ${Object.keys(KIND_WEIGHTS).join(', ')}` },
      { status: 400 },
    )
  }

  const weight = KIND_WEIGHTS[body.kind]

  const { error } = await supabase
    .from('hp_events')
    .insert({ item_id: body.item_id, kind: body.kind, weight })

  if (error) {
    // FK violation (item_id not in items) → 404; everything else → 500.
    const isFk = error.code === '23503'
    return NextResponse.json(
      { error: error.message },
      { status: isFk ? 404 : 500 },
    )
  }
  return NextResponse.json({ ok: true })
}
