---
type: roadmap
status: draft
tags: [roadmap, canvas, rendering, performance]
updated: 2026-04-22
---

# HTML-on-Canvas

> User request: explore rendering parts of the site on `<canvas>` (or WebGL) to unlock effects the DOM can't do cleanly.

## What "HTML-on-Canvas" could mean

Three distinct options, with very different tradeoffs:

### 1. Accent effects on top of DOM (cheap, recommended first)

Keep the DOM as the primary render. Use a full-viewport fixed `<canvas>` as an effects layer:

- CRT scanline jitter (real physics, not CSS repeating-gradient)
- Noise / grain overlay tied to HP or vibe
- Particle system behind the hazard stripes
- Audio-reactive visuals (tie to a mix player via Web Audio API — see [[Mixes]])

**Pros:** zero disruption to existing components; canvas sits over or under content.
**Cons:** limited — you're still rendering HTML cards, not replacing them.

### 2. Card rendering in canvas (pixi.js / threejs)

Replace [[ContentCard]] with a canvas-drawn version. Cards become sprites.

**Pros:** free any animation (physics, easing, shader effects). Layout changes in [[ContentGrid]] could be even more dramatic.
**Cons:**
- Loses accessibility (screen readers can't read canvas)
- Loses SEO (text isn't in the DOM)
- Loses copy-paste
- Breaks `text-*` CSS utility stack entirely
- Huge refactor

**Verdict: don't do this.** The editorial site benefits more from being crawlable than from fancier animations.

### 3. Isolated canvas "feature" (HP visualizer, gamified overlay)

A dedicated canvas zone — e.g., an HP-decay visualizer showing items as bubbles that shrink over time, or a vibe spectrum visualizer, or a map of CDMX venues — alongside the DOM feed.

**Pros:** high-impact in a small surface. The bulk of the site stays DOM.
**Cons:** design work to make the canvas widget feel native to the NGE aesthetic.

## Tech picks (if pursued)

- **PixiJS** — best for 2D sprite rendering; small, fast.
- **Three.js** — overkill unless going 3D.
- **Raw Canvas 2D + requestAnimationFrame** — sufficient for option 1 effects.
- **[OGL](https://github.com/oframe/ogl)** or **[Reglsmall](https://github.com/regl-project/regl)** — lightweight WebGL if shaders are the goal.

## Cost/benefit

Option 1 is weekend work and can ship incrementally. Option 3 is a discrete feature. Option 2 is a rewrite.

Recommend starting with option 1 — a subtle noise/scanline layer tuned to vibe range — and see if the aesthetic payoff justifies more.

## Open questions

- What exactly does "HTML-on-Canvas" mean to [the user] — is the goal the visual effect, or the performance/rendering properties?
- Performance budget? If we care about mobile, canvas overlays cost battery.
- Should it respond to [[VibeContext]] values (e.g., more noise at `vibe: 10`)?

## Links

- [[Gamification]]
- [[Open Questions]]
- [[NGE Aesthetic]]
- [[VibeContext]]
