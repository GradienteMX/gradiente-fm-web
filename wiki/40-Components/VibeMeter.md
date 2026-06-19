---
type: component
status: current
tags: [component, vibe, meter, instrument, cards, overlays]
updated: 2026-06-12
---

# VibeMeter

> 11-segment stepped meter — the canonical display for an item's vibe band on cards and overlay headers. New in Redesign 2026; replaced every `vibeBandGradient` strip.

## Source

[components/VibeMeter.tsx](../../components/VibeMeter.tsx)

## Client component? No

Pure render, server-safe — no hooks, no state, no `'use client'`. Imports only `VIBE_SLOT_COLORS` / `effectiveVibeBand` / `vibeRangeLabel` from [utils.ts](../../lib/utils.ts) (deliberately kept server-safe).

## Where it renders

Every band strip that used to be a `vibeBandGradient` CSS gradient:

- [[ContentCard]] — top strip (`size="sm"`)
- [[HeroCard]] — left edge, **vertical** (`size="sm" vertical`)
- [[EventoOverlay]] / [[GenericOverlay]] / [[ReaderOverlay]] — overlay headers
- [[MixCard]] / [[ArticleCard]] — orphan linear cards (`size="xs"`)

## What it shows

The **full calibrated 0–10 scale always renders** (the printed plate); the band reading is which slots are lit:

- **In-band slots** — full slot color from `VIBE_SLOT_COLORS`.
- **Out-of-band slots** — same hue at `'33'` alpha (~20%) — unlit LEDs, **never gray**. Calibrated in lockstep with [[VibeSlider]]'s unlit tape dashes (opacity 0.16 there — slightly dimmer because the tape sits on `bg-base`, the meter over imagery).

See [[Vibe Gradient]] for the ramp + lit/unlit convention.

## The lit band is the effective band

The meter calls `effectiveVibeBand(item)` — crowd median once `vibeCheckCount` hits threshold, author range until then. That's the **same band `filterByVibe` admits** and [[VibeFader]] displays at rest, so the meter can never disagree with the filter that admitted the card. A meter showing the author band while the filter ran on the crowd band would be a false readout.

Band edges are defensively clamped/rounded (crowd medians can hand back non-integers).

## Props

```ts
item: { vibeMin, vibeMax, vibeCheckCount?, vibeCheckMedianMin?, vibeCheckMedianMax? }
size?: 'xs' | 'sm' | 'md'   // thickness: 2px / 4px / 6px — length is the parent's business
vertical?: boolean            // column layout, slot 0 at the TOP (matches the 180deg-rotated
                              // strip it replaced on HeroCard); needs a height from className/parent
className?: string
```

## Accessibility

`role="img"` + `aria-label` / `title` of `VIBE · {vibeRangeLabel}` (e.g. `VIBE · 4-7 · FRESH → HOT`) — the segments themselves are presentational `<span>`s.

## Links

- [[Vibe Gradient]] — the ramp, lit/unlit convention, why stepped
- [[Vibe Checks]] — where the effective band comes from
- [[VibeFader]] — the *interactive* sibling inside overlays (vote, not display)
- [[VibeSlider]] — the feed filter (same color vocab)
- [[utils]] — `effectiveVibeBand`, `VIBE_SLOT_COLORS`
