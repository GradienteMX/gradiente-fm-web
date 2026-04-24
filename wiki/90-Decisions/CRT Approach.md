---
type: decision
status: current
tags: [decision, visual, shader, webgl, crt]
updated: 2026-04-23
---

# Decision — CRT Approach (A vs B)

> The site wants a CRT/analog aesthetic: scanlines, grain, flicker, curvature. Two fundamentally different ways to get there. We tried A first, found it too limited, and are moving to B with A retained as a mobile/reduced-motion fallback.

## The question

How do we make the page look like it's being viewed through an old CRT tube?

## The two paths

| | **Path A — Decorative overlay** | **Path B — True post-process** |
|---|---|---|
| How | WebGL overlay on top of the DOM; only paints effects | DOM is rasterised to a canvas, uploaded as texture, shader samples with barrel distortion |
| Content distortion | **None.** Rounded-rect vignette fakes curvature | Real barrel distortion — text and images actually bend |
| Interactivity | Untouched (overlay is `pointer-events: none`) | Needs inverse-distortion hit-test mapping, or DOM stays as-is underneath an invisible-but-hittable layer |
| Performance | ~30fps fragment shader, trivial | DOM snapshot every N ms (html2canvas or `foreignObject` → SVG → img) + texture upload + draw. Heavy. |
| Text fidelity | Perfect — the overlay sits over crisp rendered text | Text is rasterised then resampled; goes soft, can miss custom fonts |
| Mobile viability | Yes | Questionable; likely Path A fallback |
| Implementation cost | Small, done | Large — snapshot strategy, invalidation on DOM change, click remapping |

## What we tried (Path A — shipped and kept)

[[CRTShader]] — a fixed WebGL canvas at `z-[100]` with a fragment shader that adds scanlines, grain, flicker, rolling bar, and a rounded-rect "tube" vignette to fake curvature.

**Worked:** scanlines are visible and prominent on bright content. The effect reads as CRT on the hero card, nav bar, and card thumbnails.

**Fell short:** curvature is only suggested by corner darkening. On the mostly-black theme, the absence of real bending makes the CRT feel like a sticker on top of a flat page rather than a tube the content lives inside. The dial between "tint dark enough to not look coloured" and "tint bright enough to read on black" is narrow and the effect never fully sells.

## Decision

**Adopt Path B for desktop; keep Path A mounted for mobile and `prefers-reduced-motion`.**

