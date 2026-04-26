---
type: module
status: current
tags: [saves, store, sessionstorage, guardados]
updated: 2026-04-26
---

# saves

> Frontend-only save-from-feed store. Per-tab bookmarks of `ContentItem`s, surfaced by the dashboard's `Guardados/*` sections.

## Source

[lib/saves.ts](../../lib/saves.ts)

## Storage shape

`gradiente:saves` sessionStorage:

```ts
interface SessionState {
  savedIds: string[]
}
```

Survives page reloads, dies when the tab closes — same lifecycle as [[drafts]] and [[comments]].

## Listener pattern

Mirrors [[comments]] exactly: a small in-module `Set<() => void>` of refresh callbacks. Every write (`toggleSavedItem`, `clearSavedItems`) calls `notify()`. Hooks subscribe on mount, unsubscribe on unmount.

## Resolver

`resolveItem(id)` looks in `MOCK_ITEMS` first, falls back to [[drafts]]'s `getItemById`. So users can save:
- Real seed content from [[mockData]]
- Their own session-published drafts (since drafts produce real `ContentItem`s with stable ids)

Items whose ids no longer resolve (e.g. user deleted a saved draft) are silently dropped from the resolved list — keeps the UI from showing ghost rows.

## Read API

- `isItemSaved(id)` — synchronous boolean
- `getSavedItems()` — full `ContentItem[]` in save-order (most-recent saves last)

## Write API

- `toggleSavedItem(id)` — flips membership in `savedIds`
- `clearSavedItems()` — wipes the set

## Hooks

- `useSavedItems()` — full saved-item list. Re-renders on every save toggle. Drives [[GuardadosSection]] + [[ExplorerSidebar]] badges + the dashboard storage-panel total.
- `useIsItemSaved(id)` — boolean per item. Drives [[SaveItemButton]]'s active state and [[SavedBadge]]'s visibility on cards.

## Backend migration shape

When the real backend (see [[Supabase Migration]]) lands:

- Replace `getSavedItems` with a Supabase select joining the user's bookmarks against `content_items`.
- Replace `toggleSavedItem` with an upsert/delete RPC.
- Drop the listener registry in favor of Supabase Realtime.

Every consumer reads via the hook signatures and won't change.

## Known limitations

Saves are not user-keyed in sessionStorage — switching between mock users in the same tab shows the previous user's saves. Acceptable for prototype; real backend keys per user.

## Links

- [[mockData]] · [[drafts]] · [[comments]]
- [[SaveItemButton]] · [[SavedBadge]] · [[GuardadosSection]]
- [[Supabase Migration]] · [[Guardados Roadmap]] (memory)
