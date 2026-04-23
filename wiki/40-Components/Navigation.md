---
type: component
status: current
tags: [component, navigation, header, nge]
updated: 2026-04-22
---

# Navigation

> The EVA-unit-designation header bar. Orange glow, MAGI indicators, live clock, scrolling data-strip ticker.

## Source

[components/Navigation.tsx](../../components/Navigation.tsx)

## Client component? Yes

- `usePathname()` for active link
- `useState` for mobile menu toggle
- `useEffect` + `setInterval(100ms)` for the live clock and frame counter

## Anatomy

Four vertical strips stacked top-to-bottom:

1. **Top gradient bar** (2px) — orange fire gradient, purely decorative.
2. **Main bar** (54px) — logo box / nav links / MAGI indicators + timer.
3. **Data strip** (20px) — scrolling token marquee.
4. **Mobile menu** — slide-out panel when `mobileOpen`.

## The NGE touches

- **Logo box** has the `eva-box` class + a bar-graph fill indicator on the left. Brand reads `GRADIENTE·FM` with the `·` highlighted in `#FFB800` with glow. Unit designation labels: `UNIT·ID / SUBSISTEMA·MX` top, `CULTURAL·SUBSYSTEM·ACTIVE` bottom (both micro-size, low-contrast on-purpose).
- **Nav links** carry two-digit codes: `00 HOME / 01 AGENDA / 02 NOTICIAS / 03 REVIEWS / 04 MIXES / 05 EDITORIAL`. Active link has a horizontal glow bar at the bottom and a tiny `+` crosshair on hover.
- **MAGI indicators** — three boxes labeled CASPAR / BALTHASAR / MELCHIOR, each showing an animated green `OK` status. Reference to the three MAGI supercomputers in _Neon Genesis Evangelion_.
- **Timer** — T+ label + live `HH:MM:SS` time + a 5-digit frame counter (cycles every 100,000 frames of `Date.now() / 33` ≈ 30fps, purely decorative).
- **Data strip** scrolls 55s loop: `CDMX·UNDERGROUND // MUSICA·ELECTRONICA // FREQ·ACTIVA·128BPM // MAGI·SYSTEM·NOMINAL // A·T·FIELD·STABLE // BIOPATTERN·LOCKED …`

## The scrolling ticker

Uses a CSS keyframe `nge-ticker` (in [globals.css](../../app/globals.css)) that translates `-50%` over 55s. Content is duplicated (`[...DATA_STRIP, ...DATA_STRIP]`) so the wrap-around is seamless.

## Mobile

At `< md` breakpoint, the logo + toggle button show. Toggle (`≡` / `×`) opens a full vertical menu below the data strip. Active link marked with a `▶` glyph.

## Links

- [[NGE Aesthetic]]
- [[Typography]]
- [[Color System]]
