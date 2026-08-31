---
type: page
status: current
tags: [page, franja, dossier, route]
updated: 2026-06-25
---

# Franja Page

> `/f/[slug]` — the full franja profile (Concept-1 editorial dossier). The deep, shareable, indexable destination behind the rail overlay's `[ENTRAR AL PERFIL DE FRANJA]` CTA.

## What

A real Next route ([app/f/[slug]/page.tsx](../../app/f/%5Bslug%5D/page.tsx)) — a server component that fetches the franja via `getItemBySlug` (`notFound()` unless `type='franja'`) + their attributed content via `getItemsByFranja`, then renders [FranjaProfile.tsx](../../components/franja/FranjaProfile.tsx). Inherits the nav + `//VIBES` shell from the root layout; `generateMetadata` gives it real SEO.

Sections (top → bottom):

- **Header dossier** — logo, title, `FRANJA` + `VERIFICADO` badges, `DESDE`/location, tags, bio, web/contacto.
- **Résumé stats** — catalog facts ONLY (eventos / lanzamientos / artículos / publicaciones / productos / desde). **No vanity** (no seguidores/miembros) — see [[Size and Position as Only Signals]].
- **Última actividad** — the 3 most-recent attributed items.
- **`//PRÓXIMOS`** — upcoming-events rail.
- **`//ARCHIVO`** — type-tabbed grid (TODO / EVENTOS / LANZAMIENTOS / ARTÍCULOS / NOTICIAS).
- **`//MERCADO`** — real marketplace listings (reuses [[MarketplaceListingCard]] + [[MarketplaceListingDetail]]).
- **`//SEÑALES`** — digital-cosmetics MOCKUP (`MOCK_SENALES`, `// PRÓXIMAMENTE`) — no product class yet.
- **`//COMUNIDAD`** — catalog facts + a future `UNIRME AL CLUB` affordance.

## Why

The mockups are full-bleed multi-column pages; a centered modal can't do them justice. Iker overruled the overlay-only stance: the [[FranjaOverlay]] stays the lightweight peek, and `/f/[slug]` is the permanent destination.

**This is a real route, which relaxes [[Franjas Isolation]] + [[Contained Single Surface]].** Precedent: `/e/[slug]` (entities) + `/u/[username]` (profiles) — identity hubs already route, franjas are the same kind of hub. Flagged for datavismo sign-off.

## How

- **Server-fetched content (load-bearing).** `getItemsByFranja(franjaId)` ([lib/data/items.ts](../../lib/data/items.ts)) queries `items WHERE franja_id=X AND published`, passed as the `attributedItems` prop. FranjaProfile derives counts/featured/próximos/archivo/actividad from it via `useMemo` — NOT the client `itemsCache` (only warm on grid pages, so a direct visit would be empty).
- **Reuses overlay logic.** Imports `KIND_LABEL` / `TYPE_LABEL` from [[FranjaOverlay]]; marketplace cards from the marketplace module.
- **Opens linked items as overlays.** `useOverlay().open(slug)` stacks the item overlay over the page ([[OverlayRouter]] lives in the root layout).
- **Schema:** `verified` + `featured_item_id` columns (migration 0040 — PENDING; graceful without).

## Links
- [[FranjaOverlay]] — the peek that links here
- [[Spatial Identity Canvas]] — draft future rework that would turn this dossier route into a focused state inside the global honeycomb
- [[Franjas Isolation]] · [[Contained Single Surface]] — the decisions this relaxes
- [[Marketplace]] · [[MarketplaceListingDetail]]
- [[Size and Position as Only Signals]] — why vanity stats are cut

## Open questions
- Authoring UI to set verified / featured / tags / bio / year (none yet).
- `//SEÑALES` needs the payments + order_items spine to become real.
- Attribution is sparse (only Club Japan) — most pages read empty until the scraper attributes more.
