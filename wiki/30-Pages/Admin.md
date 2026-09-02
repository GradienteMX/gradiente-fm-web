---
type: page
status: current
tags: [page, admin, hp, hl, moderation, invites, waitlist]
updated: 2026-09-02
---

# Admin — `/admin`

> «CENTRAL DE ADMINISTRACIÓN». Seven tabs behind a server-side `role = 'admin'` gate. The one surface in the product that shows raw HL numbers, and the only place the curation model can be observed while it is being tuned.

> [!note] Supersedes the 2026-04-22 roadmap note
> This replaces `70-Roadmap/Admin Dashboard.md`, which described an `/admin/queue` · `/admin/items` · `/admin/hero` · `/admin/settings` route tree. **None of it was ever built.** `/admin` is one route with a `?tab=` param; there are no `/admin/*` sub-routes. The roadmap's body-field proposal (`body` / `externalUrl` on `ContentItem`) also never landed in that shape — longform arrived as `article_body` + `footnotes` instead. The note is deleted rather than kept as history, because a plausible-looking plan for a thing that exists differently is exactly what sends a future session hunting for files that are not there.

## The gate

[page.tsx](../../app/admin/page.tsx) is a server component with `dynamic = 'force-dynamic'`. It calls `supabase.auth.getUser()`, reads `users.role`, and `redirect('/')`s both anonymous callers and signed-in non-admins — the same destination for both, so the route's existence is not leaked to a logged-in reader. Eight accounts hold the role.

Writes go through `/api/admin/*`, each gated by `requireAdmin()` (or `requireMod()` for the moderation queue) from [requireAdmin.ts](../../lib/api/requireAdmin.ts). That gate uses the **caller's own session client**, never `createAdminClient()`, so RLS remains the enforcing layer and the route is a second lock. The service-role client is reached for separately and only where RLS genuinely blocks a legitimate admin read — per-item save counts under `user_saves_self_only`, cross-user drafts — never to skip the gate.

`/admin` is listed in `PAPER_ROUTES`; `<PaperGround/>` is mounted once in `app/layout.tsx`, so the page must not wrap itself in a `bg-paper` container.

## The seven tabs

### RESUMEN — the instrument

Reads `getAdminOverview(dias)` ([adminStats.ts](../../lib/data/adminStats.ts)), which aggregates in Node over ~600 item rows rather than in SQL. That is required, not a convenience: `items.hp` is a lazily-decayed snapshot anchored at `hp_last_updated_at`, so any `SUM(hp)` in Postgres adds up numbers of different ages. `currentHp()` is the only correct reading and it lives in TypeScript.

- **Five KPIs** — `HL ACTIVO` (live decayed HL across published non-seed non-franja items), `HL GANADO` (reader gains in the window, `null` when the window is entirely pre-ledger), `HP CREADORES`, `INTERACCIONES` (counted from `base_weight`, `null` when unknowable), `CONTENIDO ACTIVO`.
- **FLUJO DE VIDA** — a daily line chart with four series: HL ganada, HP creadores, decaimiento, and the net. Series colours and labels come from `SERIES_ON_LIGHT` / `SERIES_LABELS` in [kinds.ts](../../lib/hp/kinds.ts).
- **INTERACCIONES por tipo** — the per-kind breakdown, reader kinds only. Weight summed from `weight`, count from `base_weight`, em dash where the count cannot be known.
- **ATENCIÓN** — four rows of work waiting, each with a real count and a link that goes somewhere: items that dropped an HL bracket in 7 days, events with doors inside 48h, unpublished drafts, open reports. A row with a count of zero renders with no link rather than a dead affordance.
- **ROLLUP** — pending event count and last processed timestamp. Flagged `stale` when rows have sat unprocessed for over 15 minutes, which is two missed pg_cron ticks.
- **The acid ration** is spent here: one `AcidBlock` at the foot holding four peer create actions, not four acid buttons.

Franjas are excluded from `HL ACTIVO` — a 365-day half-life means they never decay and would dominate a "living HL" figure with what is really rail furniture. Unpublished and seed rows are excluded for the same reason: they are not in front of anyone.

### CONTENIDO — every type, not just events

Reads `listAdminItems()` ([adminItems.ts](../../lib/data/adminItems.ts)). **This is the tab that did not exist.** Before the redesign `/admin` could see one content type; the other 151 items — mixes, reseñas, editoriales, opiniones, artículos, listas, noticias — had no admin surface at all.

One row per item: decayed HL, bracket, state flags (`published` / `editorial` / `elevated` / `pinned` / `seed` / harvested), HL gained, HL lost to decay, admin injection if any, and a 7-day sparkline. Ranking happens in Node for the same anchor-age reason as RESUMEN — ordering by `items.hp` in SQL sorts snapshots of different ages against each other, so a stale row outranks a fresher one that is actually hotter.

