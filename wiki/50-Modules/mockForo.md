---
type: module
status: current
tags: [foro, mock-data, seed]
updated: 2026-04-26
---

# mockForo

> Seed threads + replies for the foro catalog. Fixed seed, layered under the [[foro]] sessionStorage shadow store.

## Source

[lib/mockForo.ts](../../lib/mockForo.ts)

## Threads (8)

| id | author | subject |
|---|---|---|
| `fr-001` | u-og-loma | ¿qué se siente realmente el "after" en CDMX? |
| `fr-002` | u-insider-tlali | recomienden vinilo mexicano de los 90s |
| `fr-003` | u-normal-meri | primera vez en Club Japan — qué esperar |
| `fr-004` | u-normal-yag | el sonido del jungle 92 se está reanimando |
| `fr-005` | u-mod-rumor | recordatorio · normas básicas del foro |
| `fr-006` | u-hzamorate | taller de modular en Roma Norte |
| `fr-007` | u-ikerio | tracklist del último mix de gradiente |
| `fr-008` | u-og-loma | la barra de Bahidorá fue el verdadero peak |

Each has 1–5 genres tagged from [[genres]]'s `GENRE_VIBE` map so the [[VibeSlider]] can filter them. Topics are picked to exercise plurality of voices (admin / mod / collaborator / OG / insider / normal user).

## Replies (16)

Reply ids follow the `fp-{threadShortRef}-NN` mock convention (e.g. `fp-001-01`, `fp-001-02`). Several replies use `>>id` quote-links (stored on `quotedReplyIds`) to exercise the backlinks system in [[ThreadOverlay]]:

- fr-001 has a depth-of-conversation thread with `>>fp-001-01` quoted by fp-001-02
- fr-003 has multi-quote (`>>fp-003-01 >>fp-003-02`) on fp-003-03

## Helpers

- `getReplyCount(threadId, replies)` — count for tile badge.
- `getRepliesForThread(threadId, replies)` — chronological list per thread.

Both pure — take the replies array as a param so [[foro]]'s hooks can pass merged mock+session data.

## Why fixed seed not generated

Same reasoning as [[mockComments]]: a curated seed exercises the UI with realistic plurality (depth-of-conversation hot-spots, multi-quote, role/category mix) and is reproducible across sessions. Generated mock data drifts and obscures regression visibility.

## Links

- [[foro]] — store that layers session writes on top of these seeds
- [[Foro]] · [[ForoCatalog]] · [[ThreadTile]] · [[ThreadOverlay]]
- [[mockUsers]] — author ids referenced here
- [[mockComments]] — same seed-data idiom for comments
