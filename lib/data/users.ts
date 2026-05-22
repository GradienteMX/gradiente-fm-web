// Server-side user reads. Pure server module — DO NOT import into client
// components (the supabase server client uses `next/headers` which can't be
// bundled for the browser). Browser-side user fetching lives in
// lib/hooks/useComments.ts using the browser client.

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import { rankFromCounts } from '@/lib/permissions'
import type { Database } from '@/lib/supabase/database.types'
import type { User, UserRank } from '@/lib/types'

type UserRow = Database['public']['Tables']['users']['Row']

export function rowToUser(row: UserRow): User {
  // `avatar_url` / `bio` / `firma` / `location` arrive post-0017 and aren't
  // in the generated types yet until `npx supabase gen types typescript`
  // re-runs. Read through `as any` to bypass; the migration guarantees
  // they exist or are null.
  const r = row as unknown as UserRow & {
    avatar_url: string | null
    bio: string | null
    firma: string | null
    location: string | null
  }
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isMod: row.is_mod || undefined,
    isOG: row.is_og || undefined,
    partnerId: row.partner_id ?? undefined,
    partnerAdmin: row.partner_admin || undefined,
    joinedAt: row.joined_at,
    avatarUrl: r.avatar_url ?? undefined,
    bio: r.bio ?? undefined,
    firma: r.firma ?? undefined,
    location: r.location ?? undefined,
  }
}

export async function getUserById(id: string): Promise<User | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return null
  return rowToUser(data)
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .maybeSingle()
  if (error || !data) return null
  return rowToUser(data)
}

export async function getUsersByIds(ids: readonly string[]): Promise<Map<string, User>> {
  const out = new Map<string, User>()
  if (ids.length === 0) return out
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .in('id', ids as string[])
  if (error || !data) return out
  for (const row of data) out.set(row.id, rowToUser(row))
  return out
}

// Server-side rank derivation. Mirrors the client-side cache in
// lib/userRanksCache.ts — same view, same `rankFromCounts` bucketing,
// shaped for one-shot SSR. Returns 'normie' when the user has no
// received-reaction rows in the view (which is the same default).
export async function getUserRankServer(userId: string): Promise<UserRank> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('user_rank_signals')
    .select('signal_count, prov_count')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return 'normie'
  return rankFromCounts(Number(data.signal_count ?? 0), Number(data.prov_count ?? 0))
}

export async function listUsers(): Promise<User[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('joined_at', { ascending: true })
  if (error || !data) return []
  return data.map(rowToUser)
}
