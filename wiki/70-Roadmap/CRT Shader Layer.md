---
type: roadmap
status: draft
tags: [roadmap, shader, crt, webgl, aesthetic]
updated: 2026-04-22
---

# CRT Shader Layer

> A full-viewport shader overlay pushing the [[NGE Aesthetic]] from "chrome that looks like a terminal" to "experience that feels like looking at a terminal through a CRT monitor."

## What

A fixed-position `<canvas>` covering the viewport, running a fragment shader that applies:

- **Scanlines** — horizontal bands at 1-2px intervals, animated slowly
- **Barrel distortion** — subtle pincushion/barrel warp (CRTs are not flat)
- **Chromatic aberration** — RGB channels splitting on edges
- **Phosphor glow / bloom** — bright pixels bleed into neighbors
- **Vignette / bezel** — darkening at the corners; optional bezel frame
- **Noise / flicker** — low-amplitude animated static
- **(Optional) rolling bar** — the horizontal VSYNC artifact, once per N seconds

The DOM renders normally underneath; the shader is cosmetic.

## Why

The current [[NGE Aesthetic]] uses `eva-scanlines` (a static CSS `repeating-linear-gradient`) + `eva-glow` text shadows. That's one layer of the CRT vocabulary — the 2D repeating pattern. A real shader gets the other layers: curvature, bloom, chromatic split, animated flicker. It's the difference between "terminal font" and "this is a CRT".

For GRADIENTE FM specifically: the editorial voice is tactical-technical. A functioning CRT effect doubles down on that. Visitors would know within 2 seconds that this site is not like other music sites.

## Two modes

### Mode 1 — blend overlay (cheap, ship first)

Canvas is drawn **on top of** the DOM with `mix-blend-mode` or alpha channel. The DOM doesn't actually warp — the scanlines/noise/vignette just overlay. Runs at 60fps even on mobile. Works with any content.

**Implementation:** raw `<canvas>` + `requestAnimationFrame` + a simple 2D or WebGL pipeline. No three.js needed. ~20KB added.

### Mode 2 — render-to-texture (expensive, real)

Rasterize the DOM to a canvas/texture (via `html2canvas`, SVG `foreignObject`, or browser-native `element.toImage()` when available), then run the shader on that texture. **Text actually bends. Edges actually split RGB.** Feels like a real CRT.

**Cost:** re-rasterize on scroll / resize / DOM mutation. 60fps achievable for static views, drops during rapid interaction. Battery impact on mobile.

**Implementation:** heavier — needs the rasterization path + a proper WebGL fragment shader pipeline. ~150KB+ added. Could reuse the three.js stack if [[Three.js Islands]] ships first.

## Recommendation

Ship Mode 1 first as a permanent low-intensity layer. Offer Mode 2 as an opt-in toggle in a future user settings panel (maybe keyed to `prefers-reduced-motion: no-preference` + desktop-only by default).

## Settings / accessibility

- **`prefers-reduced-motion: reduce`** → disable flicker/rolling-bar, keep static scanlines/vignette at low intensity
- **Performance throttle** — adaptive, drop to Mode 1 if FPS < 45 sustained
- **Per-user toggle** — "TURN OFF CRT" in a settings menu. Do not make it a popup; EVA chrome it.
- **Print/screenshot respect** — skip the shader layer on `@media print` and for share-card previews

## Design parameters (starting values)

```
barrel distortion:        0.08   (subtle — don't curve the text into unreadable)
scanline opacity:         0.12
scanline height:          2px (CSS) / 0.002 (UV)
chromatic aberration:     0.003
bloom threshold:          0.65
bloom intensity:          0.4
vignette radius/strength: 0.55 / 0.4
noise intensity:          0.025
flicker frequency:        low (barely perceptible)
```

Tune in dev via `leva` or a `/wiki`-accessible URL param.

## Does this need three.js?

No — Mode 1 is fine with raw WebGL or even Canvas 2D. But if [[Three.js Islands]] is landing anyway, reuse `@react-three/postprocessing` for the shader pipeline and save duplication.

## Links

- [[NGE Aesthetic]]
- [[Utility Classes]]
- [[Three.js Islands]]
- [[HTML-on-Canvas]]
