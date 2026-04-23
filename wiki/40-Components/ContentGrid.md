---
type: component
status: current
tags: [component, grid, mosaic, curation, layout-animation]
updated: 2026-04-22
---

# ContentGrid

> The mosaic. HP-driven card sizing + Framer Motion shared-layout animations with directional easing.

## Source

[components/ContentGrid.tsx](../../components/ContentGrid.tsx)

## Client component? Yes

Reads [[VibeContext]] for filtering and uses `motion.div layout` for animations.

## What it does

Takes a list of `ContentItem[]` and renders them into a CSS grid where:
- Each item's **size** (sm/md/lg) is determined by its score in [[HP Curation System]].
- Items are **sorted** by `prominence` descending (home mode) or by date (category mode).
- Layout changes **animate** when the user moves the vibe slider or picks a date.

## The pipeline inside

```
items (props)
    │
    ▼ filterByVibe(items, vibeRange)       ← reads VibeContext
    │
    ▼ mode === 'home'
    │   ? rankItems(...) + calendar pin    ← HP curation
    │   : rankItems(...) then sort DESC by date
    │
    ▼ ranked: RankedItem[]
    │
    ▼ mapped to <MosaicItem> per id
    │
    └▶ <ContentCard item size={tier} />
```

## The grid

```css
display: grid
grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))
grid-auto-rows: minmax(220px, auto)
grid-auto-flow: dense    ← critical: fills gaps
gap: clamp(8px, 1vw, 16px)
container-type: inline-size   ← future-proofing for container queries
```

`grid-auto-flow: dense` means when a 2×2 card appears, subsequent 1×1 cards fill gaps behind/around it. Without it, large cards would leave holes.

## Layout animations

Each card is a `motion.div` with `layout` and `layoutId`. Framer Motion tracks position/size across renders and animates transitions. Transitions differ by direction:

| Direction | Duration | Easing |
|---|---|---|
| First mount | 400ms | `easeOut` |
| **Growth** (area increased) | 400ms | `easeOut` — fast, confident |
| **Shrink** (area decreased) | 700ms | `easeIn` — slow, quiet |
| Same area | 600ms | `easeInOut` |

The rationale ([`MosaicItem` comment](../../components/ContentGrid.tsx)): "Growth: fast/confident. Shrink: slow/quiet."

Implementation uses a `useRef<Map<id, {colSpan, rowSpan}>>` to snapshot previous spans before each render, then picks the easing.

## The `--prominence` CSS variable

Each card sets `--prominence: {0..1}` based on its intra-tier intensity, and uses it for:
- `padding: calc(var(--prominence) * 0.25rem)` — subtle inset
- `transform: scale(calc(0.98 + --prominence * 0.04))` — up to 2% scale

So a card at the top of its tier is almost imperceptibly larger than one at the bottom. Design nuance you feel without reading.

## Calendar pinning

When `selectedDate` is set in [[VibeContext]], items matching that date are pulled to the front of the ranked list (preserving order within each group). Provides a "show me this day + the rest still visible" mode rather than a hard filter.

## Empty state

Both the grid and the linear feed show hazard stripes framing `// SIN CONTENIDO EN ESTE RANGO DE VIBE` when filtered to empty. See [[Utility Classes]].

## Links

- [[ContentCard]]
- [[VibeContext]]
- [[HP Curation System]]
- [[curation]]
- [[Dual Feed Systems]]
