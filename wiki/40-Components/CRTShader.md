---
type: component
status: fallback
tags: [component, visual, shader, webgl, crt, overlay]
updated: 2026-04-23
---

# CRTShader — Decorative Overlay (Path A)

> Fixed, full-viewport WebGL overlay that paints scanlines, noise, flicker, a rolling scan bar and a rounded-rectangle "tube" vignette *on top of* the real DOM. Does **not** sample or distort the page — the DOM stays untouched and fully interactive underneath.

## Status

**Fallback reference.** Kept in the codebase as the mobile/reduced-motion path and as the safety net if the full post-process approach ([[CRT Approach]]) proves too destructive. Live in the tree at [components/CRTShader.tsx](../../components/CRTShader.tsx) and mounted once in [app/layout.tsx](../../app/layout.tsx).

## What it does

A single fullscreen canvas, `position: fixed`, `inset: 0`, `pointer-events-none`, `z-[100]` — so it overlays absolutely everything including overlays. Inside, one fullscreen triangle runs a fragment shader each frame.

Per-pixel contributions (all accumulate into a single `darkness` float in `[0, 1]`, then composite as `vec4(tint, darkness)`):

| Effect | How | Default intensity |
|---|---|---|
| Scanlines | `step(1.0, mod(gl_FragCoord.y, 2.0))` — every 2nd physical pixel row | `0.55` |
| Tube mask (curvature hint) | Rounded-rect SDF; darkens outside a bulged rectangle. **Corner-only** — straight edges barely darken | `1.0` |
| Grain | `hash()` temporally quantised at ~24Hz | `0.10` |
| Flicker | Two-sine beat (24Hz + 60Hz) | `0.04` |
| Rolling scan bar | A soft vertical band drifting at 0.08Hz; **lightens** (negative contribution) | `0.10` |
| Tint | Dark neutral grey `(0.22, 0.20, 0.23)` — required so the overlay renders visibly on already-black page content | — |

`prefers-reduced-motion: reduce` collapses the time-based terms (grain tick, flicker, rolling bar) to zero.

## Why it doesn't sample the DOM

The problem with true post-process CRT on the web: to *distort* page content you need to rasterise the DOM into a texture each frame (via `html2canvas` or `foreignObject`-to-canvas), upload to WebGL, sample with barrel distortion, then composite. That costs:

1. **Performance** — html2canvas is ~100-500ms per snapshot; mobile throttles hard.
2. **Fidelity** — text goes soft, custom fonts sometimes fail, video/`<canvas>`/iframes don't capture, CORS-restricted images are missing.
3. **Interactivity** — clicks land on the *un-distorted* DOM position, not where the eye sees the element. Needs an inverse-distortion hit-test layer.

This overlay skips all three problems by being purely additive. It can only **darken pixels** (plus the rolling bar which lightens). Curvature is suggested by a **rounded-rect vignette**, not real barrel distortion — the page is still a flat rectangle underneath.

## Known limitations (and why we may abandon this path)

- **No real barrel distortion.** The rounded-rect tube mask reads as "darkened corners", not as a bulged glass tube. Acceptable on dark page content, less convincing if the reference aesthetic demands visibly curved text.
- **Effects near-invisible on pure-black background.** Alpha-blending any tint over black produces the tint color at the tint's luminance. To make scanlines visible on `bg-base #000`, the tint must have *some* luminance (currently `0.22` grey). Purer colours like `(0.0)` were tried and read as "nothing happening."
- **No RGB fringing on real text.** Chromatic aberration requires sampling the source — we can only *approximate* it with red/blue-tinted vignettes at the edges.

## Gotchas found during implementation

1. **`gl.blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA)` squares the alpha channel** when drawing onto a fully-transparent canvas. Result: effective opacity ≈ `darkness²`, visible opacity halved. Use `blendFuncSeparate(SRC_ALPHA, ONE_MINUS_SRC_ALPHA, ONE, ONE_MINUS_SRC_ALPHA)` so RGB blends normally but alpha passes through.
2. **Don't call `WEBGL_lose_context.loseContext()` in the cleanup.** Under StrictMode + HMR the effect re-runs, and the previous run's lose-context poisons the canvas for the next mount — `getShaderInfoLog` returns `null`, `COMPILE_STATUS` false, with no hint why. Let GC handle it.
3. **Pure-black tint is invisible on black.** See above. Some luminance is non-negotiable for overlay CRT effects on dark themes.
4. **Screenshot-based preview verification fails while the RAF loop is active** — use pixel sampling (`readPixels` with a fresh `preserveDrawingBuffer: true` canvas replaying the same shader) instead.

## Component props

```ts
interface CRTShaderProps {
  scanlineIntensity?: number   // default 0.55
  vignetteStrength?: number    // default 1.0  (really the tube mask strength)
  noiseIntensity?: number      // default 0.10
  flickerIntensity?: number    // default 0.04
  rollingBarIntensity?: number // default 0.10
}
```

No `reducedMotion` prop — read directly from `window.matchMedia('(prefers-reduced-motion: reduce)')` and re-evaluated each frame so a user toggle takes effect without remount.

## Tube mask parameters (in the fragment shader)

Inside `main()`:

```glsl
vec2 halfSize = vec2(aspect - 0.08, 0.92);  // tube is inset 0.08 from side edges, 0.08 from top/bottom
float cornerRadius = 0.35;                   // how round the corners are — bigger = more bulge
float sdf = ...;                              // rounded-rect signed distance
float tube = smoothstep(-0.06, 0.22, sdf) * u_vignetteStrength;  // -0.06→0.22 is the feather band
```

To tune: `cornerRadius` is the curvature dial. `halfSize` controls how much of the viewport is "lit glass". The `smoothstep` feather range controls how sharp the tube edge transition reads.

## See also

- [[CRT Approach]] — the A-vs-B decision that frames this component's role
- [[Waveform]] — companion HUD component; both together form the "analog chrome" layer
- [[Navigation]] — the existing EVA header; the CRT overlay sits above it at `z-[100]`
