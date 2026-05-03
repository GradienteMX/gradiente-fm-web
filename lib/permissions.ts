import type {
  Comment,
  ContentItem,
  ContentType,
  ReactionKind,
  Role,
  User,
  UserRank,
} from './types'

// ── Role hierarchy & permission helpers ─────────────────────────────────────
//
// Creation-tier hierarchy with a sibling pair at tier 2:
//   user (0) < curator (1) < {guide, insider} (2) < admin (3)
//
// `guide` and `insider` are siblings at the same numeric tier — equivalent
// publishing capabilities, different byline framing. Both inherit curator.
//
// Mod is an orthogonal flag (`user.isMod`) — admins implicitly have it.
// OG is a cosmetic flag (`user.isOG`) and grants no additional capability.
//
// All helpers take `User | null` (null = logged out) and return booleans.
// Pure functions — easy to backend-translate.

const ROLE_RANK: Record<Role, number> = {
  user: 0,
  curator: 1,
  guide: 2,
  insider: 2,  // sibling tier with guide
  admin: 3,
}

// Does `user` hold at least the given role tier? Sibling check works because
// guide and insider share rank 2, so `hasRole(insider, 'guide')` returns true
// (and vice versa). For UI display you want `user.role === 'guide'` instead.
export function hasRole(user: User | null, atLeast: Role): boolean {
  if (!user) return false
  return ROLE_RANK[user.role] >= ROLE_RANK[atLeast]
}

// ── Comments ───────────────────────────────────────────────────────────────

export function canComment(user: User | null): boolean {
  return user !== null
}

export function canReact(user: User | null): boolean {
  return user !== null
}

// Authors edit only their own comments. Higher roles cannot edit other users'
// comments — even admins. Editing someone else's words is never appropriate.
export function canEditComment(user: User | null, comment: Comment): boolean {
  if (!user) return false
  if (comment.deletion) return false
  return comment.authorId === user.id
}

// Authors delete their own comments outright. Mods and admins delete via
// canModerateComment, which leaves a tombstone with a stated reason.
export function canDeleteOwnComment(user: User | null, comment: Comment): boolean {
  if (!user) return false
  if (comment.deletion) return false
  return comment.authorId === user.id
}

export function canModerateComment(user: User | null, comment: Comment): boolean {
  if (!user) return false
  if (comment.deletion) return false
  return canModerate(user)
}

export function canSaveComment(user: User | null): boolean {
  return user !== null
}

// ── Content creation (gates per content type) ──────────────────────────────
//
// Curator tier creates lists, polls, marketplace cards. Guide/insider tier
// adds opinion pieces and mixes (sibling capabilities — same gate). Admin
// inherits everything. Polls and marketplace surfaces aren't built yet but
// the gate exists so they slot in cleanly later.

export function canCreateList(user: User | null): boolean {
  return hasRole(user, 'curator')
}

export function canCreatePoll(user: User | null): boolean {
  return hasRole(user, 'curator')
}

export function canCreateMarketplaceCard(user: User | null): boolean {
  return hasRole(user, 'curator')
}

export function canCreateOpinion(user: User | null): boolean {
  // guide + insider both qualify (same rank tier); admin inherits.
  return hasRole(user, 'guide')
}

export function canCreateMix(user: User | null): boolean {
  return hasRole(user, 'guide')
}

// Single per-type gate — used by the dashboard's compose entrypoints (the
// `Nuevo` template grid + the URL guard for `?type=…`). Each editable type
// maps to a creation tier:
//   listicle               → curator+ (lists are the core curator surface)
//   mix / opinion / editorial / review / articulo / noticia / evento
//                          → guide+   (editorial voice or curated event listing)
//   partner                → admin only (rail, not in the SUPPORTED set)
//
// `polls` and `marketplace` aren't ContentTypes yet; their gates live above
// (`canCreatePoll` / `canCreateMarketplaceCard`) and slot in here when those
// types are added.
export function canCreateContent(user: User | null, type: ContentType): boolean {
  if (!user) return false
  switch (type) {
    case 'listicle':
      return hasRole(user, 'curator')
    case 'mix':
    case 'opinion':
    case 'editorial':
    case 'review':
    case 'articulo':
    case 'noticia':
    case 'evento':
      return hasRole(user, 'guide')
    case 'partner':
      return user.role === 'admin'
  }
}

