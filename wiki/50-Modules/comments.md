---
type: module
status: current
tags: [comments, store, sessionstorage, ranks]
updated: 2026-04-29
---

# comments

> Frontend-only comment store. Layered on top of [[mockComments]] — the user's session shadows the seed with their own additions, reaction toggles, and saved-comment bookmarks.

## Source

[lib/comments.ts](../../lib/comments.ts)

## Storage shape

`gradiente:comments` sessionStorage:

```ts
interface SessionState {
  added: Comment[]                                       // user-authored comments
  reactionOverrides: Record<string, Reaction[]>          // per-comment, shadows seed reactions
  deletionOverrides?: Record<string, CommentDeletion>    // mock-comment tombstones (author or mod)
  savedIds: string[]                                     // bookmarked comment ids
}
```

Survives page reloads, dies when the tab closes — same lifecycle as [[drafts]].

## Listener pattern

A small in-module `Set<() => void>` of refresh callbacks. Every write (`addComment`, `toggleReaction`, `toggleSavedComment`) calls `notify()`, which fires every registered callback. Hooks subscribe on mount, unsubscribe on unmount.

## Read API

- `getCommentsForItemMerged(itemId)` — merges seed + session-added comments for one item, applies any reactionOverrides.
- `getAllCommentsMerged()` — cross-item merged view, used by `useUserRank` to count !/? a user has received across the whole comment surface.
- `isCommentSaved(commentId)` / `getSavedComments()` — bookmarked comments resolved to full `Comment` objects.

## Write API

- `addComment(comment)` — appends to `added`. Caller builds the `Comment` shape; `newCommentId()` produces a session-prefixed id (e.g. `cm-session-mofe5xbb-3z77iq`) so it never collides with seed.
- `toggleReaction(commentId, userId, kind)` — enforces **mutual exclusivity** per (user, comment): clicking the *same* kind clears the user's reaction; clicking the *other* kind replaces it. The result lands in `reactionOverrides[commentId]`. The two kinds (`!` signal / `?` provocative) both count as engagement — neither suppresses the other. See [[Roles and Ranks]] for the palette decision and [[No Algorithm]] for the engagement-as-discussion rule.
- `toggleSavedComment(commentId)` — flips membership in `savedIds`.
- `tombstoneComment(commentId, actorId, reason)` — soft-delete. One writer covers both flows: when `actorId === comment.authorId` the [[CommentList]] Tombstone reads it as a self-delete (`//ELIMINADO·POR·AUTOR`, no reason); otherwise as moderation (`//ELIMINADO·POR·MODERACIÓN @actor · RAZÓN: …`). For session-added comments the deletion record is written directly onto the record; for mock comments it lands in `deletionOverrides[id]` and `applyOverrides` merges it at read time. Author self-delete is gated by `canDeleteOwnComment`; mod-delete by `canModerateComment` (see [[permissions]]). Storage doesn't re-check; real backend will via RLS.
- `clearCommentDeletion(commentId)` — restores the body. Mirrors the foro `clearTombstone`. Both storage paths handled (drops the entry from `deletionOverrides`, or clears the `deletion` field on session-added comments). UI gate is broader than the foro's: `canModerate` OR the original actor — gives an author an undo for an accidental self-delete without exposing the affordance to anyone else.

## Hooks

- `useComments(itemId)` — merged comment list for one article. Re-renders on any session write.
- `useIsCommentSaved(commentId)` — boolean per comment, used by the `★ GUARDAR / GUARDADO` button in [[CommentList]].
- `useSavedComments()` — full saved-comment list, drives [[SavedCommentsSection]].
- `useUserRank(userId)` — derived rank (NORMIE / DETONADOR / ENIGMA / ESPECTRO) for a user, computed from received !/? reactions. Re-renders on any reaction toggle. Returns `'normie'` server-side and pre-hydration. Calls into `getUserRank` in [[permissions]]. Consumed by [[CommentList]] / [[PostHeader]] / [[SavedCommentsSection]] for the badge chip.

## Backend migration shape

When the real backend lands (see [[Supabase Migration]]):

- Replace `getCommentsForItemMerged` with a Supabase select.
- Replace `addComment` / `toggleReaction` / `toggleSavedComment` with insert/upsert RPCs.
- Drop the listener registry in favor of Supabase Realtime subscriptions.

Every consumer reads via the hook signatures and won't change.

## Known limitations

Saved IDs are not user-keyed — switching between mock users in the same tab shows the previous user's saves. Acceptable for prototype; real backend keys by user.

## Links

- [[mockComments]] · [[mockUsers]] · [[permissions]]
- [[CommentList]] · [[CommentsColumn]] · [[CommentComposer]] · [[SavedCommentsSection]]
- [[drafts]] — same sessionStorage idiom for drafts
- [[Supabase Migration]]
