---
type: component
status: current
tags: [component, rail, navigation]
updated: 2026-04-22
---

# CategoryRail

> Sticky left-side rail on the home page with live counts per [[Content Types|content type]]. Visible only on `lg+` screens.

## Source

[components/CategoryRail.tsx](../../components/CategoryRail.tsx)

## Client component? No

Pure server render — counts computed from props.

## What it shows

A 100px-wide sticky nav (`top: 105px`, just below [[Navigation]] + [[VibeSlider]]) listing:

```
//EVENTO      12
//MIX          8
//REVIEW       3
//EDITORIAL    2
//NOTICIA      6
//OPINIÓN      1
```

Each row:
- Left: `//LABEL` in category color (from [`categoryColor`](../../lib/utils.ts))
- Right: count of filtered items of that type

Linked to `/agenda`, `/mixes`, `/reviews`, `/editorial`, `/noticias`, `/opinion`.

## Gotcha — `/opinion` doesn't exist

The rail includes `opinion` with an `/opinion` href, but there's no `app/opinion/page.tsx`. Clicking it → 404. Either:
1. Remove opinion from the rail, **or**
2. Create the page (same pattern as others, `filterForCategory(items, 'opinion')`).

See [[Open Questions]].

## Counts use the filtered items

The rail is passed `gridItems` (already filtered for home — upcoming, non-partner, non-hero). So the count reflects "how many of this type are currently in the home view", not "total in the database". Clicking through lands on the category page which re-filters from `MOCK_ITEMS` — counts may differ.

Intentional or accidental? Worth discussing. See [[Open Questions]].

## Links

- [[Home]]
- [[Content Types]]
- [[utils]]
