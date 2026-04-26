import type { Role, User, UserCategory } from './types'

// ── Mock user roster ────────────────────────────────────────────────────────
//
// Visual-prototype identities. Real handles for the project team
// (admin / collaborator) are mixed with synthetic personas across the
// remaining roles so any UI we build is exercised against realistic plurality.
//
// When the real backend (see [[Supabase Migration]]) lands, swap this file
// for a Supabase `users` query — the rest of the app consumes `getUserById`
// / `listUsers` and won't change.

export const MOCK_USERS: User[] = [
  {
    id: 'u-datavismo',
    username: 'datavismo-cmyk',
    displayName: 'datavismo',
    role: 'admin',
    joinedAt: '2024-09-01T00:00:00',
  },
  {
    id: 'u-hzamorate',
    username: 'hzamorate',
    displayName: 'hzamorate',
    role: 'collaborator',
    joinedAt: '2025-01-12T00:00:00',
  },
  {
    id: 'u-ikerio',
    username: 'ikerio',
    displayName: 'ikerio',
    role: 'collaborator',
    joinedAt: '2025-02-03T00:00:00',
  },
  {
    id: 'u-mod-rumor',
    username: 'rumor.static',
    displayName: 'rumor.static',
    role: 'moderator',
    joinedAt: '2025-03-18T00:00:00',
  },
  {
    id: 'u-og-loma',
    username: 'loma_grave',
    displayName: 'loma grave',
    role: 'user',
    userCategory: 'og',
    joinedAt: '2024-11-04T00:00:00',
  },
  {
    id: 'u-insider-tlali',
    username: 'tlali.fm',
    displayName: 'tlali.fm',
    role: 'user',
    userCategory: 'insider',
    joinedAt: '2025-06-22T00:00:00',
  },
  {
    id: 'u-normal-meri',
    username: 'merimekko',
    displayName: 'merimekko',
    role: 'user',
    userCategory: 'normal',
    joinedAt: '2026-01-09T00:00:00',
  },
  {
    id: 'u-normal-yag',
    username: 'yagual',
    displayName: 'yagual',
    role: 'user',
    userCategory: 'normal',
    joinedAt: '2026-03-14T00:00:00',
  },
]

// ── Lookups ─────────────────────────────────────────────────────────────────

const USERS_BY_ID = new Map(MOCK_USERS.map((u) => [u.id, u]))
const USERS_BY_USERNAME = new Map(MOCK_USERS.map((u) => [u.username.toLowerCase(), u]))

export function getUserById(id: string): User | undefined {
  return USERS_BY_ID.get(id)
}

export function getUserByUsername(username: string): User | undefined {
  return USERS_BY_USERNAME.get(username.toLowerCase())
}

export function listUsers(): User[] {
  return MOCK_USERS
}

export function listUsersByRole(role: Role): User[] {
  return MOCK_USERS.filter((u) => u.role === role)
}

// ── Display helpers ─────────────────────────────────────────────────────────
//
// These render in role badges and comment author chips. Spanish UI copy.

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'ADMIN',
  moderator: 'MOD',
  collaborator: 'REDACCIÓN',
  user: 'LECTOR',
}

export const USER_CATEGORY_LABEL: Record<UserCategory, string> = {
  og: 'OG',
  insider: 'INSIDER',
  normal: 'LECTOR',
}

// What appears on a user's badge — role label, except for the user role,
// where the userCategory is more informative than the bare "LECTOR".
export function badgeFor(user: User): string {
  if (user.role === 'user' && user.userCategory) {
    return USER_CATEGORY_LABEL[user.userCategory]
  }
  return ROLE_LABEL[user.role]
}
