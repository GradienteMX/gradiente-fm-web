---
type: component
status: current
tags: [component, vibe, filter, slider, phosphor, multi-genre]
updated: 2026-05-05
---

# VibeSlider

> Sticky dual-handle range slider across a three-row phosphor tape, plus a feed-driven multi-genre chip strip below. Writes to [[VibeContext]].

## Source

[components/VibeSlider.tsx](../../components/VibeSlider.tsx)

## Client component? Yes

Owns pointer drag state via refs, listens on `window` pointer events, reads `visibleGenres` from context.

## Hidden on `/dashboard` and `/admin`

The slider is a feed-curation control — it has no meaning in editor surfaces. The exported `VibeSlider` is a thin wrapper that calls `usePathname()` and returns `null` when the path starts with `/dashboard` or `/admin`. Hooks live inside `VibeSliderImpl` so the conditional return doesn't violate hook rules.

## Anatomy

```
┌──────────────────────────────────────────────────────┐
│ VIBE                                       [RESET]   │  ← header (RESET always rendered, invisible at full range)
├──────────────────────────────────────────────────────┤
│         GLACIAL ──────────── VOLCÁN                  │  ← handle labels
│   · ·  ·  · ·  · ·  · ·  · ·  · ·  · ·  · ·  · ·    │  ← top phosphor row (sparse)
│  ══════════════════════════════════════════════════  │  ← middle (dense, the baseline)
│    · ·  · ·  · ·  · ·  · ·  · ·  · ·  · ·  · · ·    │  ← bottom (sparse, half-step offset)
│         │                       │                    │  ← handles (3px white)
├──────────────────────────────────────────────────────┤
│  + 28 GÉNEROS   Ambient · Lo-fi · Jazz · …           │  ← chip strip (range-driven visibility)
└──────────────────────────────────────────────────────┘
```

Sticks below [[Navigation]] at `top: 76px`. Strip total height held constant via stable header height (RESET button uses `invisible` not conditional unmount), `min-h-6` on track row, and `min-h-[3.5rem]` on the chip-strip row. See "Layout-shift hardening" below.

## Interaction model — slider band

- **Drag a handle** → updates `vibeRange` continuously
- **Click on the track** → moves the nearer handle to that position
- **RESET button** appears (becomes visible) when range ≠ `[0, 10]`; restores `[0, 10]`. Always rendered so the header height never shifts.

Handles are 6px-wide invisible pointer targets wrapping a 3px white visible mark. Touchable on mobile without a heavy footprint.

## Continuous range

`vibeRange` is `[number, number]` of **continuous floats in `[0, 10]`**, not integer slots. Dragging produces `3.73` / `7.19`.

Three things snap to integers for legibility, nothing else does:

1. **Handle label** — `VIBE_SLOT_NAMES[Math.round(min)]`. Handle at 3.73 reads as `FRESH` (slot 4).
2. **Handle label color** — `vibeToColor(Math.round(min))`.
3. **Genre chip in/out** — chips check `feedSet.has(id)` (or `GENRE_VIBE[id]` in fallback), both integer-keyed.

Everything else — handle x-position, dash lit/unlit boundary, content filter — uses the raw float.

## The phosphor tape

Three horizontal rows of short vertical dashes (~200 total `<div>`s, generated once at module load):

| Row | `bottom` | Count | Dash height | Rhythm |
|---|---|---|---|---|
| Top | `68%` | 40 | 3–5 px | sparse |
| Middle | `50%` | 120 | 4–6 px | dense, near-continuous baseline |
| Bottom | `32%` | 40 | 3–5 px | sparse, half-step offset from top |

Each dash's color is `interpolateVibeColor(t * 10)` (RGB lerp between two `vibeToColor` anchors). Lit when `dashVibe ∈ [min, max]`, unlit otherwise (opacity 0.08). 120ms transition. See [[Vibe Gradient]] for palette details.

Determinism: dash widths use `Math.imul`-based `hash01(seed, salt)` to avoid SSR/client hydration drift.

## Chip strip — feed-driven, multi-genre toggle

The strip below the band is the multi-genre filter UI for the home feed. **Major rework 2026-05-05** — see also [[Vibe Philosophy]] idea 2.

### Visibility (range-driven, not interaction-driven)

```ts
chipsVisible = !isFullRange || pinned || activeIds.length > 0
```

- At full range with no filters and no pin → strip is hidden (opacity 0). All chips would be "in range" so the set carries no information.
- As soon as the user narrows the range → strip fades in.
- Pin button (manual override) keeps it visible at full range.
- Active filters always keep it visible (so the user can clear them).

Removed all the drag/hover/linger machinery from earlier iterations — visibility is purely a function of the slider state, not interaction state. Smoother + more honest.

### Per-chip visibility

Each chip computes:

