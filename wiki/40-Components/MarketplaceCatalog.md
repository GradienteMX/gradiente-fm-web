# MarketplaceCatalog

> `components/marketplace/MarketplaceCatalog.tsx` — page body for `/marketplace`.

## What it does

Two surfaces in one component:

1. **Grid** of every marketplace-enabled partner, rendered as [[MarketplaceCard]] tiles. Sorted by listing count descending, then alphabetically — keeps the catalog reading as "active" (more inventory floats up).
2. **Overlay mount** — when `?partner=<slug>` is in the URL, mounts [[MarketplaceOverlay]] on top of the grid.

URL is the state. Clicking a card navigates to `?partner=<slug>`. Closing the overlay strips both `partner=` and `listing=` params (the overlay's own close handler only strips `listing=` — this catalog strips both so closing from the partner card never leaves an orphaned listing param).

## Props

| Prop | Type |
|------|------|
| `partners` | `ContentItem[]` — pre-filtered to marketplace-enabled |

Partners are server-prefetched by [[Marketplace Page]] so newly approved rows appear on the next request.

## Related

- [[Marketplace Page]] — server wrapper that passes the partners prop
- [[MarketplaceCard]] — single partner tile
- [[MarketplaceOverlay]] — partner-level overlay (opened by URL param)
- [[MarketplaceListingDetail]] — listing sub-overlay (z-60, stacks above the overlay)
