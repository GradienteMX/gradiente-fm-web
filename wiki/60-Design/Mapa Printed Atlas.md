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

## Camera rendering

Camera writes are coalesced to one animation frame. Content keeps a 30% overscan region on each side and refreshes as the camera approaches its edge, plus one update after motion settles; there is no repeating React refresh during small pans. The SVG guides and ink fields live in a separate, bounded layer with a cached camera transform.

Direct drag and wheel panning use `AtlasMotionLayer`, a reusable, bounded canvas drawn from already-loaded flyers, polyhex outlines, paper guides and affinity boundaries. Flyer preparation runs in short asynchronous batches before gestures, and small movements reuse the existing pixels. During motion, images and rims carry the terrain; text, focus targets and normal image resolution return when motion settles. The display-only canvas never exports or reads pixels. It does not change placement, ranking, filters, or content routes. Image requests use quantized screen widths rather than unscaled world widths. Pointer cancellation/lost capture and unmount release the gesture and pending camera work.

## Implementation and validation

`AtlasBackdrop`, `AtlasChrome`, `AtlasInspection`, `MapaCanvas`, `MapaCell`, `MapaFilterColumn`, and `FranjaObi` own the presentation. Geometry and ranking modules in `lib/mapa` were not modified. Existing synthetic-HL prototype behavior remains.

Desktop Chrome checks covered small and large franja focus, caption/Enter opening, overlay return, category exclusion/restoration, affinity on/off and focus round-trip with URL preservation, searchable franjas, expanded identity details, and help dismissal. Existing MAPA suite: 64 tests passing. Mobile design is deferred.


### Drag performance verification (2026-09-09)

Production Chrome six-second camera-path checks at 22% zoom: standard view 335 frames, affinity 351 frames; both had a 17 ms median and 33 ms p95, with zero terrain commits during the gesture. Worst observed frames remained 608 ms and 509 ms respectively, so this is a substantial improvement, not a guarantee of hitch-free motion. Actual pointer dragging, release/preview restoration, category controls, zoom, and Enter-to-open after dragging were checked separately. MAPA geometry and viewport coverage suite: 67 passing tests. The temporary timing UI lives only in an isolated test build, not application source.
