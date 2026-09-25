import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { FranjaKind, FranjaRef } from '@/lib/types'

// GET /api/franjas?q=japan → { franjas: FranjaRef[] }
//
// Type-ahead catalogue for the composer's FRANJAS picker (subject links,
// migration 0051). Published franja rows only — the same set the public rail
// shows — so a draft can only reference a franja that already exists on the
// dial. Auth-gated like /api/entities; no create-on-the-fly (franjas are
// admin-created, see wiki/90-Decisions/Franja Authoring.md).

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  let query = supabase
    .from('items')
    .select('id, title, slug, franja_kind')
    .eq('type', 'franja')
    .eq('published', true)
    .order('title', { ascending: true })
    .limit(20)
  if (q) query = query.ilike('title', `%${q}%`)

  const { data, error } = await query
  if (error) {
    console.error('[GET /api/franjas] search failed', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
  const franjas: FranjaRef[] = ((data ?? []) as { id: string; title: string; slug: string; franja_kind: string | null }[])
    .map((r) => ({ id: r.id, title: r.title, slug: r.slug, kind: (r.franja_kind ?? 'venue') as FranjaKind }))
  return NextResponse.json({ franjas })
}
