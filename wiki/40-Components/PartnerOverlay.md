---
type: component
status: current
tags: [component, partner, overlay, dossier]
updated: 2026-06-25
---

# PartnerOverlay

> Standalone full-screen partner dossier — the lightweight peek opened from the [[PartnersRail]]. Revamped 2026-06-25 from a thin image-and-links overlay into a wide two-pane dossier with an `[ENTRAR]` CTA to the full [[Partner Page]].

## What

[components/overlay/PartnerOverlay.tsx](../../components/overlay/PartnerOverlay.tsx). Opens via `?item=<partner-slug>`. Unlike every other overlay it does NOT wrap in [[OverlayShell]] — [[OverlayRouter]] special-cases `type==='partner'` to render it standalone (own chrome, `max-w-6xl`, exit-anim, ESC), because OverlayShell's 1024px single panel was too cramped for a dossier.

Two-pane: identity aside (logo, kind badge, verified, title, meta, catalog facts, bio, CTAs) + content column (kind-adaptive `//PRÓXIMOS`/`//ARCHIVO` via the `KIND_SLOT` map, `//HISTORIA DESTACADA`, `//MERCADO`).

- **Catalog facts** replace vanity metrics (real `eventos`/`lanzamientos`/`artículos` counts, no followers — [[Size and Position as Only Signals]]).
- **`//MERCADO`** folds marketplace listings inline (reuses [[MarketplaceListingCard]]); a card opens [[MarketplaceListingDetail]] as a z-60 sub-overlay via LOCAL state (`activeListingId`), NOT a URL param — so it never collides with `useOverlay`'s `?item=`. Backdrop-click + ESC gated on `!activeListingId`.
- **`[ENTRAR AL PERFIL DE PARTNER]`** — prominent CTA → the full [[Partner Page]] (`/p/[slug]`).

Exports the reusable zone logic (`KIND_LABEL`, `KIND_SLOT`, `TYPE_LABEL`, `Fact`, `PartnerLinkedPeek`, `usePartnerItems`, `usePartnerCounts`, `useFeaturedItem`) consumed by both the overlay and [[Partner Page]] — one source of truth, no duplication.

## Why

The old overlay (image + two links) read as nothing. The revamp makes the rail click a real peek; the [[Partner Page]] is the deep destination. Kept as an overlay (not folded entirely into the page) to preserve the [[Contained Single Surface]] feel for casual browsing.

## How

- **Standalone render:** [[OverlayRouter]] renders `<PartnerOverlay exiting onExited>` directly for partners; the overlay implements its own backdrop/panel/exit (`overlay-panel-out`, 320ms) honoring the router's `exiting`/`onExited` contract.
- **Close-on-navigate gotcha:** the ENTRAR Link calls `close()` explicitly. `useOverlay().open()` sets `?item=` via `history.replaceState`, which Next's `useSearchParams()` never observes → `UrlSlugSync`'s slug stays null → a route nav to `/p/[slug]` produces no slug-change → the URL-sync never clears `openSlug`. ANY in-overlay Link to a real route must `close()`.
- **Schema:** the `verified` badge + `featuredItemId` resolve from migration 0040 columns (PENDING; graceful — undefined/hidden without them).

## Links
- [[Partner Page]] — the full /p/[slug] destination
- [[PartnersRail]] — opens this overlay
- [[OverlayRouter]] · [[OverlayShell]] — the standalone special-case
- [[MarketplaceListingDetail]] · [[Marketplace]]
- [[Partners Isolation]]
