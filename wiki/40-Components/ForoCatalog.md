---
type: component
status: current
tags: [foro, catalog, page-body]
updated: 2026-04-26
---

# ForoCatalog

> Body of [[Foro]]. Renders header strip, threads grid, vibe-filtered, plus the URL-driven thread + compose overlays.

## Source

[components/foro/ForoCatalog.tsx](../../components/foro/ForoCatalog.tsx)

## What it does

- Reads `useThreads()` from [[foro]] (sorted, capped at 30).
- Reads `vibeRange` from [[VibeContext]]; filters threads via `genresIntersectVibeRange` from [[genres]] when range is narrower than `[0, 10]`.
- Reads `?thread=<id>` and `?compose=1` from `useSearchParams`. Mounts [[ThreadOverlay]] / [[NewThreadOverlay]] accordingly.
- Header strip shows `HILOS · NN/30` (or `NN/MM EN RANGO` when filtered) + the `+ NUEVO HILO` trigger.
- Empty states differentiate:
  - `// FORO VACÍO` (zero threads at all)
  - `// SIN HILOS EN ESTE RANGO DE VIBE` (filter excludes all)

## URL state management

`replaceParams(mutate)` helper that takes a function mutating a `URLSearchParams`, then calls `router.replace` with `{ scroll: false }`. Used by `closeThread`, `closeCompose`, `openCompose`, and `onPosted` (which atomically swaps `?compose=1` for `?thread=<newId>` when a thread is posted, so the overlay flips straight to the thread view).

## Login gate on NUEVO HILO

The trigger calls `openCompose`, which calls `useAuth().openLogin()` if the user isn't authed. Logged-out users get pushed to [[LoginOverlay]] instead of opening a useless empty composer.

## Grid

Responsive: `grid-cols-2 sm:3 md:4 lg:5 xl:6`. Image-forward tiles via [[ThreadTile]]. Catalog never paginates — the cap is the cap.

## Links

- [[Foro]] · [[ThreadTile]] · [[ThreadOverlay]] · [[NewThreadOverlay]]
- [[foro]] — store
- [[VibeSlider]] · [[genres]] — vibe filter
- [[useAuth]] — login gate on compose trigger
