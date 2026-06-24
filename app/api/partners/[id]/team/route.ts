import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// /api/partners/[id]/team
// GET    → list team members (users with partner_id = [id])
// POST   → add a user to the team
// PATCH  → toggle partner_admin flag on a team member
// DELETE → kick a team member
//
// Reads are gated by gateTeamAccess (site admin OR any team member). WRITES go
// through SECURITY DEFINER RPCs (partner_team_add / _set_admin / _remove —
// migration 0033) which re-authorize server-side from auth.uid() and scope
// every mutation to THIS partner, never touching role/is_mod/is_og.
//
// Why RPCs and not a direct users UPDATE: the caller's RLS-bound client can't
// write another user's row (users_self_update pins partner_id/partner_admin;
// users_admin_all needs a site admin), so the old direct UPDATE was a silent
// no-op for partner-admins. "Fixing" that with a broad users policy or the
// service-role client would let a partner-admin rewrite ANY user's role —
// privilege escalation. The definer RPCs are the safe middle path.

interface AddBody {
  user_id: string
}

interface PatchBody {
  user_id: string
  partner_admin: boolean
}

interface DeleteBody {
  user_id: string
}

const TEAM_FIELDS =
  'id, username, display_name, role, is_mod, is_og, partner_admin, joined_at'

async function gateTeamAccess(
  supabase: ReturnType<typeof createClient>,
  partnerId: string,
  requireWrite: boolean,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('users')
    .select('role, partner_id, partner_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  // Read access: site admin OR any team member.
  const isReader = profile.role === 'admin' || profile.partner_id === partnerId
  // Write access: site admin OR partner-admin of this partner.
  const isWriter =
    profile.role === 'admin' ||
    (profile.partner_id === partnerId && profile.partner_admin === true)
  if (!isReader || (requireWrite && !isWriter)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user, profile }
}

// Map a SECURITY DEFINER RPC exception to an HTTP status. The functions raise
// 'not authenticated' / 'forbidden' / '… not found' / 'user not on this
// partner team'.
function mapRpcError(error: { message?: string | null }) {
  const m = error?.message ?? ''
  if (m.includes('not authenticated')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (m.includes('forbidden')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (m.includes('not found') || m.includes('not on this partner team')) {
    return NextResponse.json({ error: m }, { status: 404 })
  }
  return NextResponse.json({ error: m || 'Server error' }, { status: 500 })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const gate = await gateTeamAccess(supabase, params.id, false)
  if ('error' in gate) return gate.error

  const { data, error } = await supabase
    .from('users')
    .select(TEAM_FIELDS)
    .eq('partner_id', params.id)
    .order('joined_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ team: data ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const gate = await gateTeamAccess(supabase, params.id, true)
  if ('error' in gate) return gate.error

  let body: AddBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.user_id) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  }

  const { error } = await supabase.rpc('partner_team_add', {
    p_partner_id: params.id,
    p_user_id: body.user_id,
  })
  if (error) return mapRpcError(error)

  // Re-select the public team fields for the response — the SECURITY DEFINER
  // function returns the whole users row (incl. private columns like hp), so
  // never echo its return value straight back to the client.
  const { data: member } = await supabase
    .from('users')
    .select(TEAM_FIELDS)
    .eq('id', body.user_id)
    .maybeSingle()
  return NextResponse.json({ member })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const gate = await gateTeamAccess(supabase, params.id, true)
  if ('error' in gate) return gate.error

  let body: PatchBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.user_id) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  }
  if (typeof body.partner_admin !== 'boolean') {
    return NextResponse.json({ error: 'partner_admin must be boolean' }, { status: 400 })
  }

  const { error } = await supabase.rpc('partner_team_set_admin', {
    p_partner_id: params.id,
    p_user_id: body.user_id,
    p_admin: body.partner_admin,
  })
  if (error) return mapRpcError(error)

  const { data: member } = await supabase
    .from('users')
    .select(TEAM_FIELDS)
    .eq('id', body.user_id)
    .maybeSingle()
  return NextResponse.json({ member })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const gate = await gateTeamAccess(supabase, params.id, true)
  if ('error' in gate) return gate.error

  let body: DeleteBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body.user_id) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  }

  const { error } = await supabase.rpc('partner_team_remove', {
    p_partner_id: params.id,
    p_user_id: body.user_id,
  })
  if (error) return mapRpcError(error)

  return NextResponse.json({ ok: true })
}
