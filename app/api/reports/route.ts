import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/reports — file a report. The one place an ordinary reader writes a
// row a moderator reads.
//
// Nothing in the product could be reported before this: there was no table, no
// gesture, no queue. Prod's entire moderation history is ONE action across four
// months, so this is not a scaling response — it is the missing primitive that
// makes the MODERACIÓN tab something other than a decorative counter.
//
// Authorization is RLS, not this route: reports_insert_self (0049 §7) enforces
// reporter_id = auth.uid(), so a forged reporter_id is rejected by the database
// even if this handler were bypassed. The route validates shape and gives the
// user a real error message instead of a policy violation.
//
// Deliberately NOT here: any notification, any auto-hide, any strike counter.
// A report is a signal that a person should look. Acting on it is a person's
// job, and inventing an automatic consequence at 61 users would be building
// the enforcement half of a system whose reporting half has never been used.

const TARGET_TYPES = ['item', 'comment', 'foro_thread', 'foro_reply', 'listing'] as const
const REASONS = [
  'spam',
  'acoso',
  'odio',
  'sexual',
  'violencia',
  'enganoso',
  'copyright',
  'otro',
] as const

interface Body {
  target_type?: string
  target_id?: string
  reason?: string
  note?: string
}

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.target_type || !(TARGET_TYPES as readonly string[]).includes(body.target_type)) {
    return NextResponse.json(
      { error: `target_type debe ser uno de: ${TARGET_TYPES.join(', ')}` },
      { status: 400 },
    )
  }
  if (!body.target_id || typeof body.target_id !== 'string') {
    return NextResponse.json({ error: 'target_id requerido' }, { status: 400 })
  }
  if (!body.reason || !(REASONS as readonly string[]).includes(body.reason)) {
    return NextResponse.json(
      { error: `reason debe ser uno de: ${REASONS.join(', ')}` },
      { status: 400 },
    )
  }

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : null

  const { error } = await supabase.from('reports' as never).insert({
    reporter_id: user.id,
    target_type: body.target_type,
    target_id: body.target_id,
    reason: body.reason,
    note: note || null,
  } as never)

  if (error) {
    // 23505 = the unique (reporter_id, target_type, target_id) index. One
    // report per person per object is the design — a second is not an error
    // the user should see as a failure, it just means "already told us".
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true })
    }
    // 42P01 = the table does not exist yet (migration 0049 not applied). Fail
    // honestly rather than pretending the report landed.
    if ((error as { code?: string }).code === '42P01') {
      return NextResponse.json(
        { error: 'El sistema de reportes aún no está disponible' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
