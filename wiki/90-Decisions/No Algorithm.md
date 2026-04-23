---
type: decision
status: current
tags: [decision, curation, editorial, philosophy]
updated: 2026-04-22
---

# Decision — No Algorithm

> Curation is editorial, not algorithmic. The site does not do personalization, behavioral ranking, or engagement optimization.

## Decision

- The curator decides what goes up.
- The curator decides the vibe.
- The editorial toggle is the only ranking lever available.
- The HP decay system is **deterministic math over editor input** — not a response to aggregate user behavior.

## Context

From the prior `CLAUDE.md`:

> - Curation is editorial, not algorithmic.
> - Never sort home feed by `publishedAt` — use HP curation.

The HP system ([[HP Curation System]]) might look like an algorithm, but it's structurally different from an engagement algorithm:
- No user logs feed into it
- No training signal
- Tunables are global constants, not learned
- Output is stable and predictable given the same inputs

It's a **decay function applied to editor choices**, not a recommender.

## Alternatives rejected

1. **Classic engagement algo (clicks → boosts).** The dominant model of the 2010s-2020s web. Rejected because it trains editors and content to optimize for clicks over quality.
2. **Personalization / per-user feed.** Rejected because:
   - Requires account infrastructure
   - Turns the site into a mirror rather than a window
   - Conflicts with the editorial stance (the editor's voice should carry across readers)
3. **Pure chronological.** Too raw — a recent uninteresting item beats an older brilliant one. The HP system corrects this while staying editor-controlled.
4. **Upvote/like-based.** See [[Size and Position as Only Signals]].

## Consequences

- **Pro:** no tracking infrastructure needed. No cookies, no analytics pipeline, no "fairness" audits.
- **Pro:** the editor's judgment is the site. Clear authorship.
- **Pro:** can't dark-pattern into time-on-site addiction.
- **Pro:** predictable for the editor — they can picture the feed that their edits will produce.
- **Con:** scaling limits. One curator can manage maybe 50-100 items a month; at festival scale that's a bottleneck.
- **Con:** no self-tuning. If the tunables drift out of alignment with the scene, someone has to notice and adjust.
- **Con:** can't claim "personalized" or "AI-driven" which is a marketing miss (a feature, not a bug).

## When this might need to relax

- **Multi-editor era.** If Gradiente grows past one curator, editorial disagreement surfaces. Not an algorithm problem yet; a governance problem.
- **Event discovery at scale.** If the agenda grows past ~50 upcoming events, personalization pressure rises. Possible compromise: filter/sort preferences via [[VibeContext]] persistence (localStorage only, no server).
- **Partner monetization.** If sponsored placements become significant revenue, pressure to loosen [[Partners Isolation]] will appear. Hold the line.

## Links

- [[HP Curation System]]
- [[Size and Position as Only Signals]]
- [[Editorial Flag]]
- [[Partners Isolation]]
- [[Gamification]]
