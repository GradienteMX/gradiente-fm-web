---
type: page
status: current
tags: [page, home, portada]
updated: 2026-04-22
---

# Home — `/`

> The one page that isn't a category filter. Portada hero + HP-curated mosaic + left category rail + right partners rail + slide-in calendar.

## Source

[app/page.tsx](../../app/page.tsx)

## Layout

```
┌─────────────────────────────────────────────────────────┐
│ Navigation (from layout.tsx)                            │
│ VibeSlider  (from layout.tsx)                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [◀CalendarSidebar]  — slides in from left, hidden by   │
│                        default, toggled from top-left   │
│                                                         │
│  ┌──CategoryRail──┬──Main column──┬──PartnersRail──┐    │
│  │  (sticky, lg+) │               │  (hidden, md+) │    │
│  │                │  HeroCard     │                │    │
│  │  EVENTO  12    │               │  partner 1     │    │
│  │  MIX      8    │  "TODO LO QUE │  partner 2     │    │
│  │  REVIEW   3    │   VIENE"      │  partner 3     │    │
│  │  …             │               │                │    │
│  │                │  ContentGrid  │                │    │
│  │                │  (mosaic)     │                │    │
│  └────────────────┴───────────────┴────────────────┘    │
│                                                         │
│  Footer                                                 │
└─────────────────────────────────────────────────────────┘
```

## Data pipeline

```ts
const homeItems  = filterForHome(MOCK_ITEMS, now)  // upcoming only, date ASC
const eventDates = getEventDates(MOCK_ITEMS)       // for calendar dots
const hero       = getPinnedHero(MOCK_ITEMS)       // single portada item

const partners = MOCK_ITEMS.filter(i => i.type === 'partner')
const gridItems = homeItems.filter(i =>
  i.type !== 'partner' && (!hero || i.id !== hero.id)
)
```

- **`homeItems`** excludes expired events and expired articles.
- **`hero`** is pulled from the full `MOCK_ITEMS` (pinned items aren't subject to "upcoming" filter).
- **`gridItems`** excludes the hero to prevent double-render.
- **Partners** are routed to the [[PartnersRail]], never into the grid — see [[Partners Isolation]].

## Components used

- [[CalendarSidebar]] — date filter via [[VibeContext]]
- [[CategoryRail]] — shows counts per type, links to category pages
- [[HeroCard]] — the single pinned item
- [[ContentGrid]] with `mode="home"` — HP-curated mosaic, groups pinned-date items first when calendar has a selected date
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