// ── Content editing (per item) ─────────────────────────────────────────────
//
// Admin edits everything. Otherwise, only the content's author edits it.
// Today author is matched by username (the ContentItem.author field is a
// free-text display name); when the schema gains an authorId post-Supabase,
// switch to that.

export function canEditContent(user: User | null, item: ContentItem): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  if (!item.author) return false
  return item.author.toLowerCase() === user.username.toLowerCase()
}

export function canDeleteContent(user: User | null, item: ContentItem): boolean {
  return canEditContent(user, item)
}

// ── Marketplace / partners ─────────────────────────────────────────────────
//
// Two levels of partner authority:
//   - site admin (`role === 'admin'`) — can approve any partner for the
//     marketplace, can assign any user to any partner's team, can edit any
//     partner's marketplace card / listings.
//   - in-team partner admin (`partnerId === thisPartner && partnerAdmin`)
//     — can add/remove team members of THEIR partner only. Manages
//     listings + marketplace card for their own partner.
// Regular team members (`partnerId` set, no admin flag) edit listings +
// marketplace card, but can't add/remove other team members.

// Approve a partner for marketplace (toggles `marketplaceEnabled`).
// Admin-only — partners don't self-promote.
export function canApprovePartner(user: User | null): boolean {
  return user?.role === 'admin'
}

// Edit a specific partner's marketplace card or listings. Admins can edit
// any partner; team members (including the partner admin) can edit only
// their own partner.
export function canManagePartner(
  user: User | null,
  partnerId: string,
): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return user.partnerId === partnerId
}

// Manage team membership for a specific partner — the gate that lets
// someone add or kick team members of `partnerId`. Site admin can manage
// any partner's team; in-team admin can manage their own.
export function canManagePartnerTeam(
  user: User | null,
  partnerId: string,
): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return user.partnerId === partnerId && user.partnerAdmin === true
}

// ── Moderation, role assignment, banning ───────────────────────────────────

export function canModerate(user: User | null): boolean {
  if (!user) return false
  return user.isMod === true || user.role === 'admin'
}

// Only admins assign roles or change a user's flags.
export function canAssignRoles(user: User | null): boolean {
  return user?.role === 'admin'
}

export function canBanUser(user: User | null): boolean {
  return user?.role === 'admin'
}

// ── User rank derivation ───────────────────────────────────────────────────
//
// Rank reflects the *texture* of a user's posting — the !/? balance they
// receive — not popularity. Computed on read; never stored on the User.
//
// The threshold is intentionally low for the prototype so the rank system is
// visible during testing. A real product would tune this against real data.

export const RANK_THRESHOLD = 2

// Pure derivation from received-reaction counts. Easy to unit-test.
//
// Buckets:
//   total < THRESHOLD       → normie
//   ≥65% signal             → detonador  (! dominant)
//   ≤35% signal (i.e. ≥65% provocative) → enigma
//   in between              → espectro   (balanced + active)
export function rankFromCounts(signal: number, provocative: number): UserRank {
  const total = signal + provocative
  if (total < RANK_THRESHOLD) return 'normie'
  const signalRatio = signal / total
  if (signalRatio >= 0.65) return 'detonador'
  if (signalRatio <= 0.35) return 'enigma'
  return 'espectro'
}

// Counts the !/? reactions the user has *received* across the supplied
// comment list and returns their rank. Caller passes a merged comment list
// (mock + session) — see lib/comments.ts useUserRank for the live-data hook.
export function getUserRank(
  userId: string,
  allComments: readonly Comment[],
): UserRank {
  let signal = 0
  let provocative = 0
  for (const c of allComments) {
    if (c.authorId !== userId) continue
    for (const r of c.reactions) {
      if (r.kind === 'signal') signal++
      else if (r.kind === 'provocative') provocative++
    }
  }
  return rankFromCounts(signal, provocative)
}

// Helper used by the comments store after a reaction toggle — validates
// only one reaction kind per (user, comment) pair survives. The store is
// the enforcer; this is just a guard for tests.
export function isMutuallyExclusiveReaction(
  prev: ReactionKind | null,
  next: ReactionKind | null,
): boolean {
  if (prev === null || next === null) return true
  return prev === next
}
