'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'
import { setCurrentAuthUidForComments } from '@/lib/comments'
import {
  setSavedCommentIds,
  clearSavedCommentIds,
} from '@/lib/savedCommentsCache'
import {
  setSavedItemIds,
  clearSavedItemIds,
} from '@/lib/itemSavesCache'
import {
  setAllDrafts,
  clearDraftsCache,
} from '@/lib/draftsCache'
import { clearPublishedItemsCache } from '@/lib/publishedItemsCache'
import { clearUserRanksCache } from '@/lib/userRanksCache'
import type { DraftItem } from '@/lib/drafts'
import type { Database } from '@/lib/supabase/database.types'
import type { User } from '@/lib/types'

// Real Supabase-backed auth, replacing the prototype sessionStorage hack.
// Login + signup go through Next.js Route Handlers (`/api/auth/{login,signup,logout}`)
// so the username→email lookup + invite-code validation happen with the
// service-role key on the server. The browser client subscribes to auth
// state changes for live session refresh.
//
// The exposed shape is back-compatible with the previous prototype API so
// existing consumers (AuthBadge, dashboard chrome, canModerate checks)
// don't need to change. `loginAs` is now a no-op — quick-switching to
// arbitrary users requires their password, which we don't have client-side.

type UserRow = Database['public']['Tables']['users']['Row']

function rowToUser(row: UserRow): User {
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

interface AuthContextValue {
  currentUser: User | null
  username: string | null
  isAuthed: boolean
  login: (identifier: string, password: string) => Promise<boolean>
  signup: (args: {
    email: string
    password: string
    username: string
    inviteCode: string
  }) => Promise<{ ok: true } | { ok: false; error: string }>
  loginAs: (userId: string) => Promise<boolean>   // deprecated; kept for back-compat, returns false
  logout: () => Promise<void>
  loginOpen: boolean
  openLogin: () => void
  closeLogin: () => void
  // Loading until the first auth-state-change settles. Avoids hydration
  // flicker between "logged out" and the resolved user.
  ready: boolean
  // True once we know the user is either definitively logged out OR has
  // a fully-loaded profile. `ready` only signals the first session-event
  // has fired; the profile fetch is async after that. Auth-gated routes
  // should wait on `authResolved` before deciding to open the login flow,
  // otherwise they race the profile fetch and pop the overlay over a
  // user who's already authed.
  authResolved: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)
const supabase = createClient()

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [ready, setReady] = useState(false)
  // Auth id (or null = logged out) that the profile fetch has finished for.
  // Compared to the live session id in `authResolved`; only matches when the
  // fetch result corresponds to the current session, so a fresh login
  // between renders correctly bumps us back to "not resolved" until its
  // own profile fetch lands. `undefined` = no fetch attempted yet (distinct
  // from the legitimate null = logged-out resolved state).
  const [fetchedAuthId, setFetchedAuthId] = useState<string | null | undefined>(undefined)

  // Subscribe to Supabase auth state. The first INITIAL_SESSION event
  // arrives synchronously after subscription, so we don't need a separate
  // getSession() call.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Safety net: if the login overlay was opened during a race (e.g. a
  // gated route mounted while the profile fetch was still in flight) and
  // the user has since resolved as authed, close the overlay automatically.
  // No legitimate flow keeps it open while authed today; if account-switch
  // ever lands, gate this on a separate "intentional re-open" flag.
  useEffect(() => {
    if (loginOpen && profile !== null) setLoginOpen(false)
  }, [loginOpen, profile])

  // Fetch the public.users profile whenever the auth user id changes.
  // RLS lets any auth'd user read users (users_public_read), so this
  // works without elevated privileges. Also push the auth uid into the
  // comments module (so toggleReaction knows the calling user) and load
  // the user's saved-comment IDs into the cache (so useIsCommentSaved
  // resolves without an extra fetch in every consumer).
  useEffect(() => {
    const authId = session?.user?.id
    setCurrentAuthUidForComments(authId ?? null)
    if (!authId) {
      setProfile(null)
      clearSavedCommentIds()
      clearSavedItemIds()
      clearDraftsCache()
      clearPublishedItemsCache()
      clearUserRanksCache()
      setFetchedAuthId(null)  // logged-out resolved state
      return
    }
    let cancelled = false
    supabase
      .from('users')
      .select('*')
      .eq('id', authId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setProfile(data ? rowToUser(data) : null)
        setFetchedAuthId(authId)  // mark resolved for THIS authId, regardless of result
      })
    supabase
      .from('saved_comments')
      .select('comment_id')
      .eq('user_id', authId)
      .then(({ data }) => {
        if (cancelled) return
        setSavedCommentIds((data ?? []).map((r) => r.comment_id))
      })
    supabase
      .from('user_saves')
      .select('item_id')
      .eq('user_id', authId)
      .then(({ data }) => {
        if (cancelled) return
        setSavedItemIds((data ?? []).map((r) => r.item_id))
      })
    // Drafts: load all of the user's drafts and prime the module cache so
    // sync `getItemById` / `useDraftItems` reads work from the dashboard
    // composer, drafts list, and overlay-router lookups without per-call
    // round-trips. RLS (drafts_self_only) limits to author_id = auth.uid().
    supabase
      .from('drafts')
      .select('id, item_payload, created_at, updated_at')
      .eq('author_id', authId)
      .then(({ data }) => {
        if (cancelled) return
        const drafts: DraftItem[] = (data ?? []).map((r) => ({
          ...(r.item_payload as object),
          _draftState: 'draft' as const,
          _createdAt: r.created_at,
          _updatedAt: r.updated_at,
        })) as DraftItem[]
        setAllDrafts(drafts)
      })
    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const login = useCallback(
    async (identifier: string, password: string): Promise<boolean> => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      })
      if (!res.ok) return false
      // Cookie was set by the route handler; pull the new session into the
      // browser client so onAuthStateChange fires, then nudge Next.js to
      // re-fetch server components so RLS-gated data lands without a hard reload.
      await supabase.auth.refreshSession()
      router.refresh()
      return true
    },
    [router]
  )

  const signup = useCallback(
    async (args: { email: string; password: string; username: string; inviteCode: string }) => {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(args),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Signup failed' }))
        return { ok: false as const, error: body.error ?? 'Signup failed' }
      }
      await supabase.auth.refreshSession()
      router.refresh()
      return { ok: true as const }
    },
    [router]
  )

  const loginAs = useCallback(async (_userId: string): Promise<boolean> => {
    // Prototype-only feature (sessionStorage quick-switch). With real auth
    // you can't impersonate without a password — left as a no-op so older
    // imports don't crash.
    return false
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    await supabase.auth.signOut()
    router.refresh()
  }, [router])

  const openLogin = useCallback(() => setLoginOpen(true), [])
  const closeLogin = useCallback(() => setLoginOpen(false), [])

  const value: AuthContextValue = {
    currentUser: profile,
    username: profile?.username ?? null,
    isAuthed: profile !== null,
    login,
    signup,
    loginAs,
    logout,
    loginOpen,
    openLogin,
    closeLogin,
    ready,
    // Resolved when the profile fetch matches the current session id (or
    // both are null = logged out). Bumped back to false in the brief render
    // after a session change before the new profile fetch lands.
    authResolved: ready && fetchedAuthId === (session?.user?.id ?? null),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
