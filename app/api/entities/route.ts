import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EntityKind, EntityRef } from '@/lib/types'

// Scene-entity endpoint (migration 0029).
//
//   GET  /api/entities?kind=artist&q=ro      → type-ahead search (max 20)
//   POST /api/entities { kind, name }         → resolve-or-create, returns ref
//
// Both are auth-gated (the whole site is invite-only). Search is open to any
// authed user; create is gated by RLS to guide/admin — a denial surfaces as
// a clean 403 rather than a raw PostgREST error.

const KINDS: EntityKind[] = ['artist', 'label', 'venue', 'promoter']

function isKind(v: string | null): v is EntityKind {
  return v !== null && (KINDS as string[]).includes(v)
}

// URL-safe slug. Matches the composer's slugify so client/server agree on the
// de-dup key — "Ro Pax" and "ro  pax" both collapse to "ro-pax".
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = request.nextUrl.searchParams
  const kind = params.get('kind')
  const q = (params.get('q') ?? '').trim()
  if (!isKind(kind)) {
    return NextResponse.json({ error: 'kind must be one of ' + KINDS.join(', ') }, { status: 400 })
  }

  let query = supabase
    .from('entities')
    .select('id, kind, name, slug')
    .eq('kind', kind)
    .is('merged_into', null)
    .order('name', { ascending: true })
    .limit(20)
  if (q) query = query.ilike('name', `%${q}%`)

  const { data, error } = await query
  if (error) {
    console.error('[GET /api/entities] search failed', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
  return NextResponse.json({ entities: (data ?? []) as EntityRef[] })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { kind?: unknown; name?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const kind = typeof body.kind === 'string' ? body.kind : null
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!isKind(kind)) {
    return NextResponse.json({ error: 'kind must be one of ' + KINDS.join(', ') }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }
  const slug = slugify(name)
  if (!slug) {
    return NextResponse.json({ error: 'name produces empty slug' }, { status: 400 })
  }

  // Resolve first — the (kind, slug) unique index is the de-dup key. A second
  // author typing the same name links the existing row instead of erroring.
  const { data: existing } = await supabase
    .from('entities')
    .select('id, kind, name, slug')
    .eq('kind', kind)
    .eq('slug', slug)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ entity: existing as EntityRef })
  }

  const { data: created, error } = await supabase
    .from('entities')
    .insert({ kind, name, slug, created_by: user.id })
    .select('id, kind, name, slug')
    .single()
  if (error) {
    // RLS denial (non-author role) lands here as code 42501.
    if (error.code === '42501') {
      return NextResponse.json(
        { error: 'No tienes permiso para crear entidades' },
        { status: 403 },
      )
    }
    // Lost a create race against a concurrent author with the same name —
    // re-resolve the now-existing row.
    if (error.code === '23505') {
      const { data: raced } = await supabase
        .from('entities')
        .select('id, kind, name, slug')
        .eq('kind', kind)
        .eq('slug', slug)
        .maybeSingle()
      if (raced) return NextResponse.json({ entity: raced as EntityRef })
    }
    console.error('[POST /api/entities] insert failed', error)
    return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  }
  return NextResponse.json({ entity: created as EntityRef })
}
