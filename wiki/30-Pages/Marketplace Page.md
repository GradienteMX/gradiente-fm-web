# Marketplace Page

> `/marketplace` — public catalog listing every marketplace-enabled franja.

## What it is

Top-level destination that renders every franja with `marketplaceEnabled: true`. Sorted by listing count descending, then alphabetically. Clicking a franja tile appends `?franja=<slug>` to the URL, which mounts [[MarketplaceOverlay]] over the catalog without a route change.

Server-prefetched via `getItems()` so newly admin-approved franjas appear on the next request without client-side sync. The `?franja=` param is read via `useSearchParams` inside [[MarketplaceCatalog]], which is wrapped in `<Suspense>` to satisfy the static build.

## Structure

```
MarketplacePage (server, force-dynamic)
  └── MarketplaceCatalog (client)
        ├── MarketplaceCard × N   (franja grid)
        └── MarketplaceOverlay    (mounted when ?franja= is present)
```

## URL pattern

| URL | State |
|-----|-------|
| `/marketplace` | Franja grid |
| `/marketplace?franja=naafi` | Franja overlay open |
| `/marketplace?franja=naafi&listing=abc123` | Listing detail sub-overlay open |

## Related

- [[MarketplaceCatalog]] — grid + overlay mount logic
- [[MarketplaceCard]] — single franja tile
- [[MarketplaceOverlay]] — per-franja full-screen overlay
- [[MarketplaceRail]] — home-page entry point (up to 3 franjas + CTA)
- [[FranjaApprovalsSection]] — admin surface that flips `marketplaceEnabled`
- [[Marketplace]] — the decision note
