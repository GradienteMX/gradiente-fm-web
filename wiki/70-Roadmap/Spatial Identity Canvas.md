---
type: roadmap
status: draft
tags: [spatial-ui, honeycomb, partners, users, identity, affinity, hl, navigation]
updated: 2026-08-18
---

# Spatial Identity Canvas

> Draft specification for replacing conventional partner and user profile pages with one continuous, zoomable honeycomb canvas whose geometry is organized by content affinity and HL.

## Status

This is a **design and product specification** with a **working experimental prototype** (2026-08-18) at the `/mapa` route — see § Prototype findings below.

- The current [[Partner Page]] at `/p/[slug]` remains live and authoritative until this proposal is implemented.
- The current `/u/[username]` profile remains live.
- The partner direction is comparatively well defined after several visual concept passes.
- The user adaptation is included here as a reasoned extension of the same system, but trophies, saves, social relationships, and the exact identity treatment still need a dedicated design pass.
- Adopting this proposal would require explicit revisions to [[Partners Isolation]], [[Contained Single Surface]], [[ContentGrid]], and the current page-level navigation model.
- The prototype required NO revisions to those decisions: it is an additive experimental route; home/partner/user production surfaces are untouched.

## Prototype findings — 2026-08-18 vertical slice (`/mapa`)

First implementation pass. Architecture: pure deterministic layout engine in `lib/mapa/` (hex.ts · polyhex.ts · affinity.ts · layout.ts — no React, unit-tested via `npm run test:mapa`), consumed by a server component ([app/mapa/page.tsx](../../app/mapa/page.tsx)) that computes the layout once per request and hydrates [MapaCanvas](../../components/mapa/MapaCanvas.tsx) / [MapaCell](../../components/mapa/MapaCell.tsx) / [PartnerObi](../../components/mapa/PartnerObi.tsx). Full build/verify detail in the top [[log]] entry.

### Demonstrated from this spec

Continuous pannable/zoomable terrain (wheel/drag/pinch, restrained momentum) · real published content via `getItems()` (MOCK_ITEMS dev-seed fallback for anon dev, where RLS returns zero rows) · full-color imagery, type color ONLY on the exterior rim (existing `categoryColor` mapping) · every occupied hex is a content item (partner rows are never terrain) · deterministic placement (same dataset + timestamp → byte-identical layout, input-order-free) · metadata-affinity adjacency with type interspersion (repeated-type penalty, no category districts) · HL→1/3/7 polyhex vocabulary reusing the [[HP Curation System]] score thresholds (1.0/0.5) with a dominant cap of 4 and the plain-events-never-dominant rule from the home mosaic · exterior-only rim on multi-unit items with graphite interior seams · canonical [[Overlay System]] opens (origin = polyhex screen rect) · semantic zoom bands (far/mid/near change cell information density, CSS-gated) · keyboard six-neighbor traversal (roving tabindex; ↑↓←→ = N/S/NW-diag/SE-diag, ⌥ flips the diagonals) · reduced-motion fallback (no momentum, jump transitions) · `?focus=<slug>` deep link + pushState/popstate so browser Back restores scale and camera · partner focus that ZOOMS INTO the existing cluster (neighbors stay visible; neutral dashed perimeter) with the obi identity strip as non-terrain chrome.

### Consequential assumptions (flag for datavismo)

