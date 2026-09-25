import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST   /api/follows/[franjaId] → follow a franja
// DELETE /api/follows/[franjaId] → stop following it
//
// `franja_follows` (migration 0053) — PK (user_id, franja_id), RLS self-only
// (franja_follows_self_only), cloned from the saves routes. Following is
// private by design: it only shapes the follower's own Taller; nobody sees
// who follows whom and no count exists anywhere — so nothing here touches
// the public world (no revalidation), and the viewer's follows travel in
// their private overlay (lib/data/world.ts).
//
// Only a published franja can be followed: checked here (a clean 404),
// and re-checked by the table's own trigger.

// Untyped: the generated Database types predate 0053.
type FollowsDb = {
  from: (t: 'franja_follows') => {
    insert: (row: { user_id: string; franja_id: string }) => PromiseLike<{ error: { code?: string; message: string } | null }>
    delete: () => { eq: (k: string, v: string) => { eq: (k: string, v: string) => PromiseLike<{ error: { code?: string; message: string } | null }> } }
  }
}

const NOT_YET = 'Seguir franjas todavía no está disponible.'

/** The table isn't there yet (0053 not applied): PostgREST says PGRST205, Postgres 42P01. */
const missingTable = (code: string | undefined) => code === 'PGRST205' || code === '42P01'

export async function POST(_request: NextRequest, { params: paramsP }: { params: Promise<{ franjaId: string }> }) {
  const params = await paramsP
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: franja } = await supabase.from('items').select('id').eq('id', params.franjaId).eq('type', 'franja').maybeSingle()
  if (!franja) return NextResponse.json({ error: 'Esa franja ya no está.' }, { status: 404 })

  // Idempotent: following twice is still following (23505 is success).
  const { error } = await (supabase as unknown as FollowsDb).from('franja_follows').insert({ user_id: user.id, franja_id: params.franjaId })
  if (error && error.code !== '23505') {
    if (missingTable(error.code)) return NextResponse.json({ error: NOT_YET }, { status: 503 })
    if (error.code === '23503') return NextResponse.json({ error: 'Esa franja ya no está.' }, { status: 404 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params: paramsP }: { params: Promise<{ franjaId: string }> }) {
  const params = await paramsP
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await (supabase as unknown as FollowsDb).from('franja_follows').delete().eq('user_id', user.id).eq('franja_id', params.franjaId)
  if (error) {
    if (missingTable(error.code)) return NextResponse.json({ error: NOT_YET }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
