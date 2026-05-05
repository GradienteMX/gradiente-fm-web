---
type: decision
status: current
tags: [decision, marketplace, partners, identity, dashboard]
updated: 2026-04-30
---

# Decision — Marketplace

> Marketplace is partner-only commerce that lives at its own dedicated route. Each approved partner gets one marketplace card with N listings inside; team membership is a `partnerId` field on User (not a new role tier); a partner-admin flag inside the team handles add/remove of team members.

## Decision

Three identity layers, four UI surfaces, one dedicated route.

### Identity model

- **No new role tier.** Roles stay `user` / `curator` / `guide` / `insider` / `admin`. Partner-team membership is a separate axis: `partnerId?: string` on User.
- **In-team admin is a flag, not a role.** `partnerAdmin?: boolean` on User. Only meaningful when `partnerId` is set. Mirrors the `isMod` / `isOG` flag pattern from [[Roles and Ranks]].
- **Capability matrix:**
  - Site `admin` (role) — can approve any partner for marketplace, can edit any partner's marketplace card / listings, can assign any user to any partner's team, can promote/demote partner-admins.
  - **`partnerAdmin: true` (in-team admin)** — can add/kick team members of *their own partner*, plus everything below.
  - **Regular team member** (`partnerId` set, no admin flag) — can edit their partner's marketplace card + listings. Cannot manage team membership.
  - **Outside the team** — read-only view via `/marketplace`.

### Approval flow (4 steps)

1. **Site admin approves** a partner — `marketplaceEnabled: true` on the partner ContentItem (toggled from [[PartnerApprovalsSection]]).
2. **Partner team gains the dashboard section** — [[MiPartnerSection]] mounts in the sidebar for any user whose `partnerId` is set, named after the partner's title.
3. **Partner-admin (or site admin) manages team** — adds users via search picker (sets their `partnerId`), promotes/demotes the `partnerAdmin` flag, kicks members (clears `partnerId`).
4. **Team edits the marketplace** — description / location / currency on the card; CRUD on individual listings (title / category / condition / price / status / image / description).

### Public surfaces

- **`/marketplace` route** — top-level destination at `08 MARKETPLACE` in the [[Navigation]]. Catalog grid of every marketplace-enabled partner, sorted by listing count desc. Clicking a tile opens the per-partner overlay via `?partner=<slug>`.
- **[[MarketplaceOverlay]]** — full-screen reader matching the reference screenshot. Identity panel left (★ MARKET chip + partner name + description + stats + location/currency/web), listings grid right (numbered tiles with image / title / category / price / condition / vendor / status pill). Listings sorted by `publishedAt` desc.
- **Home entry** — both the small rail of marketplace-enabled partners (clickable thumbnails) and an `EXPLORAR MARKETPLACE →` CTA, sitting in the right column directly below the existing [[PartnersRail]]. Per Iker: Spanish UI keeps "marketplace" as the loanword.

### Storage model

The marketplace card fields live on the partner row in the `items` table (`marketplace_enabled`, `marketplace_description`, `marketplace_location`, `marketplace_currency`). Listings live in a sibling `marketplace_listings` table (added in migration 0010, FK CASCADE on partner_id) — chosen over a jsonb array on `items` so per-listing CRUD is race-safe, RLS gates per-row, and orphan-image cleanup has a real FK to traverse. One marketplace card per partner; many listing rows.

Writes flow through `/api/partners/[id]` (card) and `/api/partners/[id]/listings/[lid]` (listings). The historical visual-MVP layer (`lib/partnerOverrides.ts`, sessionStorage) was removed 2026-05-05.

User-side fields (`partnerId`, `partnerAdmin`) live on the `users` table; admin edits in /admin?tab=users PATCH `/api/admin/users/[id]`.

## Why these calls

**`partnerId` field, not a `partner` role.** Roles already have a clean tier model (creation tier + flags); adding a per-organization role would explode into N roles or require role parametrization (`partner:club-japan`). A scalar field plus a flag stays composable: a user can be a `guide` *and* a partner team member, no contradiction.

