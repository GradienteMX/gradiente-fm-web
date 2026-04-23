---
type: page
status: current
tags: [page, noticias, news]
updated: 2026-04-22
---

# Noticias — `/noticias`

> News items only. Fast-cycling short-form.

## Source

[app/noticias/page.tsx](../../app/noticias/page.tsx)

## What

`filterForCategory(MOCK_ITEMS, 'noticia')` → [[ContentGrid]] in `mode="category"`.

## Copy

Header: `NOTICIAS · {count} ENTRADAS`
Empty: `// SIN NOTICIAS EN ESTE RANGO`

## Curation notes

Noticias have aggressive decay baked in:
- **Attention half-life: 48h** — they halve every 2 days. Fastest decay of any type.
- **Freshness half-life: 72h** — same idea on the freshness axis.
- **Score multiplier: 0.8** — downweighted vs. other text types.

So a noticia needs to be truly fresh (or `editorial: true`) to show up big on the home grid. See [[HP Curation System]].

## Links

- [[ContentGrid]]
- [[Content Types]]
- [[HP Curation System]]
