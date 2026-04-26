---
type: decision
status: current
tags: [decision, dashboard, publish, drafts, ux]
updated: 2026-04-25
---

# Publish Confirmation Flow

> Three-state model for editorial publishing in the visual prototype: **draft** (private work-in-progress), **pending** (saved as draft, under publish review), **published** (live in the feed). The transition draft → published always passes through pending — never one-click.

## What

Editor publishing is a three-state machine, not a binary. The states differ in **persistence** (storage state) AND **visibility** (whether they appear in the public feed) AND **chrome** (visual treatment).

| State | `_draftState` | URL marker | In feed? | Chrome on card |
|---|---|---|---|---|
| **draft** | `'draft'` | — | No (private) | n/a (only visible in [[Dashboard Drafts]]) |
| **pending** | `'draft'` | `?pending=<id>` on home URL | Yes (the one matching the id) | `[PENDIENTE·CONFIRMAR]` chip + glitch border + scanline + cover flicker + corner CONFIRMAR button |
| **published** | `'published'` | — | Yes | None — looks like real content |

Note that **pending is not its own data state** — it's `'draft'` plus a transient URL flag. We chose this so:

- Drafts don't accidentally surface in the feed (the user explicitly pushed back on this when we tried to)
- Pending state survives reloads naturally via the URL
- Cancelling pending just clears the URL; the draft stays intact
- No "stale pending" rows in storage to clean up

## Why three states (not two)

User feedback after the first two-state shipped (draft → published, one-click): publishing felt too dangerous and the distinction between "draft" and "ready to publish" was muddy. Adding a confirmation gate solved both:

- The danger: a misclick can't accidentally make content live
- The clarity: each state has its own visual identity. Drafts are invisible to the public; pending items are visibly mid-review; published items look indistinguishable from real content.

The pending state also serves a secondary function: it's where the editor sees their content **in feed context** before committing. The card lands where curation will rank it, glitching among real content — letting the editor judge "does this fit here?" before it's live.

## How

### Form → Pending

1. Editor clicks `▶ PUBLICAR` in any [[Dashboard Forms]] form
2. Form's `onPublish` handler:
   - Calls `workbench.requestPublish()` which calls `commit('draft')` — saves item with `_draftState: 'draft'`. Returns the stable id.
   - Calls `setCategoryFilter(null)` to clear any active home-feed filter (otherwise the new card might be filtered out)
   - Calls `router.push('/?pending=<id>')`
3. Home page mounts. `HomeFeedWithDrafts` reads URL param, finds matching draft via `useDraftItems()`, stamps with `_pendingConfirm: true`
4. Filtered into feed: published session items + the one matching `pendingId`. Pure drafts stay hidden.
5. [[ContentCard]] receives item with `_pendingConfirm` → renders glitch chrome + auto-scrolls into view + shows corner `[✓ CONFIRMAR]` button

### Pending → Published

6. Editor clicks the corner button (or `[✓ CONFIRMAR]`)
7. `usePublishConfirm.openConfirm(itemId)` opens [[PublishConfirmOverlay]]
8. Editor reviews the item preview in the modal, clicks `▶ PUBLICAR DEFINITIVAMENTE`
9. Modal's confirm handler:
   - Calls `upsertItem(item, 'published')` — flips state in store
   - Calls `closeConfirm()`
   - Calls `router.replace(...)` to clear `?pending` URL param without history bloat
10. `useDraftItems` notifies subscribers → home grid re-renders → card now has `_draftState: 'published'`, no glitch, no chip, indistinguishable from real content

### Pending → Cancel

- Cancel via modal CANCELAR button, ESC key, or backdrop click
- Modal closes; URL `?pending` param stays
- The draft remains in storage with `_draftState: 'draft'`
- Editor can re-trigger from the corner button or navigate away (URL stays in history)

### Draft → Confirm (from overlay)

- Click `▶ PUBLICAR AHORA` in the orange [[OverlayShell]] strip on any draft overlay
- `SessionItemStrip.handlePublish` calls `usePublishConfirm.openConfirm(item.id)` — same entry point the pending-card corner button uses
- Modal opens with the item preview; confirming flips the draft to `published` directly (no intermediate `?pending=` URL state, since the user is already looking at the item)
- This path skips the pending-card glitch — appropriate because the editor is already reading the item, so the "preview before publish" purpose of the pending state is already served

### Published → Edit → Pending → Published

- Click EDITAR in the published item's [[OverlayShell]] strip
- Routes to `/dashboard?type=<type>&edit=<id>`
- Form pre-populates via `useDraftWorkbench`'s `editItemId` hydration
- Editor edits, clicks PUBLICAR
- Goes through pending flow again (saves as draft → URL param → glitch → confirm)
- Final upsert with same id → state stays `'published'`, content updated

**Caveat:** during the transient pending step on a re-publish, `_draftState` momentarily becomes `'draft'`. If the editor cancels mid-flow, the previously-published item is now in draft state. Acceptable for prototype; worth deciding for production whether to preserve the published flag during pending re-confirmations.

## Components involved

- [[useDraftWorkbench]] (in [[Dashboard Forms]] / `Fields.tsx`) — `saveDraft()` and `requestPublish()` (returns id, doesn't actually publish)
- [[ContentCard]] — chip swap, glitch wiring, corner CONFIRMAR button, auto-scroll
- [[HomeFeedWithDrafts]] — URL param read, `_pendingConfirm` stamping, filter (only published + the one pending)
- [[PublishConfirmOverlay]] — globally-mounted modal
- [[usePublishConfirm]] — context for modal open state
- [globals.css](../../app/globals.css) — `pending-border-pulse`, `pending-scanline-sweep`, `pending-cover-flicker`, `pending-chip-flicker` keyframes

## Visual primitives

The pending state uses four CSS animations layered on the card:
- **Border pulse** — alternates red↔orange every 1.6s
- **Scanline sweep** — vertical gradient line traverses top→bottom every 2.4s
- **Cover flicker** — CRT-style brightness/hue distortion punches every 3.2s (~5% of the cycle)
- **Chip flicker** — subtle opacity pulse on the `[PENDIENTE·CONFIRMAR]` chip

All four are CSS-driven. No JS scramble for the title (kept that for the 404 page only — too aggressive on grid cards).

## Backend transition

When [[Supabase Migration]] lands:
- `lib/drafts.ts` API stays the same (`upsertItem`, `getItemById`, `useDraftItems`) — implementation swaps from sessionStorage to Supabase
- Drafts persist to `items` table with a `state` column
- Pending → Published becomes a real DB transition (not just a state field flip)
- The pending URL param + visual chrome stay exactly as built
- Editor permission checks on publish: only insiders/admins can confirm

## Links

- [[Dashboard]] · [[Dashboard Forms]] · [[Dashboard Drafts]]
- [[ContentCard]] · [[OverlayShell]]
- [[drafts]] · [[VibeContext]]
- [[Open Questions]]
