import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// /api/partners/[id]/listings/[lid] — single-listing endpoint.
// PATCH  → partial update of an existing listing.
// DELETE → remove the listing row (cascades any future listing-scoped
//          tables, but today nothing FKs to marketplace_listings).
//
// Gated on canManagePartner: site admin OR a team member of this partner.
// RLS on marketplace_listings_team_write enforces the same DB-side.
// The .eq('partner_id', params.id) on every query keeps mutations scoped
// so a forged lid from another partner can't slip through the gate.

const VALID_CATEGORIES = [
  'vinyl', 'cassette', 'cd', 'synth', 'drum-machine',
  'turntable', 'mixer', 'outboard', 'merch', 'other',
] as const
type ValidCategory = (typeof VALID_CATEGORIES)[number]

const VALID_CONDITIONS = ['NEW', 'NM', 'VG+', 'VG', 'G+', 'G', 'F'] as const
type ValidCondition = (typeof VALID_CONDITIONS)[number]

const VALID_STATUSES = ['available', 'reserved', 'sold'] as const
type ValidStatus = (typeof VALID_STATUSES)[number]

const VALID_SHIPPING = ['shipping', 'local', 'both'] as const
type ValidShipping = (typeof VALID_SHIPPING)[number]

interface UpdateBody {
  title?: string
  category?: ValidCategory
  subcategory?: string | null
  price?: number
  condition?: ValidCondition
  status?: ValidStatus
  description?: string | null
  tags?: string[]
  shipping_mode?: ValidShipping | null
  images?: string[]
  embeds?: unknown
}

async function gatePartnerWrite(
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
  const allowed = profile.role === 'admin' || profile.partner_id === partnerId
  if (!allowed) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, profile }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; lid: string } },
) {
  const supabase = createClient()
  const gate = await gatePartnerWrite(supabase, params.id)
  if ('error' in gate) return gate.error

  let body: UpdateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Build a narrow patch — only forward fields the body actually sent.
  const patch: Record<string, unknown> = {}

  if (body.title !== undefined) {
    const t = body.title.trim()
    if (!t) return NextResponse.json({ error: 'title required' }, { status: 400 })
    patch.title = t
  }
  if (body.category !== undefined) {
    if (!VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        { error: `category invalid (${VALID_CATEGORIES.join('|')})` },
        { status: 400 },
      )
    }
    patch.category = body.category
  }
  if (body.subcategory !== undefined) {
    patch.subcategory = body.subcategory?.trim() || null
  }
  if (body.price !== undefined) {
    if (typeof body.price !== 'number' || body.price < 0) {
      return NextResponse.json({ error: 'price must be >= 0' }, { status: 400 })
    }
    patch.price = body.price
  }
  if (body.condition !== undefined) {
    if (!VALID_CONDITIONS.includes(body.condition)) {
      return NextResponse.json(
        { error: `condition invalid (${VALID_CONDITIONS.join('|')})` },
        { status: 400 },
      )
    }
    patch.condition = body.condition
  }
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `status invalid (${VALID_STATUSES.join('|')})` },
        { status: 400 },
      )
    }
    patch.status = body.status
  }
  if (body.description !== undefined) {
    patch.description = body.description?.trim() || null
  }
  if (body.tags !== undefined) {
    patch.tags = body.tags
  }
  if (body.shipping_mode !== undefined) {
    if (body.shipping_mode && !VALID_SHIPPING.includes(body.shipping_mode)) {
      return NextResponse.json(
        { error: `shipping_mode invalid (${VALID_SHIPPING.join('|')})` },
        { status: 400 },
      )
    }
    patch.shipping_mode = body.shipping_mode
  }
  if (body.images !== undefined) {
    patch.images = body.images
  }
  if (body.embeds !== undefined) {
    patch.embeds = body.embeds
  }

  const { data, error } = await supabase
    .from('marketplace_listings')
    .update(patch as never)
    .eq('id', params.lid)
    .eq('partner_id', params.id)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }
  return NextResponse.json({ listing: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; lid: string } },
) {
  const supabase = createClient()
  const gate = await gatePartnerWrite(supabase, params.id)
  if ('error' in gate) return gate.error

  const { data, error } = await supabase
    .from('marketplace_listings')
    .delete()
    .eq('id', params.lid)
    .eq('partner_id', params.id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
