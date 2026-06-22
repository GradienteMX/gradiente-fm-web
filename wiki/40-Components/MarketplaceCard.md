# MarketplaceCard

> `components/marketplace/MarketplaceCard.tsx` — single partner tile in the [[MarketplaceCatalog]] grid.

## What it does

Renders one marketplace-enabled partner as an image-forward card. Clicking navigates to `/marketplace?partner=<slug>`, which opens [[MarketplaceOverlay]] over the catalog.

Visual idiom mirrors [[PartnersRail]] (image-forward, NGE chrome) with additional marketplace meta in a three-column footer:

| Column | Value |
|--------|-------|
| ITEMS | Total listing count (padded to 2 digits) |
| DISPONIBLES | Available listings (green) |
| ZONA | `partner.marketplaceLocation` |

## Props

| Prop | Type |
|------|------|
| `partner` | `ContentItem` with `type === 'partner'` |

## Related

- [[MarketplaceCatalog]] — grid that renders these cards
- [[MarketplaceOverlay]] — opened on click via URL param
- [[MarketplaceListingCard]] — listing-level cards inside the overlay
