---
type: page
status: current
tags: [page, home, portada]
updated: 2026-05-07
---

# Home — `/`

> The one page that isn't a category filter. Portada hero + HP-curated mosaic + left category rail + scraped-events rail + right partners rail.

## Source

[app/page.tsx](../../app/page.tsx)

## Layout

```
┌─────────────────────────────────────────────────────────┐
│ Navigation (from layout.tsx)                            │
│ VibeSlider  (from layout.tsx)                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──CategoryRail──┬──Main column──┬──PartnersRail──┐    │
│  │  (sticky, lg+) │               │  (hidden, md+) │    │
│  │                │  HeroCard     │                │    │
│  │  EVENTO  12    │               │  partner 1     │    │
│  │  MIX      8    │  EventosRail  │  partner 2     │    │
│  │  REVIEW   3    │  (auto-scroll │  partner 3     │    │
│  │  …             │   marquee)    │                │    │
│  │                │               │                │    │
│  │                │  ContentGrid  │                │    │
│  │                │  (mosaic)     │                │    │
│  └────────────────┴───────────────┴────────────────┘    │
│                                                         │
│  Footer                                                 │
└─────────────────────────────────────────────────────────┘
```

## Data pipeline

```ts
const homeItems  = filterForHome(allItems, now)  // upcoming only, date ASC
const hero       = getPinnedHero(allItems)       // single portada item

const partners = allItems.filter(i => i.type === 'partner')
const gridItems = homeItems.filter(i =>
  i.type !== 'partner' && (!hero || i.id !== hero.id)
)
```

- **`homeItems`** excludes expired events and expired articles.
- **`hero`** is pulled from the full `allItems` (pinned items aren't subject to "upcoming" filter).
- **`gridItems`** excludes the hero to prevent double-render.
- **Partners** are routed to the [[PartnersRail]], never into the grid — see [[Partners Isolation]].

## Components used

- [[CategoryRail]] — shows counts per type, links to category pages
- [[HeroCard]] — the single pinned item
- [[EventosRail]] — auto-scrolling rail of scraped events under the hero
- [[ContentGrid]] with `mode="home"` — HP-curated mosaic
- [[PartnersRail]] — chronological, isolated

## "TODO LO QUE VIENE"

The main feed header reads: `TODO LO QUE VIENE · {count} ENTRADAS · PROMINENCIA ORGÁNICA · SEÑAL + FRESCURA`.

That tagline encodes the ranking philosophy in three Spanish system-voice tokens:
- **prominencia orgánica** = HP + score (see [[HP Curation System]])
- **señal** = editorial value (score multipliers, `editorial: true`)
- **frescura** = recency decay

See [[Voice and Copy]] for more examples.

## Links

- [[Pinned Hero]]
- [[ContentGrid]]
- [[HP Curation System]]
- [[Partners Isolation]]
- [[VibeContext]]
