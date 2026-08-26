import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

// /api/admin/partners/[id]
// GET    → fetch one franja row (full detail, for edit form prefill)
// PATCH  → update editable fields on a franja row
// DELETE → hard-delete the franja row (cascades comments/saves/polls/
//          hp_events; users.franja_id + invite_codes.intended_franja_id
//          set null per existing FK constraints)
//
// Admin-only on all three. Validates franja_kind + vibe range bounds
// the same way POST /api/admin/franjas does.

type FranjaKind = Database['public']['Enums']['franja_kind']

const VALID_KINDS: readonly FranjaKind[] = [
  'label',
  'promoter',
  'venue',
  'dealer',
  'colectivo',
  'festival',
  'club',
  'medios',
  'mix-series',
  'plataforma',
]

interface UpdateBody {
  title?: string
  franja_kind?: FranjaKind
  franja_url?: string | null
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
      'id, slug, title, franja_kind, franja_url, image_url, vibe_min, vibe_max, marketplace_enabled, marketplace_description, marketplace_location, marketplace_currency, type',
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
  if (body.franja_kind !== undefined) {
    if (!VALID_KINDS.includes(body.franja_kind)) {
      return NextResponse.json(
        { error: `franja_kind invalid (${VALID_KINDS.join('|')})` },
        { status: 400 },
      )
    }
    patch.franja_kind = body.franja_kind
  }
  if (body.franja_url !== undefined) {
    patch.franja_url = body.franja_url?.trim() || null
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

  // franja_last_updated bumps on every PATCH so the rail reorders the
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const gate = await gateAdmin(supabase)
  if ('error' in gate) return gate.error

  // Cascades (per migration 0001):
  //   - comments / user_saves / polls / hp_events on this franja-item
  //     CASCADE delete
  //   - users.franja_id + invite_codes.intended_franja_id pointing here
  //     SET NULL (team members + pending invites lose the franja link
  //     but their accounts / codes survive)
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', params.id)
    .eq('type', 'franja')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
