---
type: domain
status: current
tags: [vibe, checks, crowd, aggregation, democratization]
updated: 2026-05-05
---

# Vibe Checks

> Per-user `[vibeMin, vibeMax]` grade for an item. Aggregates to a crowd median that overrides the author's range once the threshold is reached. The democratic correction layer on top of curator-assigned vibes.

## What

Each authed user can drag a fader on any content overlay and commit their reading of the item's vibe. Their vote is one row in `vibe_checks`, primary-keyed `(item_id, user_id)`. Re-voting upserts in place — one mutable vote per user.

The aggregate (median min, median max, count) lives in the `vibe_check_aggregates` view.

## Why

Per [[Vibe Philosophy]] idea 3 + 4: the curator's vibe assignment is a starting position, not the truth. The crowd refines it. The system learns calibration from accumulated checks. Operationalizes the editorial-but-democratic balance from [[Guides Not Gatekeepers]] — applied to the vibe axis instead of the prominence axis ([[HP Curation System]]).

## How

### Threshold fall-through

`VIBE_CHECK_THRESHOLD = 5`. Below 5 checks: displayed band = author's `[vibeMin, vibeMax]`. At ≥5: displayed band = crowd median `[median_min, median_max]`.

This is the **effective band** consumed by:

- [[VibeFader]] — what the gradient strip shows by default
- `filterByVibe` ([utils.ts](../../lib/utils.ts)) — whether an item passes the home slider's range. Vibe checks affect *eligibility*, not just chrome (decided 2026-05-05).

`effectiveVibeBand(item)` is the helper. Items expose `vibeCheckCount`, `vibeCheckMedianMin`, `vibeCheckMedianMax` (all optional) — populated by `getItems()` joining the aggregate view at read time.

### Aggregation

`percentile_cont(0.5) within group (order by vibe_min/max)` cast to smallint — produces the integer median per item. Median chosen over mean for outlier resistance (decided 2026-05-05).

The `vibe_check_aggregates` view is `with (security_invoker = true)` so the underlying RLS gates (read-all on `vibe_checks`) apply correctly.

### Login-gated

Commits require `auth.uid()`. Logged-out users see the displayed band but clicking the fader fires `openLogin()` instead of entering edit mode. Same gate pattern as [[polls]] / [[saves]].

### Optimistic + realtime

Mirrors [[polls]]'s shape:

- [`lib/vibeChecksCache.ts`](../../lib/vibeChecksCache.ts) — module cache, listener Set, lazy fetch per item
- [`lib/vibeChecks.ts`](../../lib/vibeChecks.ts) — `castVibeCheck` / `clearVibeCheck` (optimistic + API confirm), `useUserVibeCheck` / `useVibeCheckAggregate` hooks
- API route at [`app/api/vibe-checks/[itemId]/route.ts`](../../app/api/vibe-checks/[itemId]/route.ts) — `PUT` upsert, `DELETE` revoke
- Realtime channel `vibe-checks:item:{itemId}` invalidates the per-item cache when peer writes land

## Schema

[`supabase/migrations/0011_vibe_checks.sql`](../../supabase/migrations/0011_vibe_checks.sql):

```sql
create table vibe_checks (
  item_id    text references items(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  vibe_min   smallint check (vibe_min between 0 and 10),
  vibe_max   smallint check (vibe_max between 0 and 10),
  primary key (item_id, user_id),
  check (vibe_min <= vibe_max)
)
```

Plus `vibe_check_aggregates` view (median + count) and `vibe_checks_self_write` RLS.

[`0012_vibe_checks_security.sql`](../../supabase/migrations/0012_vibe_checks_security.sql) follow-up fixed two lints: view → `security_invoker = true`, function → pinned `search_path = public`.

## Visual rules in the fader

The fader's three layers (per [[VibeFader]]) communicate how the user, author, and crowd disagree:

- **Lit displayed band** (full opacity) — what the system thinks: author until N≥5, then crowd median.
- **User-vote ghost** (25% rest / 60% hover / 100% edit) — your personal reading.
- **Author tick marks** (faint, persistent) — what the curator originally said. Self-revealing: when consensus diverges from author, the ticks stop sitting under the lit band.

## What this rules out

- **Auto-vibe inference from votes alone.** Crowd median doesn't *replace* the author's range in the DB — only at display + filter time. The author's value stays as the seed and the comparator.
- **Anonymous votes.** Login-gated by design (see idea 4). One person, one mutable vote.
- **Hidden author values.** Author ticks stay visible even when crowd takes over — transparency in the gap.

## Status + open items

- ✅ Live in production. End-to-end round-trip verified.
- ⏳ Composer prior (use crowd-trained patterns to pre-fill new items' vibe at compose time) — not built. See [[Vibe Philosophy]] idea 3.
- ⏳ Visual differentiation when crowd diverges sharply from author (e.g. "out-of-stereotype" hint on the ticks). Sit-and-watch.
- ⏳ Minimum sample size policy at the *category* / *route* level (e.g. on `/reviews`, are vibe checks sparse enough that the threshold should be lower?). Defer until traffic.

## Links

- [[Vibe Philosophy]]
- [[VibeFader]]
- [[Vibe Spectrum]]
- [[vibeChecks]]
- [[Backend Plan]]
- [[Guides Not Gatekeepers]]
