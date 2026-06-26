---
type: page
status: current
tags: [page, partner, dossier, route]
updated: 2026-06-25
---

# Partner Page

> `/p/[slug]` — the full partner profile (Concept-1 editorial dossier). The deep, shareable, indexable destination behind the rail overlay's `[ENTRAR AL PERFIL DE PARTNER]` CTA.

## What

A real Next route ([app/p/[slug]/page.tsx](../../app/p/%5Bslug%5D/page.tsx)) — a server component that fetches the partner via `getItemBySlug` (`notFound()` unless `type='partner'`) + their attributed content via `getItemsByPartner`, then renders [PartnerProfile.tsx](../../components/partner/PartnerProfile.tsx). Inherits the nav + `//VIBES` shell from the root layout; `generateMetadata` gives it real SEO.

Sections (top → bottom):

- **Header dossier** — logo, title, `PARTNER` + `VERIFICADO` badges, `DESDE`/location, tags, bio, web/contacto.
- **Résumé stats** — catalog facts ONLY (eventos / lanzamientos / artículos / publicaciones / productos / desde). **No vanity** (no seguidores/miembros) — see [[Size and Position as Only Signals]].
- **Última actividad** — the 3 most-recent attributed items.
- **`//PRÓXIMOS`** — upcoming-events rail.
- **`//ARCHIVO`** — type-tabbed grid (TODO / EVENTOS / LANZAMIENTOS / ARTÍCULOS / NOTICIAS).
- **`//MERCADO`** — real marketplace listings (reuses [[MarketplaceListingCard]] + [[MarketplaceListingDetail]]).
- **`//SEÑALES`** — digital-cosmetics MOCKUP (`MOCK_SENALES`, `// PRÓXIMAMENTE`) — no product class yet.
- **`//COMUNIDAD`** — catalog facts + a future `UNIRME AL CLUB` affordance.

## Why

The mockups are full-bleed multi-column pages; a centered modal can't do them justice. Iker overruled the overlay-only stance: the [[PartnerOverlay]] stays the lightweight peek, and `/p/[slug]` is the permanent destination.

**This is a real route, which relaxes [[Partners Isolation]] + [[Contained Single Surface]].** Precedent: `/e/[slug]` (entities) + `/u/[username]` (profiles) — identity hubs already route, partners are the same kind of hub. Flagged for datavismo sign-off.

## How

- **Server-fetched content (load-bearing).** `getItemsByPartner(partnerId)` ([lib/data/items.ts](../../lib/data/items.ts)) queries `items WHERE partner_id=X AND published`, passed as the `attributedItems` prop. PartnerProfile derives counts/featured/próximos/archivo/actividad from it via `useMemo` — NOT the client `itemsCache` (only warm on grid pages, so a direct visit would be empty).
- **Reuses overlay logic.** Imports `KIND_LABEL` / `TYPE_LABEL` from [[PartnerOverlay]]; marketplace cards from the marketplace module.
- **Opens linked items as overlays.** `useOverlay().open(slug)` stacks the item overlay over the page ([[OverlayRouter]] lives in the root layout).
- **Schema:** `verified` + `featured_item_id` columns (migration 0040 — PENDING; graceful without).

## Links
- [[PartnerOverlay]] — the peek that links here
- [[Partners Isolation]] · [[Contained Single Surface]] — the decisions this relaxes
- [[Marketplace]] · [[MarketplaceListingDetail]]
- [[Size and Position as Only Signals]] — why vanity stats are cut

## Open questions
- Authoring UI to set verified / featured / tags / bio / year (none yet).
- `//SEÑALES` needs the payments + order_items spine to become real.
- Attribution is sparse (only Club Japan) — most pages read empty until the scraper attributes more.
