# 02 · DIRECCIÓN — «CAMPO»

> **Superseded for the visual layer by [05-TRAMA](./05-TRAMA.md)** (2026-09-25): the look moved from a dark glowing field to a printed sheet. The interaction ideas below (energy typography, the instrument, the organism, the contained reading surface) still apply; the obsidian palette, glows and material shaders do not.
>
> The V2 design direction. Derived line-by-line from [01-CONCEPTO](./01-CONCEPTO.md).

## The idea in one paragraph

Gradiente V2 is a single living **field** (*campo*: a field of energy, and a cultivated field). Pieces grow in it, glow with their half-life, cool as they age and re-ignite when someone touches them. The fader does not "filter a list" — it sets the **temperature of the world**: the color of the light, the tempo of every animation, the physics of the background, even the width and weight of the type. The surfaces are quiet and exact, like a well-made instrument; the life is carried by behavior — shaders, mass, inertia, light.

## Stance — *instrumento, no terminal*

Retro-futurist minimalism, read as **1970s precision instruments and Mexican modernism, re-built with 2026 physics** — never as a costume.

| We take | We refuse |
|---|---|
| The *behavior* of hi-fi hardware: faders with mass, detents, a needle that settles (Braun, Technics, B&O) | Skeuomorphic knobs, brushed metal, wood grain |
| Lance Wyman's Mexico '68: parallel lines that vibrate, kinetic typography | Copying the '68 logo or its stripes as decoration |
| Barragán: vast calm planes, a single saturated color, light as material | "Mexican" clichés, papel picado, folk patterns |
| Raster-Noton / Ikeda precision: data *as* form | Fake data, decorative graphs |
| Space-age product clarity: few controls, each one heroic | Sci-fi HUD overlays, terminal tickers, CRT scanlines, pixel/mono fonts, glassmorphism-by-default |

The current site speaks as a machine (`MAGI·SYSTEM·NOMINAL`). V2 speaks as a room full of people with very good equipment.

---

## Principles

1. **Una variable, un significado.** Each visual channel encodes exactly one thing:

   | Channel | Encodes |
   |---|---|
   | **Hue** | Energy (0–10). *Nothing else in the UI is colored.* Formats have no colors. |
   | **Luminance / glow** | Life (HL). Fresh pieces burn; old ones cool to ash. Never a number. |
   | **Area + position** | Prominence (HL rank). The only ranking signal. |
   | **Type width + weight** | Energy again, typographically: glacial titles are wide and light, volcán titles are condensed and black. |
   | **Pictogram** | Format (evento, mix, texto…). |
   | **Band stripe** | Franja attribution. |
   | **Motion tempo** | The energy of the current field. |

2. **El campo responde.** The background is state, not decoration: temperature (fader), pulse (audio), flares (someone just saved, calibrated, commented), stillness (nothing is happening). When nothing happens, the field is almost still.
3. **Masa y fricción.** Controls have mass and settle. Commitments cost a gesture: *drag* to calibrate, *hold* to publish, *hold* to harvest. Nothing important happens on a tap.
4. **Silencio alrededor del arte.** Chrome is hairlines and small type. The scene's flyers and covers bring the noise and the color — the frame is exact so the content can be wild.
5. **Nada aparece ni desaparece de golpe.** Objects keep their identity across states: a card unfolds into its reader and folds back into place; filtered pieces cool and shrink out; new ones kindle in.
6. **Honestidad.** No invented numbers, no fake signal, no spinner pretending. Empty states say what is true.

---

## Material

### Color

- **Obsidiana** — base `#09080B`, raised `#111016`, elevated `#18161E`, hairline `rgba(236,231,223,.09)`.
  Volcanic glass: black with a trace of violet warmth; a nod to Tezcatlipoca's smoking mirror, never stated.
- **Cal** — ink `#ECE7DF` (lime plaster). Secondary 64%, tertiary 40%, faint 18%.
- **Espectro** — the only saturated color in the system. 11 stops designed in OKLCH so the ramp is perceptually even; lightness dips through the groove and rises again into incandescence, so both extremes read as *pure*.

  | # | Name | OKLCH |
  |---|---|---|
  | 0 | GLACIAL | `0.91 0.07 212` |
  | 1 | POLAR | `0.84 0.11 224` |
  | 2 | CHILL | `0.75 0.14 238` |
  | 3 | COOL | `0.65 0.17 262` |
  | 4 | FRESH | `0.59 0.21 288` |
  | 5 | GROOVE | `0.61 0.25 318` |
  | 6 | WARM | `0.64 0.25 352` — *rosa mexicano* |
  | 7 | HOT | `0.65 0.23 20` |
  | 8 | FUEGO | `0.69 0.21 36` |
  | 9 | BRASA | `0.75 0.19 52` |
  | 10 | VOLCÁN | `0.83 0.17 72` — incandescent |

  Hotter is brighter, as in a real flame. `lib/vibe.ts` converts these to sRGB for GLSL and exposes CSS custom properties `--e0…--e10`.

### Type

| Role | Family | Why |
|---|---|---|
| **Display — la voz de la energía** | **Anybody** (variable: `wdth` 50–150, `wght` 100–900) | Its width axis spans extended-airy to compressed-dense. Every title is set **at its own energy**: `wdth = 140 → 58`, `wght = 240 → 860` as energy goes 0 → 10. The feed becomes typographically varied yet systematic. |
| **Interface** | **Instrument Sans** (variable `wdth`, `wght`) | A neutral, slightly retro neo-grotesk. Tabular numerals for dates and times. |
| **Reading** | **Newsreader** (variable `opsz`, `wght`, italics) | Optical sizes for long-form; warm, human, editorial. |

The **wordmark** is a typographic gradient: each letter of GRADIENTE steps from extended-hairline to compressed-black. When the fader moves, the pivot of that gradient follows it.

