# 06 — «LIBREA»: punch, objects, pride

> Builds on [05-TRAMA](./05-TRAMA.md). TRAMA made the sheet calm and exact;
> it also made every section and every kind of content look the same.
> LIBREA keeps the minimal sheet and goes **overboard** — The Designers
> Republic / Wipeout / Marathon overboard — exactly where something changes:
> a section, a kind of content, an identity. And it turns the credencial and
> the trophies into objects worth owning.

## 1 · Liveries (*librea*)

Every section and every format wears a **livery**, like a Wipeout team:
a code, a channel number, a flat saturated colour, a pattern and a
pictogram. The base page stays paper and ink; the livery appears at full
volume in *identity moments*: section mastheads, route changes, tabs, the
format chip of a card, a card's hover, a reading's header, empty states.

Format colours descend from the real site's category colours
(`espectro-fm-web/lib/utils.ts categoryColor`), punched for print.

| Format | Code | Colour | On | Pattern |
| --- | --- | --- | --- | --- |
| evento | EV | #E63329 red | paper | `peligro` hazard stripes |
| mix | MX | #00B4D8 cyan | ink | `surcos` record grooves |
| reseña | RS | #FFC400 yellow | ink | `trama` halftone |
| editorial | ED | #7DC21E lime | ink | `registro` registration crosses |
| opinión | OP | #8B5CF6 violet | paper | `galones` chevrons |
| artículo | AR | #2F5BFF ultramarine | paper | `renglones` ruled lines |
| lista | LS | #EC4899 magenta | paper | `escala` ranked bars |
| noticia | NT | #111 ink | paper | `teletipo` ticker dashes |
| franja | FR | #9CA3AF steel | ink | `dial` frequency ticks |

| Section | Ch. | Code | Livery |
| --- | --- | --- | --- |
| Campo `/` | 00 | CMP | the energy ramp itself (stepped) |
| Agenda | 01 | AGD | evento |
| Mixes | 02 | MXS | mix |
| Lecturas | 03 | LCT | artículo — and **morphs** into each format's livery as you switch tabs |
| Foro | 04 | FRO | opinión (`muro` poster grid) |
| Mapa | 05 | MPA | #00A36C emerald (`panal` hexes) |
| Mercado | 06 | MRC | franja steel (`barras` barcode) |
| Taller | 07 | TLL | acid #D8FF00 on ink (`tapete` cutting mat) — creation |
| Central | 08 | CTR | ink + red (`peligro`) |
| Casa (about, manifiesto, equipo) | 09 | CAS | paper/ink (`registro`) |
| La Puerta / Espera | 10 | PTA | manila #E8A623 (`rueda`) for the handover and sticker tints; /welcome itself is the original door (see below) |

Two channels still never cross: **livery = what kind of thing / where you
are; ink hue on the energy ramp = how hot it is.** Liveries are flat blocks,
chips and patterns; energy is always swatches, bars and the ramp.

## 2 · Identity moments (overboard, on purpose)

- **Cabecera** — every section opens with a livery masthead: a full-width
  colour block, the channel number and code, the section name set huge in
  Anybody (extended, black) with an outlined overprint copy, the pattern
  band drifting slowly, the pictogram, one true line and real counts.
- **Relevo** — changing section, the new livery's slabs cover the page and
  retract in registration steps while the code decodes (~0.5 s). Within a
  section (Lecturas → Reseñas) the masthead **morphs** instead: colour
  floods across, the name scrambles into the new one while its width
  morphs, the pattern slides, the counts roll.
- **Always morphing** — codes and labels *decode* when they change (a
  scramble through glyphs, ≤ 350 ms); numerals roll; patterns drift inside
  mastheads while visible. Event-driven or slow; never flashing.
- **Cards** — the format chip is the livery (colour + code); the label's top
  rule is the livery colour, so the mosaic reads as a field of teams; hover
  floods the kicker with the livery and its pattern while the title
  re-prints in its energy.
- **Nav** — a channel chip (`01 AGD`) in the current livery that decodes on
  every route change; the active link rules in that colour.

## 2b · La Puerta — the original door, reprinted

/welcome keeps the original Gradiente door's composition and colours — **a
river of ivory running diagonally from the upper left off the lower right,
open at both edges, between two dark banks** (upper right, lower left),
widening round the grotesque face; the boxed wordmark top-left, one dark
panel with the ways in (Iniciar sesión · Acceso por invitación, and the acid
bar onto the waitlist), the address bottom-right — and replaces its
recursive fractal shader with **Umbral** (`components/puerta/Umbral.tsx`):
the same composition stepped into seven levels on an 11 px screen, each
level one pattern of the house library (paper, fine dots, halftone dots,
registration crosses, hazard stripes, pixel blocks, solid ink with
knocked-out crosses), the pigments (slate, ochre, mauve) as a misregistered
spot plate along the shores.

