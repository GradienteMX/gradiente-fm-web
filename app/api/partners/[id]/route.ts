import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// /api/partners/[id]
// Partner-side API (distinct from /api/admin/partners/[id] which is admin-
// only). Gated on canManagePartner: site admin OR a team member whose
// users.partner_id matches the requested partner. Used by the dashboard
// MiPartnerSection so partner team members can fetch + edit their own
// partner without needing admin role.
//
// PATCH whitelist is narrower than the admin route — partner team can
// edit marketplace fields + the public-facing image / external URL.
// Structural fields (title, slug, partner_kind) stay admin-only.

interface UpdateBody {
  partner_url?: string | null
  image_url?: string
  marketplace_enabled?: boolean
  marketplace_description?: string | null
  marketplace_location?: string | null
  marketplace_currency?: string | null
}

async function gatePartnerAccess(
  supabase: ReturnType<typeof createClient>,
  partnerId: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('users')
    .select('role, partner_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  // canManagePartner: site admin OR any team member of this partner
  const allowed = profile.role === 'admin' || profile.partner_id === partnerId
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
  const gate = await gatePartnerAccess(supabase, params.id)
  if ('error' in gate) return gate.error

  const { data, error } = await supabase
    .from('items')
    .select(
      'id, slug, title, partner_kind, partner_url, image_url, vibe_min, vibe_max, marketplace_enabled, marketplace_description, marketplace_location, marketplace_currency, marketplace_listings, type',
    )
    .eq('id', params.id)
    .eq('type', 'partner')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
  return NextResponse.json({ partner: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const gate = await gatePartnerAccess(supabase, params.id)
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

  if (body.partner_url !== undefined) {
    patch.partner_url = body.partner_url?.trim() || null
  }
  if (body.image_url !== undefined) {
    const u = body.image_url.trim()
    if (!u) return NextResponse.json({ error: 'image_url required' }, { status: 400 })
    patch.image_url = u
  }
  if (body.marketplace_enabled !== undefined) {
    // Marketplace activation flips visibility on /marketplace + the home
    // rail. Site admins typically own this lever; partner team can also
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

  // partner_last_updated bumps on every PATCH so the rail re-orders the
  // edited partner toward the front (the rail orders by this field).
  patch.partner_last_updated = new Date().toISOString()

  const { data, error } = await supabase
    .from('items')
    .update(patch)
    .eq('id', params.id)
    .eq('type', 'partner')
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ partner: data })
}
