---
type: component
status: current
tags: [welcome, webgl, threejs, invite, holo, shaders, macos, stickers, cosmetics]
updated: 2026-06-27
---

# InviteExperience

> The `/welcome` (and `/lab/tarjeta`) 3D invitation: a manila envelope that opens to reveal a holographic "glass" access card + a fanned carousel of info pages. A faithful port of the `invitacion-3d` prototype into a React island.

## What

A self-contained Three.js/WebGL scene under [components/welcome/invite3d/](../../components/welcome/invite3d). The React wrapper [InviteExperience.tsx](../../components/welcome/invite3d/InviteExperience.tsx) is a `'use client'` island that mounts a `<canvas>` + DOM chrome (loader, hint, CTA, nav, fallback, sr-mirror) and hands them to `createExperience({ canvas, ui, invite })` in [experience.js](../../components/welcome/invite3d/experience.js). The effect keys on `[invite]`; `createExperience` returns `{ dispose }` for full teardown.

Choreography phases (`state.phase`): `loading → await → opening → card`. Clicking the closed envelope (`await`) plays a GSAP timeline (`buildOpenTimeline`) — flap opens, pages emerge and fan, the glass card flies to center — whose `onComplete` is `enterCardPhase`. In the card phase the card is interactive (pointer tilt, click to flip) and `‹ ›` cycle a 7-piece carousel (the card + 5 SVG pages + an empty REGISTRO hero that overlays the real [[RegistroCard]] form).

Mounted full-viewport by two routes: [app/welcome/page.tsx](../../app/welcome/page.tsx) (real invite via `peekInviteCard`) and [app/lab/tarjeta/page.tsx](../../app/lab/tarjeta/page.tsx) (hardcoded DEMO invite, `force-static`, flat `#0D0D0D` bg — the clean test harness).

## How

