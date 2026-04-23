---
type: external
status: current
tags: [external, partners, ecosystem]
updated: 2026-04-22
---

# Partners Ecosystem

> The broader universe of labels, venues, promoters, and collectives that the site touches.

## Kinds of partners

Per `PartnerKind` in [[types]]:

- **`venue`** — physical locations (Club Japan, Multiforo Alicia, Foro Indie Rocks, El Bajo, Parque Bicentenario)
- **`promoter`** — party collectives running events (N.A.A.F.I., Rat Pack Crew, FASCINOMA)
- **`label`** — record labels (sellos) putting out releases / label nights
- **`promo`** — one-off event promotion placements
- **`sponsored`** — explicit paid placements (for when monetization exists)

## Known anchors in [[mockData]]

| Name | Role | Appears as |
|---|---|---|
| [[FASCINOMA]] | Festival / promoter | Events |
| [[Club Japan]] | Venue | Events |
| N.A.A.F.I. | Promoter (`Atrevida` series) | Events |
| Multiforo Alicia | Venue | Event location |
| Foro Indie Rocks | Venue | Event location |
| El Bajo | Venue | Event location |
| Parque Bicentenario | Venue | Outdoor festival location |

## What counts as "partner" vs "event-linked venue"

- A venue hosting one-off events stays in items' `venue` field. No partner card needed.
- A venue that wants representation in the [[PartnersRail]] — regular appearance, logo-forward — gets a `partner` item with `partnerKind: 'venue'`.

The two are independent. A venue can have events in the main grid AND a partner card in the rail — they're different items.

## Integration rules

All partners follow [[Partners Isolation]]:
- Never in the main grid
- No HP decay (365d half-life)
- Ignore vibe filter
- Chronological by `partnerLastUpdated`

## Missing — no partner items in the seed

Worth noting: despite two real-world partner anchors (FASCINOMA + Club Japan), the seed [[mockData]] currently contains **no `type: 'partner'` items**. The [[PartnersRail]] renders nothing on [[Home]] unless seed partners are added.

If a demo of the partners rail is needed, seed a couple items with `type: 'partner'`, `partnerKind`, `partnerUrl`.

## Links

- [[FASCINOMA]]
- [[Club Japan]]
- [[PartnersRail]]
- [[Partners Isolation]]
- [[Content Types]]
