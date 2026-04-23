---
type: architecture
status: current
tags: [tech-debt, components, rendering]
updated: 2026-04-22
---

# Dual Feed Systems

> Two independent presentation systems live in `/components`. Only one is wired to pages. The other is orphaned.

## The two systems

### 1. Mosaic (active)

- [[ContentGrid]] — CSS grid with `grid-auto-flow: dense`
- [[ContentCard]] (sm/md/lg tiered)
- Driven by [[HP Curation System]] — card size = score tier
- Framer Motion `layout` animations with directional easing (growth fast, shrink slow)

**Used by:** every page in `/app/**`.

### 2. Linear feed (orphaned)

- [[ContentFeed]] — flat column, optional date-grouping for home mode
- [[EventCard]], [[MixCard]], [[ArticleCard]] — row-style cards
- No HP-driven sizing — just date order + vibe filter
- Date dividers for home mode only

**Used by:** nothing. Zero imports found in `app/`.

## Why both exist

The linear feed appears to be an **earlier or alternative design** that was fully implemented and then replaced by the mosaic. It still compiles, type-checks, and renders if you wire it up — it just isn't wired.

Evidence:
- Both systems consume the same `ContentItem` shape and [[VibeContext]].
- Both apply the same vibe filter + selected-date pinning logic, duplicated.
- The linear cards have richer per-type treatments (artists row, fake waveform for mixes, hazard stripe for vibe ≥ 9) that the mosaic `ContentCard` absorbed into a single template.

## What to do

Three options, pick one:

1. **Delete the orphans.** Cleanest. Removes ~500 lines of dead code.
2. **Promote it to a toggle** — add a `view: 'mosaic' | 'list'` preference. Mosaic is striking; list is faster to scan. Could live in [[VibeContext]].
3. **Keep as-is.** No immediate harm, but rot accumulates — the next person who edits `ContentItem` has to chase two render paths.

Flag for team discussion. See [[Open Questions]].

## Gotcha

If you add a new field to `ContentItem`, you have to decide whether the linear cards need to render it too. Right now nobody looks at them, so the linear renderers silently drift.

## Links

- [[ContentGrid]]
- [[ContentCard]]
- [[ContentFeed]]
- [[EventCard]]
- [[MixCard]]
- [[ArticleCard]]
- [[Open Questions]]