```ts
inFeed = feedSet
  ? getRollup(id).some(rid => feedSet.has(rid))   // rollup-aware
  : (GENRE_VIBE[id] ?? 5) ∈ [min, max]            // fallback
chipVisible = pinned || active || (!isFullRange && inFeed)
```

Rollup is critical: when the user is at a narrowed range and a `techno-raw` item is in the feed, the parent `Techno` chip lights up (because `getRollup('techno')` includes `techno-raw`). Without rollup, parent chips would never appear. See [[genres]] for the rollup definition.

### Chip universe

```ts
allGenreIds = unique([
  ...getRootGenres().map(g => g.id),  // 18 root categories — always available
  ...visibleGenres ?? GENRE_VIBE_keys,  // feed reality (or stereotype fallback)
  ...activeIds,                          // user's active filters
])
```

Feed-driven via `visibleGenres` from [[VibeContext]] (pushed by [[ContentGrid]]). On routes without a `ContentGrid` (e.g. `/foro`), `visibleGenres` is `null` and the strip falls back to `GENRE_VIBE` keys — keeps the slider useful even when no feed has reported in.

### Chip toggle behavior

Each chip is a `<button aria-pressed>`. Click fires `toggleGenre(id)` from [[VibeContext]] — adds if absent, removes if present. Multi-select; multiple genres can be active simultaneously and intersect via OR semantics in [[ContentGrid]]'s `itemMatchesGenreFilter` (which rolls up parent → descendants).

Active chips: gold fill (`bg-[#F5C500] text-black shadow-[0_0_6px_rgba(245,197,0,0.55)]`).
Inactive chips: outlined (`border-border/40 text-secondary`).

### Smooth fade transitions

Each chip uses `transition-all duration-200`. When falling out of range:

- `opacity` 1 → 0
- `max-width` 18rem → 0
- `margin-right` + `margin-bottom` 1.5 → 0
- `padding-x` 1.5 → 0
- `border-color` → transparent

Per-chip margins (instead of container `gap`) so hidden chips collapse fully — without this, gap-from-hidden-chip would spread visible chips apart with phantom space.

Verified mid-flight: at 130ms into a fade-out, sample chip was at opacity 0.14, width 41px (from 86px). Smooth.

### Pin button

Auto-hidden when chips are visible for another reason (clean UI). Visible only when:

- Chips would otherwise be hidden (full range, no filters), as the manual reveal
- OR currently pinned (so the user can unpin)

Label adapts: `+ N GÉNEROS` (closed) / `OCULTAR` (pinned).

## Layout-shift hardening

The user complained about page-below shifting during slider use. Three fixes:

1. **Chip-strip min-h `[3.5rem]`** — covers two rows of chips. Most narrowing flows fit. Pinning at full range may grow further (deliberate user gesture).
2. **RESET button always rendered** with `invisible` toggle instead of conditional mount. Header row stays the same height across narrow/widen.
3. **Per-chip margin collapse** (above) so the chip flex's natural height stays predictable.

Verified: strip total = 169px through full → narrow → narrow further → reset cycle (delta = 0).

## The 11 slot names

```
0 GLACIAL  1 POLAR  2 CHILL   3 COOL   4 FRESH   5 GROOVE
6 WARM     7 HOT    8 FUEGO   9 BRASA  10 VOLCÁN
```

Canonical source: `VIBE_SLOT_NAMES` exported from [utils.ts](../../lib/utils.ts). The slider, [[VibeFader]], composer [[Dashboard Forms|VibeField]], and overlay vibe chips (via `vibeRangeLabel`) all read from this single array, so adjacent slots never share a label.

## Label overlap handling

When both handles are close (< 14% apart), only the min-handle label shows. Prevents text collision.

## Why the chip strip is feed-driven (not GENRE_VIBE-driven)

The previous version computed which chips to show by checking `GENRE_VIBE[id] ∈ [min, max]` — i.e., "what genres typically live at this vibe." Per [[Vibe Philosophy]] idea 2, that's a stereotype lie. A "techno" item set at vibe 2 should make a `techno` chip appear when the slider is at 2 — and now it does.

The trade-off: when no `ContentGrid` is mounted (e.g. on `/foro`), there's no feed to read from, so the slider falls back to the `GENRE_VIBE` map. Acceptable — `/foro` has its own filter logic via `genresIntersectVibeRange`.

## Links

- [[Vibe Philosophy]] — idea 2 explains why feed-driven
- [[VibeContext]] — `vibeRange`, `genreFilter`, `visibleGenres`
- [[ContentGrid]] — pushes `visibleGenres`, consumes filters
- [[genres]] — taxonomy + `getRollup`
- [[VibeFader]] — sibling component (same color vocab, different concern)
- [[Vibe Spectrum]]
- [[Vibe Gradient]]
- [[Color System]]
