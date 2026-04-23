---
type: page
status: current
tags: [page, editorial]
updated: 2026-04-22
---

# Editorial — `/editorial`

> Editorials only. Long-form, staff-written pieces.

## Source

[app/editorial/page.tsx](../../app/editorial/page.tsx)

## What

`filterForCategory(MOCK_ITEMS, 'editorial')` → [[ContentGrid]] in `mode="category"`.

No calendar, no hero, no rails. Just the grid.

## Copy

Header: `EDITORIAL · TEXTOS & OPINIÓN · {count} ENTRADAS`
Empty: `// SIN EDITORIALES EN ESTE RANGO`

Note: the tagline says "TEXTOS & OPINIÓN" but the filter is `'editorial'` only — `opinion` type is not shown here. There's no `/opinion` route. Either the tagline needs updating or an opinion route needs adding. See [[Open Questions]].

## Links

- [[ContentGrid]]
- [[Content Types]]
- [[Editorial Flag]]
