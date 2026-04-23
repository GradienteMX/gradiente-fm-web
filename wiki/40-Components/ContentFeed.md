---
type: component
status: stale
tags: [component, feed, orphan, tech-debt]
updated: 2026-04-22
---

# ContentFeed

> **Orphaned.** An alternative linear (non-mosaic) feed renderer. Not imported by any page. See [[Dual Feed Systems]].

## Source

[components/ContentFeed.tsx](../../components/ContentFeed.tsx)

## What it does (if wired)

- Takes `ContentItem[]` + `mode: 'home' | 'category'`
- Filters by vibe range from [[VibeContext]]
- Pins `selectedDate` items to top
- In `home` mode, groups by date with a `DateDivider`:
  ```
  // JUEVES 18 DE ABRIL ──────
  [EventCard]
  [MixCard]
  [ArticleCard]
  // VIERNES 19 DE ABRIL ─────
  ...
  ```
- In `category` mode, flat list

## Card dispatch

```ts
function renderCard(item) {
  switch (item.type) {
    case 'evento': return <EventCard item={item} />
    case 'mix':    return <MixCard item={item} />
    default:       return <ArticleCard item={item} />
  }
}
```

Routes to type-specific row components instead of the size-tiered [[ContentCard]].

## Why it's orphaned

The project switched to the mosaic approach ([[ContentGrid]] + [[ContentCard]]). This file + [[EventCard]], [[MixCard]], [[ArticleCard]] remained. See [[Dual Feed Systems]] for the fuller discussion.

## Decision needed

Delete, resurrect as a toggleable view, or leave as parked. Flag for team.

## Links

- [[Dual Feed Systems]]
- [[EventCard]]
- [[MixCard]]
- [[ArticleCard]]
- [[ContentGrid]]
- [[ContentCard]]
