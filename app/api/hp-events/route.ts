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
// Tuned 2026-06-02 (balanced set, validated via scripts/hpSim.mjs). At beta
// scale these sharpen crowd reactivity — a well-received non-editorial item
// can reach the lg tier while a neglected editorial pick slips toward sm —
// without overpowering the editorial spawn lever. NOTE: weight *magnitude* is
// a minor lever (score normalizes by per-type peak); the real scale-up knob is
// switching that normalization from max → rolling p90 (see lib/curation.ts:99).
const KIND_WEIGHTS: Record<string, number> = {
  click: 0.5,
  open: 1.5,
  save: 4,
  comment: 3,
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

  // record_hp_event (migration 0025) scales the base weight by how novel this
  // item's genre/type/vibe are to the caller, records the event, and folds the
  // interaction into the caller's private affinity profile — all atomically,
  // server-authoritative. Returns the applied multiplier, or -1 if the item is
  // absent. We deliberately do NOT echo the multiplier: the novelty weighting
  // is under the hood, never surfaced to the client (see Novelty Weighting doc).
  const { data: result, error } = await supabase.rpc('record_hp_event', {
    p_item_id: body.item_id,
    p_kind: body.kind,
    p_base_weight: weight,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (result === null || result < 0) {
    return NextResponse.json({ error: 'item not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
