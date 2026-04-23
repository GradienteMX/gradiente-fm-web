---
type: roadmap
status: draft
tags: [roadmap, three-js, webgl, islands, ascii]
updated: 2026-04-22
---

# Three.js Islands

> Isolated 3D scenes embedded within DOM pages. The DOM remains the primary render; three.js scenes are opt-in per feature.

## Strategy

One `<Canvas>` per feature, lazy-loaded. DOM everything else.

```
app/page.tsx (home)
├── <HeroCard />                        DOM
├── <Canvas>                            ← 3D island
│     <VibeSpectrumSculpture />         rotating, audio/vibe-reactive
│     <AsciiRenderer />                 renders as ASCII via drei
│   </Canvas>
├── <ContentGrid />                     DOM
```

Each island is dynamically imported so pages without 3D pay zero bundle cost.

## Candidate islands (priority order)

### 1. Vibe Spectrum Sculpture (home, above fold) — **highest payoff**

A 3D object that encodes the current vibe range — e.g., a cold-to-hot gradient cylinder that extrudes/contracts based on the [[VibeSlider]] range. Rendered through `<AsciiRenderer>` for on-brand ASCII output. Signature moment.

Input: `vibeRange` from [[VibeContext]].
Output: visual confirmation of the filter state. Doubles as decoration.

### 2. Venue map of CDMX

3D schematic (not a real map — stylized, NGE-coded) showing CDMX venues as pulsing nodes. Click a node → filter to events at that venue. Low-poly or ASCII'd.

Input: `getEventDates(items)` + venue positions.
Output: spatial browsing for an events-heavy site. Big win for [[Agenda]].

### 3. Audio-reactive mix player

When a [[Mixes|mix]] is playing, show a WebGL visualization driven by the audio Web API. Frequency bars, oscilloscope, Lissajous figure — something not-Winamp-derivative. ASCII'd for texture.

Prerequisite: in-page mix playback. See [[Open Questions]].

### 4. HP decay visualizer (admin-side)

A diagnostic 3D widget on the [[Admin Dashboard]] showing items as spheres with size = HP, decay rate visible as a shrinking radius. Lets editors see the ranking at a glance.

## Libraries

| Package | Purpose |
|---|---|
| `three` | Core engine |
| `@react-three/fiber` | React bindings |
| `@react-three/drei` | Helpers — `<Html>`, `<Text>`, `<OrbitControls>`, `<AsciiRenderer>` |
| `@react-three/postprocessing` | Shader effects — bloom, noise, chromatic aberration |

Install once, use per island.

## `<AsciiRenderer>` is the killer feature

`@react-three/drei` ships [`<AsciiRenderer>`](https://drei.docs.pmnd.rs/abstractions/ascii-renderer) — it takes any three.js scene and renders it as live ASCII characters in the DOM. Combine with the CRT look of [[NGE Aesthetic]] and every 3D island becomes a moving ASCII hologram.

Example:
```tsx
<Canvas>
  <ambientLight />
  <mesh>
    <torusKnotGeometry args={[1, 0.3, 128, 32]} />
    <meshNormalMaterial />
  </mesh>
  <AsciiRenderer characters=' .:-+*=%@#' invert />
</Canvas>
```

A torus knot rendered in live ASCII, spinning. Unmistakably Gradiente.

## Loading pattern

Every 3D island lives behind a dynamic import:

```tsx
const VibeSpectrum = dynamic(() => import('@/components/3d/VibeSpectrum'), {
  ssr: false,
  loading: () => <div className="h-64 sys-label">// CARGANDO VISUAL</div>,
})
```

Home page without `<VibeSpectrum>` in viewport → doesn't load three.js. Good Core Web Vitals.

## Performance budget

- Three.js core ~600KB gzipped minified
- Each island ~20–100KB depending on complexity
- Target: 60fps on a 2021-era mid-range phone; graceful drop to 30fps acceptable
- `prefers-reduced-motion: reduce` → render a static `<img>` fallback

## Dependencies

- Decision: are we committing to three.js as a dep, or keeping it to shader-only ([[CRT Shader Layer]])?
- If yes: pick the first island to ship. Recommendation: **#1 Vibe Spectrum Sculpture** on the home page.

## Open questions

- Does the [[Admin Dashboard]] ASCII-renderer diagnostic actually help editors or is it indulgent?
- Accessibility: 3D scenes + ASCII are not screen-reader-friendly. Need an `aria-label` + possibly a DOM fallback in each island.
- Loading states: "carga de tres.js" feels heavy for a filter-forward site. Can we pre-warm the bundle on hover-of-link-to-island?

## Links

- [[NGE Aesthetic]]
- [[CRT Shader Layer]]
- [[HTML-on-Canvas]]
- [[VibeSlider]]
- [[Admin Dashboard]]
