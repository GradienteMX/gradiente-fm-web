# MAPA — Printed Atlas

Approved desktop direction, September 2026. See [[Spatial Identity Canvas]] and [[Mapa Placement Rules]] for the unchanged content and placement contracts.

## Visual language

Warm Pliego paper, Syne masthead, Space Mono controls, registration crosses and faint hex guides. Actual flyers retain their color. The focused franja's existing perimeter becomes a solid ink field; unrelated imagery recedes into the paper. Category color remains on the exterior rim and layer controls.

The design is rendered with SVG and Tailwind, using real content. The generated concept is an art-direction reference, not a flattened background asset. No invented geography, coordinates, category labels or engagement metrics.

## Interactions

- Existing 1/3/7-cell polyhexes, focus reflow, affinity continents and filter compaction remain engine-owned. Identity rows remain contextual chrome, except the existing focused nucleus.
- Hover or keyboard focus reveals a fixed-size paper caption above the dock; keyboard focus also strengthens the exterior rim. Caption state lives in `AtlasInspection`, an isolated HTML layer; hover does not reconcile the terrain, read cell geometry, repaint rims, move imagery, or change cell stacking. Semantic zoom resolves titles and metadata progressively.
- Category controls form a staggered two-column honeycomb. Fixed 64 × 56 px viewports preserve regular hexagons; short viewports scroll the category group instead of flattening its shapes.
- Focus ink fields enter and exit; affinity outlines identify related landmasses. Motion settles, and reduced-motion preferences disable new transitions.
- The persistent dock exposes zoom percentage, plus/minus, framing and help. Framing reserves space for the header, dock, layer rail and focused obi. A wider zoom-out range allows framing large clusters without clipping; global entry keeps the immersive default.
- The obi keeps dossier/exit and related-franja arrows outside its scrolling details. Its identity lettering adapts to available height. Real contact/context fields remain under FICHA.
- The franja selector supports search. Dossiers with no map content are separate, collapsible links rather than inert focus targets.
- Focus and affinity state are reflected in the header. If affinity is enabled during a focus, the rail explains that it resumes on exit.

## Implementation and validation

`AtlasBackdrop`, `AtlasChrome`, `AtlasInspection`, `MapaCanvas`, `MapaCell`, `MapaFilterColumn`, and `FranjaObi` own the presentation. Geometry and ranking modules in `lib/mapa` were not modified. Existing synthetic-HL prototype behavior remains.

Desktop Chrome checks covered small and large franja focus, caption/Enter opening, overlay return, category exclusion/restoration, affinity on/off and focus round-trip with URL preservation, searchable franjas, expanded identity details, and help dismissal. Existing MAPA suite: 64 tests passing. Mobile design is deferred.
