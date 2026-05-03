import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// /api/admin/users/search?q=...
// GET → up to 25 users matching `q` on username or display_name (ilike).
// Admin only — RLS gates via users_admin_all.
//
// Trigger this only on user-typed search input (not on every keystroke);
// the AdminUsersEditor debounces in the client. Pre-beta this runs as a
// sequential scan — fine at <100 users. Add a gin_trgm_ops index in
// chunk 4 if scale demands it.

export async function GET(request: NextRequest) {
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

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length === 0) return NextResponse.json({ users: [] })
  if (q.length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 chars' }, { status: 400 })
  }

  // Escape % and _ so user-typed wildcards don't widen the match unexpectedly.
  const safe = q.replace(/[\\%_]/g, (c) => '\\' + c)

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
    .order('username', { ascending: true })
    .limit(25)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data ?? [] })
}
