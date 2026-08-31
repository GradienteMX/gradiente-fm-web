# MarketplaceCard

> `components/marketplace/MarketplaceCard.tsx` — single franja tile in the [[MarketplaceCatalog]] grid.

## What it does

Renders one marketplace-enabled franja as an image-forward card. Clicking navigates to `/marketplace?franja=<slug>`, which opens [[MarketplaceOverlay]] over the catalog.

Visual idiom mirrors [[FranjasRail]] (image-forward, NGE chrome) with additional marketplace meta in a three-column footer:

| Column | Value |
|--------|-------|
| ITEMS | Total listing count (padded to 2 digits) |
| DISPONIBLES | Available listings (green) |
| ZONA | `franja.marketplaceLocation` |

## Props

| Prop | Type |
|------|------|
| `franja` | `ContentItem` with `type === 'franja'` |

## Related

- [[MarketplaceCatalog]] — grid that renders these cards
- [[MarketplaceOverlay]] — opened on click via URL param
- [[MarketplaceListingCard]] — listing-level cards inside the overlay
