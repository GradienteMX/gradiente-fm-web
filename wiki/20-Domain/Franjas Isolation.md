---
type: domain
status: current
tags: [franjas, isolation, constraint]
updated: 2026-06-25
---

# Franjas Isolation

> **2026-08-25 — RENAMED.** This rule was written about a concept called **Partner**. The word asserted a two-sided arrangement that only 1 of 78 rows actually had, so it was replaced everywhere — schema included — by **Franja**: a band on the dial, which claims nothing about the relationship. The text below has been updated to the current vocabulary so its `[[wikilinks]]` still resolve; the *decision* it records predates the rename. See [[Franja Authoring]] and migration `0048_partner_to_franja.sql`.

> Franjas never appear in the main content grid. They live in a dedicated sidebar rail, ordered chronologically, not by curation.

> **2026-06-25 UPDATE — rail-only relaxed (route added).** Franjas now also have a real `/f/[slug]` route ([[Franja Page]]) reached via the [[FranjaOverlay]]'s `[ENTRAR AL PERFIL DE FRANJA]` CTA. They STILL never enter the main editorial mosaic — the route is an identity hub (like `/e/[slug]` / `/u/[username]`), not a grid surface. This relaxes the original "rail-only" framing + [[Contained Single Surface]]'s no-detail-routes rule; flagged for datavismo sign-off.

## The rule

From `CLAUDE.md` (pre-canonical): _"Franjas are always isolated from main grid."_

Enforced structurally in [app/page.tsx:16-21](../../app/page.tsx):

```tsx
const franjas = MOCK_ITEMS.filter((i) => i.type === 'franja')
const gridItems = homeItems.filter(
  (i) => i.type !== 'franja' && (!hero || i.id !== hero.id),
)
```

[[FranjasRail]] receives the franjas; [[ContentGrid]] receives everything else.

## Why

- **Editorial integrity.** The site is editorial-first. Mixing paid/sponsored placements with curated picks corrodes trust.
- **Transparent bias.** A franja slot is labeled `//FRANJA` and lives in a distinct container. Readers can't mistake a franja for a review.
- **No HP games for money.** Franjas would dominate if they shared the HP pool (they'd be edited/refreshed often). Quarantining them takes that incentive off the table.

## Secondary rules

- **Franjas don't decay.** Half-life is set to 365 days in [curation.ts:25](../../lib/curation.ts) — effectively constant HP.
- **Franjas ignore vibe filter.** [[FranjasRail]] doesn't consume [[VibeContext]] — franjas show regardless of the user's vibe slider position.
- **Rail orders chronologically by `franjaLastUpdated`**, falling back to `publishedAt`. See [FranjasRail.tsx:16](../../components/FranjasRail.tsx). So a franja can bump itself by bumping that field.

## What counts as a franja

`franjaKind`:
- `promo` — event promotion
- `label` — record label (sello)
- `promoter` — party/collective
- `venue` — physical venue (Club Japan, etc.)
- `sponsored` — explicit paid placement

The distinction is visible in the rail badge label (see [FranjasRail.tsx:8](../../components/FranjasRail.tsx)).

## Related: the agenda page

An event `at` a franja venue is still an `evento`, not a `franja`. The franja card for the venue and the event card for the night can coexist — one in the rail, one in the grid. They're separate items with separate IDs.

## Links

- [[Content Types]]
- [[FranjasRail]]
- [[Home]]
- [[No Algorithm]]
