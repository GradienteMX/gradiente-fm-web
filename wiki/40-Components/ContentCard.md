---
type: component
status: current
tags: [component, card, mosaic, overlay]
updated: 2026-04-23
---

# ContentCard

> One card component, three size tiers (sm/md/lg). Image-forward, dark gradient overlay, type badge, vibe color accent. Clicking opens a full-screen overlay — see [[Overlay System]].

## Source

[components/cards/ContentCard.tsx](../../components/cards/ContentCard.tsx)

## Client component? Yes

Became a client component when overlay click handling landed — it calls [[useOverlay]] and captures the card's bounding rect on click. Inner sub-cards (SmCard/MdCard/LgCard) are still pure render.

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

The top-level export wraps the size-specific sub-card (`SmCard` / `MdCard` / `LgCard`) in a clickable `role="button"` `<div>` that:

1. Captures the card's `getBoundingClientRect()` on click (used for the overlay's grow-from-origin transform).
2. Calls `open(item.slug, rect)` from [[useOverlay]].
3. Updates the URL to `?item=<slug>`.
4. Mounts [[OverlayShell]] + the type-specific overlay ([[ReaderOverlay]] / [[EventoOverlay]] / [[GenericOverlay]]).

Keyboard: `Enter` / `Space` trigger the same handler (`onKeyDown`). Focus ring uses `focus-visible:ring-sys-red`.

Exception: the `TICKETS →` button on LG event cards is still an `<a>` with `stopPropagation` — it bypasses the overlay and opens the ticket site directly. This is intentional: the explicit external escape hatch on event cards matches [[Contained Single Surface]]'s rule about external URLs being user-chosen, not the default.

## Image strategy

Uses plain `<img>` not `next/image`. Two reasons:
1. Framer Motion `layout` animations work more reliably without Next's layout-shifting image wrapper.
2. All images are local (`/flyers/*.jpg`) — no optimization pipeline advantage.

`loading="lazy"` on the img so offscreen cards don't block initial render.

## Links

- [[ContentGrid]]
- [[Overlay System]]
- [[useOverlay]]
- [[Contained Single Surface]]
- [[HP Curation System]]
- [[Vibe Gradient]]
- [[Color System]]
- [[Typography]]
