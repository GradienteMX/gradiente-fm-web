import { NextResponse, type NextRequest } from 'next/server'
import { requireMod } from '@/lib/api/requireAdmin'

// PATCH /api/admin/reports/[id] — resolve or dismiss one report.
//
// There is no DELETE, here or in RLS (0049 §7 grants no delete policy to
// anyone). A resolved or dismissed report is the record that a person looked
// at something; deleting it erases the moderation history and leaves the
// object looking as though nobody ever raised it.
//
// «resuelto» means action was taken. «descartado» means it was reviewed and
// needed none. Both are outcomes and both are worth keeping — collapsing them
// into one state would lose the distinction between "we fixed it" and "we
// disagreed", which is exactly the thing a queue exists to record.

const STATES = ['abierto', 'resuelto', 'descartado'] as const

interface Body {
  status?: string
  resolution?: string
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requireMod()
  if (!gate.ok) return gate.response

  let body: Body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.status || !(STATES as readonly string[]).includes(body.status)) {
    return NextResponse.json(
      { error: `status debe ser uno de: ${STATES.join(', ')}` },
      { status: 400 },
    )
  }

  const closing = body.status !== 'abierto'
  const resolution =
    typeof body.resolution === 'string' ? body.resolution.trim().slice(0, 1000) : ''

  // Closing a report requires saying why. The next moderator to see this
  // object needs to know what was decided, and "resuelto" alone tells them
  // nothing they can act on.
  if (closing && resolution.length < 3) {
    return NextResponse.json(
      { error: 'Escribe qué se hizo con el reporte (mínimo 3 caracteres)' },
      { status: 400 },
    )
  }

  const { error } = await gate.supabase
    .from('reports' as never)
    .update({
      status: body.status,
      resolution: closing ? resolution : null,
      // Reopening clears the resolver so the row does not claim someone
      // signed off on a state it is no longer in.
      resolved_by: closing ? gate.userId : null,
      resolved_at: closing ? new Date().toISOString() : null,
    } as never)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
