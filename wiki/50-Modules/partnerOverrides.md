---
type: module
status: current
tags: [marketplace, partner, sessionstorage, overrides]
updated: 2026-04-30
---

# partnerOverrides

> sessionStorage patch layer over partner ContentItems. Admin toggles `marketplaceEnabled`; the partner team edits `marketplaceDescription` / `marketplaceLocation` / `marketplaceCurrency` / `marketplaceListings`. Mirror of [[userOverrides]] for partner identities.

## Source

[lib/partnerOverrides.ts](../../lib/partnerOverrides.ts)

## Storage shape

`gradiente:partner-overrides`:

```ts
type OverrideMap = Record<string, PartnerOverride>

interface PartnerOverride {
  marketplaceEnabled?: boolean
  marketplaceDescription?: string
  marketplaceLocation?: string
  marketplaceCurrency?: string
  marketplaceListings?: MarketplaceListing[]   // full replacement
}
```

Same lifecycle as the rest of the session stores: survives reload, dies with the tab. Slug + image + partnerKind etc. live on the seed ContentItem and are never overridable.

## Read API

- `getPartnerOverride(id)` — raw override entry.
- `getResolvedPartnerById(id)` — seed merged with override; returns `undefined` for non-partner ids.
- `listResolvedPartners()` — all partners with overrides applied.
- `listMarketplaceEnabledPartners()` — drives the public catalog + home rail.

## Write API

- `setPartnerOverride(id, patch)` — patch-merge; noop-collapses against seed (drops the entry when the override matches seed exactly).
- `clearPartnerOverride(id)` — restores seed.
- `setMarketplaceEnabled(id, boolean)` — convenience for [[PartnerApprovalsSection]].

### Listing CRUD

All operate on the resolved listing array (seed + override merged) and write the full new array back through `setPartnerOverride`:

- `addMarketplaceListing(partnerId, listing)`
- `updateMarketplaceListing(partnerId, listingId, patch)` — patch-merge per listing.
- `removeMarketplaceListing(partnerId, listingId)`
- `newListingId(partnerId)` — session-prefixed id.

## Hooks

Synchronous-per-render with a tick-state listener — same pattern as `useResolvedUser` after the auth-flicker fix.

- `useResolvedPartner(id)` — single partner, live.
- `useResolvedPartners()` — full roster, live.
- `useMarketplaceEnabledPartners()` — filtered to `marketplaceEnabled === true`. Drives [[MarketplaceCatalog]] and [[MarketplaceRail]].

## Backend migration

When [[Supabase Migration]] lands, partner edits become updates on `content_items` rows (jsonb column for marketplace fields, or split into a sibling `marketplace_cards` table). RLS gates writes by:

- `marketplaceEnabled` → admins only (matches `canApprovePartner`).
- everything else → site admins OR users whose `partnerId` equals this partner (matches `canManagePartner`).

Hook signatures stay; consumers (catalog / overlay / dashboard) don't change.

## Links

- [[Marketplace]] — design doc
- [[mockData]] — seed partner ContentItems (N.A.A.F.I. has marketplace pre-enabled)
- [[userOverrides]] — extended for `partnerId` / `partnerAdmin`; same idiom
- [[permissions]] — `canApprovePartner` / `canManagePartner` / `canManagePartnerTeam`
- [[PartnerApprovalsSection]] · [[MiPartnerSection]] — admin and partner-team writers
- [[MarketplaceCatalog]] · [[MarketplaceOverlay]] · [[MarketplaceCard]] · [[MarketplaceListingCard]] · [[MarketplaceRail]] — read-side consumers
