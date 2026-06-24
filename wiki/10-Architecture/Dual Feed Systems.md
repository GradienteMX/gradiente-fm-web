---
type: architecture
status: current
tags: [components, rendering]
updated: 2026-06-23
---

# Dual Feed Systems

> Historical note. There is no longer a dual feed. `ContentGrid` (the HP-driven mosaic) is the sole feed system.

## Resolution (2026-06-23)

The orphaned linear feed was **deleted as dead code**:

- `ContentFeed` — flat date-grouped column, never wired to any page (0 importers)
- `EventCard`, `MixCard`, `ArticleCard` — its row-style per-type cards (only `ContentFeed` imported them)

These compiled and type-checked but were never wired into `/app/**`. They were an earlier/alternative design fully superseded by the mosaic, so they were removed rather than kept rotting.

## The surviving system

- [[ContentGrid]] — CSS grid with `grid-auto-flow: dense`; card size = HP score tier
- [[ContentCard]] (sm/md/lg tiered) — single image-forward template
- Driven by [[HP Curation System]]
- Framer Motion `layout` animations with directional easing (growth fast, shrink slow)

**Used by:** every page in `/app/**`. This is now the only render path for `ContentItem`, so adding a field to `ContentItem` no longer means chasing two renderers.

## Links

- [[ContentGrid]]
- [[ContentCard]]
- [[HP Curation System]]
