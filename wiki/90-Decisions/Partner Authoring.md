---
type: decision
status: current
tags: [decision, partners, authoring, attribution, trust]
updated: 2026-05-14
---

# Decision — Partner Authoring

> Partner teams can publish content into the main feed. Trust is mediated by transparent attribution, not by pre-publish review. The marketplace-approval gate doubles as the publishing gate — once a partner is approved for marketplace, they can author into the feed.

## The thesis

From the project lead, on whether partner content blurs editorial integrity:

> "Partners are trusted members that actively participate in the growth of the scene. A clear indicator that this was partner content keeps us transparent without blurring the line with our philosophy."

The objection [[Partners Isolation]] raises — *"mixing paid/sponsored placements with curated picks corrodes trust"* — assumes the reader can't tell which is which. Transparent on-card attribution defuses that assumption. A clearly-bylined guest column doesn't corrode the masthead.

## Decisions

### 1. Auto-publish, gated by partner existence

Any approved partner (one with a row in the `items` table — admin-created via the existing partner-onboarding flow) can author directly into the feed. No per-item admin review. The gate is **who can author**, not **what gets through**.

**Important: publishing approval is separate from marketplace approval.** A partner exists when an admin creates the partner row. That existence is the publishing trust gate — the partner is already vetted at the org level. The `marketplace_enabled` flag is an *additional* capability that lets the partner sell listings; it does NOT gate content publishing. A venue partner with marketplace off still publishes events/mixes/noticias normally.

Admin still has moderation backstop — flag → review → unpublish, mirroring how comments work. Not a pre-publish gate.

### 2. Scope = `evento` · `mix` · `noticia` · `opinion` · `listicle`

Partner teams can author these five content types. They are scene-voice content: things venues, labels, and promoters legitimately produce — including their own opinion columns about the scene and ranked-list pieces (a label might publish a "top 10 releases this season" listicle).

Out of scope for partner teams: `editorial` · `review` · `articulo`. These are house-voice content requiring an editorial process — reviewing a record needs distance from the artist; an editorial is the publication's masthead voice; an articulo is reported longform. The line is **scene voice vs house voice**, not skill or trust. A resident DJ at a partner venue who wants to publish a review does so as a person — by being granted `insider` role on their User account, not via their partner team.

### 3. Transparent attribution chrome (three surfaces)

Borrow the existing visual vocabulary; don't invent new primitives.

- **Card chip** — same shape and position as the `//FUENTE: RA` scraper-provenance chip. Label derives from `partnerKind`:
  - `venue` → `//PRESENTA · CLUB JAPAN`
  - `label` → `//SELLO · N.A.A.F.I.`
  - `promoter` · `promo` → `//PROMOTORA · ESPACIO DINAMISMO`
  - `dealer` → `//DEALER · FAUNA`
  - `sponsored` → `//PRESENTA · X` (kept neutral)
  - Click opens the partner's [[MarketplaceOverlay]].
- **Card accent** — 1px left-border in NGE orange (no per-partner color scheme yet). Subtle; reads as provenance, not advertisement.
- **Overlay byline** — `[[OverlayShell]]` header shows `PUBLICADO POR //CLUB JAPAN` linking back. Mirrors the existing `author` byline on editorials.

The chip is the trust mechanism. The reader is told who authored, the reader decides.

### 4. Data model

Add `partnerId?: string` to `ContentItem`. References the partner org. When set on a non-partner item, the attribution chrome above renders.

`source: 'manual:partner'` (already reserved in the `ContentSource` enum) is stamped alongside `partnerId`. The two fields together mean "authored by this partner team manually" — distinct from `manual:editor` (house editorial) and `scraper:ra` (RA pipeline).

### 5. Dashboard surface

New `//PUBLICAR` tab in [[MiPartnerSection]] (third tab, alongside Marketplace + Equipo). Reuses the existing `TypePicker` + per-type form components (`EventoForm`, `MixForm`, `NoticiaForm`, `OpinionForm`, `ListicleForm`) — no new composer plumbing. Submissions are stamped server-side with `source: 'manual:partner'` + `partnerId: <theirs>` + `editorial: true` (so partner-authored content appears in both EventosRail and the main mosaic by default — the partner is the curator of their own content, the editorial flag matches that role).

For events: `venue` and `venueCity` default from the partner's stored values, editable per-event.

### 6. Per-partner curation cap — deferred knob

A single partner concentrated at the top of the mosaic is a fairness problem (not a trust problem — attribution is honest). The fix is a curation-rank cap: "no more than N items from the same `partnerId` in the top K home positions."

**Not built yet.** Currently the page has a low partner count and low publishing rhythm — building this cap pre-emptively would be infrastructure for a problem that doesn't exist. Same posture as [[HP Curation System]]'s writer side and the deferred external-monitor decisions in the [[Backend Plan]].