Path A is not deleted — it ships as the fallback branch. If Path B destabilises the page (a regression we can't fix quickly, a mobile perf cliff, or a stakeholder deadline), revert to Path A by swapping the component and we're back to a known-good visual.

### Path B mechanism — **`drawElementImage` / `texElementImage2D`**

First attempt was `html-to-image` (library-based DOM rasterisation). On this site's dense DOM the library hung indefinitely even with `skipFonts: true` — a known weak spot for every library in that space. **Pivoted to the native HTML-in-Canvas API** ([spec site](https://html-in-canvas.dev)) instead.

The native API:
- `<canvas layoutsubtree>` — opts canvas children into layout + hit testing while keeping them visually invisible until drawn.
- `gl.texElementImage2D(target, level, internalformat, format, type, element)` — uploads a DOM element directly to a WebGL texture. No rasterisation library, no font inlining, no CSS re-resolution.
- `canvas.onpaint` — fires on subtree render change. Replaces every MutationObserver / scroll listener / route hook we'd otherwise need for invalidation.
- `element.style.transform = drawnTransform.toString()` — returned DOMMatrix keeps DOM hit testing in sync with the distorted visual position.

**Current availability:** Chromium 147+ behind `chrome://flags/#canvas-draw-element` (dev-only, not enabled by default in Canary). No other browsers. All visitors without the flag hit Path A — that's the whole point of the capability probe.

`CRTOverlay` feature-detects via `typeof gl.texElementImage2D === 'function'` and routes accordingly. No library dependency; no rasterisation cost; no font-inlining fragility. When Chromium defaults the flag on (likely within the year), Path B lights up for every visitor automatically — **no code change required**.

## Why

Verbatim from Iker (2026-04-23):

> "I see what we're getting at and it's cool, but I feel like this method is a bit too limited for what we're trying to achieve. Let's go with path B: True post-process (and maybe the mobile version will just use the decorative shader only). Let's keep this recorded somewhere in Obsidian to have it as a reference to fall back if using path B destroys the page hahaha"

## Concrete implications

1. **Two code paths, one switch.** A capability probe decides which component mounts. Candidates for the probe: `window.matchMedia('(pointer: fine)')` + memory/CPU heuristic, `prefers-reduced-motion`, explicit user toggle in a settings menu, or a build-time env flag for testing.
2. **Path A is the safety net.** [[CRTShader]] stays in [components/CRTShader.tsx](../../components/CRTShader.tsx), documented and working. Don't let it bit-rot — any shader intensity tuning that matters to the mobile look should land in Path A too.
3. **Path B needs a snapshot strategy.** Rasterising the DOM every frame is infeasible. Likely approach: snapshot on mount, on `MutationObserver` ticks, on scroll end, and on route/overlay changes. Everything in between is animated purely by the shader on the cached texture. Accept ~100-200ms visual lag between DOM reality and distorted view for non-interactive areas.
4. **Clicks keep working on the real DOM.** The rasterised texture is only for *display*. The real DOM stays mounted underneath (either hidden with `opacity: 0` but hit-testable, or visible and the canvas has `pointer-events: none` and is only a visual overlay). Latter is simpler; go with that unless the un-distorted DOM bleeding through becomes visible at the edges.
5. **Text blur is expected.** Don't spend time fighting it. CRT CRTs had soft text. If it becomes unreadable at typical reading sizes, tune the distortion amplitude down before trying to sharpen the texture.

## Alternatives considered but not adopted

| Option | Why not |
|---|---|
| `html-to-image` + WebGL texture | **First Path B attempt — abandoned.** Hangs indefinitely on this DOM. Rasterisation libraries recursively clone + resolve every CSS property; on a dense page with next/font, animated tickers, nested SVGs, and inline-style cards, the clone phase never completes. `skipFonts: true` + filter-excluded canvases + 8s race-timeout confirmed it's not a config bug. Not viable. |
| CSS 3D `transform: perspective()` on a wrapper | Gives a perspective tilt, not a barrel. Reads as "screen is angled", not "content is on a tube". |
| SVG `feDisplacementMap` filter on the main container | Real pixel distortion, cheap, keeps DOM interactive. Tempting middle ground — **may revisit** if Path B stalls on perf. Downside: hit testing doesn't follow the filter, so clicks land slightly off from the distorted position; SVG filter compositing has quirks with `mix-blend-mode` children. |
| Path A with stronger corner darkening | Already tried; corners darken but the content between the corners doesn't curve, so it still reads as flat. |
| Full pre-rendered video background | Defeats the point — content must be real and live. |

## Open questions

- **Capability probe** — currently `matchMedia('(pointer: fine) and (min-width: 1024px)')` + `deviceMemory >= 4` + `texElementImage2D` feature check. Revisit if it mis-classifies tablets.
- **Scrolling inside the canvas** — with `layoutsubtree` the canvas establishes paint containment on children, which clips overflow to the canvas border box. The current skeleton uses an inner `overflow: auto` div for scroll. That puts the scrollbar visually inside the "tube" — could work thematically or feel wrong; needs eyeballing in Canary.
- **Transform sync for hit testing** — when we add distortion, the DOMMatrix returned by the native API has to be assigned back to the element via `element.style.transform`. Not in the passthrough skeleton yet (identity transform). Will need calibration once barrel distortion lands.
- **Click-through feel with barrel distortion** — even with the transform sync, minor sampling artifacts at corners may create a pixel-or-two offset between rendered position and hit test. Won't know until we try it.

## See also

- [[CRTShader]] — the Path A implementation, now documented as the fallback reference
- [[Contained Single Surface]] — why the whole site is one continuous surface, which is what makes a single fullscreen CRT shell coherent in the first place
- [[Why NGE Aesthetic]]
