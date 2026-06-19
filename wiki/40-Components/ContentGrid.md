---
type: component
status: current
tags: [component, grid, mosaic, curation, layout-animation]
updated: 2026-06-12
---

# ContentGrid

> The mosaic. HP-driven card sizing + Framer Motion layout animations under one rule: **position interpolates, size quantizes**.

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

> **Redesign 2026** (motion constitution): *position interpolates, size quantizes*. The old directional-easing scheme (400ms growth / 700ms shrink / 600ms same-area, picked via a `useRef<Map>` span snapshot) is deleted along with its direction-tracker machinery.

Each card is a `motion.div` with `layout="position"` — Framer Motion animates **position only**. Size changes between tiers **snap** (an HP tier is a state, not a momentum; also avoids text squish during span changes) while the surrounding field slides to absorb them.

| Motion | Treatment |
|---|---|
| Position (reflow) | one transition: 250ms `easeOut` |
| Size (tier change) | instant snap |
| Entrant (mount) | stepped opacity — 4 hard steps (0 → ⅓ → ⅔ → 1), 280ms, 40ms stagger capped at index 8. Signal acquisition, not a fade. No scale-in: cards CUT in, they do not grow. |
| Exit | instant unmount (no AnimatePresence — see the in-file comment on the popLayout bug) |
| `prefers-reduced-motion` | `layout={false}` — the position slide is disabled; the opacity-only reveal stays |

## The `--prominence` CSS variable

Each card still sets `--prominence: {0..1}` from its intra-tier intensity, but it currently has **no visual consumer** — the old standing-scale breathing (`scale(0.98 + p*0.04)`) and prominence padding were removed in Redesign 2026. The variable is kept as a hook for future shader/treatment work; don't remove it without checking [[ContentCard]] + CSS.

## Empty state

Both the grid and the linear feed show hazard stripes framing `// SIN CONTENIDO EN ESTE RANGO DE VIBE` when filtered to empty. See [[Utility Classes]].

## Links

- [[ContentCard]]
- [[VibeContext]]
- [[HP Curation System]]
- [[curation]]
- [[Dual Feed Systems]]
