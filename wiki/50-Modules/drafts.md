---
type: module
status: current
tags: [module, lib, drafts, sessionstorage, prototype]
updated: 2026-04-25
---

# drafts

> `lib/drafts.ts` — sessionStorage-backed store for editor-composed items in the visual prototype. The single seam between the dashboard's submit actions and the home feed's session-item rendering.

## Source

[lib/drafts.ts](../../lib/drafts.ts)

## What

Owns the runtime state for everything the editor saves or publishes during a session. Keyed under `gradiente:dashboard:items` in sessionStorage. Items survive reloads, die when the tab closes, are scoped to one editor.

## Type

```ts
type DraftState = 'draft' | 'published'

interface DraftItem extends ContentItem {
  _draftState: DraftState
  _createdAt: string  // ISO
  _updatedAt: string  // ISO
}
```

The leading-underscore keys are **frontend-only** — they never round-trip to a backend. They're declared optional on `ContentItem` itself ([lib/types.ts](../../lib/types.ts)) so any consumer can branch on them, but persistence layers should ignore them.

## Public API

| Function | Purpose |
|---|---|
| `getAllItems()` | Read all session items as `DraftItem[]`. SSR-safe (returns `[]` on server). |
| `getItemById(id)` | Lookup helper — used by [[OverlayRouter]] to resolve draft slugs and by [[useDraftWorkbench]] for edit hydration. |
| `upsertItem(item, state)` | Insert if id is new, update if it matches existing. Stamps `_updatedAt`. Notifies subscribers. Caps store at 50 items. Returns the resulting `DraftItem`. |
| `removeItem(id)` | Filter-and-rewrite. Notifies subscribers. |
| `clearAll()` | Wipes the store. Mostly for testing. |
| `newItemId(type)` | Stable id generator: `local-<type>-<timestamp>-<random>`. Used by `useDraftWorkbench` on first commit. |
| `useDraftItems()` | React hook — returns the current array, subscribes to mutations. SSR-safe (returns `[]` until hydrated). |

## Subscriber pattern

`sessionStorage` doesn't fire `storage` events in the same tab, so the module maintains an in-memory listener set:

```ts
const listeners = new Set<() => void>()
function notify() { for (const fn of listeners) fn() }
```

Every mutation calls `notify()`. `useDraftItems()` subscribes on mount, unsubscribes on unmount, re-reads on every notification. Means a publish from the form propagates immediately to a `useDraftItems()` consumer elsewhere on the page (e.g., the [[Dashboard]] header's `DRAFTS · N` count updates live).

## Consumers

- [[Dashboard Forms]] (`useDraftWorkbench`) — `upsertItem` on save / publish, `getItemById` on edit hydrate, `removeItem` on form reset
- [[HomeFeedWithDrafts]] — `useDraftItems()` to merge published items + the pending one into the feed
- [[OverlayRouter]] — `useDraftItems()` so draft slugs open via overlay (would otherwise fall through to MOCK_ITEMS only)
- [[OverlayShell]] (SessionItemStrip) — `upsertItem(item, 'published')` for the inline PUBLICAR button on a draft item, `removeItem` for ELIMINAR
- [[PublishConfirmOverlay]] — `getItemById` to find the pending item, `upsertItem(item, 'published')` on confirm
- [[Dashboard Drafts]] / `DraftsList` — `useDraftItems` for the table, `removeItem` for trash button
- [[Dashboard]] page — `useDraftItems` for the header `DRAFTS · N` live count

## Backend transition path

When [[Supabase Migration]] lands:
- `getAllItems` / `useDraftItems` → Supabase select against `items` table filtered by editor + state
- `upsertItem` → Supabase upsert RPC
- `removeItem` → Supabase delete RPC
- `notify()` listener → Supabase Realtime subscription
- The module's API surface stays the same — every consumer keeps working without changes
- Drop the `_draftState` underscore convention; rename to a real `state` column
- Drop `_createdAt` / `_updatedAt` once Supabase manages them

## Limits + caveats

- **50-item cap** (`if (all.length > 50) all.length = 50`) prevents sessionStorage bloat. Acceptable for prototype since editors rarely exceed this. Real backend won't have this constraint.
- **Single-tab scope.** Two browser tabs of the same site don't share state. The subscriber pattern is in-memory, scoped to the JS runtime.
- **No conflict resolution.** Two simultaneous edits to the same draft from the same tab would race; the latest write wins. Real backend will need optimistic locking or last-write-wins documented.
- **No pagination.** With 50-item cap, the drafts list always renders everything. Real backend needs server-side pagination.

## Links

- [[Dashboard]] · [[Dashboard Forms]] · [[Dashboard Drafts]]
- [[Publish Confirmation Flow]]
- [[Supabase Migration]] — what eventually replaces this module
- [[types]] — declares the `_draftState` / `_pendingConfirm` optional fields
