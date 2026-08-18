---
type: roadmap
status: draft
tags: [spatial-ui, honeycomb, placement, affinity, mindshare, rules]
updated: 2026-08-18
---

# Mapa Placement Rules

> The concise ruleset for how items claim cells on the `/mapa` honeycomb and
> how they relate to their neighbors. The governing idea is **mindshare
> geography**: the terrain develops recognizable regions of meaning — an
> identity's "section" of the map — that emerge from metadata and identity
> gravity, never from hand-drawn territories. Implemented in
> [lib/mapa/layout.ts](../../lib/mapa/layout.ts) ·
> [affinity.ts](../../lib/mapa/affinity.ts) · [focus.ts](../../lib/mapa/focus.ts);
> product context in [[Spatial Identity Canvas]].

## The ten rules

1. **Every cell is content, and content shows its image.** A visible hex is a
   published item (or part of one) WITH imagery — the map is a visual
   surface, and imageless items stay reachable through section pages and
   search instead of appearing as dark panels (Iker's call, 2026-08-18).
   No filler, logos, categories, stats, or spacers. Partner identity rows
   are never terrain — with one exception: the focus-state identity nucleus
   (rule 10).

2. **One item, one slab.** An item occupies one connected polyhex from a
   finite vocabulary — 1 / 3 / 7 cells — with no interior seams. HL decides
   the area (curation `score`: ≥1.0 → 7, ≥0.5 → 3, else 1; dominant cap 4;
   plain events never dominant). Size and position stay the only prominence
   signals.

3. **Affinity chooses neighbors.** Adjacency is earned through shared
   structured metadata, weighted in this order: same partner ≫ shared
   entities > shared artists > same venue > exact genre > genre root > curated
   tags > same creator > date proximity. Weights are global editorial config
   ([affinity.ts](../../lib/mapa/affinity.ts) `AFFINITY_WEIGHTS`), never
   learned from behavior.

4. **Identities own directions, not territories.** Every identity with
   attributed content gets a **fixed bearing** on the map, derived only from
   its id (`identityBearing`). Its attributed items feel a constant pull
   toward an anchor on that bearing, so the identity's mindshare section
   always grows in the same compass direction — Club Japan is always "over
   there." No boundaries are drawn; the section is just where that gravity
   wins.

5. **Regions emerge, bridges included.** Unattributed content lands by pure
   affinity, which naturally places it between the sections it relates to —
   a review about a venue's night sits at the edge of that venue's section.
   Proximity must always be explainable by rule 3 or rule 4.

6. **Types intersperse globally.** Content type is never a positive placement
   input; a repeated-type penalty breaks up accidental walls. There are no
   evento zones or mix zones on the global map.

7. **The center is now; the rim is memory.** Placement order follows
   prominence, and compactness grows the terrain outward — so current, alive
   content tiles the middle while decayed and past items settle toward the
   periphery. The archive is the outskirts, not a separate surface. This now
   includes the **Archivo Vivo 2005-2013** era (living-archive pilot): blog-era
   posts enter as ordinary items whose 2010-era dates decay them to the rim
   naturally; era reads through an aged-paper rim (`#9C8F7F`) + `//ARCHIVO`
   chip, with the author blog + year as the cell's visible credit (MANUAL.md
   §6 — excerpt + Wayback link only, never the full text, no `mentions`-as-HL).

8. **Slabs are separate pieces.** Items are inset by `HEX_GAP` grout on
   every exterior edge; the type-colored rim rides that boundary and nothing
   else.

9. **The map is stable and shared.** Same dataset + timestamp → identical
   layout for every viewer (no randomness, no behavioral input, stable
   tie-breaks; the page quantizes `now` to 10-minute buckets so soft
   refreshes can't reshuffle a near-tie). Bearings never move. Cross-snapshot
   hysteresis beyond this is still open — see below.

10. **Focus reorganizes in rings; globally nothing moves.** Entering a
    partner focus builds a relevance gradient outward from the center:
    **core** — the identity nucleus surrounded by ONLY that identity's
    eligible content (explicit `partner_id` attribution — publisher or
    editorial attachment, never inferred), arranged in type-ordered arcs
    (evento → mix → review → editorial → opinión → artículo → lista →
    mercado → noticia) with marketplace listings as single-hex nodes;
    **belt** — the most-affine exterior content (≤18 items clearing a real
    affinity floor) reassembles just outside the buffer ring at full color,
    each item sliding inward along its original bearing; **far terrain** —
    everything else dims in place. Moves are translation-only; colliding
    static neighbors glide outward; leaving focus reverses every move
    exactly. Affine PARTNERS are ranked by cross-cluster affinity and
    navigable as a carousel from the identity strip.

11. **Filters are exclusions, and the survivors close ranks.** (Reworked
    2026-08-18 passes 11-12, Iker's calls.) Every category is VISIBLE by
    default; the right-edge hex column is a row of kill-switches. When a
    type or era is deactivated its cells fade out, and the remaining terrain
    **compacts**: the same greedy walk re-runs over visible items with
    shapes frozen, but with packing-dominant weights (`W_RADIAL_COMPACT` /
    `W_CONTACT_COMPACT`; identity gravity boosted so bearings hold) — the
    mass closes its holes and cells glide translation-only to their
    compacted spots. Measured honestly: same-weights re-runs reproduce the
    original layout exactly (interspersion keeps visible content mutually
    adjacent), so compaction is a deliberately different, packing-first view
    — only defined while something is hidden; toggling everything back
    reverses every move. Hidden cells leave keyboard order and the
    accessibility tree. Deep-linkable as `?ocultar=evento,era:archivo`.
    Compaction suspends during partner focus (focus owns the geometry).
    Known tail: a partner's visible members can fragment under hard packing
    when their hidden peers were the connective tissue — focus-gather
    unaffected; a cohesion term is the named fix if it bothers in practice.

## What this buys

- **Learnability** — bearings make the geography memorable across visits.
- **Explainability** — every adjacency traces to a metadata fact (rule 3/4).
- **Honesty** — no engagement input anywhere in the pipeline; [[No Algorithm]]
  and [[Size and Position as Only Signals]] hold by construction.

## Open items

- **Cross-snapshot hysteresis** (rule 9's gap): when the dataset changes
  (daily scraper), placement order shifts and local arrangements can reflow
  even though bearings hold. Candidate mechanisms: anchor recently-seen items
  to their previous cells, cap swaps per recompute, layout snapshots.
- **Genre-community bearings**: should the big root genres (techno, ambient,
  dub…) also own directions so unattributed content gets macro structure? Or
  does that recreate category districts through the back door? Undecided.
- **Global marketplace nodes** (listings on the global terrain, not just in
  focus) — needs a placement identity for listings (rule 4 would use the
  owning partner's bearing).
- Tunables (`W_ANCHOR`, `ANCHOR_RADIUS`, affinity weights) are code constants
  pending an editorial tuning pass with real data.

## Links

- [[Spatial Identity Canvas]] — the full product spec + prototype findings
- [[HP Curation System]] — the HL scalar behind rule 2
- [[No Algorithm]] · [[Size and Position as Only Signals]]
