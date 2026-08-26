---
type: decision
status: current
tags: [decision, marketplace, franjas, identity, dashboard]
updated: 2026-04-30
---

# Decision — Marketplace

> Marketplace is franja-only commerce that lives at its own dedicated route. Each approved franja gets one marketplace card with N listings inside; team membership is a `franjaId` field on User (not a new role tier); a franja-admin flag inside the team handles add/remove of team members.

## Decision

Three identity layers, four UI surfaces, one dedicated route.

### Identity model

- **No new role tier.** Roles stay `user` / `curator` / `guide` / `insider` / `admin`. Franja-team membership is a separate axis: `franjaId?: string` on User.
- **In-team admin is a flag, not a role.** `franjaAdmin?: boolean` on User. Only meaningful when `franjaId` is set. Mirrors the `isMod` / `isOG` flag pattern from [[Roles and Ranks]].
- **Capability matrix:**
  - Site `admin` (role) — can approve any franja for marketplace, can edit any franja's marketplace card / listings, can assign any user to any franja's team, can promote/demote franja-admins.
  - **`franjaAdmin: true` (in-team admin)** — can add/kick team members of *their own franja*, plus everything below.
  - **Regular team member** (`franjaId` set, no admin flag) — can edit their franja's marketplace card + listings. Cannot manage team membership.
  - **Outside the team** — read-only view via `/marketplace`.

### Approval flow (4 steps)

1. **Site admin approves** a franja — `marketplaceEnabled: true` on the franja ContentItem (toggled from [[FranjaApprovalsSection]]).
2. **Franja team gains the dashboard section** — [[MiFranjaSection]] mounts in the sidebar for any user whose `franjaId` is set, named after the franja's title.
3. **Franja-admin (or site admin) manages team** — adds users via search picker (sets their `franjaId`), promotes/demotes the `franjaAdmin` flag, kicks members (clears `franjaId`).
4. **Team edits the marketplace** — description / location / currency on the card; CRUD on individual listings (title / category / condition / price / status / image / description).

### Public surfaces

- **`/marketplace` route** — top-level destination at `08 MARKETPLACE` in the [[Navigation]]. Catalog grid of every marketplace-enabled franja, sorted by listing count desc. Clicking a tile opens the per-franja overlay via `?franja=<slug>`.
- **[[MarketplaceOverlay]]** — full-screen reader matching the reference screenshot. Identity panel left (★ MARKET chip + franja name + description + stats + location/currency/web), listings grid right (numbered tiles with image / title / category / price / condition / vendor / status pill). Listings sorted by `publishedAt` desc.
- **Home entry** — both the small rail of marketplace-enabled franjas (clickable thumbnails) and an `EXPLORAR MARKETPLACE →` CTA, sitting in the right column directly below the existing [[FranjasRail]]. Per Iker: Spanish UI keeps "marketplace" as the loanword.

### Storage model

The marketplace card fields live on the franja row in the `items` table (`marketplace_enabled`, `marketplace_description`, `marketplace_location`, `marketplace_currency`). Listings live in a sibling `marketplace_listings` table (added in migration 0010, FK CASCADE on franja_id) — chosen over a jsonb array on `items` so per-listing CRUD is race-safe, RLS gates per-row, and orphan-image cleanup has a real FK to traverse. One marketplace card per franja; many listing rows.

Writes flow through `/api/franjas/[id]` (card) and `/api/franjas/[id]/listings/[lid]` (listings). The historical visual-MVP layer (`lib/franjaOverrides.ts`, sessionStorage) was removed 2026-05-05.

User-side fields (`franjaId`, `franjaAdmin`) live on the `users` table; admin edits in /admin?tab=users PATCH `/api/admin/users/[id]`.

## Why these calls

**`franjaId` field, not a `franja` role.** Roles already have a clean tier model (creation tier + flags); adding a per-organization role would explode into N roles or require role parametrization (`franja:club-japan`). A scalar field plus a flag stays composable: a user can be a `guide` *and* a franja team member, no contradiction.

**One card per franja, listings inside.** The reference screenshot is one big card with a grid of items underneath. Modeling each item as a top-level marketplace card would mean N cards per franja cluttering the catalog — same problem the [[Franjas Isolation]] decision avoided for the franjas rail.

**Dedicated `/marketplace` route below the franjas section.** Keeps marketplace from competing for HP/curation slots in the main feed (consistent with [[Franjas Isolation]]). The home entry — rail + CTA — preserves discoverability without polluting the mosaic.

**Two-level team management (admin + franjaAdmin).** Per Iker: site admins shouldn't be the bottleneck for every team-member change. A franjaAdmin gives the team self-management while keeping the approval gate at the site level.

## Consequences

- **Pro:** marketplace is fully decoupled from the editorial feed. Adding/removing franjas doesn't disturb HP curation or the home grid.
- **Pro:** the franja-side dashboard is fully gated — non-team users never see it; non-admins can't spawn new franjas.
- **Pro:** seed data path: every existing franja ContentItem can be marketplace-enabled or not; the model adds one optional field set, no breaking changes.
- **Con:** session storage for franja overrides means a refresh resets seed values everywhere except the seeded `marketplaceEnabled: true` baked into N.A.A.F.I. Real backend solves this via Supabase persistence.
- **Con:** no per-listing `sellerId` yet — the listing card shows the franja's name as the implicit vendor. The reference screenshot has different vendor names per listing; if Iker wants that, it's a small follow-up (add `sellerId?: string` to MarketplaceListing + a team-member dropdown in the dashboard listing editor).
- **Con:** mosaic footprint of the home rail is fixed at 260px (matching [[FranjasRail]]). On narrow viewports the rail hides; mobile users find marketplace through the top nav.