**One card per partner, listings inside.** The reference screenshot is one big card with a grid of items underneath. Modeling each item as a top-level marketplace card would mean N cards per partner cluttering the catalog — same problem the [[Partners Isolation]] decision avoided for the partners rail.

**Dedicated `/marketplace` route below the partners section.** Keeps marketplace from competing for HP/curation slots in the main feed (consistent with [[Partners Isolation]]). The home entry — rail + CTA — preserves discoverability without polluting the mosaic.

**Two-level team management (admin + partnerAdmin).** Per Iker: site admins shouldn't be the bottleneck for every team-member change. A partnerAdmin gives the team self-management while keeping the approval gate at the site level.

## Consequences

- **Pro:** marketplace is fully decoupled from the editorial feed. Adding/removing partners doesn't disturb HP curation or the home grid.
- **Pro:** the partner-side dashboard is fully gated — non-team users never see it; non-admins can't spawn new partners.
- **Pro:** seed data path: every existing partner ContentItem can be marketplace-enabled or not; the model adds one optional field set, no breaking changes.
- **Con:** session storage for partner overrides means a refresh resets seed values everywhere except the seeded `marketplaceEnabled: true` baked into N.A.A.F.I. Real backend solves this via Supabase persistence.
- **Con:** no per-listing `sellerId` yet — the listing card shows the partner's name as the implicit vendor. The reference screenshot has different vendor names per listing; if Iker wants that, it's a small follow-up (add `sellerId?: string` to MarketplaceListing + a team-member dropdown in the dashboard listing editor).
- **Con:** mosaic footprint of the home rail is fixed at 260px (matching [[PartnersRail]]). On narrow viewports the rail hides; mobile users find marketplace through the top nav.

## Alternatives rejected

1. **Marketplace as a content type in the main feed.** Considered briefly. Rejected for the same reason `partner` is rail-only — commerce crowds editorial when they share ranking pressure.
2. **Per-listing as a top-level card.** Cleanest data model, but produces a flooded catalog. The "one card with many listings" model is what the reference screenshot showed and what feels right for partner browsing.
3. **`partner` as a new role tier.** Considered. Rejected because a partner team member might also be a `guide` or `curator`; making `partner` a role would force a single-axis choice. Field-based partnership keeps it composable.
4. **Site admins as the only team-management path.** Rejected per Iker's feedback — partner-self-management is part of the value of being a partner. The `partnerAdmin` flag delegates the per-team capability while keeping site approval at the site level.

## Open follow-ups

- **Per-listing `sellerId`.** If multiple sellers within one partner team need attribution, add the field + dashboard dropdown.
- **Status transitions.** Admin/partner-admin can flip `available` / `reserved` / `sold` manually. A reservation timeout or buyer-side flow lives in the real-backend phase.
- **Search / filter inside the overlay.** Iker's reference screenshot shows quick-filter chips (`/ VINYL`, `/ CASSETTE`, etc.). Currently the listings grid is unfiltered.

## Planned refinement (handed off to next session)

After the v1 ship Iker provided a richer composer mockup and flagged two pain points: **listings are too barebones** (no detail surface, no embeds) and **the listing composer is too thin** (no multi-image, no subcategory, no tags, no shipping mode, no live preview). The work breakdown agreed on at session-end:

### Locked design calls

- **Public listing detail — sub-overlay** (not expand-in-place). Lets it deep-link as `?partner=<slug>&listing=<id>` matching the foro idiom.
- **Image upload UX — drag-and-drop or URL.** Match the existing dashboard-form drag-drop idiom (data URLs in sessionStorage) AND keep a "paste URL" field as fallback.

### Chunk A — type + storage extensions

- `MarketplaceListing` gains:
  - `images: string[]` (replaces single `imageUrl?` — first index = portada)
  - `subcategory?: string`
  - `tags?: string[]`
  - `shippingMode?: 'shipping' | 'local' | 'both'`
  - `embeds?: MixEmbed[]` (reuse the audio-system shape so SoundCloud / YouTube / Spotify / Bandcamp embeds work without new infra)
