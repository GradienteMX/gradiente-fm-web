---
type: component
status: current
tags: [component, vibe, filter, slider, station-dial, phosphor, multi-genre]
updated: 2026-06-12
---

# VibeSlider

> Sticky **station dial** — printed scale plate + three-row phosphor tape + two needle handles — plus a feed-driven multi-genre chip strip below. Writes to [[VibeContext]].

> **Redesign 2026** reworked the band as a station dial (see "Three layers, strict roles" below): static printed plate, hard-slot tape colors, PPM ballistics, release-snap detents, arrow-key stepping. Preserved verbatim: the `[data-vibe-strip]` container contract (measured by [[CategoryRail]] for its sticky offset), the chip strip's interaction-gated auto-hide, and the [[VibeContext]] API.

## Source

[components/VibeSlider.tsx](../../components/VibeSlider.tsx)

## Client component? Yes

Owns pointer drag state via refs, listens on `window` pointer events, reads `visibleGenres` from context.

## Hidden on `/dashboard` and `/admin`

The slider is a feed-curation control — it has no meaning in editor surfaces. The exported `VibeSlider` is a thin wrapper that calls `usePathname()` and returns `null` when the path starts with `/dashboard` or `/admin`. Hooks live inside `VibeSliderImpl` so the conditional return doesn't violate hook rules.

## Anatomy

```
┌──────────────────────────────────────────────────────┐
│ //VIBE  03-07 · COOL → HOT                  [RESET]  │  ← header readout (fixed 24ch slot; RESET always rendered)
├──────────────────────────────────────────────────────┤
│   · ·  ·  · ·  · ·  · ·  · ·  · ·  · ·  · ·  · ·    │  ← top tape row (sparse)
│  ═════════│════════════════════│═══════════════════  │  ← middle (dense baseline) + needles
│    · ·  · ·  · ·  · ·  · ·  · ·  · ·  · ·  · · ·    │  ← bottom (sparse, half-step offset)
│  00  01  02  03  04  05  06  07  08  09  10          │  ← scale plate — printed, STATIC
│  GLACIAL POLAR CHILL COOL … BRASA VOLCÁN             │     slot names (hidden below md)
├──────────────────────────────────────────────────────┤
│  + 28 GÉNEROS   Ambient · Lo-fi · Jazz · …           │  ← chip strip (interaction-gated visibility)
└──────────────────────────────────────────────────────┘
```

Sticks below [[Navigation]] at `top: 76px`. The chip-strip row is content-driven — collapses to the pin button when chips are hidden (no more `min-h-[3.5rem]` reservation). See "Layout & shift policy" below.

## Three layers, strict roles (station dial)

- **PLATE** — printed scale: zero-padded numerals `00`–`10` + slot names at fixed band centers. **Never moves**; in-range labels brighten (`text-muted` → `text-secondary`, "lit plate"), nothing else. Names hidden below the `md` breakpoint (numerals stay). This replaced the traveling handle labels — labels no longer follow the handles.
- **TAPE** — phosphor dash field colored in **11 hard slot bands** (no per-dash lerp). In-range dashes lit at full slot color + glow; out-of-range dim to a low-alpha version of their **own** hue — unlit LEDs on a calibrated scale, never gray.
- **NEEDLES** — the two range handles: 1.5px white line + 5×7px grip cap, inside a 28px-wide invisible drag target (`role="slider"` with full aria values). Only the needles move.

Value↔position mapping: an integer slot sits at the **center** of its band (`slotCenterPct(v) = (v + 0.5) / 11`), so a detented needle points exactly at its printed numeral. The tape dashes share the same 0–100 mapping (this fixed a ~1% tape/plate misalignment from a 99%-vs-100% scale).

## Interaction model — the dial

- **Drag a needle** → updates `vibeRange` continuously (floats); the needle follows instantly (transition off while dragging).
- **Release → detent snap** — the dragged needle snaps to the nearest integer slot via a 200ms `cubic-bezier(0.3, 1.6, 0.5, 1)` overshoot transition, so the snap reads as a felt click. **Magnetic edges:** slots 0 and 10 capture a wider window (±0.65 vs ±0.5 interior) so the extremes are generous targets.
- **Click on the track** → moves the nearer needle to the clicked slot (snapped). A drag-end click is suppressed via a `justDraggedRef` guard so releasing between the needles can't teleport the other one.
- **Arrow keys** (new in Redesign 2026) — `←`/`↓` and `→`/`↑` step the focused needle one detent, clamped against the other needle; `Home`/`End` jump to the magnetic extremes.
- **RESET button** becomes visible when range ≠ `[0, 10]`; restores `[0, 10]`. Always rendered so the header height never shifts.
- **`prefers-reduced-motion`** → all of it goes instant: tape ballistics `0ms`, needle transition `none`.

## Continuous during drag, quantized at rest

`vibeRange` is `[number, number]` in `[0, 10]` — but floats exist **only mid-drag** (release snaps both writes to integers). Slot-quantized values (`Math.round`) drive the lit tape bands, the plate brightening and the header readout, so whole bands flip as a needle crosses detent boundaries — stepped, not smeared. The content filter and needle x-position use the raw value (float while dragging).

## The phosphor tape

Three horizontal rows of short vertical dashes (~200 total `<div>`s, generated once at module load):

