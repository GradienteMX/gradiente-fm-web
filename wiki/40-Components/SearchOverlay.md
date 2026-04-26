---
type: component
status: current
tags: [search, overlay, modal, keyboard]
updated: 2026-04-25
---

# SearchOverlay

> Terminal-style command-bar overlay for site search. Invoked by the `/` keyboard shortcut from anywhere. Mounted globally in [[layout]] alongside the other globals ([[LoginOverlay]], [[PublishConfirmOverlay]], [[OverlayRouter]]).

## Source

- [components/search/SearchOverlay.tsx](../../components/search/SearchOverlay.tsx) — the panel
- [components/search/useSearch.tsx](../../components/search/useSearch.tsx) — context provider + the global `/` listener

## What

Pure-substring search across mocked + draft items, rendered as a focused subsystem (same idiom as [[FeedHeader]]'s `//SUBSISTEMA · FILTRADO · X` line, here `//SUBSISTEMA · BÚSQUEDA · 'query' // N RESULTADOS`).

Per the discovery-vs-search reconciliation: search is an **invoked mode**, not a default top-bar input. No engagement-driven autocomplete, no ranking — order matches corpus order. Type-specific surfaces and the in-page category filter remain the primary navigation; search is the typed escape hatch for "I know what I'm looking for".

## How it opens

`/` → opens the overlay anywhere on the site. The listener:
- Skips when the keyboard event target is `<input>` / `<textarea>` / `<select>` / `contenteditable` (so writing `/` in form fields works as expected)
- Skips when modifier keys are held (so OS shortcuts pass through)
- `preventDefault()`s only when actually opening, so unrelated `/` keystrokes don't get eaten

## Corpus

Two sources, deduped by `slug` (drafts win — an editor's working copy beats the seeded version):
- `MOCK_ITEMS` from [[mockData]]
- `useDraftItems()` from [[drafts]] (sessionStorage)

`partner` items are filtered out (sponsor-rail content, never surfaced through the main reading flow — see [[Partners Isolation]]).

## Match algorithm

Substring against a per-item haystack: `title + subtitle + excerpt + author + venue + artists.join(' ')`. Lower-cased. First N hits, capped at 30 — beyond that, "REFINA EL TÉRMINO" footer prompts the user to narrow.

## Result rows

Each row:
- Type chip — bordered, in the [[Color System]] category color (`categoryColor(item.type)`), label like `//EVENTO`, `//MIX`
- Title (mono, primary)
- Secondary line per type — venue + first 3 artists for `evento`, first 3 artists for `mix`, author/subtitle/excerpt for editorial-family
- `[↵]` chevron on the selected row

## Keyboard model

- `↑` / `↓` — move selection (clamped at boundaries; reset to 0 when query changes)
- `Enter` — close search and open the selected item via [[useOverlay]] (same flow a card-click takes; URL syncs to `?item=`)
- `Esc` — close
- Mouse hover updates selection, so keyboard nav resumes from where the cursor was

The arrow/Enter/Esc handlers are bound at the window level so they keep working when focus drifts (e.g., after hovering a row).

## Chrome

Borrows the panel chrome from [[LoginOverlay]] / [[PublishConfirmOverlay]] for coherence:
- `eva-box eva-scanlines overlay-panel-in` panel on a `bg-black/75 backdrop-blur-md` backdrop
- Header chip `//BÚSQUEDA` in EVA orange (`#F97316`), `[ESC] CERRAR` right
- Body scroll lock while open

Anchored to the top of the viewport (`pt-20 items-start`) rather than centered — feels more like a command palette than a dialog.

## Provider placement

`<SearchProvider>` lives inside `<OverlayProvider>` (since [[SearchOverlay]] uses both contexts) and outside `<CRTOverlay>` (so its state survives CRT mode flips — same reasoning as the other providers). See [[layout]].

## Links

- [[useOverlay]] · [[OverlayRouter]] — opens content
- [[FeedHeader]] — visual idiom for the subsystem header
- [[Contained Single Surface]] — why Enter opens an overlay, not a route
- [[mockData]] · [[drafts]] — corpus sources
