---
type: page
status: current
tags: [page, foro, imageboard, discussion]
updated: 2026-06-24
---

# Foro — `/foro`

> Imageboard-style discussion catalog. Threads sorted by bumpedAt desc, capped at 30 visible. Standalone subsystem — threads aren't `ContentItem`s, never enter the main grid, no HP/curation.

## Source

[app/foro/page.tsx](../../app/foro/page.tsx) — wraps [[ForoCatalog]] in Suspense (the catalog reads `?thread=` and `?compose=` via `useSearchParams`).

## What

Two-surface forum:

- **Catalog** — image-forward grid of [[ThreadTile]]. Cover image + subject + body preview + genre chips + tag chips + reply count + author + bumped time per tile. (Raw thread UUIDs are no longer shown anywhere in the UI.)
- **Thread overlay** — opens on `?thread=<id>`, see [[ThreadOverlay]]. OP at top (image gallery + rich body), replies flat (no nesting), reply composer pinned at bottom.

Click a tile → URL gains `?thread=fr-001` → overlay opens. Close → URL strips `?thread`. Same pattern as the rest of the site's contained-single-surface UX, just applied within the foro destination route.

## Why a separate route

The home grid is curated content (events, mixes, editorial). The foro is user-generated discussion that **doesn't compete for HP**. Putting threads alongside articles would either bury articles in user posts or force engagement metrics into the curated feed — both fight existing decisions ([[Guides Not Gatekeepers]], [[No Algorithm]]). A dedicated route keeps the two systems isolated.

## Catalog rules

- **Order:** bumpedAt desc only. New thread → bumpedAt = createdAt; new reply → parent thread's bumpedAt = reply.createdAt. No engagement scoring, no algorithm.
- **Cap:** 30 visible threads max ([`FORO_THREAD_CAP`](../../lib/foro.ts)). The catalog truncates the sorted list — older threads bump-off at the tail when newer ones bump up.
- **Vibe filter:** the [[VibeSlider]] applies on /foro. A thread passes if any of its tagged genres has `GENRE_VIBE` in the slider's `[min, max]` range. See `genresIntersectVibeRange` in [[genres]].
- **Search:** a text box in the catalog header narrows the loaded (already vibe-filtered) threads client-side, matching subject + genre/tag names and ids. Composes on top of the vibe filter; clear button resets.
- **Empty states:** `// FORO VACÍO` (no threads at all), `// SIN HILOS EN ESTE RANGO DE VIBE` (vibe-filtered out), or `// SIN RESULTADOS PARA «…»` (search miss).

## Thread creation rules

[[NewThreadOverlay]] enforces:

- **Login required** — anon posting is rejected by design. The "+ NUEVO HILO" button opens [[LoginOverlay]] when logged out.
- **Images: 1–`FORO_THREAD_IMAGES_MAX` (5)** — OP must include at least one image; pick/drag several at once, remove any, promote any to cover. The first image is the cover (`image_url`); the full ordered gallery is stored in `image_urls` (migration `0037`). Cover renders floated in the OP, the rest as a thumbnail strip; any image opens in the [[ForoLightbox]].
- **Genres: 1–5** — `FORO_THREAD_GENRES_MIN = 1`, `MAX = 5`. Drives the vibe filter; without a genre tag a thread can't be filtered out, but the picker still requires at least one for consistency.
- **Tags: 1–5** — `FORO_THREAD_TAGS_MIN/MAX`. Metadata keywords from `TAGS` in [[genres]] (transversal qualities, no vibe), stored in `foro_threads.tags`. Required, enforced in the composer and the POST route.
- **No anonymity** — author is `currentUser.id`, no toggle.

## Reply rules

[[ReplyComposer]]:

- Login required (logged-out viewers see `[+] INICIA SESIÓN PARA RESPONDER`).
- One optional image/gif (GIFs pass through uncompressed via [[imageUpload]]). Opens in the [[ForoLightbox]] on click.
- `>>id` quote-tokens parsed from body via `/>>([a-z0-9-]+)/gi`, stored on `reply.quotedReplyIds`. Still the underlying mechanism, but **rendered as the cited author's `@username`** (short-id fallback) in [[ThreadOverlay]] — the raw UUID is never shown. Click still scroll-and-pulses the cited post; backlinks ("respondieron:") use the same labels.

## Rich body (OP + replies)

`BodyText` in [[ThreadOverlay]] tokenizes post/reply text and promotes:

- **Bare URLs** → clickable anchors (`target=_blank`, `rel=noopener`).
- **YouTube URLs** (`watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`) → inline 16:9 player right where pasted.
- **`>>id` quotes** → `@username` buttons (see above).

Plain text keeps `whitespace-pre-wrap`; the wrapper is a `<div>` so block-level embeds are valid children.

## URL state

- `?thread=<id>` — opens thread overlay
- `?compose=1` — opens new-thread overlay (auth-gated)

Both managed via `router.replace` in [[ForoCatalog]] so the URL is the source of truth and back/forward navigates between catalog and overlay.

## Session id format

Mirrors mock convention so user-authored ids look the same as seeds:

- New thread: `fr-s01`, `fr-s02`, … (counter from `addedThreads.length + 1`)
- New reply: `fp-{threadShortRef}-s01` — e.g. for `fr-003`, replies become `fp-003-s05` (continuing past the 4 mock replies). For session thread `fr-s01`, replies become `fp-s01-s01`.

The `s` marker prevents collision if seed numbering is later extended. See `newThreadId` / `newReplyId` in [[foro]].

## Nav

`/foro` lives at code `07` in [[Navigation]]'s NAV_LINKS, between `/articulos` (06) and the auth badge.

## Links

- [[ForoCatalog]] · [[ThreadTile]] · [[ThreadOverlay]] · [[NewThreadOverlay]] · [[ReplyComposer]] · [[PostHeader]] · [[ForoLightbox]]
- [[foro]] — sessionStorage store + hooks
- [[mockForo]] — 8 seed threads + 16 seed replies
- [[Vibe Spectrum]] · [[genres]] — vibe + genre tagging shared with [[Content Types]]
- [[Contained Single Surface]] · [[Guides Not Gatekeepers]] · [[No Algorithm]]
