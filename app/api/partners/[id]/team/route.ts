import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// /api/partners/[id]/team
// GET    → list team members (users with partner_id = [id])
// POST   → add a user to the team (sets users.partner_id = [id])
// PATCH  → toggle partner_admin flag on a team member
// DELETE → kick a team member (sets users.partner_id = null,
//          users.partner_admin = false)
//
// All four are gated on canManagePartnerTeam: site admin OR a team member
// of this partner whose users.partner_admin = true. Regular team members
// can READ via GET but not modify.

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

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const gate = await gateTeamAccess(supabase, params.id, false)
  if ('error' in gate) return gate.error

  const { data, error } = await supabase
    .from('users')
    .select('id, username, display_name, role, is_mod, is_og, partner_admin, joined_at')
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

  // Verify the partner exists (defensive — partner could've been deleted
  // mid-flow). Otherwise the FK on users.partner_id would 23503.
  const { data: partner } = await supabase
    .from('items')
    .select('id')
    .eq('id', params.id)
    .eq('type', 'partner')
    .maybeSingle()
  if (!partner) {
    return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
  }

  // Adding a user already on another partner overwrites the assignment.
  // Matches the existing behavior — we don't enforce one-team-per-user
  // across the whole site, just on the active membership row.
  const { data, error } = await supabase
    .from('users')
    .update({ partner_id: params.id, partner_admin: false })
    .eq('id', body.user_id)
    .select('id, username, display_name, role, is_mod, is_og, partner_admin, joined_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data })
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

  // Only mutate users actually on this partner — protects against
  // promoting a user assigned to a different partner via a forged id.
  const { data, error } = await supabase
    .from('users')
    .update({ partner_admin: body.partner_admin })
    .eq('id', body.user_id)
    .eq('partner_id', params.id)
    .select('id, username, display_name, role, is_mod, is_og, partner_admin, joined_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) {
    return NextResponse.json({ error: 'User not on this partner team' }, { status: 404 })
  }
  return NextResponse.json({ member: data })
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

  // Same scoped-update guard as PATCH — only kick if the user is actually
  // on this partner team.
  const { data, error } = await supabase
    .from('users')
    .update({ partner_id: null, partner_admin: false })
    .eq('id', body.user_id)
    .eq('partner_id', params.id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) {
    return NextResponse.json({ error: 'User not on this partner team' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
