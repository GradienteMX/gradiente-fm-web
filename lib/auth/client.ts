'use client'

/**
 * Signing in, up and out — production's routes, production's contracts
 * (app/api/auth/*). The routes set or clear the Supabase session cookie; the
 * page then has to be read again for the server to hand over the viewer's
 * world: `router.refresh()` where the page stays, a full navigation where it
 * changes (La Puerta into the field, out to La Puerta).
 *
 * Failures are values, never throws: a rejected fetch escaping a submit
 * handler leaves a form disabled for good (production learned that one).
 */

import { createClient } from '@/lib/supabase/client'

export type AuthResult = { ok: true } | { ok: false; error: string }

const NETWORK = 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.'

let browserClient: ReturnType<typeof createClient> | null = null
function supabase() {
  browserClient ??= createClient()
  return browserClient
}

/** The cookie is set by the route; let the browser client pick the new session up too. */
async function syncBrowserSession() {
  try {
    await supabase().auth.refreshSession()
  } catch {
    // The cookie is already set; the server reads it on the next request.
  }
}

/**
 * POST /api/auth/login { identifier, password }. `identifier` is an email or
 * a username (the route resolves usernames with the service role). 401 is the
 * same answer for an unknown user and a wrong password, on purpose.
 */
export async function signIn(identifier: string, password: string): Promise<AuthResult> {
  let res: Response
  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: identifier.trim(), password }),
    })
  } catch {
    return { ok: false, error: NETWORK }
  }
  if (res.status === 401) return { ok: false, error: 'Usuario o contraseña incorrectos.' }
  if (res.status === 400) return { ok: false, error: 'Escribe tu usuario (o correo) y tu contraseña.' }
  if (!res.ok) return { ok: false, error: 'No pudimos abrir tu sesión. Intenta de nuevo en un momento.' }
  await syncBrowserSession()
  return { ok: true }
}

export interface SignUpArgs {
  email: string
  password: string
  /** Already normalized (lib/identity normalizeUsername). */
  username: string
  /** The code as the invitation lookup matched it (its stored spelling). */
  inviteCode: string
}

/**
 * POST /api/auth/signup { email, password, username, inviteCode }. The route
 * validates the code, creates the account (the database trigger applies the
 * invitation: role, team, folio) and signs the new person in. Its errors are
 * already in Spanish and meant to be shown as they come.
 */
export async function signUp(args: SignUpArgs): Promise<AuthResult> {
  let res: Response
  try {
    res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args),
    })
  } catch {
    return { ok: false, error: NETWORK }
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null
    return { ok: false, error: typeof body?.error === 'string' && body.error ? body.error : NETWORK }
  }
  await syncBrowserSession()
  return { ok: true }
}

/** POST /api/auth/logout, then the browser client's own copy of the session. */
export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // Fall through: the local sign-out below still clears this browser.
  }
  try {
    await supabase().auth.signOut()
  } catch {
    // Nothing left to clear.
  }
}
