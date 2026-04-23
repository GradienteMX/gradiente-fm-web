---
type: page
status: current
tags: [page, reviews]
updated: 2026-04-22
---

# Reviews — `/reviews`

> Record and event reviews. Highest score multiplier of any text type.

## Source

[app/reviews/page.tsx](../../app/reviews/page.tsx)

## What

`filterForCategory(MOCK_ITEMS, 'review')` → [[ContentGrid]] in `mode="category"`.

## Copy

Header: `REVIEWS · RESEÑAS · {count} ENTRADAS`
Empty: `// SIN REVIEWS EN ESTE RANGO`

## Curation notes

Reviews get the highest cross-type score multiplier: **1.3**. Combined with a 14-day attention half-life, they linger on the home grid longer than most other content. This is intentional — reviews are the most "evergreen" text content on the site.

See [[HP Curation System]].

## Links

- [[ContentGrid]]
- [[Content Types]]
- [[HP Curation System]]
