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
  /**
   * The code, proposed by the client: Central shows it (and the admin copies
   * it) the instant it is generated, so the row must carry exactly that one.
   * INV- + 16–32 hex; minted here when absent.
   */
  code?: string
  intended_role?: 'user' | 'curator' | 'guide' | 'insider' | 'admin'
  intended_is_mod?: boolean
  intended_franja_id?: string | null
  intended_franja_admin?: boolean
  card_name?: string | null
  expires_in_days?: number | null
}

export async function GET() {
  const supabase = await createClient()

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
  const supabase = await createClient()

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
  const franjaId = body.intended_franja_id?.trim() || null
  const franjaAdmin = !!body.intended_franja_admin && !!franjaId
  const cardName = body.card_name?.trim() || null
  // Absent → 30 days; null → never expires. (`?? 30` used to turn an
  // explicit null into 30 days, so «no expira» could not be issued.)
  const expiresInDays = body.expires_in_days === undefined ? 30 : body.expires_in_days
  if (expiresInDays !== null && (!Number.isFinite(expiresInDays) || expiresInDays < 1 || expiresInDays > 365)) {
    return NextResponse.json({ error: 'La vigencia va de 1 a 365 días (o sin fecha).' }, { status: 400 })
  }
  const expiresAt =
    expiresInDays === null
      ? null
      : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
  const proposed = typeof body.code === 'string' ? body.code.trim() : ''
  if (proposed && !/^INV-[0-9a-f]{16,32}$/i.test(proposed)) {
    return NextResponse.json({ error: 'Código con forma inválida.' }, { status: 400 })
  }

  // Folio = the beta member number (NNN/150) printed on the invitación-3d card.
  // Assigned as the next free integer. The roster bulk-import sets folios 1..N
  // in sheet order explicitly; one-off codes minted here continue the run. The
  // partial unique index (folio where not null) is the real guard against a rare
  // concurrent-mint collision — it surfaces as an error the admin can just retry.
  const { data: maxRow } = await supabase
    .from('invite_codes')
    .select('folio')
    .not('folio', 'is', null)
    .order('folio', { ascending: false })
    .limit(1)
    .maybeSingle()
  const folio = (maxRow?.folio ?? 0) + 1

  // Random opaque token. INV- prefix distinguishes from BOOT- bootstrap codes.
  const code = proposed || 'INV-' + randomBytes(8).toString('hex')

  const { data, error } = await supabase
    .from('invite_codes')
    .insert({
      code,
      intended_role: role,
      intended_is_mod: isMod,
      intended_franja_id: franjaId,
      intended_franja_admin: franjaAdmin,
      card_name: cardName,
      folio,
      created_by: user.id,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) {
    // 23505: the code (or the folio) is taken. A proposed code that already
    // exists because THIS admin's other request stored it a moment ago —
    // Central's waitlist «Generar código» sends the same code to
    // /api/admin/waitlist too — is the same invitation, not a clash. Anything
    // else is never overwritten.
    if (error.code === '23505') {
      const { data: existing } = proposed
        ? await supabase.from('invite_codes').select('*').eq('code', proposed).maybeSingle()
        : { data: null }
      if (existing && existing.created_by === user.id && !existing.used_by) {
        return NextResponse.json({ code: existing, reused: true })
      }
      return NextResponse.json({ error: existing ? 'Ese código ya existe. Genera otro.' : 'El folio se ocupó al mismo tiempo. Intenta de nuevo.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ code: data })
}
