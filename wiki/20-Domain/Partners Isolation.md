---
type: domain
status: current
tags: [partners, isolation, constraint]
updated: 2026-04-22
---

# Partners Isolation

> Partners never appear in the main content grid. They live in a dedicated sidebar rail, ordered chronologically, not by curation.

## The rule

From `CLAUDE.md` (pre-canonical): _"Partners are always isolated from main grid."_

Enforced structurally in [app/page.tsx:16-21](../../app/page.tsx):

```tsx
const partners = MOCK_ITEMS.filter((i) => i.type === 'partner')
const gridItems = homeItems.filter(
  (i) => i.type !== 'partner' && (!hero || i.id !== hero.id),
)
```

[[PartnersRail]] receives the partners; [[ContentGrid]] receives everything else.

## Why

- **Editorial integrity.** The site is editorial-first. Mixing paid/sponsored placements with curated picks corrodes trust.
- **Transparent bias.** A partner slot is labeled `//PARTNER` and lives in a distinct container. Readers can't mistake a partner for a review.
- **No HP games for money.** Partners would dominate if they shared the HP pool (they'd be edited/refreshed often). Quarantining them takes that incentive off the table.

## Secondary rules

- **Partners don't decay.** Half-life is set to 365 days in [curation.ts:25](../../lib/curation.ts) — effectively constant HP.
- **Partners ignore vibe filter.** [[PartnersRail]] doesn't consume [[VibeContext]] — partners show regardless of the user's vibe slider position.
- **Rail orders chronologically by `partnerLastUpdated`**, falling back to `publishedAt`. See [PartnersRail.tsx:16](../../components/PartnersRail.tsx). So a partner can bump itself by bumping that field.

## What counts as a partner

`partnerKind`:
- `promo` — event promotion
- `label` — record label (sello)
- `promoter` — party/collective
- `venue` — physical venue (Club Japan, etc.)
- `sponsored` — explicit paid placement

The distinction is visible in the rail badge label (see [PartnersRail.tsx:8](../../components/PartnersRail.tsx)).

## Related: the agenda page

An event `at` a partner venue is still an `evento`, not a `partner`. The partner card for the venue and the event card for the night can coexist — one in the rail, one in the grid. They're separate items with separate IDs.

## Links

- [[Content Types]]
- [[PartnersRail]]
- [[Home]]
- [[No Algorithm]]
