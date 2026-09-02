import { NextResponse, type NextRequest } from 'next/server'
import { requireMod } from '@/lib/api/requireAdmin'

// GET /api/admin/reports?estado=abierto — the moderation queue.
//
// Gated with requireMod(), not requireAdmin(): the reports_read_staff policy
// admits private.auth_is_mod_or_admin(), and a route stricter than its RLS
// would hand mods a 403 on rows the database would happily have shown them.
// The two predicates are mirrors and must move together — requireMod() in
// lib/api/requireAdmin.ts is the TS side of that pair.
//
// Reads through the CALLER'S session on purpose. RLS is doing the real work;
// if the policy is ever wrong, this returns nothing rather than leaking, which
// is the failure direction to prefer.

const STATES = ['abierto', 'resuelto', 'descartado'] as const

export async function GET(request: NextRequest) {
  const gate = await requireMod()
  if (!gate.ok) return gate.response

  const estado = request.nextUrl.searchParams.get('estado') ?? 'abierto'
  const filter = (STATES as readonly string[]).includes(estado) ? estado : 'abierto'

  const { data, error } = await gate.supabase
    .from('reports' as never)
    .select(
      'id, target_type, target_id, reason, note, status, created_at, resolved_at, resolution, reporter:users!reports_reporter_id_fkey ( username ), resolver:users!reports_resolved_by_fkey ( username )',
    )
    .eq('status', filter)
    // Oldest first: a queue is worked from the front. Newest-first would let
    // the oldest complaint sink forever, which is how a queue rots.
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) {
    if ((error as { code?: string }).code === '42P01') {
      // Migration 0049 not applied yet. An empty queue with a stated reason,
      // never a crash and never a silent zero.
      return NextResponse.json({ rows: [], unavailable: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rows: data ?? [] })
}