Rows expand (`ExpandableRow`, one open at a time via `useSingleOpen`) into a dossier fetched from `GET /api/admin/items/[id]/stats?dias=` → `getAdminItemDetail()`: per-kind breakdown, exact save / comment / vibe-check / report counts read from their own tables, every admin adjustment the piece has received, and a daily net series. Fetched on expand rather than shipped with the list — a page holds 50 rows, and hydrating every dossier up front would mean 50 ledger scans and 200 count queries for the one row the operator opens.

The **HL lever** lives in that dossier: `POST /api/admin/items/[id]/hp`, a thin wrapper over `admin_adjust_item_hp()`. See [[Admin Instrument Exemption]] for what it is for, what it refuses to touch, and the per-type-peak side effect the UI states at the point of commit.

### EVENTOS — the events editor

`AdminEventsEditor`, unchanged in shape from before the redesign: a spreadsheet-style listing where each row is one event with its entity pickers (DJs / venue / promoter) and image upload inline. Reads `getAllEventsAdmin()`; saves per row to `POST /api/admin/events`, which upserts the item and delete-then-inserts its `item_entities` links, plus writes the venue address onto the linked venue entity (`entities.address`, migration 0039). Three defects in this path are listed under **Known limits** below.

### FRANJAS — franja CRUD + the marketplace kill-switch

`AdminFranjasComposer`, over `/api/admin/franjas`. `marketplace_enabled` is **self-service** for the franja team (MERCADO › AJUSTES on the dashboard); what survives here is an abuse override, not an approval queue. The dashboard's retired-approvals path redirects to `/admin?tab=franjas`, which is why the `franjas` key is listed in the alias table even though it did not change.

### USUARIOS — roles, flags, franja binding

`AdminUsersEditor`. The server prefetches three bounded lists rather than the whole roster: everyone with non-default permissions (`role != 'user'` OR `is_mod` OR `is_og` OR bound to a franja — the audit-staff workflow, ~50 rows even at scale), the 25 most recent signups, and 50 recent plain readers. Plus total user count, per-role counts, and the mod count. Writes go to `/api/admin/users`; lookup beyond those lists goes through `/api/admin/users/search`.

### ACCESO — invitaciones + espera

A merge of the two former tabs, with sub-tabs. **INVITACIONES** renders `AdminInviteCodes` over the full code book (`limit(1000)`; 217 codes and growing slowly) — the whole book so a specific person's code is always present for the client-side filter. An earlier `.limit(50)` left older redeemed codes off the end, where they read as "never invited". **ESPERA** renders `AdminWaitlist` over `waitlist_signups` ordered oldest-first, so the row index *is* the queue position. Both degrade to an empty list on error rather than failing the page — relevant when migration 0045 is unapplied.

### MODERACIÓN — the reports queue

`ModeracionTab`, over `GET /api/admin/reports?estado=` and `PATCH /api/admin/reports/[id]`. Substrate is the `reports` table from [0049 §7](../../supabase/migrations/0049_admin_central.sql).

Both routes are gated with `requireMod()`, not `requireAdmin()`: `reports_read_staff` admits `private.auth_is_mod_or_admin()`, and a route stricter than its own RLS would hand mods a 403 on rows the database would have shown them. The two predicates are mirrors and must move together — `canModerate()` in `lib/permissions.ts` is the TS side of the same pair.

Three states: `abierto`, `resuelto` (action was taken), `descartado` (reviewed, needed none). Both outcomes are kept — collapsing them loses the difference between "we fixed it" and "we disagreed", which is the thing a queue exists to record. **There is no DELETE**, here or in RLS: a resolved report is the record that a person looked. `target_id` carries no FK — it is polymorphic across five tables whose keys are not even the same type — so a report outlives its target and the queue renders orphans as «OBJETO ELIMINADO» rather than dropping them.

The open-report count rides on the MODERACIÓN latch on **every** tab, so work arrives visibly without a visit. It degrades to `undefined` — no count, no dot — when 0049 is unapplied, never to a placeholder zero.

## URL contract

Everything lives in query params on one route; there are no `/admin/*` sub-routes.

| Param | Values | Notes |
|---|---|---|
| `tab` | `resumen` · `contenido` · `eventos` · `franjas` · `usuarios` · `acceso` · `moderacion` | Absent or unknown → `resumen`. `/admin` bare is the canonical RESUMEN URL. |
| `sub` | e.g. `invitaciones` · `espera` | Sub-tab within a tab that has them. |
| `dias` | 7–180, default 30 | Clamped by `clampDays()`. The ceiling is the ledger's own retention (`sweep_old_hp_events`), so a longer window could only add empty space. |
| `tipo` · `estado` · `q` · `orden` | CONTENIDO filters | `orden` ∈ `hp` · `reciente` · `delta` · `caida`. |

**Legacy aliases** ([tabs.ts](../../lib/admin/tabs.ts)) — old values are aliased, never dropped:

