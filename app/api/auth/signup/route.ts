import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteCodeCandidates, usernameProblemEs } from '@/lib/identity'

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

// GoTrue and Postgres answer in English; the whole signup surface is Spanish
// and the form prints whatever comes back verbatim. Translate the handful of
// messages an invitee can actually provoke, pass anything else through.
function signupErrorEs(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already been registered') || m.includes('already registered')) {
    return 'Ese email ya tiene una cuenta. Inicia sesión.'
  }
  if (m.includes('users_username_key') || m.includes('duplicate key')) {
    return 'Ese usuario ya está tomado. Elige otro.'
  }
  if (m.includes('invalid format') || m.includes('validate email')) {
    return 'Ese email no es válido. Revísalo.'
  }
  if (m.includes('password')) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }
  return message
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
  // Lowercase, don't reject: every phone keyboard capitalizes the first
  // letter, and bouncing "Sofia" taught invitees nothing. Characters the slug
  // can't carry still fail the gate below — the form normalizes as you type,
  // so by the time this fires the user has already seen the real username.
  const username = body.username?.trim().toLowerCase()
  const inviteCode = body.inviteCode?.trim()

  if (!email || !password || !username || !inviteCode) {
    return NextResponse.json(
      { error: 'Faltan datos: email, contraseña, usuario y código de invitación.' },
      { status: 400 }
    )
  }
  // Username is load-bearing for /u/[username], the CreatorChip, and the
  // future user-HP / trophy surfaces — treat it like a slug. Dots are in
  // (nombre.apellido, .nombre); @, whitespace and anything else outside the
  // alphabet stay out. Older accounts with email-shaped usernames exist as a
  // known-bug in [[Open Questions]] and need separate row-level cleanup; this
  // gate prevents new ones.
  const usernameProblem = usernameProblemEs(username)
  if (usernameProblem) {
    return NextResponse.json({ error: usernameProblem }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 6 caracteres.' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // 1. Pre-validate invite code. Matched exactly first, then against the
  // normalized spelling, so a code retyped on a phone (auto-capitalized) or
  // pasted with a trailing period still resolves to its row.
  const { data: codeRows, error: codeErr } = await admin
    .from('invite_codes')
    .select('code, used_at, expires_at')
    .in('code', inviteCodeCandidates(inviteCode))
    .limit(1)

  const codeRow = codeRows?.[0]
  if (codeErr) return NextResponse.json({ error: codeErr.message }, { status: 500 })
  if (!codeRow) {
    return NextResponse.json({ error: 'Código de invitación no reconocido.' }, { status: 400 })
  }
  if (codeRow.used_at) {
    return NextResponse.json({ error: 'Este código de invitación ya fue usado.' }, { status: 400 })
  }
  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Este código de invitación expiró.' }, { status: 400 })
  }

  // 2. Create the user. Trigger fires inside this call.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // The code as *stored*, not as typed — the 0001 trigger looks it up with
    // an exact match, so handing it the user's spelling would fail the signup
    // inside the transaction after we already accepted the code above.
    user_metadata: { username, invite_code: codeRow.code },
  })

  if (createErr) {
    // The trigger may raise, e.g. "username already taken" via the unique constraint.
    return NextResponse.json({ error: signupErrorEs(createErr.message) }, { status: 400 })
  }
  if (!created?.user) {
    return NextResponse.json({ error: 'createUser returned no user' }, { status: 500 })
  }

  // 3. Sign in via the SSR client to set the session cookie.
  const ssr = createSsrClient()
  const { error: signInErr } = await ssr.auth.signInWithPassword({ email, password })
  if (signInErr) {
    // The account exists and the invite code is spent by now — retrying the
    // form can only report "código ya usado". Say so plainly and point at
    // login, instead of leaving them to guess they're locked out.
    return NextResponse.json(
      {
        error:
          'Tu cuenta fue creada, pero no pudimos iniciar sesión automáticamente. Entra con tu email y contraseña desde INICIAR SESIÓN.',
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, userId: created.user.id })
}
