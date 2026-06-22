# MarketplaceListingCard

> `components/marketplace/MarketplaceListingCard.tsx` — single listing tile inside [[MarketplaceOverlay]].

## What it does

Renders one `MarketplaceListing` as an image-forward card with:

- Numbered corner badge (`01`, `02`, …) matching the grid position
- Image or category label fallback
- Title + category chip (NGE orange)
- Price (`$X,XXX MXN`)
- Meta rows: condition / vendor / published-ago (Spanish relative time via `date-fns/es`)
- Status pill (AVAILABLE green / RESERVED amber / SOLD grey)

When `onClick` is provided the wrapper renders as a `<button>` (opens [[MarketplaceListingDetail]] sub-overlay). Without it renders as `<article>` — used in the dashboard composer's GRID preview where cards are non-interactive.

## Props

| Prop | Type | Notes |
|------|------|-------|
| `listing` | `MarketplaceListing` | |
| `partner` | `ContentItem` | For vendor name + currency |
| `index` | `number` | 1-based, drives the corner badge |
| `onClick` | `() => void?` | When provided, renders as `<button>` |

## Related

- [[MarketplaceOverlay]] — grid that renders these cards
- [[MarketplaceListingDetail]] — sub-overlay opened on click
- [[MiPartnerSection]] — dashboard surface where partners manage listings
