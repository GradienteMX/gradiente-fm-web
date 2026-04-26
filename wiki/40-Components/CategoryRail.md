---
type: component
status: current
tags: [component, rail, filter, contained-surface]
updated: 2026-04-25
---

# CategoryRail

> Sticky left-side rail on the home page. **In-page filter** for the home grid by content type — clicking a category narrows the feed in place rather than navigating to a new route. Visible only on `lg+` screens.

## Source

[components/CategoryRail.tsx](../../components/CategoryRail.tsx)

## Client component? Yes (since 2026-04-25)

Reads `categoryFilter` and `setCategoryFilter` from [[VibeContext]]. Was previously server-rendered with `<a href>` links to dedicated routes.

## What it shows

A ~120px-wide sticky nav (`top: 105px`, just below [[Navigation]] + [[VibeSlider]]) listing:

```
SECCIÓN                 [×]
//TODOS    76    ← active when no filter
//EVENTO   20
//MIX      15
//REVIEW   14
//EDITORIAL 10
//ARTÍCULO  4
//LISTA     3
//NOTICIA   5
//OPINIÓN   5
```

Each row is a `<button>` toggle:
- **Click** → set this type as the active filter
- **Click again on the active type** → clear the filter
- **`//TODOS`** → pseudo-row at top, always clears the filter

Visual feedback:
- Active row: tinted background in the category's color, count in the same color
- Inactive rows: dim to 40% opacity when any filter is active (focus signal)
- `×` clear affordance in the SECCIÓN header — visible only when a filter is active, second exit alongside clicking-active-again

## Why in-page (since 2026-04-25)

Per [[Contained Single Surface]] — the page is one continuous surface; navigation away breaks the terminal idiom. Filtering in place is the same affordance as the [[VibeSlider]] does for vibe ranges and [[CalendarSidebar]] does for dates: subtractive client-side filters that compose on top of the same grid.

## How the filter propagates

1. `setCategoryFilter(type)` from this rail
2. [[VibeContext]] holds the state
3. [[ContentGrid]] reads `categoryFilter` and adds it to the filter pipeline (only on `mode === 'home'`)
4. [[HeroCard]] also reads it and returns `null` if its type doesn't match
5. [[FeedHeader]] swaps to `//SUBSISTEMA · FILTRADO · {TYPE}` to reflect the focus
6. Card exit/enter animations in [[ContentGrid]] (Framer `<AnimatePresence mode="popLayout">`) make the transition feel deliberate, not snappy

## Dedicated routes still exist

`/agenda`, `/mixes`, `/reviews`, `/editorial`, `/articulos`, `/noticias`, `/opinion` are intentionally preserved for deep-linking, bookmarking, and SEO. The rail just no longer points to them — it's an in-page filter, the routes are the share-link surface. Editorial decision (2026-04-25).

## Counts reflect the home-feed input

The rail is passed `gridItems` (already filtered for home — upcoming, non-partner, non-hero). So the count reflects "how many of this type are currently in the home view", not "total in the database". When a filter is set, the visible card count drops to match the filtered type's row count. (TODOS shows the unfiltered total; that doesn't change as you flip filters.)

## Bottom panels

Two decorative subsystem panels below the nav: a `WAVEFORM·10-A` placeholder ([[Waveform]]) and an `ANALIZANDO·ESPECTRO` SVG curve. Static for now — will become reactive when the audio session lands. See [[Open Questions]] (audio-context session).

## Links

- [[Home]]
- [[VibeContext]] — holds `categoryFilter`
- [[ContentGrid]] — applies the filter
- [[FeedHeader]] — reflects the filter in the header strip
- [[HeroCard]] — hides when filter doesn't match
- [[Contained Single Surface]] — the underlying philosophy
- [[Content Types]]
