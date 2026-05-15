---
type: component
status: current
tags: [component, navigation, header, nge]
updated: 2026-05-12
---

# Navigation

> The EVA-unit-designation header bar. Orange glow, scrolling data-strip ticker, optional clock at 2xl+. MAGI indicators removed 2026-05-07 to free header space at MacBook widths. Nav row trimmed from 9 → 4 and brand renamed `GRADIENTE·FM → GRADIENTE·MX` on 2026-05-12 — see top of [[log]] for the why (beta testers were ignoring the header because it duplicated the SECCIÓN filter rail).

## Source

[components/Navigation.tsx](../../components/Navigation.tsx)

## Client component? Yes

- `usePathname()` for active link
- `useState` for mobile menu toggle
- `useEffect` + `setInterval(100ms)` for the live clock and frame counter

## Anatomy

Four vertical strips stacked top-to-bottom:

1. **Top gradient bar** (2px) — orange fire gradient, purely decorative.
2. **Main bar** (54px) — logo box / nav links / timer (2xl+ only) / [[AuthBadge]].
3. **Data strip** (20px) — scrolling token marquee.
4. **Mobile menu** — slide-out panel when `mobileOpen`.

## The NGE touches

- **Logo box** has the `eva-box` class + a bar-graph fill indicator on the left. Brand reads `GRADIENTE·MX` (was `·FM` until 2026-05-12) with the `·` highlighted in `#FFB800` with glow. Unit designation labels: `UNIT·ID / SUBSISTEMA·MX` top, `CULTURAL·SUBSYSTEM·ACTIVE` bottom (both micro-size, low-contrast on-purpose).
- **Nav links** — four destinations: `HOME · AGENDA · FORO · MARKETPLACE`. Trimmed from nine on 2026-05-12; the previous list (`HOME / AGENDA / NOTICIAS / REVIEWS / MIXES / EDITORIAL / ARTÍCULOS / FORO / MARKETPLACE`) was a visual duplicate of the SECCIÓN filter rail — five of nine labels matched `//NOTICIA / //REVIEW / //MIX / //EDITORIAL / //ARTÍCULO` content-type chips one-for-one, so testers learned to ignore the header and never discovered FORO + MARKETPLACE (the only net-new destinations). Two-digit `00–05` route codes dropped along with the trimmed items; padding is `px-6` again now that the row carries fewer items.
- **Active state** — orange → red gradient text (`#FF8800 → #E63329`) via `bg-clip: text` + matching gradient bottom bar + ~6% opacity gradient bg tint. Inactive items render in **solid NGE orange** (`#FF8800`) with a faint `text-shadow` glow — the original "dim until active" treatment was the second SECCIÓN-equivalence cue (inactive items vanished into the chrome), so it was retired. Hover gets a tiny `+` crosshair top-right. **Gotcha:** `text-shadow` doesn't render on `bg-clip: text` glyphs (underlying glyph is transparent — no surface to cast a shadow from), so the active glow uses `filter: drop-shadow()` instead. That operates on the rendered pixels, gradient included.
- **Timer** — T+ label + live `HH:MM:SS` time + a 5-digit frame counter (cycles every 100,000 frames of `Date.now() / 33` ≈ 30fps, purely decorative). Wrapped in `hidden 2xl:flex` — visible only at viewports ≥1536px. Sacrificed first when header space runs low.
- **Data strip** scrolls 55s loop: `CDMX·UNDERGROUND // MUSICA·ELECTRONICA // FREQ·ACTIVA·128BPM // MAGI·SYSTEM·NOMINAL // A·T·FIELD·STABLE // BIOPATTERN·LOCKED …`

## The scrolling ticker

Uses a CSS keyframe `nge-ticker` (in [globals.css](../../app/globals.css)) that translates `-50%` over 55s. Content is duplicated (`[...DATA_STRIP, ...DATA_STRIP]`) so the wrap-around is seamless.

## Mobile

At `< md` breakpoint, the logo + toggle button show. Toggle (`≡` / `×`) opens a full vertical menu below the data strip. Active link marked with a `▶` glyph.

## Links

- [[NGE Aesthetic]]
- [[Typography]]
- [[Color System]]
