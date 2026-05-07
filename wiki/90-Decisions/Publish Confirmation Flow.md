---
type: decision
status: current
tags: [decision, dashboard, publish, drafts, ux]
updated: 2026-05-07
---

# Publish Confirmation Flow

> Two-state model: **draft** (private work-in-progress, only in dashboard) and **published** (live in the feed). The transition runs through a confirmation overlay that opens **inside the dashboard composer** — never on the public feed. Recently-published items wear a fresh-glitch chrome on the feed for one hour so editors can spot their landing.

## What

Editor publishing has two persistent states plus one transient confirmation step:

| State | `_draftState` | Visible to public? | Card chrome on feed |
|---|---|---|---|
| **draft** | `'draft'` | No (only [[Dashboard Drafts]]) | n/a |
| **published** | `'published'` | Yes | None — looks like real content, EXCEPT for the first hour after publish, when the editor's own type-coloured glitch chrome ([NUEVO] chip + border pulse + scanline + cover flicker) marks it as fresh |

The previous three-state model (draft / pending / published) with a `?pending=<id>` URL flag and a glitching pending card on the feed was retired on 2026-05-07. Beta testers hit a recurring confusion: they would refresh after composing and not realise their item was still in pending limbo, then ask why their content wasn't on the feed. See [[log]] entry of that day for the redesign.

## How

### Form → Confirm overlay (in dashboard)

1. Editor clicks `▶ PUBLICAR` in any [[Dashboard Forms]] form.
2. Form's `onPublish` handler:
   - `workbench.requestPublish()` saves the item with `_draftState: 'draft'` and returns its stable id.
   - `setCategoryFilter(null)` clears any active home-feed filter so the card surfaces post-publish.
   - `usePublishConfirm.openConfirm(id)` opens [[PublishConfirmOverlay]] **in place** — no navigation.
3. The overlay shows a preview (type badge + slug + title + subtitle) and two buttons: `CANCELAR` and `▶ PUBLICAR DEFINITIVAMENTE`.

### Confirm → Published

4. Editor clicks `▶ PUBLICAR DEFINITIVAMENTE`.
5. Modal's `handleConfirm`:
   - Captures the payload locally + closes the modal (so the modal dismisses via its own state, not via the cache mutation pulling `item` out from under the memoized render).
   - Optimistically drops the row from `draftsCache` so the dashboard drafts list reflects the publish before the API round-trip completes.
   - Awaits `publishItem(payload)` — the server route flips the row to `published = true`.
   - On success: wipes `gradiente:dashboard:<type>-draft` so the next "new <type>" navigation starts empty.
   - Pushes the user to `/?fresh=<id>` so they land on the feed with their card visible.

### Auto-scroll to the new card

6. [[HomeFeedWithDrafts]] reads `?fresh=<id>` on mount, queries the DOM for `[data-card-id="<id>"]`, and runs the same double `scrollIntoView` pattern (120ms + 800ms) used previously for pending cards — handles the layout shift from lazy-loaded images above/below.
7. The URL param is then stripped via `replaceState` so back/forward doesn't re-trigger the scroll.

### Confirm → Cancel

- Cancel via `CANCELAR`, `ESC`, or backdrop click.
- Modal closes. The draft persists in `draftsCache` so the editor can re-trigger from the same form (it autosaves) or from the dashboard drafts list.

### Draft → Publish (from inside an overlay)

- The orange `SessionItemStrip` in [[OverlayShell]] still has `▶ PUBLICAR AHORA` for any open draft.
- `SessionItemStrip.handlePublish` calls `usePublishConfirm.openConfirm(item.id)` — same entry point the dashboard form uses. Modal opens on top of the overlay; confirm publishes + navigates to `/?fresh=<id>`. The overlay closes naturally when the URL changes.

### Published → Edit → Confirm again

- Click `EDITAR` in the published item's `SessionItemStrip` chrome.
- Routes to `/dashboard?type=<type>&edit=<id>`. Form hydrates via `useDraftWorkbench`'s `editItemId`.
- Editor edits, clicks `▶ PUBLICAR` → same confirm overlay → same `?fresh=<id>` landing.
- The DB upsert reuses the existing id; `_draftState` stays `'published'` throughout.

## Fresh-published chrome (the [NUEVO] hour)

For the first hour after publish, **editor-composed items only**, the [[ContentCard]] wrapper renders a glitch chrome:

- **Border pulse** — `fresh-border-pulse` keyframe (1.6s loop), color sourced from `--glitch-color` (the type's `categoryColor`).
- **Scanline sweep** — single thin band, top: -25% → 110% of card (parent-relative) over 2.4s. Earlier version used `transform: translateY(percentage)` which is element-relative and only travelled ~28% of the card; switched to animating `top` so the sweep covers the full card (fixed 2026-05-07).
- **Cover flicker** — CRT brightness/hue distortion, 3.2s loop with ~5%-of-cycle punches.
- **[NUEVO] chip** — type-coloured chip next to the type badge, with the `fresh-chip-flicker` opacity pulse.

### Predicate

```ts
const isEditorComposed = item.source !== 'scraper:ra'
const ageMs = Date.now() - Date.parse(item.publishedAt)
const isFresh = isEditorComposed && ageMs >= 0 && ageMs < ONE_HOUR_MS
```

`source === 'scraper:ra'` excludes the RA Mon/Wed/Fri batches (otherwise 100+ events would all glitch at once on scrape day). Seed data has stale `publishedAt` and naturally never qualifies.

### 1-hour expiry

[[ContentCard]] holds `isFresh` in `useState` and runs a single `setTimeout` for `(publishedAt + 1hr) - now` ms; on fire it flips `isFresh = false` and the chrome disappears. No `setInterval`, one shot per fresh card. If the user keeps the page open past the boundary the timer still fires.

## Components involved

- [[useDraftWorkbench]] (in [[Dashboard Forms]] / `Fields.tsx`) — `saveDraft()` and `requestPublish()` (returns id, doesn't actually publish)
- [[ContentCard]] — `isFresh` computation, `--glitch-color` CSS variable, [NUEVO] chip, per-card 1hr `setTimeout`
- [[HomeFeedWithDrafts]] — `?fresh=<id>` read + double-scroll + URL param cleanup
- [[PublishConfirmOverlay]] — globally-mounted modal; opens from form `onPublish` and from `SessionItemStrip` publish-now
- [[usePublishConfirm]] — context for modal open state
- [globals.css](../../app/globals.css) — `fresh-border-pulse`, `fresh-scanline-sweep`, `fresh-cover-flicker`, `fresh-chip-flicker` keyframes (parameterized via `--glitch-color`)

## Open

- The `_pendingConfirm` flag still exists on `ContentItem` but is unused by any rendering code. Worth a follow-up cleanup pass on the type definition + the defensive strip in `Fields.tsx:1140`.
- The fresh-chrome timer runs entirely client-side. If the user has no `publishedAt` or it's malformed, `freshAgeMs` returns null and the chrome is suppressed — defensive but worth surfacing if it ever triggers in the wild.

## Links

- [[Dashboard]] · [[Dashboard Forms]] · [[Dashboard Drafts]]
- [[ContentCard]] · [[OverlayShell]]
- [[drafts]] · [[VibeContext]]
- [[Open Questions]]