1. **Rim palette = existing `categoryColor`.** The spec's rim table (burnt orange evento, violet-family editorial, warm-sand marketplace…) differs from the live category colors. Prototype reuses the canonical mapping; the new palette is a [[Color System]] decision, not a prototype call.
2. **Archive included.** Past events stay on the map (spec open question 11). Emergent behavior is good: decayed HP → 1-unit cells, and prominence-ordered placement pushes them to the terrain periphery — the outskirts ARE the archive.
3. **"About the partner" ≠ attributed.** Focus eligibility is `items.partnerId` only (precedence rules 1–4). Editorial ABOUT Club Japan is not attributed in the seed; affinity places it adjacent to the cluster instead. This reads as the right answer to open question 10 — attribution stays strict, discovery happens through geography.
4. **Seed attribution added.** 5 mock items Club Japan publishes got `partnerId: "pa-club-japan"` stamps (mirrors prod's 3 attributed events on `pa-club-japan-ppur`). Attribution is hand-stamped editorial data, never inferred at runtime.
5. **Focus does not yet reflow.** Level-2 spec wants only-attributed content inside the focused perimeter with local re-arrangement; the slice zooms to the cluster in the global layout (attributed cells ARE the perimeter). Local reflow = later phase.
6. **`/mapa` stays invite-gated in prod** (dev-only anon allowance mirrors `/lab`). The route is experimental; no public exposure decision made.
7. **Items without images render as dark title panels** (~9% of seed). They are real content, so they stay on the terrain; treatment TBD.
8. **Dominant cap = 4** (xl + MAX_LG parity with the home grid). Without it, fresh text-heavy items would flood the terrain with rosettes — same failure mode `rankItems` solves.
9. **Type chips deviate from strict rim-only color** (pass 2). The approved mockups show category-colored boxed chips (`EVENTO` orange chip etc.), which contradicts this spec's "type color appears only on the exterior rim." The prototype follows the mockups — chips are chrome, not image tint — but the rule text needs reconciling.

### Discovered constraints

- **Partner identity data is thinner than the obi wants.** No address, schedule, or contact fields exist on partner rows: location falls back to `subtitle` ("Venue · Roma Norte"), schedule is the honest template line `HORARIO SEGÚN EVENTO` for venues, contact is derived from `partnerUrl` (`@JAPAN_CDMX` parsed from the Instagram URL). A real obi needs either partner-row columns (address/schedule/contact) or a structured link to the venue's `entities` row (which has `address` since 0039).
- **`getItemsByPartner()` is lean** (no entities/creator/aggregate attach) — fine for `/p/[slug]`, but affinity on entity signals needs the full `getItems()` merge. The map uses `getItems()`.
- **Mock genre ids skew legacy (68%)** — affinity must resolve through genre parents (`getRollup`-style), never raw id equality, or legacy↔leaf pairs of the same concept read as unrelated. Implemented via root expansion.
- **The `ra` provenance tag** (all 128 scraped events) must be excluded from tag affinity or the scraper firehose glues into one cluster. Implemented: only taxonomy tags count.
- **`setPointerCapture` on pointerdown kills cell clicks** (click retargets to the capture target). Capture only once the drag threshold is crossed. Same class of trap as the [[OverlayShell]] getBoundingClientRect memory.
- **HP decay makes aged seeds mostly 1-unit** (204/209 standard on the April–June seed). Honest HL behavior, but a fresh-content dataset is needed to evaluate the 1/3/7 texture properly.

### Not yet implemented (later phases)

Hierarchical coarse→fine cell resolution at approach scale (current semantic zoom changes information density, not cell granularity) · focused-cluster local reflow · marketplace listings as content nodes · `/p/[slug]` + `/u/[username]` mapping to focus states · user focus entirely · hysteresis/anchors across dataset changes (layout is deterministic per snapshot; cross-snapshot stability unmeasured) · semantic list fallback · true no-hole guarantee (compactness bias only; camera clamp is bbox-inset, so blob edges can expose black at extreme pan) · image lazy-loading beyond virtualization + the glass layer's texture LRU.

**Pass 2 (same day)** added a WebGL glass layer (refractive slabs per the reference video), slab grout via outline inset (`HEX_GAP`), partner-focus dim/emphasis, and zoom-performance fixes. **Pass 3 (same day) REMOVED the glass layer** on review — it distorted the content and its per-frame shader loop was the new lag — and rebuilt cells as HTML `<img>` + CSS `clip-path` (GIFs animate; GPU-composited zoom) with NO interior seams (a multi-unit item is one unbroken slab). The glass design is preserved in the pass-2 [[log]] entry if a future WebGPU/TSL attempt wants it; treat "cinematic glass" as an explicitly parked direction, not a pending task. Still open: real-machine frame-feel check (the dev browser pane throttles rAF) and pinch polish on touch hardware.

**Pass 5 (same day)** completed the focus cluster with marketplace listing nodes (canonical `?partner=&listing=` detail mounted over the map) and codified the placement model as [[Mapa Placement Rules]] — ten concise rules built around **mindshare geography**: identity bearings give every attributed identity a fixed compass direction its section grows toward. Remaining data/mechanism gaps live in that note's Open items.

**Pass 4 (same day)** shipped the Level-2 focus REFLOW ([lib/mapa/focus.ts](../../lib/mapa/focus.ts)): on partner focus the members gather into one contiguous, type-arc-ordered cluster around a central identity nucleus hex (translation-only moves, colliding neighbors displaced outward, 700ms transform transitions, derived layout for keyboard nav) — this supersedes the pass-1 "focus does not yet reflow" deviation (assumption 5 above). Club Japan's seed attribution was enriched to 11 items across 7 types (5 publisher stamps + 6 precedence-5 editorial attachments) instead of inventing a synthetic partner. THREE further mockup-driven deviations to reconcile with this spec's text: the identity nucleus consumes a terrain cell during focus (spec forbids identity hexes; mockups show one), focus types read as neat arcs (spec says "remain interspersed"), and category-colored type chips (spec says rim-only color). Marketplace listing nodes in the focus cluster remain the next data gap.

### Verification

`tsc` clean · `npm run test:mapa` 21/21 (determinism, affinity, connectivity, exterior edges) · `next lint` clean · prod `next build` clean (`/mapa` 8 kB, dynamic) · live walkthrough on :3003 (global → focus → obi → overlay → back-restore → keyboard traversal).

## Executive summary

Gradiente becomes a single spatial information environment rather than a set of conventional profile pages.

At the widest scale, the reader sees a global, pannable honeycomb containing content from the complete Gradiente ecosystem. Content attributed to partners and users forms recognizable local clusters through shared metadata, not through manually drawn sections or permanent category columns.

Selecting a partner or user does not replace the map with a disconnected page. The camera moves into the existing cluster. Coarse cells resolve into detailed content cells while preserving the underlying honeycomb coordinates. At the focused scale, a contextual identity strip appears and the cluster reorganizes locally according to content affinity and current HL.

The central rules are:

1. **The honeycomb is navigation.** No conventional partner-page submenu, category tabs, or secondary card grid.
2. **Every terrain unit carries content.** No decorative, blank, category-only, statistic-only, partner-name, or generic text hexes.
3. **Affinity determines neighborhood.** Related items become spatial neighbors because they share artists, genres, venues, entities, tags, dates, or attribution.
4. **HL determines area and gravity.** More alive content occupies more connected base units and receives more visual attention.
5. **Type is encoded only by the rim.** Images remain natural full color; category color never washes the content.
6. **Identity is contextual chrome.** Partner/user information lives in a dedicated strip, not in content real estate.
7. **The map is global and deterministic.** It is not a personalized recommendation surface and uses no behavioral profile.

## Goals

- Make partners and users feel native to Gradiente rather than bolted-on destination pages.
- Provide one-link identity destinations containing all public material associated with an identity.
- Preserve spatial context when moving between the global ecosystem and a focused identity.
- Turn HL into a legible physical property without exposing vanity metrics.
- Make metadata relationships discoverable through geography.
- Allow the interface to grow as content accumulates without adding menus or category silos.
- Reuse the real content model and overlay readers rather than creating a parallel partner-only publishing universe.

## Non-goals

- A literal geographic map of Mexico or any other territory.
- A conventional directory of partner logos.
- A dashboard, analytics surface, or knowledge graph diagram.
- Per-user behavioral personalization.
- Engagement-ranked recommendations.
- Visible follower totals, play counts, likes, trends, or numeric HL.
- Partner-colored continents.
- Category districts such as an event zone, mix zone, or marketplace zone.
- Replacing content overlays/readers with tiny hexagonal reading experiences.
- Moving authoring or partner administration onto the public map.

## Terminology

### Global canvas

The complete pannable and zoomable Gradiente honeycomb. It contains all eligible published content and the implicit clusters formed by that content.

### Base hex

The smallest terrain unit at the current detail level. Every visible base hex is occupied by a content item or is part of a multi-hex content item.

### Polyhex

A connected group of base hexes representing one content item. HL chooses the allowed polyhex size.

### Cluster

A locally coherent area produced by affinity placement. A cluster is **not** a manually authored page section or a permanent continent.

### Focus state

The close zoom level for one partner or user. The selected cluster expands in place and gains contextual identity chrome.

### Identity strip

The non-terrain surface containing a partner or user's identity information. The Club Japan concept uses a Japanese vinyl obi as the model.

### Affinity

A deterministic relationship score between content items based on shared metadata. Affinity affects adjacency, not prominence.

### HL and HP

The public/product language is **HL (half-life)**: content has energy that decays and can be renewed. The existing code and older wiki notes use **HP** for the stored scalar and curation math. In this proposal:

- **HL** is the user-facing concept.
- **HP** is the implementation value that drives it.
- Neither number is public.
- Size and position remain the only public prominence signals, preserving [[Size and Position as Only Signals]].

## Design principles

### One continuous surface

The global view and focused identity view are two scales of the same surface. A focus transition must not look like routing from a map to a separate microsite.

The reader should be able to recognize the selected cluster before, during, and after the zoom.

### Content before taxonomy

Taxonomy explains a card but never becomes terrain by itself. There are no hexes whose only purpose is to say `EVENTOS`, `MIXES`, `ARCHIVO`, `MERCADO`, or `COMUNIDAD`.

### Full-color source material

Flyers, covers, editorial images, marketplace photography, and avatars remain in their original color. Type color belongs exclusively to a thin outline around the item's exterior.

### Stable movement

Self-organization must feel alive without making the map impossible to learn. Minor metadata or HL changes must not cause the entire canvas to jump.

### Spatial honesty

Proximity must mean something. Two neighboring items should have a defensible metadata relationship. Decorative adjacency weakens the entire model.

## Information architecture by zoom level

### Level 0 — global ecosystem

The widest useful scale shows the complete Gradiente landscape.

- All visible cells are occupied.
- Content from partners, individual creators, editorial staff, marketplace sellers, venues, labels, artists, and collectives shares one lattice.
- Related content forms local neighborhoods automatically.
- Partner/user clusters can be recognized through the density and attribution of their content, but there are no permanent partner-colored landmasses.
- Partner names and logos do not consume hexes.
- A hover, focus, or selected-state banner may identify the cluster under inspection without becoming a terrain unit.
- Content is visually simplified at this scale: imagery and cluster silhouette dominate; detailed titles appear only where legible.
- The viewport crops occupied cells on every edge to communicate that the surface continues.

### Level 1 — approach

The approach state communicates continuity between global and focused scales.

- The camera moves toward the selected cluster.
- Coarse cells progressively resolve into smaller base units.
- Recognizable images and cluster boundaries persist across the transition.
- Neighboring clusters remain visible around the selected area.
- The selected identity strip begins to appear as contextual chrome.
- Content can shift locally as higher-resolution affinity data becomes available, but the cluster must not teleport or dissolve.

### Level 2 — partner focus

The partner cluster expands to occupy most of the viewport while remaining embedded in the global terrain.

- Only content attributed to, created by, sold by, or explicitly about the selected partner appears inside the focused perimeter.
- Neighboring global terrain remains partially visible beyond the perimeter.
- Internal content reflows by partner-local affinity and HL.
- Content types remain interspersed.
- A terrain-native `− ZOOM GLOBAL` affordance returns to the previous scale.
- Opening an item still uses the appropriate [[Overlay System]] reader/detail experience.
- The focus state is deep-linkable and indexable.

### Level 2 — user focus

The user version follows the same spatial contract:

- The cluster contains the user's published work and other explicitly public identity material.
- Authored content is arranged by affinity and HL rather than by chronology or category sections.
- Saved content remains private and does not enter the public cluster.
- Private presence/harvest/HL information remains owner-only.
- Public trophies and rank may appear in the identity strip, but they must not become popularity signals or content-ranking inputs.

The exact user-focused strip and the status of public comments, foro threads, and trophy history remain open design questions.

## Global cluster model

Partners are present globally, but they are not rendered as colored continents.

A partner's global presence emerges from:

- published items with `partner_id = partner.id`;
- partner-authored marketplace listings;
- items explicitly related to the partner through structured entity/relationship data;
- items published by partner team members when explicit partner attribution is enabled;
- the partner identity record used only for selection, metadata, SEO, and the focus strip.

The partner record itself is not a content hex.

At global scale, a partner with many mutually related items will naturally produce a more recognizable cluster. A partner with sparse content may occupy a small neighborhood until its archive grows.

This is a consequence of the content graph, not a manually assigned territory size.

## Partner-focused content eligibility

The focused cluster must use explicit attribution rules. Title substring matching such as searching for “Club Japan” is insufficient.

Recommended precedence:

1. **Direct attribution:** `items.partner_id` equals the selected partner.
2. **Marketplace ownership:** the listing belongs to the selected partner.
3. **Structured relationship:** the item links to the partner through a future `item_entities` or equivalent relation.
4. **Partner-team publishing:** a team member explicitly selected “vincular con mi partner” during authoring.
5. **Editorial association:** an admin/editor explicitly attached the partner entity.

The focused cluster must not infer ownership from author strings, venue strings, tags, or image filenames.

## Identity strip

### Partner strip

The Club Japan concept uses a Japanese vinyl obi, but the structural requirement is broader: every partner gets a compact, distinctive identity strip without consuming honeycomb cells.

Required information:

- logo;
- partner name;
- partner kind;
- concise description;
- location/address when relevant;
- schedule or availability when relevant;
- website/contact/social links;
- verification state when supported;
- shareable canonical URL.

Behavior:

- fixed within the partner focus viewport;
- never becomes a submenu;
- contains no category navigation;
- may collapse while the reader pans deeper into the cluster;
- must not obscure map interaction;
- should be partner-customizable within a controlled Gradiente template.

The Club Japan example uses:

- `CLUB JAPAN`;
- `MONTERREY 56 · ROMA NORTE · CDMX`;
- `HORARIO SEGÚN EVENTO`;
- `@JAPAN_CDMX`.

### User strip

Proposed public fields:

- avatar;
- display name and `@username`;
- role/rank and non-ranking identity flags;
- location;
- bio;
- editorial signature;
- public trophy summary;
- canonical profile link.

Private owner-only data such as current presence, harvest projections, saved content, drafts, and permissions stays in the dashboard.

## Content-cell anatomy

Every content surface must behave like a spatial version of [[ContentCard]].

Required elements:

- natural full-color image;
- small content-type label;
- title;
- minimal type-appropriate metadata;
- thin type-colored exterior rim;
- click/tap target opening the existing detail overlay;
- semantic DOM representation for accessibility and indexing.

Examples of useful metadata:

| Type | Minimal card metadata |
|---|---|
| evento | date, venue, key artists |
| mix | artist/source, duration where known |
| noticia | date or short dek |
| review | subject/record/venue and author |
| editorial/opinion/articulo | dek and author |
| listicle | short premise or item count |
| marketplace | product, price, status |

Forbidden cell types:

- partner logo only;
- partner name only;
- category name only;
- follower/member count;
- decorative waveform;
- generic `+` or empty placeholder;
- contact information without associated content;
- blank visual spacer.

## Rim color system

Category color appears only on the exterior rim of a content item.

| Type | Rim direction |
|---|---|
| evento | burnt orange |
| mix | cyan |
| review | muted yellow |
| editorial/opinion/articulo/listicle | violet family, with final mapping to follow [[Color System]] |
| marketplace | warm sand |
| noticia | red |

The rim must not:

- tint the image;
- create a filled category region;
- connect unrelated items into a category boundary;
- overpower the image or title;
- become an HL indicator.

## HL-to-geometry mapping

The spatial system replaces rectangular `sm/md/lg` spans with a small vocabulary of compact polyhexes.

Initial mapping:

| Public weight | Base units | Suggested shape | Meaning |
|---|---:|---|---|
| standard | 1 | single hex | ordinary/current item |
| elevated | 3 | compact trihex | medium HL |
| dominant | 7 | center + six-cell rosette or equivalent compact heptahex | highest HL |

Rules:

- Multi-hex content remains one card.
- One image and one information hierarchy flow across the occupied units.
- Fine graphite internal seams may remain visible to make the terrain units legible.
- Only the exterior edge receives the content-type rim.
- Shapes must be compact, connected, and chosen from a finite template set.
- Events can often receive more area because of imminence and HL, but no type receives a guaranteed size.
- Public numeric HL is never displayed.
- Publisher-only HL status may remain available as an optional private inspection layer, consistent with today's owner-only `HL·DÉBIL/FUERTE` chip.

The exact thresholds should reuse or replace the current [[HP Curation System]] tier boundaries through a deliberate migration rather than introducing an unrelated score.

## Affinity placement

### Inputs

Affinity should use structured metadata already present or planned in the content model:

- direct partner attribution;
- creator identity;
- subject entities;
- artists;
- labels;
- venues;
- genres;
- tags;
- city/location;
- event or publication date proximity;
- explicit related-content links;
- marketplace relationship to a release/event/entity.

Content type should not be a positive clustering input. A weak type-diversity tie-breaker may be used to prevent accidental walls of events or mixes.

### Conceptual score

```text
affinity(a, b) =
  w_partner  · same_partner
+ w_entity   · shared_entities
+ w_artist   · shared_artists
+ w_venue    · same_venue
+ w_genre    · genre_overlap
+ w_tag      · tag_overlap
+ w_creator  · same_creator
+ w_time     · time_proximity
+ w_related  · explicit_relation
- w_type_run · repeated_type_penalty
```

The weights are global editorial configuration, not learned from personal behavior.

### Separation of responsibilities

- **Affinity chooses neighbors.**
- **HL chooses area and local visual gravity.**
- **Content type chooses rim color.**
- **Identity attribution chooses focus eligibility.**
- **The viewer's history chooses none of these.**

This separation is essential. Combining the signals would make the geography difficult to reason about.

### Stability and hysteresis

A naive force-directed layout would constantly reshuffle. The production layout needs stability controls:

- deterministic seed from content/identity IDs;
- stable hierarchical hex coordinates;
- movement only when an affinity improvement clears a threshold;
- limited local swaps per update cycle;
- preserved anchors for recently viewed/selected items;
- layout snapshots or versioning when global recomputation is unavoidable;
- reduced-motion mode that updates without animated travel.

## No-empty-cell rule

The design intent is a fully occupied terrain. This does not require fabricating content.

At any viewport and zoom level:

- the renderer selects a populated region of the logical map;
- occupied cells extend beyond every visible edge;
- multi-hex items tessellate with smaller items;
- the camera avoids exposing unpopulated frontier space;
- sparse identity clusters may borrow contextual neighboring content at global/approach scales, but partner focus eligibility remains strict.

The system must never create fake category cells or decorative filler to close a geometric hole.

## Interaction model

### Pan

- Drag/trackpad pans the terrain.
- Momentum is restrained; this is editorial browsing, not a physics toy.
- Keyboard users can move to the six logical neighboring cells.

### Zoom

- Wheel/pinch changes semantic scale, not just CSS magnification.
- Selecting a partner/user cluster animates to its focus scale.
- The same coordinates remain recognizable throughout the transition.
- `− ZOOM GLOBAL` is a terrain-native affordance within or adjacent to the selected perimeter.
- Browser Back restores the previous camera/focus state.

### Open content

- Clicking a cell or polyhex opens the appropriate current overlay.
- The overlay origin should use the selected polyhex bounds, extending [[useOverlay]]'s existing origin-rect behavior.
- Closing the overlay returns to the same map coordinate and zoom.

### Share and deep links

Existing canonical routes should survive:

- `/p/[slug]` resolves directly to the partner focus state;
- `/u/[username]` resolves directly to the user focus state;
- item deep links continue to open the relevant content overlay;
- optional URL state can encode selected identity, item, zoom level, and camera anchor without exposing raw layout internals.

The map transition is the visual model; canonical routes remain valuable for SEO, accessibility, sharing, and server rendering.

## Public versus owner interaction

The public canvas is a browsing surface, not an editor.

### Public readers

- pan and zoom;
- focus a partner or user;
- open content;
- follow partner/user contact links;
- use existing comments, polls, saves, and vibe checks inside content detail surfaces.

### Content owners

- use Dashboard → Perfil for user identity edits;
- use [[MiPartnerSection]] for partner profile, team, publishing, marketplace, and listing management;
- continue to receive private HL/presence information where authorized;
- preview how edits affect the public focus strip and content attribution.

No inline public-map editing is included in this proposal.

## User-page adaptation

The user system should reuse the same engine rather than becoming a smaller conventional profile page.

Confirmed shared behavior:

- focus through spatial zoom;
- stable honeycomb coordinates;
- content arranged by affinity and HL;
- identity in contextual chrome;
- content opens existing overlays;
- no public popularity metrics;
- owner edits remain in the dashboard.

Items that require a dedicated user design decision:

- whether public trophies appear directly in the identity strip or in a secondary overlay;
- whether foro threads belong in the public cluster;
- whether public comments are content nodes or remain attached only to items;
- whether collaborations create shared boundary cells between users;
- whether a user with no published content receives a profile focus state or a compact identity overlay;
- how role, rank, OG, and mod flags read without overwhelming the strip;
- whether creator clusters can overlap partner clusters when the creator publishes on behalf of a partner.

## Marketplace behavior

Marketplace listings are content nodes, not a separate marketplace district.

- A listing is eligible inside a partner focus cluster when owned by that partner.
- Listings sit near related releases, events, artists, or genres.
- A record listing may touch its review, related mix, label, or launch event.
- Listing status and price are minimal card metadata.
- Opening a listing uses [[MarketplaceListingDetail]].
- Marketplace approval and management remain governed by [[Marketplace]].

## Compatibility with existing decisions

### Preserved

- [[Size and Position as Only Signals]] — HL is expressed through polyhex area and spatial gravity.
- [[No Algorithm]] — placement is deterministic metadata layout, not behavioral recommendation.
- [[Guides Not Gatekeepers]] — editorial content continues to coexist with community and partner content.
- [[Partner Authoring]] — partner-created material remains explicitly attributed.
- [[Overlay System]] — spatial cards still open the canonical detail experiences.

### Relaxed or superseded if adopted

- [[Partners Isolation]] — partners would no longer live only in a separate rail/route system, although partner identity records still must not masquerade as editorial content cards.
- [[Contained Single Surface]] — the canvas becomes the shared surface, while canonical focus routes remain addressable.
- [[Partner Page]] — the current dossier becomes the server/share entry point for a spatial partner focus state.
- [[ContentGrid]] — the rectangular mosaic would be replaced or complemented by a hierarchical honeycomb layout engine.

These changes require an explicit decision record before implementation.

## Data requirements

Minimum existing data:

- `items.id` and stable slug;
- `items.type`;
- `items.partner_id`;
- `items.created_by`;
- HL/HP snapshot and timestamps;
- genres and tags;
- dates and event windows;
- image URL;
- marketplace ownership and status;
- users and partner team membership.

Likely additions:

- structured partner/entity relations for “explicitly about” content;
- normalized artist, venue, label, and collective IDs;
- optional layout version/snapshot identifiers;
- deterministic global anchor assignment;
- relation confidence/provenance for scraped metadata;
- canonical identity-to-cluster lookup.

Layout coordinates should initially be derived rather than hand-authored. Persist them only if deterministic recomputation and hysteresis are insufficient.

## Rendering architecture considerations

The implementation surface has not been selected. Candidates include:

- DOM/CSS transforms for the cells with viewport virtualization;
- SVG for topology plus HTML content overlays;
- Canvas/WebGL for terrain with an accessible semantic DOM mirror;
- a hybrid similar to [[HTML-on-Canvas]].

Hard requirements regardless of renderer:

- semantic links/buttons for every visible item;
- server-renderable identity and content metadata;
- viewport virtualization;
- image lazy loading;
- deterministic layout between server and client;
- keyboard navigation by six hex neighbors;
- restore camera state after overlay close and browser navigation;
- testable coordinates and focus behavior;
- no reliance on rasterized text for the production UI.

## Accessibility

- Every content node must exist in a logical DOM reading order.
- Arrow-key or equivalent navigation must move predictably between neighboring cells.
- Focus state must remain visible independently of rim color.
- Type labels remain textual; rim color is supplementary.
- A reduced-motion preference must replace the animated zoom with a short cross-scale transition while preserving location context.
- Screen readers need identity context such as “Club Japan, partner focus, 12 published items.” This is semantic copy, not a visible vanity metric.
- A list representation may be offered as an accessibility fallback without becoming the primary visual navigation.
- Content overlays retain their existing headings, landmarks, and close behavior.

## Responsive behavior

Desktop is the concept reference, but the spatial contract must survive smaller screens.

Proposed mobile direction:

- the honeycomb remains pannable and zoomable;
- the identity obi becomes a collapsible horizontal record sleeve or narrow edge strip;
- a focused item expands enough to preserve readable title sizes;
- multi-hex weight remains visible, even if fewer neighboring items fit onscreen;
- pinch and double-tap zoom are first-class;
- the current [[PartnersDrawer]] becomes obsolete only after the canvas provides equivalent discovery;
- overlays continue to use the mobile comments sheet and responsive readers from [[Mobile Readiness]].

Exact mobile identity chrome remains open.

## Motion

Motion should explain topology, never decorate it.

Allowed:

- camera pan and semantic zoom;
- coarse cells resolving into finer cells;
- local cell swaps after meaningful affinity changes;
- polyhex expansion/contraction when HL crosses a tier;
- selected perimeter emphasis;
- overlay growth from the selected polyhex.

Avoid:

- perpetual idle drift;
- glowing scan effects;
- animated waveforms unrelated to playback;
- bouncing cells;
- random reshuffles;
- parallax that makes adjacency ambiguous;
- long zoom sequences that delay content access.

## Phased implementation

### Phase 0 — decision and prototype

- Approve or reject the spatial-canvas direction.
- Write the required ADR revisions.
- Build a static prototype using real production content.
- Validate the 1/3/7 polyhex vocabulary.
- Test whether readers understand affinity without explanatory labels.

### Phase 1 — geometry engine

- Define hierarchical hex coordinates.
- Implement deterministic affinity placement.
- Add stable anchors and hysteresis.
- Implement viewport virtualization.
- Create DOM-accessible content cells.

### Phase 2 — global read-only canvas

- Populate from current published items.
- Preserve existing overlays.
- Add pan, zoom, focus, Back restoration, and share URLs.
- Keep the current home grid available behind a feature flag during evaluation.

### Phase 3 — partner focus

- Map `/p/[slug]` to a partner focus state.
- Add the partner identity-strip template.
- Enforce explicit focus eligibility.
- Integrate marketplace nodes.
- Preserve partner dashboard management.

### Phase 4 — user focus

- Map `/u/[username]` to a user focus state.
- Add the user identity strip.
- Resolve trophies, foro, comments, collaborations, and empty-profile behavior.

### Phase 5 — responsive and accessibility hardening

- Mobile identity treatment.
- Keyboard neighbor navigation.
- Reduced-motion transition.
- Semantic list fallback.
- Performance tests against large archives.

### Phase 6 — migration

- Remove or archive obsolete partner rail/dossier surfaces only after analytics-free usability testing and team sign-off.
- Preserve redirects and canonical URLs.
- Update onboarding and [[Voice and Copy]].
- Refresh all affected wiki decisions and component notes.

## Acceptance criteria

### Global canvas

- [ ] Every visible base hex is occupied by real content or belongs to a real multi-hex item.
- [ ] No partner name, logo, category, statistic, or decorative filler consumes a content hex.
- [ ] Partner/user clusters emerge from attribution and affinity rather than manual regions.
- [ ] Neighbor relationships can be explained by structured metadata.
- [ ] Content types are interspersed rather than segregated.
- [ ] Images render in natural full color.
- [ ] Type color appears only on the item's exterior rim.

### Zoom continuity

- [ ] Selecting a partner/user zooms into the existing cluster rather than replacing the surface.
- [ ] Recognizable cells and cluster shape persist through the transition.
- [ ] Neighboring global terrain remains visible in the focused state.
- [ ] Browser Back restores the previous scale and camera position.
- [ ] Direct `/p/[slug]` and `/u/[username]` visits render the correct focus state.

### Focused partner

- [ ] The identity strip contains partner identity/contact data and no category navigation.
- [ ] Every internal card is explicitly eligible for the selected partner.
- [ ] Affinity determines adjacency.
- [ ] HL determines 1/3/7-unit area.
- [ ] Events may be larger but do not form an event district.
- [ ] Marketplace listings sit near related cultural content.
- [ ] Opening an item uses its canonical overlay/detail surface.

### Focused user

- [ ] The public cluster contains only public user material.
- [ ] Saved content, drafts, permissions, presence, and harvest data remain private.
- [ ] Public rank/trophies do not affect content placement.
- [ ] Profile edits remain in the dashboard.

### Accessibility and performance

- [ ] Every visible item has a semantic interactive DOM node.
- [ ] Keyboard users can traverse logical neighbors and exit focus.
- [ ] Reduced-motion mode avoids long spatial travel.
- [ ] Large canvases virtualize offscreen cells and images.
- [ ] Overlay close restores map state without layout drift.

## Open questions

1. What makes a partner cluster discoverable at global scale without putting a permanent partner-name hex in the terrain?
2. Should an identity banner appear on hover, selection, or only at focus scale?
3. How many hierarchy levels are needed between global and focused views?
4. Does a focused partner perimeter have a visible neutral outline, or is ownership communicated only by the identity strip and eligibility?
5. Should the global map include unattributed house-editorial content between partner/user neighborhoods?
6. What is the minimum content count required for an identity to receive a spatial cluster?
7. How should an empty or new user profile render?
8. Can one item appear in more than one identity focus cluster while retaining one canonical global coordinate?
9. How are collaborations represented without duplicating content?
10. Should partner-focused content include items merely about the partner, or only explicitly attributed/published items?
11. How should expired events remain available as archive nodes without dominating current geography?
12. What is the correct type-diversity penalty before it begins overriding genuine affinity?
13. Which renderer best balances visual scale, DOM semantics, SEO, and mobile performance?
14. Does the home page become the global canvas immediately, or does the canvas launch as an experimental route first?
15. Which existing partner surfaces remain as fallback during migration?

## Links

- [[Partner Page]]
- [[Partners Isolation]]
- [[Partner Authoring]]
- [[Marketplace]]
- [[HP Curation System]]
- [[Size and Position as Only Signals]]
- [[No Algorithm]]
- [[ContentGrid]]
- [[ContentCard]]
- [[Overlay System]]
- [[Contained Single Surface]]
- [[HTML-on-Canvas]]
- [[Mobile Readiness]]
- [[Dashboard Explorer]]
- [[MiPartnerSection]]

