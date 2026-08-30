import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// /api/franjas/[id]
// Franja-side API (distinct from /api/admin/franjas/[id] which is admin-
// only). Gated on canManageFranja: site admin OR a team member whose
// users.franja_id matches the requested franja. Used by the dashboard
// MiFranjaSection so franja team members can fetch + edit their own
// franja without needing admin role.
//
// PATCH whitelist is narrower than the admin route — franja team can
// edit marketplace fields + the public-facing image / external URL.
// Structural fields (title, slug, franja_kind) stay admin-only.

interface UpdateBody {
  franja_url?: string | null
  image_url?: string
  marketplace_enabled?: boolean
  marketplace_description?: string | null
  marketplace_location?: string | null
  marketplace_currency?: string | null
}

async function gateFranjaAccess(
  supabase: ReturnType<typeof createClient>,
  franjaId: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('users')
    .select('role, franja_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  // canManageFranja: site admin OR any team member of this franja
  const allowed = profile.role === 'admin' || profile.franja_id === franjaId
  if (!allowed) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, profile }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const gate = await gateFranjaAccess(supabase, params.id)
  if ('error' in gate) return gate.error

  const { data, error } = await supabase
    .from('items')
    .select(
      'id, slug, title, franja_kind, franja_url, image_url, vibe_min, vibe_max, marketplace_enabled, marketplace_description, marketplace_location, marketplace_currency, type, marketplace_listings(*)',
    )
    .eq('id', params.id)
    .eq('type', 'franja')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Franja not found' }, { status: 404 })
  return NextResponse.json({ franja: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const gate = await gateFranjaAccess(supabase, params.id)
  if ('error' in gate) return gate.error

  let body: UpdateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Narrow patch — only forward whitelisted fields the body actually sent.
  // Empty strings on optional text fields collapse to null so the team can
  // clear them.
  const patch: Record<string, unknown> = {}

  if (body.franja_url !== undefined) {
    patch.franja_url = body.franja_url?.trim() || null
  }
  if (body.image_url !== undefined) {
    const u = body.image_url.trim()
    if (!u) return NextResponse.json({ error: 'image_url required' }, { status: 400 })
    patch.image_url = u
  }
  if (body.marketplace_enabled !== undefined) {
    // Marketplace activation flips visibility on /marketplace + the home
    // rail. Site admins typically own this lever; franja team can also
    // toggle it for self-service activation/deactivation. If we ever want
    // to lock activation to admins only, narrow the gate here.
    patch.marketplace_enabled = !!body.marketplace_enabled
  }
  if (body.marketplace_description !== undefined) {
    patch.marketplace_description = body.marketplace_description?.trim() || null
  }
  if (body.marketplace_location !== undefined) {
    patch.marketplace_location = body.marketplace_location?.trim() || null
  }
  if (body.marketplace_currency !== undefined) {
    patch.marketplace_currency = body.marketplace_currency?.trim() || null
  }

  // franja_last_updated bumps on every PATCH so the rail re-orders the
  // edited franja toward the front (the rail orders by this field).
  patch.franja_last_updated = new Date().toISOString()

  const { data, error } = await supabase
    .from('items')
    .update(patch)
    .eq('id', params.id)
    .eq('type', 'franja')
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ franja: data })
}
