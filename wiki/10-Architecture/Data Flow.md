---
type: architecture
status: current
tags: [data-flow, curation, rendering]
updated: 2026-04-22
---

# Data Flow

> One direction: `mockData.ts` → filters → curation → pages → UI. No writes, no side effects, no fetches.

## What

The codebase treats content as an **immutable seed list** that flows through a pipeline of pure functions:

```
lib/mockData.ts::MOCK_ITEMS
        │
        ▼
lib/utils.ts::filterForHome / filterForCategory / filterByVibe / filterByDate
        │
        ▼
lib/curation.ts::rankItems  ← HP decay, freshness, prominence, size tier
        │
        ▼
app/**/page.tsx             ← server component selects subset
        │
        ▼
components/**                ← renders; reads VibeContext for client filtering
```

## Why

- **Pure data pipeline** = trivial to reason about, trivial to test, trivial to swap for a real backend.
- **No per-user state** — HP lives on the item, not on a user log. See [[Size and Position as Only Signals]] and [[No Algorithm]].
- **Server components do the heavy filtering** (by type, by date expiration), then pass to client islands for interactive filtering (vibe range, selected date via [[VibeContext]]).

## How

### Entry points

- [app/page.tsx](../../app/page.tsx) — Home. Calls `filterForHome` (removes expired) + `getPinnedHero` + splits out partners. Passes to [[ContentGrid]] in `mode="home"`.
- [app/agenda/page.tsx](../../app/agenda/page.tsx) and siblings — call `filterForCategory(type)` and pass to [[ContentGrid]] in `mode="category"`.

### Server-side filtering (pure)

[`filterForHome(items, now)`](../../lib/utils.ts) — keeps upcoming only (events not past; non-events with `expiresAt` not crossed), sorted ascending by date.

[`filterForCategory(items, type)`](../../lib/utils.ts) — keeps one `ContentType`, sorted **descending** by date.

### Curation (pure, deterministic)

See [[HP Curation System]] for the full math. The key transform is [`rankItems`](../../lib/curation.ts) which returns `RankedItem[]` — each item enriched with `score`, `prominence`, `tier`, and a `CardLayout` (colSpan × rowSpan).

### Client-side filtering (reactive)

[[ContentGrid]] reads `vibeRange` and `selectedDate` from [[VibeContext]], re-computes the ranked list in a `useMemo`, and animates layout changes via Framer Motion.

## Invariants

- `filterForHome` runs only on the server. `filterByVibe` + `selectedDate` pinning run only on the client. Don't cross the streams.
- **Partners never flow into the main grid** — filtered out in [app/page.tsx:16](../../app/page.tsx). See [[Partners Isolation]].
- **Hero is removed from the grid** to avoid double-rendering (same file, `i.id !== hero.id` check).

## Links

- [[HP Curation System]]
- [[ContentGrid]]
- [[VibeContext]]
- [[mockData]]
- [[utils]]
