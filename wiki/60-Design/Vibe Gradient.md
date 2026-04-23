---
type: design
status: current
tags: [design, vibe, gradient, color]
updated: 2026-04-22
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

### 3. `VibeSlider::NEON_GRADIENT` — 8-stop saturated gradient

Used for: the striped band in [[VibeSlider]]. Inline in [VibeSlider.tsx:32](../../components/VibeSlider.tsx).

```
#00ffff  0%   → #0066ff 18% → #6600ff 34% → #ff00ff 50%
→ #ff0066 62% → #ff5500 76% → #ff2200 90% → #ff0000 100%
```

Closer to the `vibeToColor` palette than to the Tailwind pastel — essentially the same saturated fluorescents rendered continuously.

## Why three

- **Tailwind pastel** — looks good as a large fill (a sticky bar), softer on the eye, less fatiguing when always visible.
- **Discrete saturated** — individual items benefit from crisp color identity (vibe 7 is unmistakably different from vibe 8).
- **Saturated gradient** — fills the slider band, which needs to match the discrete per-item accents visually.

## Should they unify

Probably. A single exported function that returns color(s) for a vibe with `mode: 'discrete' | 'continuous' | 'pastel'` would be cleaner. Not urgent — the fragmentation is invisible to users. See [[Open Questions]].

## Visual identity

The vibe gradient is **the** signature of the site. If a user describes GRADIENTE FM in one sentence, they probably mention "the color bar that goes from blue to red". It's the brand at a glance.

## Links

- [[Vibe Spectrum]]
- [[Color System]]
- [[VibeSlider]]
- [[utils]]
