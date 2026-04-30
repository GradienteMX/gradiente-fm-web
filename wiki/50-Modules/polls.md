---
type: module
status: current
tags: [polls, store, sessionstorage, attachment]
updated: 2026-04-30
---

# polls

> Frontend-only vote store + per-type choice resolver for poll attachments. Poll *definitions* live on the parent `ContentItem` (see [[Polls As Attachments]]); only the votes are session-scoped.

## Source

[lib/polls.ts](../../lib/polls.ts)

## Storage shape

`gradiente:polls` sessionStorage:

```ts
interface SessionState {
  // Per-poll, per-user vote map. One vote per (pollId, userId);
  // revoting replaces outright. multiChoice on the poll definition
  // controls whether choiceIds may have length > 1.
  votes: Record<string, Record<string, PollVote>>
}
```

Same lifecycle as [[comments]] / [[saves]] / [[foro]]: survives reload, dies with the tab.

## Read API

- `getUserVote(pollId, userId)` — direct lookup; null if user hasn't voted.
- `getPollVotes(pollId)` — full vote map for a poll. Used by the aggregator.
- `aggregateVotes(votes, choices)` — pure helper, returns `{ totalVotes, perChoice }`.
- `resolvePollChoices(item, poll)` — the per-type variant resolver:
  - `from-list` → derive from item's `articleBody` `track` blocks
  - `from-tracklist` → derive from item's `tracklist`
  - `attendance` → fixed `[VOY, TAL VEZ, NO PUEDO]`
  - `freeform` → return `poll.choices` verbatim
- `isPollClosed(poll)` — checks `closesAt` against now.

## Write API

- `castVote(pollId, userId, choiceIds)` — adds or replaces. Caller validates the choice ids exist in the resolved list (storage doesn't re-check).
- `clearVote(pollId, userId)` — re-anonymizes a voter. Not exposed in UI yet but ready for an "undo" affordance.

## Hooks

- `useUserVote(pollId, userId)` — live `PollVote | null`. Re-renders on any vote change for the same poll.
- `usePollResults(pollId, choices)` — live `{ totalVotes, perChoice }`. Aggregates across all voters. The choice list is supplied by the caller because choices may be derived from the parent (which only the caller has in hand).

## Default prompts

`POLL_DEFAULT_PROMPT[kind]` — Spanish-UI defaults used by [[PollFieldset]] when an editor opts a content item into a poll. Always editable.

## Anonymous-until-vote

The store does NOT enforce the gate — that's a UI concern. `usePollResults` returns counts unconditionally. [[PollCardCanvas]] and [[PollSection]] both branch on `useUserVote(...) === null` and hide counts until the viewer has voted (or the poll is closed).

## Backend migration

When [[Supabase Migration]] lands:

- Replace `castVote` / `clearVote` with Supabase RPCs against a `poll_votes` table.
- Listener pattern → Supabase Realtime subscriptions on the poll's vote rows.
- `resolvePollChoices` stays unchanged — it derives from the in-memory `ContentItem`, no backend round-trip needed.

Hook signatures stay; consumers don't change.

## Links

- [[Polls As Attachments]] — the design decision
- [[PollCardCanvas]] · [[PollSection]] · [[PollFieldset]] — the UI surfaces
- [[mockData]] — where seed polls live (one per kind: listicle / mix / evento / noticia)
- [[comments]] · [[foro]] · [[userOverrides]] — same listener idiom
