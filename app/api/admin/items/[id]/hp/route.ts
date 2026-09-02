import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin, statusForRpcError } from '@/lib/api/requireAdmin'

// POST /api/admin/items/[id]/hp — the beta-calibration HL lever.
//
// WHAT THIS IS. During beta the team needs to see the mosaic in states real
// traffic will not produce for months at 61 users: what the grid looks like
// when a mix outranks tonight's event, how the tier ladder behaves at the
// bracket boundaries, whether the creator-side HP loop responds the way the
// model says. This route manufactures those states on demand.
//
// WHAT IT IS NOT. It is not a curation thumb. `editorial`, `elevated` and
// `pinned` are the honest levers for "this piece should matter more" — they
// are declarative, they are visible in the item's own record, and they do not
// pretend engagement happened. Anyone reaching for this route to promote
// content is using the wrong tool, and the audit trail will say so.
//
// The route is deliberately thin. ALL authorization, the decay math, the
// clamp, the audit row and the ledger row live inside admin_adjust_item_hp()
// (migration 0049 §5) so there is exactly one path that can move items.hp and
// it cannot be reached without writing its own record. requireAdmin() here is
// the second lock, not the only one — the RPC re-derives the caller from
// auth.uid() and re-checks private.auth_is_admin() regardless of what this
// route believes.
//
// Reversal needs no endpoint of its own: audit_log carries before/after, so
// the UI reverts by POSTing the inverse delta, which is itself audited. There
// is no un-audited undo.

interface Body {
  delta?: number
  reason?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let body: Body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const delta = Number(body.delta)
  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json(
      { error: 'delta debe ser un número distinto de cero' },
      { status: 400 },
    )
  }

  // A reason is required, not optional. An unexplained adjustment is a number
  // in the ledger that nobody can interpret three weeks later — which defeats
  // the purpose of keeping the ledger at all.
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (reason.length < 3) {
    return NextResponse.json(
      { error: 'Indica el motivo del ajuste (mínimo 3 caracteres)' },
      { status: 400 },
    )
  }
  if (reason.length > 280) {
    return NextResponse.json({ error: 'El motivo excede 280 caracteres' }, { status: 400 })
  }

  const { data, error } = await gate.supabase.rpc('admin_adjust_item_hp' as never, {
    p_item_id: params.id,
    p_delta: delta,
    p_reason: reason,
  } as never)

  if (error) {
    // The RPC raises with the house errcode vocabulary ('28000' unauthenticated,
    // '42501' forbidden, 'P0002' not found, '22023' bad parameter); anything
    // else is a genuine 500 and keeps its message.
    return NextResponse.json(
      { error: error.message },
      { status: statusForRpcError((error as { code?: string }).code) },
    )
  }

  return NextResponse.json(data)
}