| Old | Lands on |
|---|---|
| `?tab=invites` | ACCESO, sub `invitaciones` |
| `?tab=espera` | ACCESO, sub `espera` |
| `?tab=users` | USUARIOS |
| `?tab=events` | EVENTOS |
| `?tab=franjas` | FRANJAS (unchanged; listed because `app/dashboard/page.tsx` links to it by name) |

`resolveAdminTab()` is the single resolver and **both** the server page and `AdminTabNav` call it. They used to disagree: the page fell back to `invites` for an unknown value while the tab bar cast the raw param straight to its union, so `?tab=bogus` rendered INVITACIONES content with no tab latched — a state where the panel contradicted itself about where you were.

## Chrome

«EL PLIEGO» throughout, via [admin/kit.tsx](../../components/admin/kit.tsx), which re-exports the [espacios](../../components/dashboard/espacios/kit.tsx) primitives (`Sheet`, `SheetTable`, `Chip`, `InkButton`, `SubTabs`, `AcidBlock`, `EmptyLine`, `ErrorLine`, `MarginNote`, `SpaceHead`, `FOCUS_RING`) and adds the instrument pieces (`StatBlock`, `StatStrip`, `BarMeter`, `KindBreakdown`, `Sparkline`, `LineChart`, `ExpandableRow`, `LatchBar`, `useSingleOpen`). **Import from there.** `FOCUS_RING` had six copies before this kit existed; that is the problem it was made to end.

`LatchBar` is also the one implementation of the ink-fill latch grammar, replacing the two that existed (`AdminTabNav`'s own, and `DashTabBar`'s, which is hard-bound to `EspacioId`).

Colour never travels alone: every kind and type swatch carries its two-letter code (`KIND_CODES`, `TYPE_CODES`). `KIND_ON_LIGHT` is deliberately disjoint from `CATEGORY_ON_LIGHT`, because a CONTENIDO row shows a content-type swatch and a kind breakdown side by side and two palettes that alias would make the row unreadable.

## Known limits

These are stated on the surface itself, in `MarginNote`s. They are not deferred work — they are what the data can and cannot say.

- **The item-side ledger starts at `LEDGER_EPOCH`.** Any window reaching further back is partly blind, and the panel says how blind rather than drawing empty chart. ~2,110 pre-migration events were destroyed and cannot be recovered. See [[HL Ledger]].
- **`weight` is not a count.** Counts come from `base_weight`; where it is `NULL` (pre-0049 rows, and both system kinds) the cell prints an em dash — never `0`, never a figure derived from `weight`.
- **`DECAIMIENTO` is not corpus-wide decay.** It covers only items the rollup re-anchored in the same tick. Gains plus that decay equal the true net change in `items.hp`, which is what the net line means; the other ~590 items are decaying invisibly.
- **No per-user attribution of interactions.** `hp_events` has no `user_id`, by design, and must not get one. [[Admin Instrument Exemption]] §1.
- **EVENTOS: every save force-publishes.** `contentItemToRow()` defaults `published: true` and `POST /api/admin/events` passes no `opts`, so correcting a typo on an unpublished scraped draft silently puts it live. `ContentItem` carries no `published` field at all, so the editor cannot even display the state it is overwriting.
- **EVENTOS: every save stamps `seed: false`.** Same helper. That flag is the provenance marker the Noche Negra importer's `--revert` is scoped by, and the seed-vs-real distinction elsewhere.
- **EVENTOS: the listing is unbounded and back-to-front.** `getAllEventsAdmin()` selects every `type = 'evento'` row with no limit and no window, ordered by `date` ascending — 450 rows in production, oldest first, all shipped to the client as editable rows with entity pickers. The events an operator needs are at the bottom.
- **The ATENCIÓN row for events links to `?tab=eventos&filtro=proximos`.** Confirm EVENTOS actually reads `filtro` and that the server page's `searchParams` type lists it; otherwise the link lands on an unfiltered listing and the affordance is decorative.
- **No reader-side report gesture exists yet.** `POST /api/reports` is live and RLS-enforced, and the queue reads it, but nothing in the product currently calls it. Until a report button ships somewhere a reader can reach, MODERACIÓN is correct and empty. It is deliberately empty rather than seeded: prod holds 31 comments, 4 tombstoned, three of those author self-deletes — exactly **one** moderator action in four months, and a tile wired to the tombstone count would have overstated real moderation four-fold.

## Links

- [[Admin Instrument Exemption]] — why this surface may show numbers nothing else may
- [[HL Ledger]] — the substrate, and what it cannot say
- [[HP Curation System]] · [[curation]] — the model being calibrated
- [[Dashboard]] — the insider-side surface; PANEL · PUBLICAR · FRANJA · MERCADO
- [espacios/kit.tsx](../../components/dashboard/espacios/kit.tsx) — the source of the primitives `components/admin/kit.tsx` re-exports
- [[Scraper Pipeline]] — what fills EVENTOS
- [[Backend Plan]] · [[Roles and Ranks]] · [[Marketplace]]
