# 01 · CONCEPTO — what Gradiente is, and why it exists

> Written before a single pixel of V2. Everything in [02-DIRECCION](./02-DIRECCION.md) is derived from this page; if a V2 design decision can't be traced back to a line here, it is decoration and should be cut.
>
> Sources: the welcome copy and user guide (`wiki/copy/`), the domain and decision notes (`wiki/20-Domain`, `wiki/90-Decisions`), and the live code of `espectro-fm-web` (Sept 2026).

---

## The sentence

**Gradiente is a commons for Mexico's underground sound culture in which attention behaves like physics, not like money.**

Everything else — the fader, the half-life, the mosaic, the two reactions, the franjas, the foro — is that sentence made operable.

> *«Treinta rayos convergen en el cubo de una rueda; es el agujero en el centro lo que la hace útil.»* — Tao Te Ching, XI
>
> The project opens with this quote on purpose. Gradiente is designed as the **hub, not the spokes**: an emptiness at the center that the scene's own people (DJs, labels, promoters, venues, writers, serious listeners) converge on and fill. The site is not the content; it is the hole that makes the wheel turn.

---

## Why it was made

1. **The platforms that shape discovery were built elsewhere, to extract.** Algorithmic feeds optimize for time-on-site, flatten local context, and turn music into genre tags and counters. They take from the culture and give nothing back. («extraen y no devuelven nada a la cultura»)
2. **The CDMX scene already curates itself from the inside** — but its knowledge lives in Instagram stories, RA listings and WhatsApp groups: ephemeral, rented, owned by someone else.
3. **So Gradiente is two things at once:** *infraestructura* the scene owns (tools, listings, a press, a market, a forum) and *memoria* — a living archive where nothing is buried, things simply settle into their niches.
4. **It is local on purpose.** «Nosotros no necesitamos traducción.» Built from CDMX, aimed at Latin America, «por locales, para todo el mundo».
5. **It is human on purpose.** No AI-written text, no AI music. «No tienes que saber escribir bien. Solo tener algo que decir.»

---

## The five laws (the mechanics *are* the product)

### Law 1 — Energy, not genre · *el fader*

**«El género como único organizador de música es una mentira.»** There is techno that meditates and techno that detonates; three-a.m. jazz and wall-of-noise jazz. So every piece carries an **energy band** on a continuous axis:

`0 GLACIAL · 1 POLAR · 2 CHILL · 3 COOL · 4 FRESH · 5 GROOVE · 6 WARM · 7 HOT · 8 FUEGO · 9 BRASA · 10 VOLCÁN`

- Two clean axes that compose: **genre is categorical, energy is continuous.** You can ask for *dub at a 7* or *jazz at a 2*. The home filter is `energy range ∩ type ∩ any-of(genres)`.
- **Genre chips follow the feed, not stereotypes.** A techno item set at 2 makes a `techno` chip appear in the cold region, because that's where it actually is.
- **Calibración analógica.** The author proposes the band; the community refines it. Any logged-in reader can *drag* a reading onto the fader (a "vibe check"). At **5+ readings the crowd median becomes the effective band** — it changes feed eligibility, not just chrome. The author's original ticks stay visible so the gap between author and crowd is always legible.
- **The drag is the point.** A tap-to-agree would pour every passive scroller into the median. Slide-and-release filters for attention. *The friction is the design, not a defect.*

### Law 2 — Attention is physics, not currency · *HL (half-life)*

Every piece is born with energy — **HL** — that decays exponentially with a type-specific half-life (events 3 days, news 2 days, reviews 14, mixes 21…) and is **renewed when the community touches it** (open, save, comment, vibe check). **«Sube, baja, cambia de tamaño, muere, resucita si alguien la discute.»**

- **Size and position are the only visible signals.** No likes, no followers, no stars, no play counts, no "trending". An item fades by *shrinking and drifting*, never by showing a falling number.
- **No per-user feed.** Everyone sees the same field. The only personal thing is *write weight*: interactions from outside your usual genre/energy/format box push slightly harder (novelty weighting, ×0.6–1.5, invisible). Reads stay global.
- **Events have their own clock:** decay slows as the night approaches, freezes during the live window, and accelerates into the archive afterwards.
- **The creator can harvest (COSECHAR)** — once, ever — taking 40% of a piece's current HL into their own presence, at the cost of the piece decaying 1.7× faster afterwards. A garden metaphor made literal: *cultivate, then harvest*.
- The scalar is **private**. Only the publisher sees an HL bracket on their own cards (DÉBIL → MODESTO → NOTABLE → FUERTE → PLENO), in words, never digits.

### Law 3 — Guides, not gatekeepers

**«Somos guías, no porteros.»** Editors plant seeds (the editorial flag = a bigger starting HL, 50 vs 20) and pin a small portada; the collective decides what grows. Editorial content competes *in the same mosaic* as scraped events and member contributions — no separate "staff picks" lane. If nobody touches what the editors chose, it fades. That is intended.

### Law 4 — Voice is earned; labels go on people, never weights on content

- **Access layers are earned by participating:** `usuario → curador → guía | insider → admin`. Each unlocks formats (listicles and polls → opinions and mixes → editorials, events…). *Guía* is the house voice; *insider* is the scene's voice — same rights, different byline.
- **Two reactions, only two:** **`[!] SEÑAL`** (something ignites) and **`[?] DUDA`** (something opens a question). Mutually exclusive per person per comment. No up/down.
- **Reactions received shape a living rank** — `NORMIE` (<5), `DETONADOR` (mostly !), `ENIGMA` (mostly ?), `ESPECTRO` (balanced). Flat: no numbered tiers. It names *texture*, not status.
- **Progression is story-shaped:** trophies ("published in 5 formats", "a thread past 20 replies", "25 vibe checks"), rank frames, a *firma*, composer emojis. Never a public score, never a leaderboard.
- **Gamify the world, not the user.**

