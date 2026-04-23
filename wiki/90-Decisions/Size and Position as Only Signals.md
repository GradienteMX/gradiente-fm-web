---
type: decision
status: current
tags: [decision, ui, signals, curation]
updated: 2026-04-22
---

# Decision — Size and Position as Only Signals

> The site shows item importance **only** through card size and grid position. No stars, no upvotes, no view counts, no "trending" badges, no play counts, no follower numbers.

## Decision

An item's prominence is encoded in:
1. **Card size tier** — sm / md / lg (1×1, 2×1, 2×2 grid span)
2. **Position in the grid** — higher score → earlier in the ordering

That's it. No numeric indicators of popularity anywhere in the UI.

## Context

Explicit in [[curation]] module header:

> Design constraints (hard):
> - Only size and position are visible ranking signals.

The underlying [[HP Curation System]] produces plenty of numbers (HP, score, prominence, intensity), but those numbers never appear in the UI. They only determine layout.

## Alternatives rejected

1. **Like / heart counts per item.** Industry default. Rejected because it optimizes for engagement over editorial quality — see [[No Algorithm]].
2. **Play count for mixes.** Reasonable in a music context. Rejected because it'd be the only numeric signal — a half-commitment that primes users to look for others.
3. **"Trending" or "Hot" badges.** Rejected for the same reason as engagement counters: it turns browsing into popularity hunting.
4. **Editor's pick ribbons.** Softer than engagement counters, but still noisy. The single [[Pinned Hero]] + editorial ★ badge is all the editorial-lever imagery the site gets.

## Consequences

- **Pro:** can't be gamed by ad-fraud or bot traffic.
- **Pro:** no user-visible stress about what's "winning." Quiet.
- **Pro:** a decaying feed looks natural — items fade position by shrinking, not by showing a dropping number.
- **Pro:** fully deterministic without account infrastructure.
- **Con:** users unfamiliar with the site can't quickly identify "the hot thing" — they have to read the grid.
- **Con:** loses an easy onboarding hook ("see what's trending").
- **Con:** editors can't signal "this was read by X people" to incentivize contributors.

## Implicit limits

Since size and position are the **only** signals, their UX needs to be very readable:
- The three tiers need distinct silhouettes ([[ContentCard]] delivers this).
- Position-within-tier matters — see the `--prominence` CSS var + intensity in [[ContentGrid]].
- Decay has to feel natural — items shouldn't just vanish; they shrink gracefully. See [[HP Curation System]].

## Links

- [[No Algorithm]]
- [[HP Curation System]]
- [[ContentGrid]]
- [[ContentCard]]
- [[Editorial Flag]]