The river **flows**, as the original did: the field sways and the rough
shoreline drifts downstream — in printed steps (12 a second; the engine skips
the frames between; still under reduced motion). Everything else is an
event: it prints in over the page's gradient; the pointer develops the print
toward the middle patterns in stepped rings; keystrokes send a ring out from
the eye; an unknown code goes cold; a valid code widens the river and it
travels to wherever the card lands. The code, waitlist (same row as
/espera) and registration live in paper sheets inside the dark panel.

**Entering («Identidad», `components/acceso/*`).** Logging in speaks the same
language at the door and everywhere else: one panel, `Identidad`, lives in
La Puerta's console (Iniciar sesión) and in the Acceso sheet any page opens
(`openAccess`). Every identity sheet — Identidad, the door's code and
waitlist panels, the registration — wears the same livery head, `Cabeza`:
channel chip, the title set wide, one chip, the livery's pattern in a band;
changing mode floods the head across in registration steps and decodes the
words. Entrar wears the credencial's ink (CRD 11), a code La Puerta's manila
(PTA 10). The modes are channel-chip tabs. The demo identities are
**credentials in miniature** (`MiniCredencial`): each in its role's washed
stock with its grain and uneven dye, name, handle, role, folio in order of
arrival, rank and flags; they print in staggered, lift under the pointer
with red registration corners, light up as you type their handle («Entrar
como @…»), and press in one inverted step when chosen. There is **one way to
sign up**: a code entered in Acceso opens in La Puerta
(`/welcome?codigo=…`), where the card arrives and the identity is minted —
the sheet never mints one itself. The demo's open codes are listed from the
ledger, tap to fill.

## 3 · The credencial — «ESTUCHE»

