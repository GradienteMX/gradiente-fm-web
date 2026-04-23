---
type: component
status: stale
tags: [component, card, orphan, event]
updated: 2026-04-22
---

# EventCard

> **Orphaned.** Linear event row with left vibe edge, date column, and hazard stripe for vibe ≥ 9. Used by [[ContentFeed]] which isn't wired.

## Source

[components/cards/EventCard.tsx](../../components/cards/EventCard.tsx)

## Structure

Horizontal `<article>` with three columns:

1. **Date column** (64px) — month / big day number / day name / time, bordered right.
2. **Content column** — type/editorial/lgbtq/free badges, title, subtitle, artists, excerpt, venue, genre chips, price, tickets button.
3. **Hazard stripe** (6px, only when `vibe >= 9`) — the 45° orange/black warning tape pattern. A signature NGE touch — "this one's volcanic."

## Notable detail — vibe-colored left border

```tsx
style={{ borderLeftColor: vibeColor, borderLeftWidth: 2 }}
```

Each event row carries a 2px vibe edge on the left. In a linear feed this would produce a readable "temperature scan" down the page.

## Why orphaned

See [[Dual Feed Systems]]. The site uses the mosaic [[ContentCard]] instead; row-style cards never got imported.

## Links

- [[ContentFeed]]
- [[Dual Feed Systems]]
- [[ContentCard]]
