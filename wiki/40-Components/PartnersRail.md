---
type: component
status: current
tags: [component, partners, rail, isolation]
updated: 2026-04-22
---

# PartnersRail

> Right-side rail of partner cards. Chronological, never merges with the main grid. Visible on `md+` screens.

## Source

[components/PartnersRail.tsx](../../components/PartnersRail.tsx)

## Client component? Yes

Uses `useMemo` to sort. Could be server; marked client defensively.

## What it shows

A 260px-wide vertical stack of partner cards. Header:

```
// PARTNERS
{count} · SELLOS · VENUES · PROMO
```

## Partner card

Per [PartnersRail.tsx:20](../../components/PartnersRail.tsx):

- 4:3 aspect-ratio cover image with bottom gradient
- `//PROMO` / `//SELLO` / `//VENUE` / etc. badge in grey `categoryColor('partner')`
- Title (2 lines max) and optional subtitle (1 line)
- Wraps in an `<a target="_blank">` if `partnerUrl` is set

## Ordering

Sorted **descending** by `partnerLastUpdated` (fallback `publishedAt`). See [PartnersRail.tsx:16](../../components/PartnersRail.tsx).

No HP, no vibe filter, no date filter. Partners are quarantined — see [[Partners Isolation]].

## Hidden on mobile

`hidden md:block` — on phones, partners don't show at all. Acceptable for now because the content is typically visible elsewhere (a venue has events in the main grid; a label has mixes). Design call; revisit if ad revenue becomes important.

## Links

- [[Partners Isolation]]
- [[Home]]
- [[Content Types]]
- [[Partners Ecosystem]]
