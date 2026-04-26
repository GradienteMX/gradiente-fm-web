---
type: component
status: current
tags: [foro, catalog, tile]
updated: 2026-04-26
---

# ThreadTile

> Single thread card in the [[ForoCatalog]] grid. Image-forward. Reply count is the only ranking signal allowed.

## Source

[components/foro/ThreadTile.tsx](../../components/foro/ThreadTile.tsx)

## Layout

Image fills a square aspect-ratio top half. Subject + body preview + genre chips + author + bumped time below.

## Chips on image

- **Top-left:** `R·NN` reply count. Border + text orange when `replyCount > 0`, neutral when zero. Only visible discussion signal — see [[Size and Position as Only Signals]].
- **Top-right (session threads only):** `SESIÓN` chip in green so the user can spot their own additions in a tab.
- **Bottom-left:** `//FR-XXX` thread id chip — handy when the user is debugging or sharing.

## Genre chips

Below the body preview: first 2 thread genres, plus `+N` overflow indicator. Color-coded by `GENRE_VIBE` so a single glance reads the thread's spectral position. Full chip list shows in the [[ThreadOverlay]] OP article.

## Click target

Wraps the whole tile in a `<Link href="/foro?thread=<id>">`. The catalog (router) reads `?thread=` and opens [[ThreadOverlay]]. No JS-side click handler needed.

## Hover

Border tints to sys-orange; subject color shifts to sys-orange; image scales 1.02. Subtle, terminal-aesthetic — no card lift.

## Links

- [[Foro]] · [[ForoCatalog]] · [[ThreadOverlay]]
- [[mockUsers]] — author lookup for `@username`
- [[genres]] · [[Vibe Spectrum]] — chip colors
