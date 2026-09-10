import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/api/requireAdmin'

// PATCH /api/admin/items/[id]/portada { pinned: boolean }
//
// The one-click portada lever. `pinned` is a declarative editor flag (unlike
// HL it claims no engagement), so it needs no ledger row: the column is its
// own record. Admin-only — the toggle lives on cards, the hero and the
// overlay header, so it must be impossible to reach for anyone else. RLS
// (items_staff_update) re-checks the caller regardless of what this route
// believes; `pinned` is inside the column grant from 0049 §6.

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let body: { pinned?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof body.pinned !== 'boolean') {
    return NextResponse.json({ error: 'pinned debe ser true o false' }, { status: 400 })
  }

  const { data, error } = await gate.supabase
    .from('items')
    .update({ pinned: body.pinned })
    .eq('id', params.id)
    .neq('type', 'franja')
    .select('id, pinned')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  // The home is force-dynamic, so this only clears any full-route cache a
  // deployment might add later; the client refreshes itself after the call.
  revalidatePath('/')
  return NextResponse.json({ ok: true, itemId: data.id, pinned: data.pinned })
}
