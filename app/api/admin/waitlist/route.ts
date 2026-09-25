import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

// /api/admin/waitlist — convert waitlist entries into invite codes.
//
// POST   { id, code? } → mint an invite code for the entry (idempotent: an
//                 existing unexpired code is returned instead of minting a
//                 second one), mark the entry invited. The code funnels the
//                 person into the EXISTING /welcome?codigo= signup pipeline —
//                 this route never touches auth.users.
//                 `code`: the code Central already generated and copied (V2
//                 dispatches the invitation and this status together). It is
//                 linked as it is — inserted here if the invitation's own
//                 request hasn't stored it yet, found if it has — so the
//                 person gets exactly the link the admin sent: ONE code.
// DELETE { id } → remove an entry (spam cleanup / ARCO removal requests).
//
// Same trust model as /api/admin/invite-codes: SSR client (caller's session),
// RLS does the enforcement (waitlist_signups_admin_all + invite_codes_admin_all),
// and we pre-check the role for clean 401/403s.

interface ActionBody {
  id?: string
  code?: string
}

const CODE_RE = /^INV-[0-9a-f]{16,32}$/i

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') {
    return { supabase, user: null, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { supabase, user, res: null }
}

type Db = Awaited<ReturnType<typeof createClient>>

/**
 * After this, invitation `code` exists: found (this admin's own invitation
 * request stored it a moment ago) or inserted here with the waitlist shape
 * (reader, 30 days, the alias on the card, the next folio — mirroring POST
 * /api/admin/invite-codes). A code someone else minted is never adopted.
 */
async function ensureCode(
  supabase: Db,
  code: string,
  cardName: string | null,
  adminId: string,
): Promise<{ ok: true; reused: boolean } | { ok: false; res: NextResponse }> {
  const find = () => supabase.from('invite_codes').select('code, created_by').eq('code', code).maybeSingle()
  const clash = () => ({ ok: false as const, res: NextResponse.json({ error: 'Ese código ya existe. Genera otro.' }, { status: 409 }) })

  const { data: found } = await find()
  if (found) return found.created_by === adminId ? { ok: true, reused: true } : clash()

  const { data: maxRow } = await supabase
    .from('invite_codes')
    .select('folio')
    .not('folio', 'is', null)
    .order('folio', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { error } = await supabase.from('invite_codes').insert({
    code,
    intended_role: 'user',
    card_name: cardName,
    folio: (maxRow?.folio ?? 0) + 1,
    created_by: adminId,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  })
  if (!error) return { ok: true, reused: false }
  if (error.code === '23505') {
    // Raced the invitation's own request (same code): the same invitation.
    const { data: raced } = await find()
    if (raced) return raced.created_by === adminId ? { ok: true, reused: true } : clash()
    return { ok: false, res: NextResponse.json({ error: 'El folio se ocupó al mismo tiempo. Intenta de nuevo.' }, { status: 409 }) }
  }
  return { ok: false, res: NextResponse.json({ error: error.message }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  const { supabase, user, res } = await requireAdmin()
  if (res || !user) return res!

  let body: ActionBody = {}
  try {
    body = await request.json()
  } catch {
    /* fall through to the id check */
  }
  const id = body.id?.trim()
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const { data: entry, error: entryErr } = await supabase
    .from('waitlist_signups')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 500 })
  if (!entry) return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })

  // The code Central already generated (and copied): link exactly that one.
  const proposed = typeof body.code === 'string' ? body.code.trim() : ''
  if (proposed) {
    if (!CODE_RE.test(proposed)) return NextResponse.json({ error: 'Código con forma inválida.' }, { status: 400 })
    const linked = await ensureCode(supabase, proposed, entry.alias || null, user.id)
    if (!linked.ok) return linked.res
    const { error: linkErr } = await supabase
      .from('waitlist_signups')
      .update({ status: 'invited', invite_code: proposed, invited_at: new Date().toISOString() })
      .eq('id', id)
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 })
    return NextResponse.json({ code: proposed, reused: linked.reused })
  }

  // Idempotency: reuse a previously-minted code while it's still redeemable
  // (or already redeemed — then the link simply reports "ya activado").
  if (entry.invite_code) {
    const { data: existing } = await supabase
      .from('invite_codes')
      .select('code, used_at, expires_at')
      .eq('code', entry.invite_code)
      .maybeSingle()
    const expired =
      existing?.expires_at != null && new Date(existing.expires_at) < new Date() && !existing.used_at
    if (existing && !expired) {
      return NextResponse.json({ code: existing.code, reused: true })
    }
    // Expired and never used → fall through and mint a replacement.
  }

  // Mint — mirrors /api/admin/invite-codes POST (folio continuation, INV-
  // prefix, 30-day expiry) with the waitlist alias as the card name.
  const { data: maxRow } = await supabase
    .from('invite_codes')
    .select('folio')
    .not('folio', 'is', null)
    .order('folio', { ascending: false })
    .limit(1)
    .maybeSingle()
  const folio = (maxRow?.folio ?? 0) + 1

  const code = 'INV-' + randomBytes(8).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error: codeErr } = await supabase.from('invite_codes').insert({
    code,
    intended_role: 'user',
    card_name: entry.alias || null,
    folio,
    created_by: user.id,
    expires_at: expiresAt,
  })
  if (codeErr) return NextResponse.json({ error: codeErr.message }, { status: 500 })

  const { error: updErr } = await supabase
    .from('waitlist_signups')
    .update({ status: 'invited', invite_code: code, invited_at: new Date().toISOString() })
    .eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ code, reused: false })
}

export async function DELETE(request: NextRequest) {
  const { res } = await requireAdmin()
  if (res) return res

  let body: ActionBody = {}
  try {
    body = await request.json()
  } catch {
    /* fall through to the id check */
  }
  const id = body.id?.trim()
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const supabase = await createClient()
  const { error } = await supabase.from('waitlist_signups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
