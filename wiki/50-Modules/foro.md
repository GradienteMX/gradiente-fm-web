---
type: module
status: current
tags: [foro, store, sessionstorage, imageboard, moderation]
updated: 2026-04-29
---

# foro

> Frontend-only foro store. SessionStorage-backed, layered on top of [[mockForo]]. Threads + replies the user authors this session shadow the seed catalog.

## Source

[lib/foro.ts](../../lib/foro.ts)

## Storage shape

`gradiente:foro` sessionStorage:

```ts
interface SessionState {
  addedThreads: ForoThread[]                  // user-authored threads
  addedReplies: ForoReply[]                   // user-authored replies
  bumpOverrides: Record<string, string>       // mock-thread id → ISO bumpedAt
  tombstones: Record<string, ForoDeletion>    // thread/reply id → mod deletion
}
```

Same lifecycle as [[comments]] / [[saves]]: survives reloads, dies with the tab.

## Bump rules

Catalog ordering is `bumpedAt desc`, capped at `FORO_THREAD_CAP = 30`.

- **New thread** → `bumpedAt = createdAt`. Lands at top.
- **New reply** → parent's `bumpedAt = reply.createdAt`. Parent floats up.
- Mock threads are immutable — their `bumpedAt` is shadowed at read time via `bumpOverrides`. `getMergedThreads` overlays the override before sorting.

## Listener pattern

In-module `Set<() => void>` of refresh callbacks. Every write (`addThread`, `addReply`) calls `notify()`. Hooks subscribe on mount, unsubscribe on unmount. Same idiom as [[comments]].

## Read API

- `getMergedThreads()` — mock + session, with bumpOverrides applied, sorted desc, sliced to FORO_THREAD_CAP.
- `getThreadById(id)` — looks in mocks first, falls back to addedThreads.
- `getRepliesForThreadId(threadId)` — chronological, mock + session merged.
- `getReplyCountForThread(threadId)` — count for catalog tile badge.

## Write API

- `addThread(thread)` — appends to `addedThreads`, fires `notify()`.
- `addReply(reply)` — appends to `addedReplies`, sets `bumpOverrides[reply.threadId]` to the reply timestamp, also patches the parent in `addedThreads` if it's a session thread (so its bumpedAt stays consistent across reads).
- `tombstoneThread(threadId, moderatorId, reason)` — soft-delete. Writes a `ForoDeletion` to `tombstones[threadId]`. The thread's body is preserved in storage (so quote-links keep resolving) but `getMergedThreads` filters it out of the catalog and `getThreadById` returns it with `deletion` set. [[ThreadOverlay]] renders a `Tombstone` block in place of the body and disables the composer.
- `tombstoneReply(replyId, moderatorId, reason)` — same shape. Reply position is preserved (article still renders, backlinks still work) but the body is replaced with the moderator stub.
- `clearTombstone(postId)` — drops the deletion record so the post reappears (catalog re-includes the thread; reply body restores). One writer for both kinds because the tombstone map is keyed by post id, not type. Same `canModerate` gating as the writers above.

All three writers trust the caller to gate via `canModerate(currentUser)` from [[permissions]] — the storage layer doesn't re-check. Real backend enforces in RLS.

## Session id generation

Mirrors the mock format so user-authored ids are visually indistinguishable from seeds in `>>id` quote-tokens. See [[Foro]] § "Session id format".

- `newThreadId()` — reads `addedThreads.length`, returns `fr-s{NN}` zero-padded.
- `newReplyId(threadId)` — counts existing replies for the thread (mock + session), returns `fp-{threadShortRef}-s{NN}`.

`threadShortRef` strips the `fr-` prefix: `fr-003` → `003`, `fr-s01` → `s01`.

## Hooks

- `useThreads()` — sorted, capped catalog list. Re-renders on any session write.
- `useThread(threadId)` — single thread by id. Returns null when not found.
- `useReplies(threadId)` — chronological replies for a thread.
- `useReplyCount(threadId)` — count for tile badges.

## Backend migration shape

When [[Supabase Migration]] lands:

- Replace `useThreads` / `useThread` / `useReplies` with Supabase selects.
- Replace `addThread` / `addReply` with insert RPCs (server bumps parent server-side).
- Listener pattern → Supabase Realtime subscriptions.
- Server-side enforcement of `FORO_THREAD_CAP` via prune-on-insert.

Hook signatures stay stable; consumers don't change.

## Known limitations

- Session-only — switching mock users in the same tab doesn't filter "my threads" since there's no per-user keying.
- Cap enforcement is read-side only (slice 30 in `getMergedThreads`). Storage can grow past 30 if the user authors many threads, but the catalog only renders 30.

## Links

- [[mockForo]] · [[Foro]] · [[ForoCatalog]] · [[ThreadOverlay]] · [[NewThreadOverlay]] · [[ReplyComposer]]
- [[comments]] · [[saves]] — same storage idiom
- [[Supabase Migration]]