The card is something you carry and show off. It lives in a **collector's
case**, one-touch style: two thick clear shells meeting at a parting seam,
flat glossy faces (the stickers' ground), generously rounded corners and a
machined edge — a fillet into a sanded side. Inside, the card sits in a
recessed pocket a hair larger than itself; around the pocket the shells'
inner faces are **sandblasted**, so the frosted band frames a clear window
and the card reads as *inside* the object. The band carries a laser-engraved
label with real data only (folio, handle, role). Scratches and smudges on the
outer skin only show when it leans, and deepen with membership age.

**The card is printed on its role's colour** — the feed's format colours,
so a role reads like a kind of content (`LIBREA_ROL`, `libreaDeRol` in
`lib/librea.ts`), each close to the role's original hue — but **dyed into
the board, not lit on a screen**: `cardStock()` keeps the livery's hue,
takes its chroma down (× 0.6) and draws its lightness toward a pale mid
(OKLab), so the card reads as coloured cotton stock next to the flat feed
livery. The type prints in the livery's own ink where it still reads on the
washed board (≥ 4:1), else in the other ink:

| Role | Livery | Washed stock | Ink | Foil (hot-foil accents) |
| --- | --- | --- | --- | --- |
| lector | reseña yellow #FFC400 | mustard #E1BF71 | ink | rainbow diffraction |
| curador | opinión violet #8B5CF6 | dusty violet #8E7AD2 | ink | glitter, flakes twinkling one by one |
| guía | editorial green #7DC21E | sage #8FB869 | ink | lenticular bands over brushed lines |
| insider | mix cyan #00B4D8 | faded teal #68AEC3 | ink | cracked-ice prism shards |
| admin | evento red #E63329 | faded brick #CD685C | ink | ember: dark foil, sparks, heat shimmer |

Matte cotton board with a visible grain — cloudy pulp formation, fibres,
flecks of recycled stock, micro-tooth — and **uneven dye**: a broad fade from
a corner where light reached it and a few deeper pools, seeded per card
(folio + handle), so no two boards look alike; a sheen only at grazing
angles; type and rules **letterpressed** into it, a triplex edge
(coloured faces, ink core) visible through the acrylic when edge-on. Foil
stamps the border, wordmark, role chip, folio, seal, pins and flags; it reads
as dark metal at rest and comes alive in motion. The name stays plain ink.

**Handling:** drag to turn it freely (pitch ±30°); let go and it **slings**
to the nearest face on a stiff underdamped spring — overshoot, a couple of
wobbles, rest (a fling carries it over). Click / Enter / Space flip with the
same landing; touch keeps vertical scroll; reduced motion lands in one frame.
Files and API in [04-KIT › Collectibles](./04-KIT.md). On La Puerta the
page's ground is painted on `<html>` so the 3D card can arrive over it.

## 4 · Stickers — «CALCOS»

Stickers are how you show who you stand with: a franja's mark bought from
its store, the stub of a night you had a ticket for, the house's own. They
are pressed onto the **case** (front or back) like decals: permanent once
applied (Counter-Strike rules — you can only scrape them off, pass by pass),
stacked over each other, and they **age**: fading, grime at the edges,
corners lifting — the older the case, the more it reads like a wall that's
been stuck on for years.

- Data: `lib/stickers/types.ts`, catalog `lib/stickers/catalog.ts`, actions
  `sticker-get` / `sticker-apply` / `sticker-scrape`, selectors `binderOf`,
  `placementsOf`, `stickersOfFranja`, `stickerOfEvent`, `hasSticker`,
  `editionLeft` in `lib/store/world-core.ts`.
- Forms: `logo` (die-cut around the franja mark), `tipo` (typographic),
  `cinta` (tape strip), `boleto` (ticket stub, perforated), `circulo` (flyer
  circle with a text ring), `sello` (stamp).
- **Finishes** (full spec in `lib/stickers/finish.ts`, followed by both the 3D
  case and the flat UIs): stock `papel`, `vinil`, `holo`, `brillo`,
  `transparente`, `metal` (oro / plata / cobre / grafito foil), `lenticular`
  (two frames flipping across ridges); eight holo families — prisma, galaxia,
  hielo roto, diamante, láser, aceite, escamas, motivo — each recognisable at
  a glance; reliefs over any stock — tinta en relieve, gofrado, hundido,
  barniz a registro, domo de resina. **The same design comes in several
  finishes** — separate catalog entries grouped by `design`, each with its
  own price and counted run (like CS stickers' paper / holo / foil; never a
  randomised paid outcome). **Every copy is unique**: its foil layout is
  seeded by the copy's uid (`copySeed`, `foilLayout`), so two copies of the
  same holo never catch the light the same way — in the binder and on the case.
- Getting them: a franja's store (price shown, **the demo never charges**),
  a night's reading ("Tengo boleto" — demo honour system, labelled), the
  house at signup.
- A night's stub: one per person per night, claimable until a week after the
  night ends (`STUB_WINDOW_MS`); scraping it off doesn't let you claim it
  again (`stubsClaimed`).
- *Built:* aging runs over about two years — ink fades toward paper, paper
  yellows, grime creeps in from the die-cut edge, corners curl to show the
  white backing and leave a dirty glue patch. Scraping opens streaks down to
  the case, one stepped pass at a time.
- **Wrap:** a sticker placed past the case's outline is never cut — it
  follows the outer skin (`EDGE_PATH`: fillet, sanded side, fillet) round the
  edge and continues flat on the other face, like a decal folded over a slab.
  Round the rounded corners it wraps radially and the squeezed material folds
  into a few shaded pleats. From the far side, through the acrylic, you see
  its backing. Only corners still on the flat face can curl.

## 5 · Trophies — «INSIGNIAS»

Trophies become **enamel pins**: die-struck metal (gold, silver, black
nickel, copper by family) with raised lines, glossy enamel fills in the
trophy's colour, an epoxy dome that catches light, the occasional glitter or
glow-in-the-dark fill. They sit **pressed into the page itself**: no tray,
no box — the paper around them is the page's own paper (`--paper`, matched
to the pixel), with soft neumorphic wells where the earned pins adhere and
blind-debossed outlines of the pins still to come, the condition printed
beside them. Hover tilts a pin under the light; click turns it over
(butterfly clutch, engraved month and story).

*Built:* silhouettes by family — craft a pointy-top hexagon (gold), reception
a speech bubble with `!` / `?` (nickel), community a shield (black nickel),
presence a disc with 24 pleated rays (copper). Special fills: glitter for
`presence_insider_track`, and **nacre instead of glow-in-the-dark** for
`thread_anchor` (the tray is always lit, so glow would never show; nacre
grows layer on layer around one grain, like a thread around its replies).
Lit by a generated jeweller's light box with its own tone mapping, handed
back so other GL windows are unaffected.

## Don't

Livery colour on body text, livery hue used to mean energy, ambient motion
that never rests, glitch that flashes above 3 Hz, stickers that can be moved
after pressing, fake scarcity (editions are real runs, counted).