## Alternatives rejected

1. **Marketplace as a content type in the main feed.** Considered briefly. Rejected for the same reason `franja` is rail-only — commerce crowds editorial when they share ranking pressure.
2. **Per-listing as a top-level card.** Cleanest data model, but produces a flooded catalog. The "one card with many listings" model is what the reference screenshot showed and what feels right for franja browsing.
3. **`franja` as a new role tier.** Considered. Rejected because a franja team member might also be a `guide` or `curator`; making `franja` a role would force a single-axis choice. Field-based franjaship keeps it composable.
4. **Site admins as the only team-management path.** Rejected per Iker's feedback — franja-self-management is part of the value of being a franja. The `franjaAdmin` flag delegates the per-team capability while keeping site approval at the site level.

## Open follow-ups

- **Per-listing `sellerId`.** If multiple sellers within one franja team need attribution, add the field + dashboard dropdown.
- **Status transitions.** Admin/franja-admin can flip `available` / `reserved` / `sold` manually. A reservation timeout or buyer-side flow lives in the real-backend phase.
- **Search / filter inside the overlay.** Iker's reference screenshot shows quick-filter chips (`/ VINYL`, `/ CASSETTE`, etc.). Currently the listings grid is unfiltered.

## Planned refinement (handed off to next session)

After the v1 ship Iker provided a richer composer mockup and flagged two pain points: **listings are too barebones** (no detail surface, no embeds) and **the listing composer is too thin** (no multi-image, no subcategory, no tags, no shipping mode, no live preview). The work breakdown agreed on at session-end:

### Locked design calls

- **Public listing detail — sub-overlay** (not expand-in-place). Lets it deep-link as `?franja=<slug>&listing=<id>` matching the foro idiom.
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

Replace the current inline `ListingsEditor` inside [[MiFranjaSection]] with a three-zone layout matching Iker's mockup:

- **LEFT — `ListingComposer`** — full editor with character counters on title (80 max) + description (1000 max), category + subcategory pair, condition + price (currency derived from franja), estado as 3-button radio row (DISPONIBLE green / RESERVADO red / VENDIDO red), multi-image grid with portada label + X-remove + drag-to-reorder, description textarea, tags chip input, shipping-mode 3-card radio.
- **RIGHT — `ListingPreview`** — live preview pane with three sub-views:
  - VISTA DESTACADA (full ficha — large image + meta block + price + condition + vendor + description preview + status pill)
  - VISTA GRID (the existing card shape from public marketplace)
  - VISTA LISTA (linear-row variant: thumb + title + price + status)
- **BOTTOM — `ListingsTable`** — replace the current compact rows with a proper table: image, title, category, condition, price, estado, actualizado, actions (edit pencil / duplicate / delete-red). Pagination at 5 per page (current N.A.A.F.I. seed has 6, so this exercises page 2). `+ NUEVO LISTADO` button creates an empty draft and opens it in the composer.

Composer action row: `VISTA PREVIA` (opens the public detail overlay against the in-progress draft) / `GUARDAR BORRADOR` / `PUBLICAR ITEM` (green primary).

Image upload: use the same drag-drop wrapper as the existing dashboard-form `ImageUrlField` (data URL stored in sessionStorage via the franja override). Each image slot also accepts a pasted URL string. First image is implicit portada; reorder via drag-handle in the corner.

### Chunk C — public listing detail

Sub-overlay opened from [[MarketplaceOverlay]] when the user clicks a listing. URL becomes `?franja=<slug>&listing=<id>`. Layout:

- Left — image gallery (large main + thumbnail strip; click thumbnail to swap main).
- Right — full title, category / subcategory line, large price, condition badge, status pill, full description, tags chips, shipping-mode line, vendor line linking back to the franja card.
- If `embeds.length > 0` — render the existing [[Embed Primitive]] above the description (lets a vinyl listing link to a SoundCloud preview, a synth listing to a YouTube demo, etc.).
- ESC / `[× CERRAR]` strips `&listing=` and returns to the franja overlay.

### Suggested order

A → B → C. Chunk A is foundational (the type extensions block both UI chunks). Chunk B is the visual centerpiece — biggest scope, biggest visible win. Chunk C closes the read loop.

## Links

- [[userOverrides]] — extended for `franjaId` / `franjaAdmin`
- [[permissions]] — `canApproveFranja` / `canManageFranja` / `canManageFranjaTeam`
- [[FranjaApprovalsSection]] · [[MiFranjaSection]] · [[MarketplaceOverlay]] · [[MarketplaceCatalog]] · [[MarketplaceCard]] · [[MarketplaceListingCard]] · [[MarketplaceRail]]
- [[Roles and Ranks]] — the `isMod` / `isOG` flag pattern this borrows from
- [[Franjas Isolation]] — the existing franja-rail decision the marketplace inherits from
