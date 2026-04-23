---
type: decision
status: current
tags: [decision, philosophy, curation, democratization]
updated: 2026-04-22
---

# Decision — Guides, Not Gatekeepers

> The core editorial thesis. Editors plant seeds. Collective user attention decides which grow.

## The thesis

Verbatim from the project lead (via the user):

> "We are guides, not gatekeepers. We offer guidance, users decide if that guidance is worthy. The HP system offers democratization — if users don't interact with the material that we added to the main grid, that means the users are taking a different direction, this is intended."

## Concrete implications

1. **Editorial content enters the main grid**, not a separate "featured" lane. Editor-written editorials/reviews/opinions/mixes and editor-selected "insider approved" events live alongside scraped events.
2. **`editorial: true` is a boost, not a lock.** Spawn HP: 20 → 50. Head start, not permanent placement. See [[Editorial Flag]].
3. **HP decay is the democratic mechanism.** If editorial picks don't get interacted with, HP decays. Feed self-corrects toward the audience's actual taste.
4. **Partners are separate** — they stay in their rail. That's about editorial integrity (sponsored vs curated), not about hiding anything from users. See [[Partners Isolation]].

## What "user attention" means (current + planned)

**Current (V0):** HP only decays. No interaction feedback. Editor seeding is the only input. The system is democratic *in theory* but passive in practice — users can only influence by not-clicking, not by clicking.

**Planned (V1):** aggregate interaction signals (clicks, plays, reads, shares) feed back into HP — either as additive boosts or as decay slowdown. Items users engage with stay up longer; items they ignore fade faster.

**What V1 is not:**
- Not personalization. No per-user profiles, no "items you may like."
- Not a recommender. No learned model, no training, no A/B testing of ranking.
- Not engagement-optimization. Not a loop that rewards clickbait.

**What V1 is:**
- Aggregate, anonymous, item-level attention measurement.
- A signal that can fail gracefully — if we never ship it, the system still works on decay alone.

See [[Open Questions]] for the V1 tracking question.

## Why this works with [[No Algorithm]]

"No algorithm" was always about **no personalization** and **no engagement-optimizing recommender**. Aggregate attention on items isn't either. Every user sees the same feed; items rise and fall by collective vote-with-attention.

The editor is the author. The audience is the editor.

## Alternatives rejected

1. **Editors manually override feed order.** Gatekeeping. Kills democratization.
2. **Editors pin every "important" item.** [[Pinned Hero]] is one slot. Expanding that undoes the curation model.
3. **Separate "staff picks" section outside the main feed.** Creates two feeds, one boring (scraped) and one curated (staff). Defeats the whole point — the mix is the content.
4. **Up/down voting by users.** Explicit engagement signal is brittle and gameable. Attention (implicit) is cleaner. See [[Size and Position as Only Signals]].
5. **Personalized feeds.** Off the table — see [[No Algorithm]].

## Consequences

- **Pro:** scalable — editors don't have to curate every item that appears.
- **Pro:** honest — the audience gets real feedback about editor picks.
- **Pro:** preserves editor agency (they get the HP boost + hero slot + writing platform) while respecting users.
- **Con:** V0 is passive — editorial influence only comes from seeding; no audience feedback loop yet.
- **Con:** bad editor taste gets exposed fast. Fair; some would argue a feature.
- **Con:** interaction tracking (even aggregate, anonymous) has infrastructure and privacy implications. Needs careful implementation when V1 arrives.

## Links

- [[HP Curation System]]
- [[Editorial Flag]]
- [[Pinned Hero]]
- [[No Algorithm]]
- [[Size and Position as Only Signals]]
- [[Partners Isolation]]
- [[Open Questions]]