### Law 5 — One contained surface

**«Todo contenido en un solo lugar, sin cambios de página.»** Reading an article, playing a mix, inspecting an event: all happen *over* the field, which stays behind — dimmed, alive, exactly where you left it. Deep links via `?item=`. External links (tickets, SoundCloud, a label's site) are explicit escape hatches, never the default.

---

## The ecosystem

| Actor / place | What it is | Rules that shape its design |
|---|---|---|
| **Piezas** (9 types) | `evento · mix · noticia · review · editorial · opinion · articulo · listicle` + `franja` | Every piece: an image (always — cards are posters), an energy band, genres, tags, HL. Readers are per-type, not unified. |
| **Personas** | readers, curators, guides, insiders, admins; `isMod` / `isOG` flags | Identity = role + flags + derived rank + trophies + firma. HL is private. |
| **Franjas** | "a band on the dial": labels, venues, promoters, collectives, dealers | Never inside the mosaic. A rail, ordered chronologically, deaf to the fader; a dossier page; a team; an optional market. When a franja authors into the feed it is **transparently attributed** (`PRESENTA · CLUB JAPAN`). |
| **El Foro** | an imageboard: threads need an image + 1–5 genres + 1–5 tags; flat replies; `>>id` quotes; bump order | Not HL, not curated. **Only 30 threads can be open** — the oldest falls off when a new one arrives. |
| **El Mapa** | the whole archive as a honeycomb terrain: affinity decides neighborhood, HL decides area | Deterministic, global, no personalization. The periphery *is* the archive. |
| **El Mercado** | franja-only commerce, one storefront per franja, listings inside | Commerce never competes for HL. |
| **La Puerta** | invite-only entry (codes, a holographic credential), public waitlist | The card *is* the profile *is* the card. |
| **El Taller** | the creator's desk: compose (8 formats), drafts → pendiente → publicado, saves, reception, harvest | Publishing is a two-step commitment. Reception shows **shape, never weights**. |
| **Central** | admin instrument | The *only* surface allowed to show raw HL numbers. |

---

## The loop

```
          ┌──────────────── energy band (author) ────────────────┐
          │                                                       ▼
 PIECE ──► born with HL ──► mosaic: size + position ──► readers open / save / comment / calibrate
   ▲                                   ▲                         │            │
   │                                   │     (novelty-weighted)  │            ▼
   │                                   └──── HL renewed ◄────────┘     crowd median (≥5)
   │                                                                    re-positions the piece
   │                                                                    on the energy axis
   └── creator: presence ◄── reactions / saves received ──► rank (!/?) · trophies · harvest
```

Two axes position a piece (**energy**, **genre**). One scalar animates it (**HL**). Two gestures refine it (**calibration**, **attention**). Everything a reader sees is the result of those five things — nothing is ranked by who you are.

---

## Non-negotiables for any redesign

1. **No visible engagement metrics** on content — no likes, counts, trending, followers. Size and position only. (Poll results inside a poll, after you vote, are the one carve-out; `/admin` is the one exemption.)
2. **No per-user feed ordering.** The fader filters; it never personalizes.
3. **The energy gesture keeps its friction** — drag-to-set, login-gated, one mutable reading per person.
4. **Franjas never enter the mosaic.** Their rail ignores the fader.
5. **Cards are posters** — the artwork is always present and dominant; dense captions only on hover/focus.
6. **HL is private** except as words on the publisher's own cards; public progression is trophies/frames/firma/emoji only.
7. **Content opens over the field**, never on a new page (identity hubs — `/f/`, `/u/` — are the exception).
8. **No decorative chrome.** Every visible element works today or names its future.
9. **Spanish UI, human voice.** System copy is terse and uppercase; editorial copy is warm and informed.

---

## What the current interface hides

The current UI (NGE terminal → «PLIEGO» print) is expressive and dense, but it *narrates* the mechanics with chrome instead of *embodying* them:

- **The fader is the heart of the system, yet it looks like one control among many.** Moving it re-filters a grid; nothing else in the world responds. Energy is shown as a color stripe and a label.
- **HL — a living, decaying energy — is invisible** except as card size. The "organism" the copy promises («no es algoritmo, es un organismo») never visibly breathes, cools, or re-ignites.
- **Terminal chrome (tickers, `MAGI·SYSTEM·NOMINAL`, `//` tokens) speaks in the voice of a machine** — the exact register the project defines itself against. The scene is human; the interface performs a computer.
- **Commitment gestures (drag-to-calibrate, confirm-to-publish, harvest) are philosophically central but visually ordinary.**
- **Franjas are "bands on the dial" — a radio metaphor — but they render as a list.**
- **The foro's 30-thread cap and bump order are rules you read about, not a space you feel.**

## The opportunity

Make the mechanics themselves the aesthetic:

| Mechanic | Becomes |
|---|---|
| Energy 0–10 | The **temperature** of the entire interface — color, motion tempo, shader physics, and typographic width/weight |
| HL decay | Pieces **cool** over time and **re-ignite** when touched — a visible metabolism with no numbers |
| Calibration | A tactile instrument with mass and detents; author, crowd and you as three legible layers |
| Size & position | A mosaic with physical reflow — pieces grow, shrink and drift, never pop |
| Franjas | A literal **tuning dial**: stations with interference between them |
| Foro cap | Exactly **30 slots**; a new thread pushes the oldest off the wall |
| `>>id` quotes | Threads drawn between posts, like string on a wall |
| Contained surface | Pieces **unfold from their own card** over a field that stays alive behind |
| La Puerta | The Tao wheel: thirty spokes, and the code field is the hole at the center |

This is the brief for V2.
