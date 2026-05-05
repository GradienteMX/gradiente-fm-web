---
type: component
status: current
tags: [marketplace, overlay, partner, public]
updated: 2026-05-05
---

# MarketplaceOverlay

> Per-partner marketplace card — full-screen overlay opened via `?partner=<slug>` on `/marketplace`. Identity panel + listings grid layout matching the reference screenshot.

## Source

[components/marketplace/MarketplaceOverlay.tsx](../../components/marketplace/MarketplaceOverlay.tsx)

## Layout

```
┌────────────────────────────────────────────────────────────────┐
│ //MKT  GRADIENTE MARKETPLACE v1.0.3   R·06   ●ONLINE  [×]     │
├──────────────────────────┬─────────────────────────────────────┤
│ IDENTITY                 │ LISTADOS RECIENTES                  │
│  ★ MARKET                │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  N.A.A.F.I.              │  │ 01  │ │ 02  │ │ 03  │ │ 04  │   │
│  description             │  │     │ │     │ │     │ │     │   │
│  TOTAL / DISP / RES / SOLD│ └─────┘ └─────┘ └─────┘ └─────┘   │
│  UBICACIÓN / MONEDA / WEB│  …                                  │
│  consejo                 │                                     │
└──────────────────────────┴─────────────────────────────────────┘
```

- **Chrome row** — `//MKT GRADIENTE MARKETPLACE v1.0.3` + total listing count + `●ONLINE` chip + `[ESC] CERRAR`.
- **Identity panel** — partner name in massive Syne, description, two stat blocks (totals + location/currency/web), helper note about the partner being responsible for fulfillment.
- **Listings grid** — sorted by `publishedAt` desc; each tile is a [[MarketplaceListingCard]] with status pill (AVAILABLE green / RESERVED yellow / SOLD grey).

## URL-driven open

The overlay mounts when `?partner=<slug>` is set on `/marketplace`. Receives the resolved partner as a `partner: ContentItem | null` prop from [[MarketplaceCatalog]], which looks up the slug in its own server-fetched `partners` array (already includes `marketplace_listings` joined since migration 0010). No client-side fetch.

ESC closes (calls back into [[MarketplaceCatalog]] which strips the param). Click-outside backdrop also closes. Body scroll locked while open.

## Empty / disabled states

- Partner not found (bad slug, or disabled and not in catalog) → small error block with `//PARTNER·NO·ENCONTRADO`.
- Partner exists but `marketplaceEnabled === false` → `//MARKETPLACE·INACTIVO` panel explaining the partner isn't approved yet. (Reachable only if the catalog is ever loosened to include disabled partners.)
- Partner enabled but `marketplaceListings` empty → `//SIN·LISTINGS` block in the grid area.

## Links

- [[Marketplace]] — design decision
- [[MarketplaceCatalog]] — the parent that mounts this on `?partner=` and supplies the `partner` prop
- [[MarketplaceListingCard]] — the per-listing tile inside the grid
- [[MiPartnerSection]] — author-side counterpart that produces the data