| Row | `bottom` | Count | Dash height | Rhythm |
|---|---|---|---|---|
| Top | `68%` | 40 | 3–5 px | sparse |
| Middle | `50%` | 120 | 4–6 px | dense, near-continuous baseline |
| Bottom | `32%` | 40 | 3–5 px | sparse, half-step offset from top |

Each dash is **hard-assigned to one slot** (`Math.floor(t * 11)`) and colored `VIBE_SLOT_COLORS[slot]` — no lerp across band boundaries (the old `interpolateVibeColor` RGB-lerp helper is deleted). Lit when `slot ∈ [minSlot, maxSlot]` (opacity 1 + 3px glow), unlit otherwise (opacity 0.16, same hue). See [[Vibe Gradient]].

**PPM ballistics:** per-dash `transitionDuration` is picked by the lit-state the dash is transitioning *into* — fast attack (~100ms) when a band lights, slow decay (~600ms) when it dims. The plate labels brighten/dim on the same ballistics.

Determinism: dash heights use `Math.imul`-based `hash01(seed, salt)` to avoid SSR/client hydration drift.

## Chip strip — feed-driven, multi-genre toggle

The strip below the band is the multi-genre filter UI for the home feed. **Major rework 2026-05-05** — see also [[Vibe Philosophy]] idea 2.

### Visibility (interaction-gated, idle-collapsing)

```ts
chipsVisible = pinned || activeIds.length > 0 || (!isFullRange && recentInteraction)
```

The chip strip is hidden by default. Three ways it appears:

- **Recent interaction (transient)** — fades in on slider drag or chip toggle, fades back out 2s after the last action. A `setTimeout(setRecentInteraction(false), 2000)` resets on every `[min, max]` or `activeFilterCount` change, so continuous dragging keeps the strip open; the 2s only really starts on `pointerup`. An `isFirstInteractionRender` ref skips the mount-time pseudo-change so chips don't flash open on page load.
- **Pin button (manual override)** — keeps chips visible indefinitely until unpinned.
- **Active filters** — always keep the strip visible (the user needs to see / clear them).

This replaced an earlier range-driven rule (`chipsVisible = !isFullRange || pinned || activeIds.length > 0` — see 2026-05-12 in [[log]]). The range-driven version held the strip open indefinitely after the user committed to a narrowed range, even after they'd moved on to scrolling the feed, and the container reserved `min-h-[3.5rem]` of dead space even when chips were faded out.

### Per-chip visibility

Each chip computes:

```ts
inFeed = feedSet
  ? getRollup(id).some(rid => feedSet.has(rid))   // rollup-aware
  : (GENRE_VIBE[id] ?? 5) ∈ [min, max]            // fallback
chipVisible = pinned || active || (!isFullRange && inFeed && recentInteraction)
```

Active (orange) chips stay visible **always** — the user needs to see and clear them. Non-active chips inherit the same 2s interaction gate as the container, so once a filter is committed and 2s of idle pass, the strip settles to just the orange selections. Toggling a chip resets the timer, giving a fresh 2s window to pick another candidate before the strip settles back.

The earlier (pre-2026-05-12) version dropped the `recentInteraction` clause, so committing a filter left the entire 70-chip candidate strip visible indefinitely — the surface read as "you've picked these three, plus also here are 70 more options" — opposite of what the user just did.

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

Active chips: sys-orange fill (`bg-sys-orange text-black shadow-[0_0_6px_rgba(249,115,22,0.55)]`).
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

## Layout & shift policy

The chip-strip row's height is now **content-driven** — it grows when chips fade in and collapses to the pin button (~22px) when they're hidden, with the chips wrapper transitioning `max-height: 0 ↔ 7rem` in lockstep with `opacity: 0 ↔ 1` (both 200ms).

Trade-off taken on 2026-05-12: small vertical shift below the strip on each interaction (~50px when chips fade in/out), in exchange for the feed sitting tight against the slider when chips are hidden. The previous `min-h-[3.5rem]` reservation eliminated visible shift but at the cost of permanent dead space pushing the feed down — even after the user committed to a range and moved on. Shift reads smooth because the `max-height` + `opacity` transitions match.

Two height-stability fixes that *did* survive the rework:

1. **RESET button always rendered** with `invisible` toggle (not conditional mount), so the header row stays the same height when the user narrows / resets.
2. **Per-chip margin collapse** — hidden chips animate `mr-1.5 mb-1.5 → mr-0 mb-0` instead of using container `gap`, so they leave no phantom gap-spacing that would spread visible chips apart.

## The 11 slot names

```
0 GLACIAL  1 POLAR  2 CHILL   3 COOL   4 FRESH   5 GROOVE
6 WARM     7 HOT    8 FUEGO   9 BRASA  10 VOLCÁN
```

Canonical source: `VIBE_SLOT_NAMES` exported from [utils.ts](../../lib/utils.ts). The slider's plate + header readout, [[VibeFader]], composer [[Dashboard Forms|VibeField]], and overlay vibe chips (via `vibeRangeLabel`) all read from this single array, so adjacent slots never share a label.

(The old "label overlap handling" — hiding the max-handle label when the handles were < 14% apart — is gone with the traveling labels themselves: the plate is printed at fixed positions, so nothing can collide.)

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
