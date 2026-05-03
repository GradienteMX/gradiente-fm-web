import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

// /api/admin/users/[id]
// PATCH → update role / is_mod / is_og / partner_id / partner_admin for one
//         user. Admin only — RLS gates via users_admin_all (caller's session).
//
// We deliberately don't expose username / display_name / id mutations here.
// Those are user-self-managed fields (display_name) or immutable (id, username
// is unique-constrained and set at signup).

type Role = Database['public']['Enums']['user_role']

interface PatchBody {
  role?: Role
  is_mod?: boolean
  is_og?: boolean
  partner_id?: string | null
  partner_admin?: boolean
}

const VALID_ROLES: readonly Role[] = ['user', 'curator', 'guide', 'insider', 'admin']

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: PatchBody = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Build the patch — only include fields the caller actually sent so we
  // don't accidentally null out partner_id when the form omitted it.
  const patch: Partial<{
    role: Role
    is_mod: boolean
    is_og: boolean
    partner_id: string | null
    partner_admin: boolean
  }> = {}

  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: `Invalid role: ${body.role}` }, { status: 400 })
    }
    patch.role = body.role
  }
  if (body.is_mod !== undefined) patch.is_mod = !!body.is_mod
  if (body.is_og !== undefined) patch.is_og = !!body.is_og
  if (body.partner_id !== undefined) {
    patch.partner_id = body.partner_id?.trim() || null
  }
  if (body.partner_admin !== undefined) {
    patch.partner_admin = !!body.partner_admin
  }
  // partner_admin only meaningful when partner_id is set — clear it if the
  // patch removes the partner link.
  if (patch.partner_id === null) patch.partner_admin = false

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Empty patch' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ user: data })
}
