import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

// /api/admin/invite-codes
// GET  → list codes (admin only — RLS gates via invite_codes_admin_all)
// POST → create a new code, returns it for the admin to copy
//
// RLS does the heavy lifting. We use the SSR client (caller's session),
// not the service-role client. If the caller isn't admin, RLS rejects
// the insert/select with permission-denied which we surface as 403.

interface CreateBody {
  intended_role?: 'user' | 'curator' | 'guide' | 'insider' | 'admin'
  intended_is_mod?: boolean
  intended_partner_id?: string | null
  intended_partner_admin?: boolean
  expires_in_days?: number | null
}

export async function GET() {
  const supabase = createClient()

  // Auth check up front so we can return a clean 401/403 instead of an
  // empty list if the caller isn't admin.
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

  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ codes: data ?? [] })
}

export async function POST(request: NextRequest) {
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

  let body: CreateBody = {}
  try {
    body = await request.json()
  } catch {
    /* empty body is fine — defaults will apply */
  }

  const role = body.intended_role ?? 'user'
  const isMod = !!body.intended_is_mod
  const partnerId = body.intended_partner_id?.trim() || null
  const partnerAdmin = !!body.intended_partner_admin && !!partnerId
  const expiresInDays = body.expires_in_days ?? 30
  const expiresAt =
    expiresInDays === null
      ? null
      : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

  // Random opaque token. INV- prefix distinguishes from BOOT- bootstrap codes.
  const code = 'INV-' + randomBytes(8).toString('hex')

  const { data, error } = await supabase
    .from('invite_codes')
    .insert({
      code,
      intended_role: role,
      intended_is_mod: isMod,
      intended_partner_id: partnerId,
      intended_partner_admin: partnerAdmin,
      created_by: user.id,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ code: data })
}
