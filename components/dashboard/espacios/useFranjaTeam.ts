'use client'

// ── useFranjaTeam — the first consumer of /api/franjas/[id]/team ────────────
//
// That route has shipped FOUR live methods since migration 0033 and, until
// this file, ZERO callers. This hook is the entire client half of it: one GET
// per franja, three writes, and the project's post-mutation recipe on every
// single one of them.
//
// The two gates are NOT the same gate, and the hook keeps them apart:
//   READ   site admin OR any team member  → a plain member sees the roster.
//   WRITE  site admin OR `franja_admin` of THIS franja, re-authorized inside
//          the SECURITY DEFINER RPCs (franja_team_add / _set_admin /
//          _remove) so the server never trusts the client's word for it.
// FranjaSpace mirrors the write gate with `canManageFranjaTeam` and HIDES what
// it cannot call. A disabled button the server would 403 is exactly the dead
// affordance the house bans.
//
// ── The username→id problem, and why this solution is honest ───────────────
// `POST { user_id }` needs a uuid, and no username→id endpoint exists that a
// franja-admin may call — /api/admin/users/search is site-admin-gated, so a
// franja-admin gets a 403 from it. We resolve the handle against the `users`
// table with the browser client instead. That is a sanctioned read, not a
// hole: `users_public_read` is `FOR SELECT USING (true)` for PUBLIC
// (migration 0002 — verified against production), the same policy
// /u/[username], the comment author lookups and lib/dashboard/activity.ts
// already ride. Signup lowercases every username (app/api/auth/signup), so an
// exact `.eq()` IS the correct match — `ilike` is wrong here, its `_`
// wildcard would silently let `ikerXio` answer for `iker_io`.
//
// `resolveHandle` deliberately returns the candidate's CURRENT franja instead
// of adding straight away: `franja_team_add` sets `franja_id` unconditionally,
// so adding someone who already belongs elsewhere MOVES them. The space asks
// before it poaches.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import { createClient } from '@/lib/supabase/client'
import type { Role } from '@/lib/types'

// ── Shapes ──────────────────────────────────────────────────────────────────

/** One roster row, camelCased from the route's TEAM_FIELDS projection. */
export interface FranjaTeamMember {
  id: string
  username: string
  displayName: string | null
  role: Role
  isMod: boolean
  isOg: boolean
  franjaAdmin: boolean
  joinedAt: string | null
  /**
   * NOT part of the team route's projection — enriched separately under the
   * same public-read policy. Null when unknown or when the enrichment query
   * failed; the roster then prints a monogram plate, never a placeholder face.
   */
  avatarUrl: string | null
}

export type TeamStatus = 'idle' | 'loading' | 'ready' | 'error'

export type TeamWriteResult = { ok: true } | { ok: false; error: string }

export type ResolvedHandle =
  | {
      ok: true
      id: string
      username: string
      /** The franja this account belongs to TODAY — null when unaffiliated. */
      currentFranjaId: string | null
    }
  | { ok: false; error: string }

export interface FranjaTeamState {
  team: FranjaTeamMember[]
  status: TeamStatus
  /** Read failure — the roster could not be listed at all. */
  error: string | null
  /** Last write failure, cleared on the next attempt. */
  writeError: string | null
  /** Id of the member a write is in flight for (or ADD_BUSY_KEY for an add). */
  busyId: string | null
  reload: () => Promise<void>
  clearWriteError: () => void
  resolveHandle: (raw: string) => Promise<ResolvedHandle>
  addMember: (userId: string) => Promise<TeamWriteResult>
  setAdmin: (userId: string, admin: boolean) => Promise<TeamWriteResult>
  removeMember: (userId: string) => Promise<TeamWriteResult>
}

/** `busyId` sentinel for the add-member form, which has no member id yet. */
export const ADD_BUSY_KEY = '__add__'

// ── Wire rows ───────────────────────────────────────────────────────────────

interface TeamRow {
  id: string
  username: string | null
  display_name: string | null
  role: Role | null
  is_mod: boolean | null
  is_og: boolean | null
  franja_admin: boolean | null
  joined_at: string | null
}

function mapRow(row: TeamRow): FranjaTeamMember {
  return {
    id: row.id,
    username: row.username ?? '',
    displayName: row.display_name,
    role: row.role ?? 'user',
    isMod: row.is_mod === true,
    isOg: row.is_og === true,
    franjaAdmin: row.franja_admin === true,
    joinedAt: row.joined_at,
    avatarUrl: null,
  }
}

// ── Honest error copy ───────────────────────────────────────────────────────
//
// The route answers in English ('Forbidden', 'user not found'). Uppercasing
// that would print English chrome on a Spanish sheet, so statuses map to
// house copy and only genuinely unknown failures fall through.

async function httpMessage(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return 'SESIÓN EXPIRADA — VUELVE A ENTRAR.'
  if (res.status === 403) return 'SIN PERMISO PARA ESTA ACCIÓN.'
  if (res.status === 404) return 'ESA CUENTA YA NO ESTÁ EN ESTE EQUIPO.'
  try {
    const json = (await res.json()) as { error?: string }
    if (json?.error) return `${fallback} (${json.error.toUpperCase()})`
  } catch {
    // Non-JSON body (a proxy error page, say) — the fallback is the truth.
  }
  return fallback
}

// ── Avatar enrichment ───────────────────────────────────────────────────────
//
// One batched `.in()` read under users_public_read. It NEVER fails the roster:
// a rejected or empty result simply leaves every avatarUrl null and the
// monogram plates stand.

