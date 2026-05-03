// Server-side user reads. Pure server module — DO NOT import into client
// components (the supabase server client uses `next/headers` which can't be
// bundled for the browser). Browser-side user fetching lives in
// lib/hooks/useComments.ts using the browser client.

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import type { User } from '@/lib/types'

type UserRow = Database['public']['Tables']['users']['Row']

export function rowToUser(row: UserRow): User {
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

export async function listUsers(): Promise<User[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('joined_at', { ascending: true })
  if (error || !data) return []
  return data.map(rowToUser)
}
