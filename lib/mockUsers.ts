import type { Role, User, UserRank } from './types'

// ── Mock user roster ────────────────────────────────────────────────────────
//
// Visual-prototype identities. Real handles for the project team are mixed
// with synthetic personas across the remaining roles so any UI we build is
// exercised against realistic plurality.
//
// Role/rank/flag model (see lib/types.ts):
//   - role: hierarchical creation tier — user < curator < {guide, insider} < admin
//   - isMod: orthogonal pruning flag (admins implicit)
//   - isOG:  cosmetic first-wave-registrant badge (admin-granted)
//   - rank:  derived from received !/? reactions, not stored here
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
    role: 'guide',
    joinedAt: '2025-01-12T00:00:00',
  },
  {
    id: 'u-ikerio',
    username: 'ikerio',
    displayName: 'ikerio',
    role: 'guide',
    joinedAt: '2025-02-03T00:00:00',
  },
  {
    // Was the old `moderator` role; under the new model mods are orthogonal.
    // rumor.static is a regular reader the team trusts to prune — role: user,
    // isMod: true. Their rank still derives from received !/? reactions.
    id: 'u-mod-rumor',
    username: 'rumor.static',
    displayName: 'rumor.static',
    role: 'user',
    isMod: true,
    joinedAt: '2025-03-18T00:00:00',
  },
  {
    // OG is now a flag, not a category. loma_grave is an early-registered
    // reader with the cosmetic badge. She also runs N.A.A.F.I.'s
    // marketplace team (`partnerAdmin: true`) — which means she's the
    // person inside the team who can add/kick other team members. See
    // [[Marketplace]].
    id: 'u-og-loma',
    username: 'loma_grave',
    displayName: 'loma grave',
    role: 'user',
    isOG: true,
    partnerId: 'pa-naafi',
    partnerAdmin: true,
    joinedAt: '2024-11-04T00:00:00',
  },
  {
    // Insider was promoted from a user-category to a real publishing role —
    // sibling of `guide`. Scene voice (DJ / promoter / venue) rather than
    // staff voice.
    id: 'u-insider-tlali',
    username: 'tlali.fm',
    displayName: 'tlali.fm',
    role: 'insider',
    joinedAt: '2025-06-22T00:00:00',
  },
  {
    // Curator-tier — list/poll/marketplace builder. Synthetic persona; covers
    // the new `curator` role so the role/permission system has full seed
    // coverage. Will gain real consumers when poll + marketplace ship.
    id: 'u-curator-radiolopez',
    username: 'radiolopez',
    displayName: 'radio lopez',
    role: 'curator',
    joinedAt: '2025-09-08T00:00:00',
  },
  {
    id: 'u-normal-meri',
    username: 'merimekko',
    displayName: 'merimekko',
    role: 'user',
    joinedAt: '2026-01-09T00:00:00',
  },
  {
    // yagual is a regular team member of N.A.A.F.I. (no partnerAdmin flag).
    // She can edit listings and the marketplace card, but only loma_grave
    // (the team's partnerAdmin) or a site admin can add/remove her from
    // the team.
    id: 'u-normal-yag',
    username: 'yagual',
    displayName: 'yagual',
    role: 'user',
    partnerId: 'pa-naafi',
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
// Spanish UI copy. The primary chip rendered next to a username is the
// *role* for staff (admin / curator / guide / insider) and the *rank* for
// regular readers. Mod and OG flags render as additional sibling chips —
// see FLAG_LABEL / FLAG_COLOR.

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'ADMIN',
  insider: 'INSIDER',
  guide: 'GUÍA',
  curator: 'CURADOR',
  user: 'LECTOR',  // generic floor — only used when rank is unknown / pre-derivation
}

export const RANK_LABEL: Record<UserRank, string> = {
  normie: 'NORMIE',
  detonador: 'DETONADOR',
  enigma: 'ENIGMA',
  espectro: 'ESPECTRO',
}

// Color palette — staff roles each get a distinct hue; ranks live in a softer
// adjacent palette since they share badge real estate. Mod and OG sit on
// either side of red/amber so they stay legible together.
export const ROLE_COLOR: Record<Role, string> = {
  admin: '#F97316',     // sys-orange — primary chrome
  insider: '#22D3EE',   // cyan — scene voice
  guide: '#4ADE80',     // green — staff editorial voice
  curator: '#C084FC',   // violet — list/poll/marketplace builder
  user: '#9CA3AF',      // neutral fallback
}

export const RANK_COLOR: Record<UserRank, string> = {
  normie: '#6B7280',     // dim grey
  detonador: '#F87171',  // red-400 — heat / signal-flare
  enigma: '#A78BFA',     // soft violet — questioning
  espectro: '#F0ABFC',   // magenta-pink — full-spectrum
}

export type FlagKind = 'mod' | 'og'

export const FLAG_LABEL: Record<FlagKind, string> = {
  mod: 'MOD',
  og: 'OG',
}

export const FLAG_COLOR: Record<FlagKind, string> = {
  mod: '#E63329',  // sys-red — pruning / danger
  og: '#FBBF24',   // amber-gold — earned recognition
}

export interface BadgeSpec {
  label: string
  color: string
}

// What appears as the *primary* chip on a user. For staff roles, it's the
// role label. For regular users it's their derived rank — callers pass the
// rank in (computed via lib/permissions.ts getUserRank).
export function badgeFor(user: User, rank: UserRank = 'normie'): BadgeSpec {
  if (user.role === 'user') {
    return { label: RANK_LABEL[rank], color: RANK_COLOR[rank] }
  }
  return { label: ROLE_LABEL[user.role], color: ROLE_COLOR[user.role] }
}

// Sibling chips that render alongside the primary badge.
// Returns mod first (rendered before og when both apply).
export function flagsFor(user: User): FlagKind[] {
  const flags: FlagKind[] = []
  if (user.isMod) flags.push('mod')
  if (user.isOG) flags.push('og')
  return flags
}