### Shape

- Pieces: 3px radius — almost square, machined.
- Panels: 14px. Controls: capsules. Hairlines: 1px at 9% ink.
- **Pictograms** (format): circle-based geometric marks — `evento` ◉ a place-in-time · `mix` ◎ a record · `noticia` ― a bulletin · `review` ◐ a judgement · `editorial` ■ the masthead · `opinion` ▲ a stance · `articulo` ≡ a long body · `listicle` ⋮ a ranked stack · `franja` ▭ a band.
- **Rank sigils**: NORMIE ○ · DETONADOR ✳ (a burst) · ENIGMA ◌? (a spiral) · ESPECTRO ◑ (a balanced split).

### Grid & rhythm

4px base. 12 columns, 1680 max, 32px gutters. Spacing scale 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128.

---

## Motion

- **Eases:** `materia` (heavy expo-out — objects with mass), `resorte` (a damped spring for handles and needles), `enfriar` (a long sine for cooling and breathing).
- **Durations:** micro 160 ms · base 420 ms · stage 900 ms · epic 1600 ms.
- **Energy sets tempo.** The global timeline's `timeScale` follows the fader's center: 0.85× at glacial, 1.2× at volcán. Cold is patient; hot is urgent. (Clamped so usability never suffers.)
- **Reflow is physical.** Filter changes run a GSAP Flip over the mosaic: pieces that leave cool, shrink and fade to ash; pieces that stay slide and resize; pieces that enter kindle from a spark.
- **Containment.** A piece's artwork unfolds from its card rect into the reader (Flip across layers); the field dims and keeps moving behind; closing folds it home.
- **Reduced motion:** shaders render a still frame; transitions become 160 ms fades; nothing loops.

---

## The field — shader catalogue

One WebGL context for the whole app (`components/stage`): a fixed canvas **behind** the DOM renders the field full-screen, then a set of DOM-tracked *windows* (scissored viewports) for the instruments that need GL. One renderer, one loop, visibility-culled.

| Shader | Where | What it does |
|---|---|---|
| **Campo** | everywhere, behind everything | Domain-warped flow noise whose regime is the fader: **frozen** (slow Voronoi frost, glints) → **laminar** (long silky currents) → **convective** (rising plumes, heat shimmer, embers). Hue from the spectrum LUT restricted to the selected band. Audio adds pulse; interactions inject **flares** (expanding rings at the element's position, tinted by the piece's energy). |
| **Lente** | hover on any piece | The artwork is re-rendered through a material chosen by its energy: *hielo* (0–2, crystalline refraction), *agua* (3–4, ripples), *surco* (5–6, groove lines that bend with the pointer — a nod to Wyman), *calor* (7–8, rising haze), *magma* (9–10, glowing dissolve along noise edges). |
| **Portada** | the pinned carousel | Slide transitions dissolve with the incoming piece's material: frost crystallises cold pieces in, heat burns hot ones through. |
| **Credencial** | profile | A thin-film iridescent card with depth; tilt follows the pointer, click flips to trophies. |
| **Rueda** | La Puerta | Thirty spokes converge on an empty hub; the code field is the hole. Typing sends pulses down the spokes; a valid code opens the iris. |
| **Territorio** | the map | The honeycomb as an instanced terrain: HL is area and light, energy is the rim, affinity is geography. |

---

## Components (vocabulary)

| V2 name | Replaces | Essence |
|---|---|---|
| **Horizonte** | VibeSlider | The spectrum as a horizon across the top of the world. Two handles with mass, a lit band you can drag as a whole, station names set in their own energy, genre particles floating where the feed actually is. |
| **Calibrador** | VibeFader | The vibe check. Press and paint your reading across the track, release to seal it. Three legible layers: the lit band (author until 5 readings, then crowd), your ghost, the author's ticks. |
| **Pieza** | ContentCard | A poster at rest (art + title in its energy). On hover: the Lente, the caption, the gestures. Its bottom edge is an energy line whose glow is its life. |
| **Organismo** | ContentGrid | The HL mosaic (same ranking math, same tiers and caps) with physical reflow. |
| **Portada** | HeroCarousel | Pinned pieces, 9 s dwell, material transitions, dwell shown as a single filling hairline. |
| **Pulso** | EventosRail | The next fourteen nights as a timeline you can throw; tonight burns, live events breathe. |
| **Dial** | FranjasRail | A tuning scale. Scroll or drag to tune; between stations there is interference; on a station, it locks and shows the franja. |
| **Consola** | NowPlayingHud / AudioPlayer3D | The persistent deck. The field listens to it. |
| **Lectura** | OverlayShell + readers | The contained reading surface. Per format: **Noche** (evento), **Sesión** (mix), **Texto** (reader types), **Crónica** (artículo), **Lista** (listicle). |
| **Hilo** | CommentsColumn | Comments with only `[!]` and `[?]`; rank sigils; firma. |
| **Muro** | ForoCatalog | Exactly thirty slots. `>>id` quotes draw a thread between posts. |
| **Territorio** | /mapa | The archive as land. |
| **Credencial** | /u/[username] + invite card | One card, two states: invitation and public credential. |
| **Taller** | /dashboard | The desk: Panel · Publicar (**Mesa**) · Guardados · Recepción · Franja · Mercado. |
| **Puerta** | /welcome | The wheel. |
| **Central** | /admin | The one instrument with numbers. |

---

## Voice

Spanish UI, human. Short uppercase labels for instruments (`ENERGÍA`, `EN VIVO`, `ESTA NOCHE`), warm sentence case for everything a person reads. No `//` tokens, no machine jargon. Empty states tell the truth in one line: *«Nada en esta temperatura. Mueve el horizonte.»*
