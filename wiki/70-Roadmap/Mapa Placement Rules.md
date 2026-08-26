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
   No filler, logos, categories, stats, or spacers. Franja identity rows
   are never terrain — with one exception: the focus-state identity nucleus
   (rule 10).

2. **One item, one slab.** An item occupies one connected polyhex from a
   finite vocabulary — 1 / 3 / 7 cells — with no interior seams. HL decides
   the area (curation `score`: ≥1.0 → 7, ≥0.5 → 3, else 1; dominant cap 4;
   plain events never dominant). Size and position stay the only prominence
   signals. *Beta amendment (2026-08-18, Iker's call): until the deferred
   hp_events writer feeds real signals, real scores are nearly flat and the
   terrain reads as a field of single hexes — so `/mapa` opts into
   **synthetic HL injection** (`sizeTiers` `{syntheticHl: true}`):
   deterministic id-hashed promotions (≈5.5% toward rosettes, next ≈28% to
   trihexes, archive era at half rate, dominant cap 8, promotion-only — a
   real tier is never demoted, and plain events still never take a rosette).
   Same layout for every viewer; remove the layer when real HP flows.*

3. **Affinity chooses neighbors.** Adjacency is earned through shared
   structured metadata, weighted in this order: same franja ≫ shared
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
    franja focus builds a relevance gradient outward from the center:
    **core** — the identity nucleus surrounded by ONLY that identity's
    eligible content (explicit `franja_id` attribution — publisher or
    editorial attachment, never inferred), arranged in type-ordered arcs
    (evento → mix → review → editorial → opinión → artículo → lista →
    mercado → noticia) with marketplace listings as single-hex nodes;
    **belt** — the most-affine exterior content (≤18 items clearing a real
    affinity floor) reassembles just outside the buffer ring at full color,
    each item sliding inward along its original bearing; **far terrain** —
    everything else dims in place. Moves are translation-only; colliding
    static neighbors glide outward; leaving focus reverses every move
    exactly. Affine FRANJAS are ranked by cross-cluster affinity and
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
    Compaction suspends during franja focus (focus owns the geometry).
    Known tail: a franja's visible members can fragment under hard packing
    when their hidden peers were the connective tissue — focus-gather
    unaffected; a cohesion term is the named fix if it bothers in practice.

12. **AFINIDAD lets the terrain breathe into continents.** (2026-08-20,
    Iker's call.) The one OPT-IN toggle in the filter column — the inverse
    of a kill-switch: it hides nothing. The engine
    ([continents.ts](../../lib/mapa/continents.ts)) reads the map's own
    affinity structure: adjacent items whose pairwise affinity clears a
    threshold fuse into LANDMASSES (union-find over adjacency edges), and
    each mass drifts rigidly away from the terrain centroid
    (`CONTINENT_SPREAD`) so **ocean opens between masses** while every mass
    keeps its exact internal geography. Masses of ≥`CONTINENT_MIN_ITEMS`
    are ringed as continents (dashed sys-orange perimeter + live count on
    the toggle); islets and singles drift too, with narrower water
    (`ISLET_MIN_OCEAN` 1 vs `CONTINENT_MIN_OCEAN` 2 — uniform wide oceans
    measured ~3× area blow-up on the dev seed). The threshold is
    **adaptive**: it escalates from the affinity floor (2) until the
    largest mass holds ≤`CONTINENT_MAX_SHARE` (35%) of the terrain —
    a fixed floor percolates into Pangaea (dev seed: one 150-item mass at
    t=2) — and backs off if escalation leaves no major area. Collision
    repair is nearest-fit ring search around each mass's scaled target
    (pure radial pushes were measured to stack crowded bearings into long
    rays). Pure + deterministic per layout; translation-only; reversible;
    deep-linkable as `?afinidad=1` (replaceState — Back stays reserved for
    focus). Precedence: focus reflow > affinity continents > filter
    compaction > global; hiding a category while AFINIDAD is up fades cells
    in place inside their continents (no compaction). Camera clamp/fit
    follow the expanded bounds while active.

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
- ~~**Global marketplace nodes**~~ — DONE 2026-08-20 (`placeGlobalListings`
  in [focus.ts](../../lib/mapa/focus.ts)): listings are single-hex MERCADO
  satellites BFS-placed on the free cells nearest their franja's cluster —
  the stable terrain is never displaced (rule 9 holds; the interspersed
  center often has no free neighbors, so satellites take the nearest coast
  and chain into an arc). Each records its nearest member as ANCHOR and
  rides that member's delta through view arrangements; satellites dim
  during another franja's focus, hand over to the focus arc during their
  own, fade during compaction (the repack can claim their coast), and obey
  the MERCADO kill-switch. Engine-level placement (listings as first-class
  terrain items pulled toward the franja bearing) remains the eventual
  refinement if satellites ever need to sit deeper than the coast.
- Tunables (`W_ANCHOR`, `ANCHOR_RADIUS`, affinity weights) are code constants
  pending an editorial tuning pass with real data.
- **Synthetic HL retirement**: the rule-2 beta amendment must come out once
  `apply_hp_rollup()` has real traffic — flip `SYNTHETIC_HL` in
  [app/mapa/page.tsx](../../app/mapa/page.tsx) to false and re-judge the
  terrain texture.
- **Placement beyond ~5k items**: the packed-grid engine (2026-08-18) runs
  the full 2,400-item archive corpus in ~1.1s (O(n^1.5) — frontier grows as
  the perimeter). The next lever if the corpus outgrows that is a bounded
  frontier window (score only the k nearest frontier cells), which changes
  output and therefore needs its own placement-quality review.

## Links

- [[Spatial Identity Canvas]] — the full product spec + prototype findings
- [[HP Curation System]] — the HL scalar behind rule 2
- [[No Algorithm]] · [[Size and Position as Only Signals]]
