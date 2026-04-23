---
type: decision
status: current
tags: [decision, aesthetic, nge]
updated: 2026-04-22
---

# Decision — Why NGE Aesthetic

> The founding visual call: GRADIENTE FM uses _Neon Genesis Evangelion_-coded terminal UI as its primary design language.

## Decision

Adopt NGE-style terminal chrome (orange glow, scanlines, MAGI indicators, `//` tokens, `sys-label` mono text) as the structural visual grammar — not surface decoration.

## Context

- Target audience: CDMX electronic music scene — specifically the underground literate-in-internet-aesthetics subset.
- Audience already recognizes NGE cues from rave flyers, Y2K web revival, and cyberpunk gestures that are common in scene graphic work.
- Alternative editorial aesthetics (Pitchfork-like magazine, grid-and-photo, all-serif) would signal "generic" and read from outside the culture.

## Alternatives rejected

1. **Minimalist editorial grid (Substack-like).** Fits long-form text well. Rejected because the site is filter-forward, not reading-forward — a calm grid undersells the [[VibeSlider]] + [[ContentGrid]] mechanics.
2. **Pure y2k/web1.0 throwback.** Evokes similar era but reads as pastiche. NGE is more specific and more respected.
3. **Club-flyer maximalism (colorful, chaotic).** Appropriate for individual events, corrosive at the site level — every article looks like a rave poster.
4. **Brutalist (single-color, system-default fonts).** Honest but clinical. Missing the emotional temperature the [[Vibe Spectrum]] wants to project.

## Consequences

- **Pro:** unmistakable brand identity. Hard to confuse for any other music site.
- **Pro:** NGE's HUD language naturally accommodates information density (see [[NGE Aesthetic]]).
- **Pro:** the constraint forces discipline — there's a clear "what fits" and "what doesn't" test.
- **Con:** narrower audience. Someone who doesn't read NGE cues may find the UI chaotic before they find it cool.
- **Con:** heavy custom CSS (see [[Utility Classes]]). Non-NGE UIs like a simple signup form would either break the voice or require bespoke styling.
- **Con:** aesthetic-first discipline sometimes loses to UX pragma (e.g., `SE ACTUALIZA SEMANALMENTE` is a commitment most sites would avoid).

## Reversal cost

High. The aesthetic is load-bearing — every component, including chrome utility classes, is implicated. Changing later would be a ~3-week rebrand, not a CSS tweak.

## Links

- [[NGE Aesthetic]]
- [[Typography]]
- [[Color System]]
- [[Voice and Copy]]
