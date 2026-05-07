---
type: module
status: current
tags: [module, vibe, vibe-checks, cache, hooks, realtime]
updated: 2026-05-05
---

# vibeChecks

> Optimistic-cache + hooks for the [[Vibe Checks]] feature. Two read surfaces (user's own vote, crowd aggregate) backed by one per-item cache. Mirrors [[polls]]'s shape.

## Sources

- [lib/vibeChecksCache.ts](../../lib/vibeChecksCache.ts) — module-scoped cache, listener Set, lazy fetch
- [lib/vibeChecks.ts](../../lib/vibeChecks.ts) — write API + hooks + helpers
- [app/api/vibe-checks/[itemId]/route.ts](../../app/api/vibe-checks/[itemId]/route.ts) — `PUT` upsert / `DELETE` revoke

## Cache shape

Per-item cache keyed by `itemId`:

```ts
type ItemEntry = { checks: Map<string, VibeCheck> }  // userId → check
```

Holds **every known check for an item** so optimistic writes can recompute the aggregate locally without a server round-trip — same all-votes-in-memory shape as [[polls]] / [pollVotesCache](../../lib/pollVotesCache.ts).

## Read API

### Sync (cache reads)

```ts
getUserVibeCheckSync(itemId, userId): VibeCheck | null
getVibeCheckAggregateSync(itemId): { checkCount, medianMin, medianMax }
```

Both return zeros when the item isn't cached yet. Useful as React state initializers.

### Hooks

```ts
useUserVibeCheck(itemId, userId): VibeCheck | null
useVibeCheckAggregate(itemId): VibeCheckAggregate
```

Both lazy-fetch via `ensureVibeChecksFetched(itemId)` on first subscription (concurrent subscribers share the in-flight promise). `useVibeCheckAggregate` *additionally* opens a Supabase realtime channel scoped to that item — peer writes invalidate the cache + trigger a refetch.

## Write API

```ts
castVibeCheck(itemId, userId, vibeMin, vibeMax): Promise<void>
clearVibeCheck(itemId, userId): Promise<void>
```

Both are optimistic: cache flips locally, then API confirms (or rolls back to previous). `userId` is for the local cache key — the server uses `auth.uid()` regardless.

The `PUT /api/vibe-checks/[itemId]` route does:

- Auth check (401 if not signed in)
- Range validation (400 if not integers, out of 0-10, or `min > max`)
- `upsert` on `(item_id, user_id)`

`DELETE /api/vibe-checks/[itemId]` deletes the calling user's row.

## Aggregation

`aggregateChecks(checks: Map): { checkCount, medianMin, medianMax }` — the local equivalent of the SQL `vibe_check_aggregates` view. Median of an integer array picks the lower of the two middle values for even-length sets to match the Postgres `cast(percentile_cont(0.5) as smallint)` rounding, so client + server agree.

## Threshold + effective band

```ts
VIBE_CHECK_THRESHOLD = 5

effectiveVibeBand(authorMin, authorMax, aggregate): [number, number]
  // crowd median if checkCount >= threshold, else [authorMin, authorMax]
```

This client-side helper is the analog of [`utils.ts::effectiveVibeBand`](../../lib/utils.ts) (which takes a `ContentItem` directly) — both apply the same fall-through rule. The utils version is server-safe (no `'use client'`), used by `filterByVibe` for home-grid eligibility decisions.

## Realtime

Per-item channel pattern: `vibe-checks:item:{itemId}` listening on `INSERT/UPDATE/DELETE` filtered by `item_id=eq.{itemId}`. On any peer event, the entry is invalidated and the next subscriber's render re-fetches.

This is per-item rather than one shared channel because vibe checks are sparse — most viewers only ever look at a handful of items at a time. Fetching all checks for all items would be wasteful.

## Logout teardown

[useAuth](../../components/auth/useAuth.tsx) calls `clearAllVibeChecks()` when the session ends, alongside the other per-user caches (saved comments, saves, drafts, ranks). Keeps the post-logout state clean.

## Why mirror polls

The shape was deliberate — see [Backend Plan §Optimistic write shape](../70-Roadmap/Backend%20Plan.md). One canonical pattern across the cache modules makes them mutually legible. If you understand `pollVotesCache`, you understand `vibeChecksCache`.

## Open questions

- Memory growth: every viewed item's full check set lives in the cache forever (until logout). Fine at current scale; revisit if active users hit hundreds.
- The aggregate is recomputed per render via `aggregateChecks`. Consider memoizing per-item if this shows up in profiling.

## Links

- [[Vibe Checks]] — domain concept
- [[VibeFader]] — the consumer UI
- [[polls]] — the pattern this mirrors
- [[Backend Plan]]
