import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

// /api/admin/partners/[id]
// GET    → fetch one partner row (full detail, for edit form prefill)
// PATCH  → update editable fields on a partner row
// DELETE → hard-delete the partner row (cascades comments/saves/polls/
//          hp_events; users.partner_id + invite_codes.intended_partner_id
//          set null per existing FK constraints)
//
// Admin-only on all three. Validates partner_kind + vibe range bounds
// the same way POST /api/admin/partners does.

type PartnerKind = Database['public']['Enums']['partner_kind']

const VALID_KINDS: readonly PartnerKind[] = [
  'promo',
  'label',
  'promoter',
  'venue',
  'sponsored',
  'dealer',
]

interface UpdateBody {
  title?: string
  partner_kind?: PartnerKind
  partner_url?: string | null
  image_url?: string
  vibe_min?: number
  vibe_max?: number
  marketplace_enabled?: boolean
  marketplace_description?: string | null
  marketplace_location?: string | null
  marketplace_currency?: string | null
}

async function gateAdmin(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const gate = await gateAdmin(supabase)
  if ('error' in gate) return gate.error

  const { data, error } = await supabase
    .from('items')
    .select(
      'id, slug, title, partner_kind, partner_url, image_url, vibe_min, vibe_max, marketplace_enabled, marketplace_description, marketplace_location, marketplace_currency, type',
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
  const gate = await gateAdmin(supabase)
  if ('error' in gate) return gate.error

  let body: UpdateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Build a narrow patch object — only forward fields the body actually
  // sent. Empty strings on optional text fields collapse to null so the
  // admin can clear them.
  const patch: Record<string, unknown> = {}

  if (body.title !== undefined) {
    const t = body.title.trim()
    if (!t) return NextResponse.json({ error: 'title required' }, { status: 400 })
    patch.title = t
  }
  if (body.partner_kind !== undefined) {
    if (!VALID_KINDS.includes(body.partner_kind)) {
      return NextResponse.json(
        { error: `partner_kind invalid (${VALID_KINDS.join('|')})` },
        { status: 400 },
      )
    }
    patch.partner_kind = body.partner_kind
  }
  if (body.partner_url !== undefined) {
    patch.partner_url = body.partner_url?.trim() || null
  }
  if (body.image_url !== undefined) {
    const u = body.image_url.trim()
    if (!u) return NextResponse.json({ error: 'image_url required' }, { status: 400 })
    patch.image_url = u
  }
  if (body.vibe_min !== undefined || body.vibe_max !== undefined) {
    const min = body.vibe_min ?? 0
    const max = body.vibe_max ?? 10
    const vibeValid = (v: unknown): v is number =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10
    if (!vibeValid(min) || !vibeValid(max)) {
      return NextResponse.json({ error: 'vibe_min and vibe_max must be 0-10' }, { status: 400 })
    }
    if (min > max) {
      return NextResponse.json({ error: 'vibe_min must be <= vibe_max' }, { status: 400 })
    }
    if (body.vibe_min !== undefined) patch.vibe_min = Math.round(min)
    if (body.vibe_max !== undefined) patch.vibe_max = Math.round(max)
  }
  if (body.marketplace_enabled !== undefined) {
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

  // partner_last_updated bumps on every PATCH so the rail reorders the
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const gate = await gateAdmin(supabase)
  if ('error' in gate) return gate.error

  // Cascades (per migration 0001):
  //   - comments / user_saves / polls / hp_events on this partner-item
  //     CASCADE delete
  //   - users.partner_id + invite_codes.intended_partner_id pointing here
  //     SET NULL (team members + pending invites lose the partner link
  //     but their accounts / codes survive)
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', params.id)
    .eq('type', 'partner')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
