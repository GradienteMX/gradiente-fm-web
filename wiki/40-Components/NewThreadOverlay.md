---
type: component
status: current
tags: [foro, composer, overlay]
updated: 2026-04-26
---

# NewThreadOverlay

> Modal composer for starting a foro thread. Login required, image required, 1–5 genres required, no anonymity.

## Source

[components/foro/NewThreadOverlay.tsx](../../components/foro/NewThreadOverlay.tsx)

## Required fields

| Field | Constraint |
|---|---|
| `subject` | non-empty, 140 char limit (counter shown) |
| `body` | non-empty |
| `imageUrl` | mandatory data URL — file picker or drag-drop |
| `genres` | 1–5 ids from [[genres]]; `FORO_THREAD_GENRES_MIN` / `MAX` from [[types]] |
| author | implicit `currentUser.id` — login is gated by [[ForoCatalog]] |

Submit button stays disabled until all five conditions hold. Attempting to add a 6th genre triggers `⚠ FALTA: Máximo 5 géneros.` (the picker rejects the click and shows the error, the chip count pins at 5/5).

## Genre picker

Inline implementation — doesn't reuse the dashboard's `GenreMultiSelect` since this picker enforces a max + colors chips by their vibe.

- Counter `N/5 · mín 1` in the section label
- Selected chips above the filter input — clickable to remove (with X icon)
- Filter input matches against name + id
- Chip grid below — clickable to toggle. Color-coded by `vibeForGenre(id)`, falling back to neutral grey for genres not in `GENRE_VIBE`.

## Image upload

Same `FileReader.readAsDataURL` path as the dashboard's [Dashboard Forms]] image field. Drag-drop on the form body works alongside the explicit file picker. Preview rendered with a `QUITAR` button.

## Submit flow

1. Validation: collects missing fields → `⚠ FALTA: …`.
2. Calls `addThread(thread)` — see [[foro]]. Thread id from `newThreadId()`.
3. Calls `onPosted(threadId)` (provided by [[ForoCatalog]]) which strips `?compose=1` and sets `?thread=<newId>` so the user lands directly on their new thread overlay.

## Links

- [[Foro]] · [[ForoCatalog]] · [[ThreadOverlay]]
- [[foro]] · [[genres]]
- [[useAuth]] — login gate
- [[Dashboard Forms]] — image upload pattern shared
