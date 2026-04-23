---
type: component
status: current
tags: [component, vibe, filter, slider]
updated: 2026-04-22
---

# VibeSlider

> Sticky dual-handle range slider across a neon-striped gradient band. Writes to [[VibeContext]].

## Source

[components/VibeSlider.tsx](../../components/VibeSlider.tsx)

## Client component? Yes

Owns pointer drag state via refs, listens on `window` pointer events.

## Anatomy

```
┌──────────────────────────────────────────────────────┐
│ VIBE                                       [RESET]   │  ← header row
├──────────────────────────────────────────────────────┤
│         GLACIAL ──────────── VOLCÁN                  │  ← handle labels
│  ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱       │  ← neon stripe band
│         │                       │                    │  ← handles (3px white)
├──────────────────────────────────────────────────────┤
│ Ambient · Lo-Fi · Organic House · Deep House · …     │  ← genre chips in range
└──────────────────────────────────────────────────────┘
```

Sticks below [[Navigation]] at `top: 76px` so both remain visible while scrolling.

## Interaction model

- **Drag a handle** → updates `vibeRange`
- **Click on the track** → moves the nearer handle to that position
- **RESET** button appears when range is not `[0, 10]`, restores full range

Each handle is a 6px-wide invisible pointer target wrapping a 3px white visible mark. Makes it touchable on mobile without a huge visual footprint.

## The stripe band

Two layered backgrounds:
1. `STRIPE_MASK` — 45° repeating transparent/black stripes (9px on, 9px off)
2. `NEON_GRADIENT` — 8-stop horizontal gradient cyan → blue → purple → magenta → red

Combined via CSS layering, then clipped to `[minPercent, maxPercent]` with `clip-path: inset()`. Outside the range, only the stripe mask is visible (mostly black). Inside, the neon shows through the gaps.

Transition: `clip-path 75ms linear` — the clip animates smoothly as you drag.

## The 11 slot names

```
0 GLACIAL  1 POLAR  2 CHILL   3 COOL   4 FRESH   5 GROOVE
6 WARM     7 HOT    8 FUEGO   9 BRASA  10 VOLCÁN
```

Different from the 8-label shorter scale in [utils.ts::vibeToLabel](../../lib/utils.ts) — this one has finer granularity because the slider needs 11 stable positions. See [[Vibe Spectrum]].

## Label overlap handling

When both handles are close (< 14% apart), only the min-handle label shows. Prevents text collision.

## The genre chip strip

Below the band, `GENRE_VIBE` (an inline map from genre id → default vibe) is filtered by the current range and rendered as a wrapped chip row. Max 60 genres shown. Gives the user a preview of what's in range.

**Note:** this `GENRE_VIBE` map is used **only for UI display** — it doesn't drive any item's actual vibe score. Items' vibes are set by the curator in [[mockData]].

## Links

- [[VibeContext]]
- [[Vibe Spectrum]]
- [[Vibe Gradient]]
- [[Color System]]
