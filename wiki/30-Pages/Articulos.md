---
type: page
status: current
tags: [page, articulo, longform]
updated: 2026-04-23
---

# Artículos — `/articulos`

> Longform features only. Substack-style deep-dives — reported essays, interviews, curated criticism.

## Source

[app/articulos/page.tsx](../../app/articulos/page.tsx)

## What

`filterForCategory(MOCK_ITEMS, 'articulo')` → [[ContentGrid]] in `mode="category"`.

No calendar, no hero, no rails. Just the grid.

Cards open the [[ArticuloOverlay]] — a dedicated longform reader (not [[ReaderOverlay]]) with sticky TOC, pull-quotes, footnotes, and curated `SIGUIENTES·LECTURAS`.

## Copy

Header: `ARTÍCULOS · LONGFORM · {count} ENTRADAS`
Empty: `// SIN ARTÍCULOS EN ESTE RANGO`

## How articulo differs from editorial as a page

Both pages filter to a single type. The difference lives in content + overlay:

- `/editorial` → [[ReaderOverlay]]. Shorter, curatorial/positional essays. Flyer demoted to archival rail.
- `/articulos` → [[ArticuloOverlay]]. Longer reported work. Hero image leads. Structured `articleBody` supports sections, pull-quotes, Q&A, footnotes.

## Links

- [[ContentGrid]]
- [[ArticuloOverlay]]
- [[Content Types]]
