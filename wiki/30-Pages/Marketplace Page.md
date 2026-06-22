# Marketplace Page

> `/marketplace` — public catalog listing every marketplace-enabled partner.

## What it is

Top-level destination that renders every partner with `marketplaceEnabled: true`. Sorted by listing count descending, then alphabetically. Clicking a partner tile appends `?partner=<slug>` to the URL, which mounts [[MarketplaceOverlay]] over the catalog without a route change.

Server-prefetched via `getItems()` so newly admin-approved partners appear on the next request without client-side sync. The `?partner=` param is read via `useSearchParams` inside [[MarketplaceCatalog]], which is wrapped in `<Suspense>` to satisfy the static build.

## Structure

```
MarketplacePage (server, force-dynamic)
  └── MarketplaceCatalog (client)
        ├── MarketplaceCard × N   (partner grid)
        └── MarketplaceOverlay    (mounted when ?partner= is present)
```

## URL pattern

| URL | State |
|-----|-------|
| `/marketplace` | Partner grid |
| `/marketplace?partner=naafi` | Partner overlay open |
| `/marketplace?partner=naafi&listing=abc123` | Listing detail sub-overlay open |

## Related

- [[MarketplaceCatalog]] — grid + overlay mount logic
- [[MarketplaceCard]] — single partner tile
- [[MarketplaceOverlay]] — per-partner full-screen overlay
- [[MarketplaceRail]] — home-page entry point (up to 3 partners + CTA)
- [[PartnerApprovalsSection]] — admin surface that flips `marketplaceEnabled`
- [[Marketplace]] — the decision note