- **Renderer:** `WebGLRenderer({ alpha: true, antialias: true })`, ACES tone mapping, `transmissionResolutionScale = 1.0`. Full-res refraction is deliberate: the card back's engraved text lives *behind* the glass (see §Card back), and the prior half-res (`0.5`) transmission buffer was the sole cause of it rendering blurry. Canvas is transparent over the page → a frame that fails to draw shows the dark page through it.
- **Post chain (EffectComposer):** `RenderPass → UnrealBloomPass (strength 0.06) → OutlinePass → OutputPass`, run every frame via `composer.render()`. `OutlinePass.selectedObjects` is empty until `enterCardPhase` (subtle card edge glow only in the card phase).
- **Glass card** ([glasscard/glassCard.js](../../components/welcome/invite3d/glasscard/glassCard.js)): a `MeshPhysicalMaterial` with `transmission:1` + iridescence + clearcoat (one of three's heaviest shaders), built eagerly and rendered from the first frame, plus stacked **additive** hologram layers.
- **Hologram shaders** ([glasscard/hologram.js](../../components/welcome/invite3d/glasscard/hologram.js)): four custom `ShaderMaterial` factories — hologram / foil / smudge / lenticular — all `AdditiveBlending`, `toneMapped:false` (they write straight to the HDR buffer, so their glow feeds the bloom). Canvas-2D textures (print/foil/back) come from [glasscard/cardPrint.js](../../components/welcome/invite3d/glasscard/cardPrint.js).
- **Dev console hooks:** `window.__glass` exposes live tuners + isolation toggles (`glassOff/On`, `holoOff/On`, `lightSpec`, …) — invaluable for bisecting render bugs.

## Card back: engraved text (behind glass) + sticker layer (over glass)

The back is **two distinct depth layers relative to the glass body** — a distinction worth holding onto, because it dictates how anything new on the back must be built:

- **Engraved text** (`NECESITAS DOS COSAS` / código / barcode, drawn to a canvas texture in [cardPrint.js](../../components/welcome/invite3d/glasscard/cardPrint.js)) sits *behind* the glass back face (text ≈ z −0.054; the glass back face ≈ −0.152). It is **refracted by the glass** → real parallax/depth on tilt. Its sharpness is governed **entirely** by `transmissionResolutionScale` (see Renderer) — it is not a separate effect. Moving it out from behind the glass to "fix blur" would kill the parallax; the fix was the full-res buffer.
- **Stickers** ([glasscard/sticker.js](../../components/welcome/invite3d/glasscard/sticker.js)) sit *over* the glass, seated just **outside the measured glass back face** (we read `caseMesh.geometry.boundingBox.min.z`, not a magic number) so they read as stuck-on, not embedded. `buildGlassCard` takes a general **`stickers[]`** list — the first brick of a card-cosmetics system — defaulting today to `invite.partner` (the partner attached to the invite code → its logo as a holo chip in the back-right zone). Each chip is a thin **extruded** rounded-rect: the image wraps the bevelled edge (planar-UV reprojection → no dark sides), a holo-laminate sheen on top, and it is **culled on the front face via an explicit visibility toggle** (a solid slab isn't auto-culled like a one-sided plane is).
- **Two halo traps when adding *any* material to the card** (both bit us building the sticker): (1) every card surface suppresses direct-light specular via `hideLightSources`; a new material that skips it is the only thing showing raw light-blobs that then bloom → apply the equivalent `killDirectSpecular`. (2) an **additive** overlay scaled larger than its base paints light *beyond* the footprint onto neighbouring glass (a bright halo) → keep the footprint equal and separate depth with `polygonOffset`, never `scale > 1`.

## Gotchas

### macOS-only ~2.5s blackout on open (fixed 2026-06-26)

**Symptom:** on Mac only, opening the envelope made the whole scene vanish (just background) for ~2.5s mid-animation, then everything reappeared in place. Not reproducible on Windows.

**Root cause:** the hologram shader computed `atan(N.y, N.x)` on the surface normal. When the card flips **face-on to the camera** during the open animation, `N ≈ (0,0,1)` so `N.x = N.y = 0`, and **`atan(0,0)` is undefined — Metal (macOS) returns `NaN`, Direct3D (Windows) returns `0`**. The NaN flows through the **additive** hologram blend into the HDR buffer; `UnrealBloomPass`'s separable blur then smears it across the **entire frame** → full-canvas blackout. It self-clears once the card settles to a non-dead-on tilt.

**Fix:** guard the degenerate case in [hologram.js](../../components/welcome/invite3d/glasscard/hologram.js):
```glsl
float ang = dot(N.xy, N.xy) > 1e-7 ? atan(N.y,N.x)/TAU + 0.5 : 0.5;
```

**How it was found (repeatable method):** reproduced in the headless preview by sampling per-frame canvas luminance (`drawImage`→`getImageData`) across the open — the blank shows as a luminance→0 window. Confirmed it was **not** a context loss (`gl.isContextLost()` stayed false, the rAF loop never stalled), so a live-context blank ⇒ a shader NaN, not a driver crash. Bisected with the `window.__glass` toggles + `outline.enabled`/`bloom.enabled`: blank survived `glassOff`, survived OutlinePass being inactive, **died with bloom off**, and **died with `holoOff` while bloom stayed on** ⇒ the holo layers feed bloom the NaN. See [[reference_mac_metal_shader_nan]] (assistant memory) for the general gotcha.

## Links
- [[RegistroCard]] — the real signup form overlaid on the empty REGISTRO carousel hero
- [[Welcome]] · [[Backend Plan]] — the invite/beta-gate flow this fronts
- [[NGE Aesthetic]] · [[Three.js Islands]] — design + the broader WebGL-island direction

## Open questions
- The `UnrealBloomPass` strength is only 0.06 (barely visible). Worth keeping at all, or drop it to remove a fragile pass entirely?
- Other custom shaders (CRT layer, audio visualizer) should be audited for the same Metal-NaN class of bug before they ship.
