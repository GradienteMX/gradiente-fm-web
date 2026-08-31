---
type: component
status: current
tags: [component, franjas, rail, isolation]
updated: 2026-04-22
---

# FranjasRail

> Right-side rail of franja cards. Chronological, never merges with the main grid. Visible on `md+` screens.

## Source

[components/FranjasRail.tsx](../../components/FranjasRail.tsx)

## Client component? Yes

Uses `useMemo` to sort. Could be server; marked client defensively.

## What it shows

A 260px-wide vertical stack of franja cards. Header:

```
// FRANJAS
{count} · SELLOS · VENUES · PROMO
```

## Franja card

Per [FranjasRail.tsx:20](../../components/FranjasRail.tsx):

- 4:3 aspect-ratio cover image with bottom gradient
- `//PROMO` / `//SELLO` / `//VENUE` / etc. badge in grey `categoryColor('franja')`
- Title (2 lines max) and optional subtitle (1 line)
- Wraps in an `<a target="_blank">` if `franjaUrl` is set

## Ordering

Sorted **descending** by `franjaLastUpdated` (fallback `publishedAt`). See [FranjasRail.tsx:16](../../components/FranjasRail.tsx).

No HP, no vibe filter, no date filter. Franjas are quarantined — see [[Franjas Isolation]].

## Hidden on mobile

`hidden md:block` — on phones, franjas don't show at all. Acceptable for now because the content is typically visible elsewhere (a venue has events in the main grid; a label has mixes). Design call; revisit if ad revenue becomes important.

## Links

- [[Franjas Isolation]]
- [[Home]]
- [[Content Types]]
- [[Franjas Ecosystem]]
