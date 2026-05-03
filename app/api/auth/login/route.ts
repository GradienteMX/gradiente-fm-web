import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/auth/login
// Body: { identifier, password }
//
// `identifier` may be either an email (contains "@") or a username. For
// usernames we look up the email via the admin API (auth.users isn't
// publicly readable). The username column on public.users is unique, and
// the admin client bypasses RLS so the lookup is straightforward.

interface LoginBody {
  identifier: string
  password: string
}

export async function POST(request: NextRequest) {
  let body: LoginBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const identifier = body.identifier?.trim()
  const password = body.password
  if (!identifier || !password) {
    return NextResponse.json({ error: 'identifier + password required' }, { status: 400 })
  }

  let email: string

  if (identifier.includes('@')) {
    email = identifier.toLowerCase()
  } else {
    // Username path: find the public.users row by username, then fetch the
    // email via auth.admin.getUserById.
    const admin = createAdminClient()
    const { data: profile, error: profileErr } = await admin
      .from('users')
      .select('id')
      .eq('username', identifier)
      .maybeSingle()

    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })
    if (!profile) {
      // Generic message to avoid username enumeration.
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(profile.id)
    if (authErr || !authUser?.user?.email) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    email = authUser.user.email
  }

  // Sign in via the SSR client to set the session cookie.
  const ssr = createSsrClient()
  const { error } = await ssr.auth.signInWithPassword({ email, password })
  if (error) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
