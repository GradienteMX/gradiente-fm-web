import type { Comment, ContentItem, Role, User } from './types'

// ── Role hierarchy & permission helpers ─────────────────────────────────────
//
// Strict hierarchy: admin ⊃ moderator ⊃ collaborator ⊃ user.
// Higher roles inherit every capability of lower roles. Helpers below take a
// `User | null` (null = logged out) and return booleans.
//
// Pure functions, no React, no I/O — easy to backend-translate later.

const ROLE_RANK: Record<Role, number> = {
  user: 0,
  collaborator: 1,
  moderator: 2,
  admin: 3,
}

// Does `user` hold at least the given role tier?
export function hasRole(user: User | null, atLeast: Role): boolean {
  if (!user) return false
  return ROLE_RANK[user.role] >= ROLE_RANK[atLeast]
}

// ── Comments ───────────────────────────────────────────────────────────────

// Anyone logged in can post a top-level comment or reply.
export function canComment(user: User | null): boolean {
  return user !== null
}

// Anyone logged in can react. Anonymous viewers see counts but can't react.
export function canReact(user: User | null): boolean {
  return user !== null
}

// Authors can edit their own comments. Higher roles cannot edit other users'
// comments — even admins. Editing someone else's words is never appropriate.
export function canEditComment(user: User | null, comment: Comment): boolean {
  if (!user) return false
  if (comment.deletion) return false
  return comment.authorId === user.id
}

// Authors can delete their own comments outright.
// Moderators (and above) can delete any comment, but the deletion is
// recorded with a reason and shown as a tombstone — never hard-removed.
export function canDeleteOwnComment(user: User | null, comment: Comment): boolean {
  if (!user) return false
  if (comment.deletion) return false
  return comment.authorId === user.id
}

export function canModerateComment(user: User | null, comment: Comment): boolean {
  if (!user) return false
  if (comment.deletion) return false
  return hasRole(user, 'moderator')
}

// Saving comments to the dashboard requires login.
export function canSaveComment(user: User | null): boolean {
  return user !== null
}

// ── Content (cards / submissions) ──────────────────────────────────────────
//
// Mirrors the comment model: collaborators control their own submissions,
// admins control everything. Used by the dashboard publish/edit flows when
// we eventually multi-author the editor surface.

export function canEditContent(user: User | null, item: ContentItem): boolean {
  if (!user) return false
  if (hasRole(user, 'admin')) return true
  // Collaborators edit only items they authored. The ContentItem.author field
  // is currently a free-text display name (e.g. "datavismo"), not a user id —
  // match by username for now. When the schema gains an `authorId` field
  // (post-Supabase), switch to that.
  if (hasRole(user, 'collaborator')) {
    return !!item.author && item.author.toLowerCase() === user.username.toLowerCase()
  }
  return false
}

export function canDeleteContent(user: User | null, item: ContentItem): boolean {
  // Same rule as edit: own submissions only for collaborators, anything for admins.
  return canEditContent(user, item)
}

// Only admins assign roles or change a user's category.
export function canAssignRoles(user: User | null): boolean {
  return hasRole(user, 'admin')
}

// Only admins ban — moderators delete content but don't touch accounts.
export function canBanUser(user: User | null): boolean {
  return hasRole(user, 'admin')
}
