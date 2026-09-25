import { NextResponse, type NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WORLD_TAG } from '@/lib/data/tags'

// /api/franjas/[id]
// Franja-side API (distinct from /api/admin/franjas/[id] which is admin-
// only). Gated on canManageFranja: site admin OR a team member whose
// users.franja_id matches the requested franja. Used by the Taller's
// Franja and Mercado spaces so franja team members can fetch + edit their
// own franja without needing admin role.
//
// PATCH whitelist is narrower than the admin route — franja team can
// edit marketplace fields + the public-facing image / external URL.
// Structural fields (title, slug, franja_kind) stay admin-only.
//
// WHY THE WRITE USES THE SERVICE ROLE. No RLS policy lets a team member
// update the franja's OWN row (checked against production's pg_policies
// 2026-09-25): items_partner_team_update only covers rows *attributed* to
// the franja (franja_id = theirs, source = 'manual:franja'), and the
// franja row itself carries no franja_id. So through the caller's client
// this PATCH matched zero rows for everyone but site admins, and the team's
// self-service storefront switch (fase D) never saved. A policy can't be the
// fix — a row-level grant would hand the team every column of their franja
// (title, verified, sponsored, pinned…). The authority is this route: the
// gate below reads the caller's own row with their own session, and the
// update writes ONLY the whitelisted columns, only on this franja's row.

interface UpdateBody {
  franja_url?: string | null
  image_url?: string | null
  marketplace_enabled?: boolean
  marketplace_description?: string | null
  marketplace_location?: string | null
  marketplace_currency?: string | null
}

async function gateFranjaAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
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
    return { error: NextResponse.json({ error: 'Solo el equipo de la franja (o administración) puede cambiarla.' }, { status: 403 }) }
  }
  return { user, profile }
}

export async function GET(
  _request: NextRequest,
  { params: paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await paramsP
  const supabase = await createClient()
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
  { params: paramsP }: { params: Promise<{ id: string }> },
) {
  const params = await paramsP
  const supabase = await createClient()
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
    const u = body.image_url?.trim() ?? ''
    if (!u) return NextResponse.json({ error: 'El logo no puede quedar vacío.' }, { status: 400 })
    patch.image_url = u
  }
  if (body.marketplace_enabled !== undefined) {
    // Marketplace activation flips visibility on /marketplace + the home
    // rail. GOVERNANCE (2026-09, fase D): this is SELF-SERVICE — the franja
    // team owns its own storefront switch, in the dashboard's MERCADO space
    // under AJUSTES. The old admin approval queue is retired; site admins
    // keep only an abuse kill-switch, on /admin, through the admin route.
    // Do not narrow this gate without moving that UI too.
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
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Empty patch' }, { status: 400 })
  }

  // franja_last_updated bumps on every PATCH so the rail re-orders the
  // edited franja toward the front (the rail orders by this field).
  patch.franja_last_updated = new Date().toISOString()

  // The service role, after the gate above (see the header): whitelisted
  // columns, this franja's row only.
  const { data, error } = await createAdminClient()
    .from('items')
    .update(patch as never)
    .eq('id', params.id)
    .eq('type', 'franja')
    .select('id, slug, title, franja_kind, franja_url, image_url, marketplace_enabled, marketplace_description, marketplace_location, marketplace_currency, franja_last_updated')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Esa franja ya no está.' }, { status: 404 })
  // A franja's card and storefront are part of the public world.
  revalidateTag(WORLD_TAG, { expire: 0 })
  return NextResponse.json({ franja: data })
}
