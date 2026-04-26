---
type: design
status: current
tags: [design, vibe, gradient, color]
updated: 2026-04-24
---

# Vibe Gradient

> The dominant visual motif. Cold-cyan → warm-pink → hot-red, mapping to the [[Vibe Spectrum]] 0–10.

## Three expressions (not two)

There are **three** related color scales. Yes, it's a bit fragmented. Reconciliation is on the deferred list.

### 1. Tailwind `bg-vibe-gradient` — 8-stop smooth gradient

Used for: [[VibeSlider]] track (as the neon gradient base), long horizontal bars.

```
#7DD3FC (ice)  → #38BDF8 → #818CF8 → #A78BFA → #E879F9 → #FB923C → #F87171 → #B91C1C (volcano)
```

Pastel-to-blood. Softer than the other two. Defined in [tailwind.config.ts:42](../../tailwind.config.ts).

### 2. `vibeToColor()` — 11-step discrete palette

Used for: per-item accents in [[ContentCard]], [[HeroCard]], [[MixCard]], [[EventCard]], [[ArticleCard]].

```
0  #00FFFF   pure cyan
1  #00CCFF
2  #0066FF
3  #6600FF
4  #CC00FF
5  #FF00FF   pure magenta
6  #FF0066
7  #FF5500
8  #FFAA00
9  #FF2200
10 #FF0000   pure red
```

Saturated, high-contrast. Closer to fluorescent marker colors. Defined in [utils.ts:19](../../lib/utils.ts).

### 3. `VibeSlider::interpolateVibeColor()` — per-dash RGB lerp over the 11-step anchors

Used for: the phosphor tape in [[VibeSlider]]. Inline helper in [VibeSlider.tsx](../../components/VibeSlider.tsx).

Not a separate palette — it piggybacks on `vibeToColor` (scale 2 above). For a float vibe `v`, it does linear RGB interpolation between `vibeToColor(floor(v))` and `vibeToColor(ceil(v))`:

```ts
interpolateVibeColor(3.7)   // lerp between #6600FF (slot 3) and #CC00FF (slot 4), t=0.7
```

Each dash in the tape is colored by its x-position on `[0, 10]` once at module load — so the band reads as a smooth gradient but anchors exactly on the discrete per-item slot colors. This replaced the old `NEON_GRADIENT` CSS-gradient string when the slider was redesigned as phosphor tape (2026-04-24).

## Why three

- **Tailwind pastel** — looks good as a large fill (a sticky bar), softer on the eye, less fatiguing when always visible.
- **Discrete saturated** — individual items benefit from crisp color identity (vibe 7 is unmistakably different from vibe 8).
- **Slider interpolation** — lerps between the discrete saturated anchors so the phosphor tape matches per-item accents exactly, with smooth in-between colors on the band itself.

## Should they unify

Probably. A single exported function that returns color(s) for a vibe with `mode: 'discrete' | 'continuous' | 'pastel'` would be cleaner — the slider's `interpolateVibeColor` is 80% of what `'continuous'` would be. Not urgent — the fragmentation is invisible to users. See [[Open Questions]].

## Visual identity

The vibe gradient is **the** signature of the site. If a user describes GRADIENTE FM in one sentence, they probably mention "the color bar that goes from blue to red". It's the brand at a glance.

## Links

- [[Vibe Spectrum]]
- [[Color System]]
- [[VibeSlider]]
- [[utils]]
