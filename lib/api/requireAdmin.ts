import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

// ── The admin/staff route gate — ONE copy ───────────────────────────────────
//
// This block was copy-pasted into all seven /api/admin routes (five inline,
// twice as a local `gateAdmin`/`requireAdmin` helper). The redesign adds
// several more routes; without extraction each one becomes an eighth, ninth,
// tenth copy of a security check, which is the shape of thing that eventually
// drifts in exactly one file.
//
// Returns a discriminated union rather than throwing, so a route reads:
//
//     const gate = await requireAdmin()
//     if (!gate.ok) return gate.response
//     const { supabase, userId } = gate
//
// The gate uses the CALLER'S session client, never createAdminClient(). RLS
// stays the enforcing layer and the route is a second lock, not the only one.
// Reach for the service-role client separately and only where RLS genuinely
// blocks a legitimate admin read (per-item save counts under
// user_saves_self_only, cross-user drafts) — never to skip this gate.

type Role = Database['public']['Enums']['user_role']

export type Gate =
  | {
      ok: true
      supabase: SupabaseClient<Database>
      userId: string
      role: Role
    }
  | { ok: false; response: NextResponse }

async function gate(allow: (role: Role) => boolean, label: string): Promise<Gate> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, is_mod')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role as Role | undefined
  // is_mod is an orthogonal flag, mirroring canModerate() in lib/permissions.ts
  // — an admin is implicitly a mod, and a mod need not be an admin.
  const isMod = Boolean(profile?.is_mod) || role === 'admin'

  if (!role || !(label === 'mod' ? isMod : allow(role))) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true, supabase, userId: user.id, role }
}

/** role = 'admin'. The gate every /api/admin route uses. */
export function requireAdmin(): Promise<Gate> {
  return gate((role) => role === 'admin', 'admin')
}

/**
 * is_mod OR role = 'admin' — the TS mirror of private.auth_is_mod_or_admin(),
 * which is what the `reports` RLS policies check (migration 0049 §7). The two
 * predicates must agree: a route that admits someone RLS will reject produces
 * an empty 200 instead of an honest 403.
 */
export function requireMod(): Promise<Gate> {
  return gate(() => true, 'mod')
}

/**
 * Maps the errcodes the SECURITY DEFINER RPCs raise onto HTTP. Same vocabulary
 * the franja team routes already use — the RPC is the authorization authority
 * and the route just translates.
 */
export const RPC_ERROR_STATUS: Record<string, number> = {
  '28000': 401, // not authenticated
  '42501': 403, // forbidden
  P0002: 404, // not found
  '22023': 400, // invalid parameter
}

export function statusForRpcError(code: string | undefined): number {
  return (code && RPC_ERROR_STATUS[code]) || 500
}