Triggering condition for building: when any single partner has 3+ concurrent items in the top 12 home positions, or when we see a partner publishing >2 items/week sustained. Then the cap lands next to the existing `MAX_LG` knob in `lib/curation.ts` and is tunable the same way.

## Why this is consistent with existing philosophy

**[[Guides Not Gatekeepers]]** — the HP decay is the democratic mechanism for *all* content in the grid. Partner-authored items decay the same way; if readers don't interact, they fade. The system already trusts the audience to vote with attention — adding partner content widens the input set, not the ranking math.

**[[Partners Isolation]]** — that decision was about partner-AS-ORG cards staying in the rail. The wiki note explicitly carves out: *"An event at a partner venue is still an evento, not a partner. The partner card for the venue and the event card for the night can coexist."* Partner-authored content was always allowed in the grid; what changes is who can author it (previously: editors only; now: the partner team).

**[[Marketplace]]** — the `partnerId` + `partnerAdmin` identity layer already exists. Marketplace approval continues to gate listing sales; this decision adds a separate, more permissive gate for content publishing (any approved partner can publish, marketplace-enabled or not). This decision adds one field on `ContentItem` and one tab on `MiPartnerSection`; everything else is reuse.

**[[No Algorithm]]** — no personalization, no recommender. Partner content competes in the same ranking pass as everything else.

## Alternatives rejected

1. **Per-item admin review queue.** Tempting but redundant: the partner-existence gate (admin-created partner row) already vets the org. A second per-item gate creates admin labor without adding signal.

2. **Marketplace approval as the publishing gate.** Considered briefly during the design conversation. Rejected because the two gates serve different purposes: marketplace approval is about commerce (does this org get to sell on our platform?), while publishing approval is about editorial trust (does this org belong in the feed?). A venue partner posting their weekly events shouldn't need to also enable marketplace.
2. **`partner` as a new role tier.** Already rejected in [[Marketplace]]; doesn't compose with existing roles (a user might be both `guide` and partner team).
3. **Unattributed partner content (no chip).** Defeats the transparency mechanism that lets this work philosophically. Non-starter.
4. **Sponsored-style banner attribution.** Too loud — pushes the content toward "AD" framing, which the project lead explicitly doesn't want. The chip + 1px accent + overlay byline is the right register.
5. **Allowing partners to author `editorial` / `review` / `articulo`.** Blurs house voice and scene voice. The `insider` role escape hatch (per-person, not per-org) covers the legitimate case (a DJ at a partner venue who can write).
6. **Hard rate limits on partner publishing.** Hostile UX, premature given current volume. Per-partner curation cap (deferred) is the fairness lever when needed.

## Consequences

- **Pro:** Partners gain authoring without new approval infrastructure. Marketplace approval becomes the single gate.
- **Pro:** Transparent attribution preserves [[Partners Isolation]]'s editorial-integrity goal while widening the input set.
- **Pro:** Reuses existing dashboard composer, permission helpers, and `ContentSource` enum value. Minimal new surface.
- **Pro:** Low-volume posture — fairness gate is deferred until a real problem appears, matching the [[Backend Plan]] philosophy of deferring infrastructure until traffic justifies it.
- **Con:** A partner with poor taste can publish into the feed without pre-review. Mitigation: HP decay + admin unpublish backstop + marketplace-approval gate at the org level.
- **Con:** Self-promotion temptation increases once partners realize publishing is auto. Mitigation lives in the deferred curation cap when needed.
- **Con:** The `//PRESENTA · X` chip vocabulary needs to land before the first partner-authored item ships, otherwise readers see uncontextualized partner content briefly.

## Implementation order (when we build)

1. **Types + provenance chip** — `partnerId?: string` on `ContentItem`; `//PRESENTA · X` chrome renders on cards + overlay byline. Ship behind feature flag, no authoring surface yet.
2. **MiPartnerSection `//PUBLICAR` tab** — reuse TypePicker + EventoForm/MixForm/NoticiaForm; publish path stamps `source` + `partnerId`.
3. **Moderation backstop** — admin can unpublish via existing admin tooling (no new queue surface).
4. **Defer:** scraper auto-claim, recurring events, inherited crowd vibe defaults, post-event recap nudge, earned auto-publish per type. These were generated as ideation in the design conversation — keep them in mind, do not build pre-emptively.

## Links

- [[Marketplace]] — the approval gate this rides on
- [[Partners Isolation]] — the rule this clarifies (org cards rail-only; partner-authored content grid-eligible)
- [[Guides Not Gatekeepers]] — the philosophy this extends
- [[No Algorithm]] · [[Editorial Flag]] · [[HP Curation System]]
- [[MiPartnerSection]] — where the `//PUBLICAR` tab lands
- [[PartnerApprovalsSection]] — the marketplace gate that doubles as publishing gate
- [[Backend Plan]] — the low-volume / defer-until-needed posture this inherits
