---
type: component
status: current
tags: [component, vibe, filter, slider, phosphor]
updated: 2026-04-24
---

# VibeSlider

> Sticky dual-handle range slider across a three-row phosphor tape. Writes to [[VibeContext]].

## Source

[components/VibeSlider.tsx](../../components/VibeSlider.tsx)

## Client component? Yes

Owns pointer drag state via refs, listens on `window` pointer events.

## Hidden on `/dashboard`

The slider is a feed-curation control — it has no meaning in the editor's working surface. The exported `VibeSlider` is a thin wrapper that calls `usePathname()` and returns `null` when the path starts with `/dashboard`; the actual slider renders as `VibeSliderImpl`. Hooks live inside the impl so the conditional return doesn't violate hook rules.

## Anatomy

```
┌──────────────────────────────────────────────────────┐
│ VIBE                                       [RESET]   │  ← header row
├──────────────────────────────────────────────────────┤
│         GLACIAL ──────────── VOLCÁN                  │  ← handle labels
│   · ·  ·  · ·  · ·  · ·  · ·  · ·  · ·  · ·  · ·    │  ← top row — sparse
│  ══════════════════════════════════════════════════  │  ← middle row — continuous
│    · ·  · ·  · ·  · ·  · ·  · ·  · ·  · ·  · · ·    │  ← bottom row — sparse, half-step offset
│         │                       │                    │  ← handles (2.5px white)
├──────────────────────────────────────────────────────┤
│ Ambient · Lo-Fi · Organic House · Deep House · …     │  ← genre chips in range
└──────────────────────────────────────────────────────┘
```

Sticks below [[Navigation]] at `top: 76px` so both remain visible while scrolling.

## Interaction model

- **Drag a handle** → updates `vibeRange` to a continuous float (see [Continuous range](#continuous-range) below)
- **Click on the track** → moves the nearer handle to that position
- **RESET** button appears when range is not `[0, 10]`, restores full range

Each handle is a 6px-wide invisible pointer target wrapping a 3px white visible mark. Makes it touchable on mobile without a huge visual footprint.

## Continuous range

`vibeRange` is stored as `[number, number]` but the numbers are **continuous floats in `[0, 10]`**, not integer slots. Dragging produces positions like `3.73` or `7.19`.

Three things snap to integers for legibility, nothing else does:

1. **Handle label** — `VIBE_SLOT_NAMES[Math.round(min)]`. Handle at 3.73 reads as `FRESH` (slot 4).
2. **Handle label color** — `vibeToColor(Math.round(min))`. Color bumps from one slot color to the next as the nearest-integer crosses.
3. **Genre chips** — `GENRE_VIBE` entries are integer-keyed, so the `v >= min && v <= max` filter uses float boundaries against integer chip values. Chips appear/disappear smoothly as handles cross half-integer boundaries.

Everything else — handle x-position, dash lit/unlit boundary, content filter — uses the raw float.

The lit boundary inside the phosphor tape moves **pixel-precisely** with the handle: a dash at `vibe=3.75` flips state the instant the handle passes 3.75, without any integer quantization.

## The phosphor tape

**Three horizontal rows** of short vertical dashes evoking a static waveform display:

| Row | `bottom` | Count | Dash height | Rhythm |
|---|---|---|---|---|
| Top | `68%` | 40 | 3–5 px | sparse, aligned at `t = i/count` |
| Middle | `50%` | 120 | 4–6 px | dense, near-continuous baseline |
| Bottom | `32%` | 40 | 3–5 px | sparse, **half-step offset** from top → saw alternation |

All dashes are 2.5px wide. Positions are deterministic per-index — a stable, non-reactive waveform print.

Dashes are generated once at module load via an IIFE, so there's no per-render allocation. ~200 total `<div>` elements in the track.

### Color

Each dash's color is computed once at module load as `interpolateVibeColor(t * 10)` where `t` is its x-position `[0, 1]`. `interpolateVibeColor` does linear RGB interpolation between the two nearest integer anchors in [`vibeToColor()`](../../lib/utils.ts) — so the gradient is smooth but perfectly tied to the 11-slot discrete palette (see [[Vibe Gradient]]).

### Lit vs unlit

```ts
const lit = d.vibe >= min && d.vibe <= max
```

- **Lit** — `opacity: 1`, `boxShadow: 0 0 3px ${d.color}` (tight halo glow).
- **Unlit** — `opacity: 0.08`, no shadow. Dashes stay faintly visible so the off-range tape reads as "unlit phosphor" rather than hidden content.

120ms linear transition on both properties.

### Determinism

Dash widths use a `Math.imul`-based integer hash (`hash01(seed, salt)`) — bit-exact across JS engines. This avoids SSR/client hydration drift that an earlier `Math.sin`-based hash caused (server and Chrome's V8 produced identical-looking but different-last-digit floats, triggering React hydration warnings).

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
