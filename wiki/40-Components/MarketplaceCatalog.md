# MarketplaceCatalog

> `components/marketplace/MarketplaceCatalog.tsx` — page body for `/marketplace`.

## What it does

Two surfaces in one component:

1. **Grid** of every marketplace-enabled franja, rendered as [[MarketplaceCard]] tiles. Sorted by listing count descending, then alphabetically — keeps the catalog reading as "active" (more inventory floats up).
2. **Overlay mount** — when `?franja=<slug>` is in the URL, mounts [[MarketplaceOverlay]] on top of the grid.

URL is the state. Clicking a card navigates to `?franja=<slug>`. Closing the overlay strips both `franja=` and `listing=` params (the overlay's own close handler only strips `listing=` — this catalog strips both so closing from the franja card never leaves an orphaned listing param).

## Props

| Prop | Type |
|------|------|
| `franjas` | `ContentItem[]` — pre-filtered to marketplace-enabled |

Franjas are server-prefetched by [[Marketplace Page]] so newly approved rows appear on the next request.

## Related

- [[Marketplace Page]] — server wrapper that passes the franjas prop
- [[MarketplaceCard]] — single franja tile
- [[MarketplaceOverlay]] — franja-level overlay (opened by URL param)
- [[MarketplaceListingDetail]] — listing sub-overlay (z-60, stacks above the overlay)
