---
type: component
status: current
tags: [saves, cards]
updated: 2026-04-26
---

# SavedBadge

> Tiny orange `★` chip that appears in a card's top-right corner when the item is bookmarked. Renders nothing otherwise.

## Source

[components/cards/SavedBadge.tsx](../../components/cards/SavedBadge.tsx)

## What

Lightweight visual indicator that pairs with [[SaveItemButton]]. Driven by `useIsItemSaved(itemId)` from [[saves]]; returns `null` when not saved so the unsaved feed has zero added chrome.

## Placement

Top-right corner of:
- [[ContentCard]] — every mosaic tile in [[ContentGrid]]
- [[HeroCard]] — the pinned hero on the home page

Top-right was deliberately chosen because the top-left corner is already occupied by the type badge + editorial-flag mark + pending chip on cards. Top-right was clear apart from the 1px vibe stripe.

## Color choice

Orange (`#F97316`) — same palette as the rest of the user-engagement chrome (GUARDAR / GUARDADO chip, the user-own-comment rail, the pending-publish accent). Distinct from the editorial-flag badge which uses red `bg-sys-red/90`. Visually distinguishable by both color and position.

## Glyph

A solid `★`. Matches the iconography established by [[SaveItemButton]] (`★ GUARDADO`) and [[CommentList]]'s `SaveButton` (`★ GUARDADO`). Editorial uses the same glyph but in red — confusing if both appeared in the same corner, which is why the saved badge is on the opposite side.

## Links

- [[ContentCard]] · [[HeroCard]]
- [[SaveItemButton]] · [[saves]]
