import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/auth/signup
// Body: { email, password, username, inviteCode }
//
// Flow:
//   1. Pre-validate the invite code with service-role (avoids creating an
//      orphan auth.users row if the code is bad).
//   2. Call auth.admin.createUser with email_confirm: true so the user is
//      verified immediately (we trust them — they have a valid invite code).
//      The Postgres trigger from 0009 fires on the INSERT, applies the
//      invite-code metadata to a new public.users row, and marks the code
//      as used. All atomic — if the trigger fails (username taken, etc.)
//      the auth.users insert rolls back.
//   3. Sign the new user in via the SSR client to set the session cookie.

interface SignupBody {
  email: string
  password: string
  username: string
  inviteCode: string
}

export async function POST(request: NextRequest) {
  let body: SignupBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password
  const username = body.username?.trim()
  const inviteCode = body.inviteCode?.trim()

  if (!email || !password || !username || !inviteCode) {
    return NextResponse.json(
      { error: 'email, password, username, inviteCode required' },
      { status: 400 }
    )
  }
  if (username.length < 3) {
    return NextResponse.json({ error: 'username must be at least 3 characters' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Pre-validate invite code
  const { data: codeRow, error: codeErr } = await admin
    .from('invite_codes')
    .select('code, used_at, expires_at')
    .eq('code', inviteCode)
    .maybeSingle()

  if (codeErr) return NextResponse.json({ error: codeErr.message }, { status: 500 })
  if (!codeRow) return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })
  if (codeRow.used_at) return NextResponse.json({ error: 'Invite code already used' }, { status: 400 })
  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite code expired' }, { status: 400 })
  }

  // 2. Create the user. Trigger fires inside this call.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, invite_code: inviteCode },
  })

  if (createErr) {
    // The trigger may raise, e.g. "username already taken" via the unique constraint.
    return NextResponse.json({ error: createErr.message }, { status: 400 })
  }
  if (!created?.user) {
    return NextResponse.json({ error: 'createUser returned no user' }, { status: 500 })
  }

  // 3. Sign in via the SSR client to set the session cookie.
  const ssr = createSsrClient()
  const { error: signInErr } = await ssr.auth.signInWithPassword({ email, password })
  if (signInErr) {
    return NextResponse.json({ error: signInErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId: created.user.id })
}