- Migrate the 6 N.A.A.F.I. seed listings to the new shape (single `imageUrl` → `images: [imageUrl]`).
- New const `SUBCATEGORIES_BY_CATEGORY` — first-pass catalog:
  - `vinyl` → `7"`, `10"`, `12"`, `LP`, `EP`, `Single`, `Compilation`, `Box Set`, `Picture Disc`, `Coloured`
  - `cassette` → `Album`, `EP`, `Mixtape`, `Bootleg`
  - `cd` → `Album`, `EP`, `Single`, `Compilation`, `Box Set`
  - `synth` → `Analog`, `Digital`, `Modular`, `Module`, `Software`
  - `drum-machine` → `Analog`, `Digital`, `Sampler`, `Hybrid`
  - `turntable` → `Direct Drive`, `Belt Drive`, `Cartridge`, `Slipmat`
  - `mixer` → `2-channel`, `4-channel`, `Rotary`, `Battle`, `Club`
  - `outboard` → `Effects`, `Compressor`, `EQ`, `Preamp`, `Other`
  - `merch` → `Camiseta`, `Sudadera`, `Gorra`, `Tote`, `Poster`, `Otro`
  - `other` → (no subcategory)

### Chunk B — listing composer rewrite (the meat)

Replace the current inline `ListingsEditor` inside [[MiPartnerSection]] with a three-zone layout matching Iker's mockup:

- **LEFT — `ListingComposer`** — full editor with character counters on title (80 max) + description (1000 max), category + subcategory pair, condition + price (currency derived from partner), estado as 3-button radio row (DISPONIBLE green / RESERVADO red / VENDIDO red), multi-image grid with portada label + X-remove + drag-to-reorder, description textarea, tags chip input, shipping-mode 3-card radio.
- **RIGHT — `ListingPreview`** — live preview pane with three sub-views:
  - VISTA DESTACADA (full ficha — large image + meta block + price + condition + vendor + description preview + status pill)
  - VISTA GRID (the existing card shape from public marketplace)
  - VISTA LISTA (linear-row variant: thumb + title + price + status)
- **BOTTOM — `ListingsTable`** — replace the current compact rows with a proper table: image, title, category, condition, price, estado, actualizado, actions (edit pencil / duplicate / delete-red). Pagination at 5 per page (current N.A.A.F.I. seed has 6, so this exercises page 2). `+ NUEVO LISTADO` button creates an empty draft and opens it in the composer.

Composer action row: `VISTA PREVIA` (opens the public detail overlay against the in-progress draft) / `GUARDAR BORRADOR` / `PUBLICAR ITEM` (green primary).

Image upload: use the same drag-drop wrapper as the existing dashboard-form `ImageUrlField` (data URL stored in sessionStorage via the partner override). Each image slot also accepts a pasted URL string. First image is implicit portada; reorder via drag-handle in the corner.

### Chunk C — public listing detail

Sub-overlay opened from [[MarketplaceOverlay]] when the user clicks a listing. URL becomes `?partner=<slug>&listing=<id>`. Layout:

- Left — image gallery (large main + thumbnail strip; click thumbnail to swap main).
- Right — full title, category / subcategory line, large price, condition badge, status pill, full description, tags chips, shipping-mode line, vendor line linking back to the partner card.
- If `embeds.length > 0` — render the existing [[Embed Primitive]] above the description (lets a vinyl listing link to a SoundCloud preview, a synth listing to a YouTube demo, etc.).
- ESC / `[× CERRAR]` strips `&listing=` and returns to the partner overlay.

### Suggested order

A → B → C. Chunk A is foundational (the type extensions block both UI chunks). Chunk B is the visual centerpiece — biggest scope, biggest visible win. Chunk C closes the read loop.

## Links

- [[userOverrides]] — extended for `partnerId` / `partnerAdmin`
- [[permissions]] — `canApprovePartner` / `canManagePartner` / `canManagePartnerTeam`
- [[PartnerApprovalsSection]] · [[MiPartnerSection]] · [[MarketplaceOverlay]] · [[MarketplaceCatalog]] · [[MarketplaceCard]] · [[MarketplaceListingCard]] · [[MarketplaceRail]]
- [[Roles and Ranks]] — the `isMod` / `isOG` flag pattern this borrows from
- [[Partners Isolation]] — the existing partner-rail decision the marketplace inherits from
