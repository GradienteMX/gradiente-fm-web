---
type: component
status: stale
tags: [component, card, orphan, article]
updated: 2026-04-22
---

# ArticleCard

> **Orphaned.** Linear article row for `noticia`/`review`/`editorial`. Used by [[ContentFeed]] which isn't wired.

## Source

[components/cards/ArticleCard.tsx](../../components/cards/ArticleCard.tsx)

## Structure

Horizontal row with:
- Thin 2px vibe-colored left accent (full height)
- Meta row: `//TYPE` badge (vibe color) → `//EDITORIAL` (if flagged) → date → `BY AUTHOR` → read time
- Title + subtitle + excerpt (2-line clamp)
- Genre chips + tag chips + `LEER →` hover hint on the right

## Notes

- Handles 5 types in `TYPE_LABEL` (noticia/review/editorial/evento/mix) but only meant for the 3 text types. Dispatch fallback in [[ContentFeed]] routes non-event non-mix items here; `opinion` type isn't in the label map — falls back to `//TEXTO`. Minor bug if `opinion` items are ever fed. See [[Open Questions]].

## Why orphaned

See [[Dual Feed Systems]].

## Links

- [[ContentFeed]]
- [[Dual Feed Systems]]
- [[ContentCard]]
