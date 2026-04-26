---
type: module
status: current
tags: [comments, store, sessionstorage]
updated: 2026-04-26
---

# comments

> Frontend-only comment store. Layered on top of [[mockComments]] — the user's session shadows the seed with their own additions, reaction toggles, and saved-comment bookmarks.

## Source

[lib/comments.ts](../../lib/comments.ts)

## Storage shape

`gradiente:comments` sessionStorage:

```ts
interface SessionState {
  added: Comment[]                          // user-authored comments
  reactionOverrides: Record<string, Reaction[]>  // per-comment, shadows seed reactions
  savedIds: string[]                        // bookmarked comment ids
}
```

Survives page reloads, dies when the tab closes — same lifecycle as [[drafts]].

## Listener pattern

A small in-module `Set<() => void>` of refresh callbacks. Every write (`addComment`, `toggleReaction`, `toggleSavedComment`) calls `notify()`, which fires every registered callback. Hooks subscribe on mount, unsubscribe on unmount.

## Read API

- `getCommentsForItemMerged(itemId)` — merges seed + session-added comments for one item, applies any reactionOverrides.
- `isCommentSaved(commentId)` / `getSavedComments()` — bookmarked comments resolved to full `Comment` objects.

## Write API

- `addComment(comment)` — appends to `added`. Caller builds the `Comment` shape; `newCommentId()` produces a session-prefixed id (e.g. `cm-session-mofe5xbb-3z77iq`) so it never collides with seed.
- `toggleReaction(commentId, userId, kind)` — adds the `(userId, kind)` reaction if absent, removes it if present. Result lands in `reactionOverrides[commentId]`. **All reaction kinds count toward engagement equally** — no kind subtracts, no kind suppresses. See [[No Algorithm]] / "controversy as discussion."
- `toggleSavedComment(commentId)` — flips membership in `savedIds`.

## Hooks

- `useComments(itemId)` — merged comment list for one article. Re-renders on any session write.
- `useIsCommentSaved(commentId)` — boolean per comment, used by the `★ GUARDAR / GUARDADO` button in [[CommentList]].
- `useSavedComments()` — full saved-comment list, drives [[SavedCommentsSection]].

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
