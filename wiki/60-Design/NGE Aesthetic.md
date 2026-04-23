---
type: design
status: current
tags: [design, aesthetic, nge, evangelion, identity]
updated: 2026-04-22
---

# NGE Aesthetic

> The visual language is _Neon Genesis Evangelion_ terminal-UI — orange glows, sharp mono, scanlines, tactical overlays. Not thematic only: it's structural.

## What

The 1995 Evangelion HUD language made concrete in web components:

| NGE element | Where it lives in the site |
|---|---|
| EVA unit designation box | [[Navigation]] logo box with bar-graph indicator |
| MAGI system trio indicators | [[Navigation]] top-right: CASPAR / BALTHASAR / MELCHIOR with green OK pulses |
| Countdown timer `T+HH:MM:SS:frames` | [[Navigation]] right side — live clock + 5-digit frame counter |
| Scrolling data-strip tokens | [[Navigation]] bottom band: `A·T·FIELD·STABLE // BIOPATTERN·LOCKED // …` |
| CRT scanline overlay | `eva-scanlines` class on sticky header |
| Hazard stripe tape (45° orange/black) | used for vibe ≥ 9 accent, empty-state dividers |
| Corner brackets (`.nge-bracket`) | small tactical L-marks on cards and boxes |
| `//` token dividers | section markers everywhere: `//EVENTO`, `//EN PORTADA`, `//SIN CONTENIDO` |
| Terminal labels (`sys-label`) | uppercase 10px mono, all secondary info |
| Orange glow text (`eva-glow`) | brand lockup, with `holo-flicker` animation |

## Why

- **Recognition.** The scene the site serves is literate in this aesthetic (NGE + Y2K + 90s rave flyer cross-currents). A generic editorial template would read as *from outside*.
- **Information density without noise.** NGE HUDs are busy on purpose — they look technical, not decorative. Fits a site that's genuinely filter-heavy (vibe slider + calendar + category rail).
- **Brand consolidation.** The NGE vocabulary unifies dissimilar content types (events, mixes, articles) under one visual grammar.
- **It's loud enough to carry a dark palette.** The site is mostly black. Orange glows + vibe colors give it rhythm without going beige.

## Not just theming

These aren't stickers — they're structural. For example:

- The **hazard stripe** is the empty-state frame everywhere ([[ContentGrid]], [[ContentFeed]]). It's how nothing is communicated.
- The **`//` divider** on `.nge-divider` is the standard section break. Removing it would leave no section break.
- **`sys-label`** is the unit for all "system voice" metadata — dates, durations, counts, badges. Without it, the information hierarchy collapses.

See [[Utility Classes]] for the concrete CSS.

## The Spanish NGE layer

Some labels are in-universe Spanish/MX:

- `CDMX·UNDERGROUND`
- `SUBSISTEMA·MX`
- `UNIT·GRADIENTE·ONLINE`
- `SINCRONIZACION·ACTIVA`
- `INSTRUMENTACION·NEURAL·ACTIVA`

Invented MAGI-style mashups localized to CDMX. See [[Voice and Copy]].

## Boundaries — keeping it restrained

- **Never apply EVA styling to content text.** Titles stay in Syne display; body stays in Space Grotesk. The EVA vocabulary is for chrome/UI, not editorial prose.
- **No animated GIFs, no noise bitmaps.** Modern web equivalents only (CSS keyframes, gradients). The aesthetic should feel bespoke, not 2006 retro.
- **Orange glows are budgeted.** Overuse kills contrast. Reserve for brand moments (logo), active state indicators (MAGI pulses, nav active), and system alerts.

## Links

- [[Typography]]
- [[Color System]]
- [[Utility Classes]]
- [[Voice and Copy]]
- [[Navigation]]
- [[Why NGE Aesthetic]]