async function attachAvatars(members: FranjaTeamMember[]): Promise<FranjaTeamMember[]> {
  if (members.length === 0) return members
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('users')
      .select('id, avatar_url')
      .in('id', members.map((m) => m.id))
    if (error || !data) return members
    const rows = data as unknown as { id: string; avatar_url: string | null }[]
    const byId = new Map(rows.map((r) => [r.id, r.avatar_url]))
    return members.map((m) => ({ ...m, avatarUrl: byId.get(m.id) ?? null }))
  } catch {
    return members
  }
}

// ── The hook ────────────────────────────────────────────────────────────────

export function useFranjaTeam(franjaId: string | null): FranjaTeamState {
  // Pulled from the provider rather than passed in, so the post-mutation
  // recipe cannot be forgotten at a call site: EVERY write below ends in
  // `afterMutation('franja')`.
  const { afterMutation } = useDashboardData()

  const [team, setTeam] = useState<FranjaTeamMember[]>([])
  const [status, setStatus] = useState<TeamStatus>(franjaId ? 'loading' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Monotonic request token — a stale GET (franja switch, fast re-add) never
  // overwrites a fresher roster.
  const seqRef = useRef(0)
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    if (!franjaId) {
      setTeam([])
      setError(null)
      setStatus('idle')
      return
    }
    const seq = ++seqRef.current
    setStatus('loading')
    try {
      const res = await fetch(`/api/franjas/${encodeURIComponent(franjaId)}/team`)
      if (!res.ok) {
        const msg = await httpMessage(res, 'NO SE PUDO LEER EL EQUIPO.')
        if (!aliveRef.current || seq !== seqRef.current) return
        setTeam([])
        setError(msg)
        setStatus('error')
        return
      }
      const json = (await res.json()) as { team?: TeamRow[] }
      const members = await attachAvatars((json.team ?? []).map(mapRow))
      if (!aliveRef.current || seq !== seqRef.current) return
      setTeam(members)
      setError(null)
      setStatus('ready')
    } catch {
      if (!aliveRef.current || seq !== seqRef.current) return
      setTeam([])
      setError('NO SE PUDO LEER EL EQUIPO — SIN CONEXIÓN.')
      setStatus('error')
    }
  }, [franjaId])

  useEffect(() => {
    void reload()
  }, [reload])

  const clearWriteError = useCallback(() => setWriteError(null), [])

  const write = useCallback(
    async (
      method: 'POST' | 'PATCH' | 'DELETE',
      body: Record<string, unknown>,
      busyKey: string,
      fallback: string,
    ): Promise<TeamWriteResult> => {
      if (!franjaId) return { ok: false, error: 'SIN FRANJA ASIGNADA.' }
      setBusyId(busyKey)
      setWriteError(null)
      try {
        const res = await fetch(`/api/franjas/${encodeURIComponent(franjaId)}/team`, {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const msg = await httpMessage(res, fallback)
          if (aliveRef.current) setWriteError(msg)
          return { ok: false, error: msg }
        }
        await reload()
        // The one post-mutation recipe (§3.10): revalidate the franja slice,
        // then router.refresh(). Never a hand-rolled cache poke.
        await afterMutation('franja')
        return { ok: true }
      } catch {
        if (aliveRef.current) setWriteError(fallback)
        return { ok: false, error: fallback }
      } finally {
        if (aliveRef.current) setBusyId(null)
      }
    },
    [franjaId, reload, afterMutation],
  )

  const resolveHandle = useCallback(async (raw: string): Promise<ResolvedHandle> => {
    const handle = raw.trim().replace(/^@+/, '').toLowerCase()
    if (!handle) return { ok: false, error: 'ESCRIBE UN @USUARIO.' }
    try {
      const supabase = createClient()
      const { data, error: qErr } = await supabase
        .from('users')
        .select('id, username, franja_id')
        .eq('username', handle)
        .maybeSingle()
      if (qErr) return { ok: false, error: 'NO SE PUDO BUSCAR ESA CUENTA.' }
      if (!data) return { ok: false, error: `@${handle.toUpperCase()} NO EXISTE.` }
      const row = data as unknown as {
        id: string
        username: string | null
        franja_id: string | null
      }
      return {
        ok: true,
        id: row.id,
        username: row.username ?? handle,
        currentFranjaId: row.franja_id,
      }
    } catch {
      return { ok: false, error: 'NO SE PUDO BUSCAR ESA CUENTA — SIN CONEXIÓN.' }
    }
  }, [])

  const addMember = useCallback(
    (userId: string) =>
      write('POST', { user_id: userId }, ADD_BUSY_KEY, 'NO SE PUDO AÑADIR A ESA CUENTA.'),
    [write],
  )

  const setAdmin = useCallback(
    (userId: string, admin: boolean) =>
      write(
        'PATCH',
        { user_id: userId, franja_admin: admin },
        userId,
        'NO SE PUDO CAMBIAR EL PERMISO.',
      ),
    [write],
  )

  const removeMember = useCallback(
    (userId: string) =>
      write('DELETE', { user_id: userId }, userId, 'NO SE PUDO RETIRAR A ESA CUENTA.'),
    [write],
  )

  return {
    team,
    status,
    error,
    writeError,
    busyId,
    reload,
    clearWriteError,
    resolveHandle,
    addMember,
    setAdmin,
    removeMember,
  }
}
