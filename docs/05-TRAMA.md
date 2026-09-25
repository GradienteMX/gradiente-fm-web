# 05 — «TRAMA»: the printed direction

> Supersedes the visual part of `02-DIRECCION.md` («CAMPO»). The interaction
> ideas of CAMPO stay (energy typography, the Horizonte instrument, the
> organism's physics, the contained reading surface); the look moves to the
> sheet.

## Why

The first V2 pass leaned on dark glass, glowing fields and material shaders —
effective, but generic ("modern") and louder than Gradiente. The real site's
language is a **printed sheet**: cream paper, ink, hairlines, sparse red,
mono labels, generous negative space. TRAMA is the middle ground between
that sheet and V2's interactions, pushed toward The Designers Republic:
disciplined information graphics, assertive type, indexical labels and
unexpected-but-legible alignment — never copied motifs, distress or
illegible microtype.

*Trama* is the halftone screen of offset printing (and "weave", "plot"). All
motion effects are **printing gestures**: blocks resolving into crisp content,
then getting out of the way.

## The sheet

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Paper | `--paper` | #EDEBE3 | the page |
| Raised | `--paper-2` | #F6F4EC | sheets, panels, labels |
| Sunken | `--paper-3` | #E4E1D6 | inputs, unprinted plates |
| Pressed | `--paper-4` | #D8D4C7 | hover/pressed on paper |
| Ink | `--ink` `--ink-2` `--ink-3` `--ink-4` | #111 → #8C877B | text; `--ink-4` never for body copy |
| Rules | `--rule`, `--hair`, `--hair-2`, `--hair-3` | ink, ink 12/22/40 % | 1 px structure / hairlines |
| Well | `--well`, `--well-2`, `--on-well*` | #111 | the **only** dark surfaces: media frames, the deck, map chrome |
| Red | `--red`, `--red-ink` | #E63329 / #C42B20 | live, alerts, destructive, active nav, registration marks, section names |
| Acid | `--acid` | #D8FF00 | creation only, and only as a **ground** (never acid text/border on paper) |
| Cobalt | `--cobalt` | #1D4ED8 | private HL — "solo tú ves esto" |
| Stock | `--p-*` | pastel plates | **format** (like forms printed on coloured paper) |
| Energy | `--e0`…`--e10` | the real thermal ramp | **energy** — ink hue belongs to energy alone |

Two channels, never crossed: **stock = format, ink hue = energy.** Text on an
energy ground: `energyOn(e)` (paper on 0–1, ink on 2–10). On paper the ramp is
printed as **swatches** (`bandSteps`, `SPECTRUM_STEPS`), not smooth gradients.

## Type

- **Anybody** (`--font-display`) — energy typography: every title is set at
  its piece's energy (`energyVariation`: glacial wide/even → volcán
  condensed/black; never hairline). Sized with `fitTitle` (container units).
- **Space Grotesk** (`--font-ui`) — interface and short text.
- **Space Mono** (`--font-mono`) — the system speaking: labels, indices,
  codes, counters, chips, buttons. Uppercase, 9.5–11 px, tracking .06–.14em.
- **Newsreader** (`--font-read`) — long prose and deks only.

## Grammar

- **Indexical heads**: `01 / PORTADA — lo que plantó la redacción` — index in
  ink, slash in `--ink-4`, name in red-ink bold, the rest in lowercase prose.
- **Codes**: `MX`, `EV·014`, `04–07 · FRESH → HOT`. Format code sits on its stock.
- **Boxes**: 1 px ink outlines, square corners, joined segmented controls
  (`margin-left: -1px`). No pills; circles only for avatars and dots.
- **Pressed = inversion**: ink ground, paper text, zero tween.
- **Lift**: the only shadow is `var(--lift)` (4 px hard offset) for things
  that are lifted, dragged or floating above the sheet (menus, tags).
- **Registration marks**: four red corners on hover/focus of a piece.
- **Hatch** (`.hatch`) is the printed "nothing here".
- **Fresh** (< 1 h): `.print-fresh`, colour plates slipping out of register.
- Frames drawn with `::after { border }` over media — outlines paint under
  positioned children.
- Negative space: section gap 40 px, rail 264 px, gutters `--gutter`.

## Motion

Mechanical, never floaty: platen passes (`--ease-platen`), registration jumps
(`steps()`), one-step inversions. Entry waits for intent (60 ms), release is
faster (130 ms). Nothing strobes above 3 Hz.

## TRAMA gestures (`components/trama`)

One transparent WebGL canvas above the DOM. Real DOM underneath, always; the
canvas paints only while a gesture runs, then hands the element back 1:1 and
stops (zero idle cost). No per-frame randomness. Reduced motion / no WebGL →
instant.

| Gesture | API | Where it means something |
| --- | --- | --- |
| Print text | `revelar(el, {energy})`, `<Revelado>` | headlines arriving; hover re-prints a card title in its energy's ink |
| Print image | `revelarImagen(img)` / `useRevelarImagen` | the first sheet of the organism; pieces entering after a retune |
| Un-print | `revelarImagen(img, {ceniza:true})` | pieces leaving the organism (grey blocks) |
| Cross plates | `cruzar(frame, a, b)` | the portada turning |
| Sheet off the press | `imprimirHoja(el, {origin})` | a panel (reading, deck) opening from where it was asked for |
| Retune pass | `barrido(el)` | the mosaic re-ranking after the Horizonte moves |
| Burst | `chispa(x, y, e)` / `flare()` | a commit landed (save, reading, vote) |
| Settle | `asentar(root?)` | a modal opens: finish everything outside it |

Presets for text: `imprimir` (hot silhouettes → ink), `disolver` (quiet grey
mosaic), `bitmap` (1-bit ordered dither), `radiar` (from the centre),
`teletipo` (a narrow front, left to right).

The stage canvas **behind** the DOM survives only for GL islands (map,
credencial…): transparent, idle when no window is registered.

## Don't

Glass, blur, glows, soft shadows, decorative gradients, neon, scanlines,
bloom, fluid/aurora fields, radii > 2 px, pills, rainbow hue for anything but
energy, acid text on paper, HL numbers outside the admin instrument.

The one exception is the collectibles (06-LIBREA §3–5): they are objects,
not UI chrome. The credencial's acrylic case, stickers and enamel pins may
use real material light — reflections, frost, foil, and the soft deboss of
pins pressed into the page. None of it spreads to controls, panels or type.
