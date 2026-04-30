'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type { User } from '@/lib/types'
import { getUserById, getUserByUsername } from '@/lib/mockUsers'
import { useResolvedUser } from '@/lib/userOverrides'

// Visual-prototype auth. Stores only the user id in sessionStorage; the
// exposed `currentUser` is resolved live through [[userOverrides]] so admin
// self-edits in [[PermisosSection]] (role / isMod / isOG) propagate to every
// surface that reads `currentUser` — sidebar gating, AuthBadge breadcrumb,
// canModerate checks — without requiring a page reload.
//
// The `password` field is theater: any user can log in with password ===
// their username, OR with the legacy `admin / admin` shortcut (resolves to
// the canonical admin user).
//
// When real auth lands (Supabase), swap login() / loginAs() / the storage
// helpers below for real calls — every consumer reads `currentUser` /
// `isAuthed` / `username` and won't change.

const ADMIN_SHORTCUT_USERNAME = 'admin'
const ADMIN_SHORTCUT_PASSWORD = 'admin'

const STORAGE_KEY = 'gradiente:auth'

interface AuthContextValue {
  currentUser: User | null
  // Back-compat conveniences derived from currentUser. Existing consumers
  // (AuthBadge, dashboard page) use these.
  username: string | null
  isAuthed: boolean
  login: (username: string, password: string) => boolean
  loginAs: (userId: string) => boolean
  logout: () => void
  loginOpen: boolean
  openLogin: () => void
  closeLogin: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUserId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed?.userId === 'string' ? parsed.userId : null
  } catch {
    return null
  }
}

function persistUserId(id: string | null) {
  try {
    if (id) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ userId: id }))
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {}
}

// Resolve a (username, password) pair to a User if the credentials are valid.
// Reads from MOCK_USERS (the seed) — credential check is independent of any
// session-only override; you can't unlock a different account by editing
// someone's role.
function resolveCredentials(username: string, password: string): User | null {
  const u = username.trim()
  // Back-compat shortcut: admin / admin → first admin user.
  if (
    u.toLowerCase() === ADMIN_SHORTCUT_USERNAME &&
    password === ADMIN_SHORTCUT_PASSWORD
  ) {
    const adminUser = getUserByUsername('datavismo-cmyk')
    return adminUser ?? null
  }
  const user = getUserByUsername(u)
  if (!user) return null
  // Prototype rule: password must match the username (case-insensitive).
  if (password.toLowerCase() !== user.username.toLowerCase()) return null
  return user
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Source of truth is just the user id; the resolved User comes from
  // useResolvedUser, which subscribes to override changes and re-renders.
  // Start null on both server and client to avoid hydration drift; read
  // storage after mount.
  const [userId, setUserId] = useState<string | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setUserId(readStoredUserId())
    setHydrated(true)
  }, [])

  const resolved = useResolvedUser(userId)

  const login = useCallback((username: string, password: string): boolean => {
    const user = resolveCredentials(username, password)
    if (!user) return false
    setUserId(user.id)
    persistUserId(user.id)
    return true
  }, [])

  const loginAs = useCallback((userId: string): boolean => {
    const user = getUserById(userId)
    if (!user) return false
    setUserId(user.id)
    persistUserId(user.id)
    return true
  }, [])

  const logout = useCallback(() => {
    setUserId(null)
    persistUserId(null)
  }, [])

  const openLogin = useCallback(() => setLoginOpen(true), [])
  const closeLogin = useCallback(() => setLoginOpen(false), [])

  const exposed = hydrated ? resolved ?? null : null
  const value: AuthContextValue = {
    currentUser: exposed,
    username: exposed?.username ?? null,
    isAuthed: exposed !== null,
    login,
    loginAs,
    logout,
    loginOpen,
    openLogin,
    closeLogin,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
