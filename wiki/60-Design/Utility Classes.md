---
type: design
status: current
tags: [design, css, utilities, nge]
updated: 2026-04-22
---

# Utility Classes

> Custom non-Tailwind classes defined in [app/globals.css](../../app/globals.css) that carry the [[NGE Aesthetic]].

## `sys-label`

```css
.sys-label {
  font-family: var(--font-space-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #444;
}
```

The workhorse. Used everywhere for chrome metadata. Combines with `text-*` to override color when needed.

## `nge-divider`

Renders a `//` prefix and a gradient bottom-line:

```html
<div class="nge-divider">
  <span>AGENDA</span>
</div>
```

Produces: `//  AGENDA  ──────────`

## `nge-bracket` / `nge-bracket-full`

Tactical corner decoration. `nge-bracket` → two top L-corners (red). `nge-bracket-full` → a dashed-looking diagonal frame via border-image gradient.

## `hazard-stripe`

45° repeating orange/black stripes, the hazard-tape texture. Standard empty-state divider and vibe ≥ 9 accent.

```css
background: repeating-linear-gradient(-45deg, #F97316 0px 4px, #000000 4px 12px);
```

## `eva-*` family (Navigation-specific)

Only used in [[Navigation]], but defined globally:

- **`eva-scanlines`** — CRT-monitor horizontal scan stripes, applied via `::after` pseudo-element over the sticky header
- **`eva-box`** — 1px orange border with inset/outer orange glow + tiny corner brackets in `#FF9900`
- **`eva-glow`** — the brand orange-glow text style, combined with `holo-flicker` animation (triggers a brief brightness spike every ~8s)
- **`eva-glow-sm`** — smaller, static version of the glow

## `cursor-blink`

Adds a `▋` blinking cursor glyph at the end of an element. Unused currently but defined.

## `animate-fade-up`

Custom keyframe: 6px translate-Y + opacity, 250ms `ease-out`. Used on [[ContentFeed]] for cascading entries.

## Tailwind-defined animations

Defined in [tailwind.config.ts:57](../../tailwind.config.ts):
- `animate-blink` — 1.2s opacity 0/1 step-end
- `animate-slide-in` — 200ms slide + fade from left
- `animate-fade-in` — 300ms fade
- `animate-scanline` — 4s linear top-to-bottom sweep (unused currently)

## `nge-ticker` keyframe

Defined in [globals.css:144](../../app/globals.css). Moves `translateX(0)` → `translateX(-50%)`. The navigation data strip duplicates content and runs this on a 55s loop for seamless scrolling.

## `holo-flicker` keyframe

Subtle opacity + brightness spike on 8s loop. Attached to `.eva-glow`. Gives the brand text a "damaged CRT" feel without being distracting.

## Links

- [[NGE Aesthetic]]
- [[Typography]]
- [[Color System]]
- [[Navigation]]
