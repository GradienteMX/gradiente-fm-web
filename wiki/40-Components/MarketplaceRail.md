# MarketplaceRail

> `components/marketplace/MarketplaceRail.tsx` — home-page entry point for the marketplace.

## What it does

Mounted in the home page right column, directly below [[PartnersRail]]. Renders nothing when zero partners have `marketplaceEnabled` (keeps the home page clean in the bare seed state).

Two pieces:
1. Up to 3 partner thumbnails (the most-stocked, by listing count desc) — each links to `/marketplace?partner=<slug>` which opens [[MarketplaceOverlay]] over the catalog
2. `EXPLORAR MARKETPLACE` CTA linking to `/marketplace`

Partners are server-prefetched by the home page so newly approved rows appear on the next request.

## Props

| Prop | Type |
|------|------|
| `partners` | `ContentItem[]` — pre-filtered to marketplace-enabled |

## Design note

The section header uses `//MARKETPLACE` in amber (`#FBBF24`) — the same yellow used throughout the marketplace surface to distinguish it from the NGE orange of the main editorial system.

## Related

- [[Marketplace Page]] — full catalog
- [[MarketplaceCatalog]] — catalog grid + overlay mount
- [[MarketplaceCard]] — the full partner tile (used on `/marketplace`)
- [[PartnersRail]] — mounted above this on the home page
