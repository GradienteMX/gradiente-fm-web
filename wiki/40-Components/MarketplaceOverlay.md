---
type: component
status: current
tags: [marketplace, overlay, partner, public]
updated: 2026-04-30
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

The overlay mounts when `?partner=<slug>` is set on `/marketplace`. Slug → seed-id lookup against `MOCK_ITEMS`, then live resolution via `useResolvedPartner(id)` from [[partnerOverrides]] so partner-team edits propagate without reload.

ESC closes (calls back into [[MarketplaceCatalog]] which strips the param). Click-outside backdrop also closes. Body scroll locked while open.

## Empty / disabled states

- Partner not found (bad slug) → small error block with `//PARTNER·NO·ENCONTRADO`.
- Partner exists but `marketplaceEnabled === false` → `//MARKETPLACE·INACTIVO` panel explaining the partner isn't approved yet.
- Partner enabled but `marketplaceListings` empty → `//SIN·LISTINGS` block in the grid area.

## Backend migration

When [[Supabase Migration]] lands, `useResolvedPartner` becomes a Supabase select. Listings might move into a sibling table — same hook signature suffices. The catalog/overlay component stays.

## Links

- [[Marketplace]] — design decision
- [[MarketplaceCatalog]] — the parent that mounts this on `?partner=`
- [[MarketplaceListingCard]] — the per-listing tile inside the grid
- [[partnerOverrides]] — `useResolvedPartner` source
- [[MiPartnerSection]] — author-side counterpart that produces the data
