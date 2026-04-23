---
type: component
status: current
tags: [component, card, mosaic]
updated: 2026-04-22
---

# ContentCard

> One card component, three size tiers (sm/md/lg). Image-forward, dark gradient overlay, type badge, vibe color accent.

## Source

[components/cards/ContentCard.tsx](../../components/cards/ContentCard.tsx)

## Client component? No

Pure server component — renders static markup. All interactivity (hover, click) is CSS.

## Three tiers

### SM (1×1, 280–380px square-ish)
Minimal: title (2 lines), date, venue/author, up to 2 genres. Event date-block in top-right when applicable.

### MD (2×1 wide or 1×2 tall)
Adds: artists row, subtitle, meta row with icons (MapPin/Play/Clock/Ticket), expanded genre chips.

### LG (2×2 featured)
Full bells: 4 artists, subtitle, 2-3 line excerpt, genre + tag chips with color backgrounds, venue + city, price, tickets button, read time. Date-block scaled up.

The tier is picked by [`cardLayout(item).tier`](../../lib/curation.ts) and passed in as a prop. [[ContentGrid]] is the only wirer.

## Shared bits across all tiers

**`CardImage`** internal component renders:
- Background image (or solid fallback), with `group-hover:scale-105` for a subtle zoom
- Top-to-bottom dark gradient: `from-black via-black/50 to-black/10`
- Top-right 1px strip in vibe color (the unambiguous vibe indicator)
- Type badge top-left: `//{TYPE_LABEL}` in category color
- Red ★ badge next to type if `editorial: true`
- NGE corner bracket bottom-right (subtle, vibe-colored, 60% alpha)

## The per-type date block (events only)

Top-right floating block:

```
ABR       ← fmtMonthShort
 19       ← fmtDayNumber (big)
SAB       ← fmtDayName (3-char)
22:00     ← fmtTime (MD/LG only)
```

Rendered inside the image area with `bg-black/70 backdrop-blur-sm` to stay legible over any cover art.

## Interaction

The whole card is a `cursor-pointer` article, but **currently doesn't link anywhere** — no `href`. Slug-based routing hasn't been added yet. See [[Open Questions]].

Exception: the `TICKETS →` button on LG event cards is an `<a>` with `stopPropagation` to prevent parent click handlers (which don't exist yet, but defensively set).

## Image strategy

Uses plain `<img>` not `next/image`. Two reasons:
1. Framer Motion `layout` animations work more reliably without Next's layout-shifting image wrapper.
2. All images are local (`/flyers/*.jpg`) — no optimization pipeline advantage.

`loading="lazy"` on the img so offscreen cards don't block initial render.

## Links

- [[ContentGrid]]
- [[HP Curation System]]
- [[Vibe Gradient]]
- [[Color System]]
- [[Typography]]
