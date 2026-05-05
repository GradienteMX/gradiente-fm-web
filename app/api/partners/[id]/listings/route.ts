import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// /api/partners/[id]/listings — collection endpoint.
// POST → create a marketplace listing under this partner.
// Gated on canManagePartner: site admin OR a team member of this partner.
// (RLS on marketplace_listings_team_write enforces the same gate from the
// DB side.)
//
// GET on this collection is intentionally absent — listings come back
// embedded on GET /api/partners/[id]. If a consumer ever needs an
// independent listings query (e.g. cross-partner filtering by category),
// add a GET here.

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

interface CreateBody {
  id: string
  title: string
  category: ValidCategory
  subcategory?: string | null
  price?: number
  condition: ValidCondition
  status?: ValidStatus
  description?: string | null
  tags?: string[]
  shipping_mode?: ValidShipping | null
  images?: string[]
  embeds?: unknown
  published_at?: string
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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const gate = await gatePartnerWrite(supabase, params.id)
  if ('error' in gate) return gate.error

  let body: CreateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.id?.trim()) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }
  if (!VALID_CATEGORIES.includes(body.category)) {
    return NextResponse.json(
      { error: `category invalid (${VALID_CATEGORIES.join('|')})` },
      { status: 400 },
    )
  }
  if (!VALID_CONDITIONS.includes(body.condition)) {
    return NextResponse.json(
      { error: `condition invalid (${VALID_CONDITIONS.join('|')})` },
      { status: 400 },
    )
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `status invalid (${VALID_STATUSES.join('|')})` },
      { status: 400 },
    )
  }
  if (body.shipping_mode && !VALID_SHIPPING.includes(body.shipping_mode)) {
    return NextResponse.json(
      { error: `shipping_mode invalid (${VALID_SHIPPING.join('|')})` },
      { status: 400 },
    )
  }
  if (typeof body.price === 'number' && body.price < 0) {
    return NextResponse.json({ error: 'price must be >= 0' }, { status: 400 })
  }

  // Verify the partner exists (defensive — partner could have been
  // deleted mid-flow; the FK on partner_id would 23503 otherwise).
  const { data: partner } = await supabase
    .from('items')
    .select('id')
    .eq('id', params.id)
    .eq('type', 'partner')
    .maybeSingle()
  if (!partner) {
    return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({
      id: body.id.trim(),
      partner_id: params.id,
      title: body.title.trim(),
      category: body.category,
      subcategory: body.subcategory?.trim() || null,
      price: body.price ?? 0,
      condition: body.condition,
      status: body.status ?? 'available',
      description: body.description?.trim() || null,
      tags: body.tags ?? [],
      shipping_mode: body.shipping_mode ?? null,
      images: body.images ?? [],
      embeds: (body.embeds ?? []) as never,
      published_at: body.published_at ?? new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A listing with that id already exists' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ listing: data })
}
