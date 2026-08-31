---
type: external
status: current
tags: [external, franjas, ecosystem]
updated: 2026-04-22
---

# Franjas Ecosystem

> The broader universe of labels, venues, promoters, and collectives that the site touches.

## Kinds of franjas

Per `FranjaKind` in [[types]]:

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

## What counts as "franja" vs "event-linked venue"

- A venue hosting one-off events stays in items' `venue` field. No franja card needed.
- A venue that wants representation in the [[FranjasRail]] — regular appearance, logo-forward — gets a `franja` item with `franjaKind: 'venue'`.

The two are independent. A venue can have events in the main grid AND a franja card in the rail — they're different items.

## Integration rules

All franjas follow [[Franjas Isolation]]:
- Never in the main grid
- No HP decay (365d half-life)
- Ignore vibe filter
- Chronological by `franjaLastUpdated`

## Missing — no franja items in the seed

Worth noting: despite two real-world franja anchors (FASCINOMA + Club Japan), the seed [[mockData]] currently contains **no `type: 'franja'` items**. The [[FranjasRail]] renders nothing on [[Home]] unless seed franjas are added.

If a demo of the franjas rail is needed, seed a couple items with `type: 'franja'`, `franjaKind`, `franjaUrl`.

## Links

- [[FASCINOMA]]
- [[Club Japan]]
- [[FranjasRail]]
- [[Franjas Isolation]]
- [[Content Types]]
