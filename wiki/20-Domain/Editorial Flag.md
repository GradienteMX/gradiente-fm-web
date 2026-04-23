---
type: domain
status: current
tags: [editorial, curation, lever]
updated: 2026-04-22
---

# Editorial Flag

> `editorial: true` is the **only** editor lever on an item's ranking. Raises spawn HP from 20 to 50.

## What

A boolean field on `ContentItem`. When `true`:

1. **Spawn HP boost.** `spawnHp(item) = 50` instead of `20`. See [curation.ts:41](../../lib/curation.ts).
2. **Visual badge.** A red ★ appears on the card corner via [[ContentCard]], and a `//EDITORIAL` tag on [[EventCard]]/[[MixCard]]/[[ArticleCard]].
3. **Pinned hero eligibility.** [`getPinnedHero`](../../components/HeroCard.tsx) falls back to the most recent `editorial: true` item (among editorial/review/noticia/opinion) when no `pinned: true` exists. See [[Pinned Hero]].

## Why

Philosophical stance: **"guides, not gatekeepers"** (see [[Guides Not Gatekeepers]]).

`editorial: true` is a **boost, not a quarantine**. Editorial content enters the **same main grid** as scraped content — they compete on HP. The flag gives the editor's pick a head start (2.5× spawn HP), not a permanent lock.

If users don't interact with editorial-boosted items, their HP decays and the feed self-corrects toward what the audience actually cares about. That's the whole point — the editor seeds, the audience confirms or overrides through collective attention.

A single boolean keeps the editor honest. They can't:
- Tune per-item HP manually
- Add per-user boosts
- Override decay
- Inject items out of chronological order

They can:
- Mark a thing as editorial (once) — it gets 2.5× spawn HP
- Mark a thing as pinned (single slot) — it takes the hero

That's it. The rest is math (and, in V1, collective user attention — see [[Open Questions]]).

## When to set it

Rule of thumb: "Is this worth standing on a milk crate for?" If yes, `editorial: true`.

Concrete signals from the mock data:
- Events: festivals, headliner nights, workshops with heavyweights
- Mixes: from Gradiente residents or first-time reveals
- Articles: staff-written, not reposts

Non-editorial examples: listing-level events (just another Wednesday night), link-blog noticias, cross-posts.

## Interaction with decay

`editorial: true` does **not** slow decay. It only raises the starting HP. So a 2-month-old editorial item is no more prominent than a 2-month-old non-editorial item of the same score.

This is intentional: the lever is about **launch visibility**, not permanent status.

## Links

- [[HP Curation System]]
- [[Pinned Hero]]
- [[Guides Not Gatekeepers]]
- [[No Algorithm]]
- [[Size and Position as Only Signals]]
