# 03 · PARIDAD — every current function, and where it lives in V2

> The contract for the rebuild. Left: what `espectro-fm-web` does today (verified against code, Sept 2026). Right: the V2 surface that carries it. Mechanics are ported, not reinvented — `lib/seed/*` holds the original ranking math, taxonomy and seed data; `lib/data` + `lib/store` run them locally.

Status legend: ✅ built · ◐ partial · ○ planned

## Shell & state

| Today | V2 |
|---|---|
| Providers: auth, prompt, publish-confirm, vibe, overlay, search, audio | `lib/store/*` (zustand) + `components/shell/*` |
| `?item=` deep link on any page, `?comment=` focus, `?inspect=1` | `lib/store/lectura.ts` URL sync → **Lectura** host |
| Anonymous → `/welcome` gate | Demo mode: anyone can browse; gated actions open **Acceso** (login sheet with demo identities) |
| Vibe range + category + multi-genre filter (home only for cat/genre) | `lib/store/campo.ts` → **Horizonte**, **Formatos**, genre particles |
| Global `/` search | **Buscador** palette |
| Prompt / type-to-confirm dialogs | **Dialogo** kit |
| Publish confirmation (draft → pendiente → publicado) | **Mesa** hold-to-publish + **Confirmar** sheet |
| Report overlay (8 reasons) | **Reportar** sheet |

## Home `/`

| Today | V2 |
|---|---|
| Portada carousel (pinned, 9 s dwell, pause rules, admin unpin) | **Portada** — material shader transitions, dwell hairline |
| EventosRail (auto-scroll marquee, drag) | **Pulso** — 14-night timeline, inertial drag |
| FeedHeader (filtered status + clears) | **Estado** line under the Horizonte |
| ContentGrid mosaic (`rankItems`: xl/lg/md/sm, caps, weave, run-breaker, tail) | **Organismo** — same `rankItems`, GSAP Flip reflow |
| Event caps (3/day, 8 total; editorial/elevated bypass) | `lib/data/feed.ts` — same constants |
| ContentCard poster + hover dense face, chips (★, NUEVO, PASADO, franja stamp, own-HL chip, admin portada lever), SavedBadge, PollCardCanvas | **Pieza** + **Lente** + card poll canvas |
| CategoryRail (type counts) | **Formatos** (pictogram row with counts) |
| EL CAMPO fluid panel | **Campo** — the whole background |
| Queue seeder (12 playable mixes by HL) | **Consola** queue |
| FranjasRail + drawer | **Dial** |
| MarketplaceRail | **Mercado** strip under the Dial |

## Reading (overlays)

| Today | V2 |
|---|---|
| OverlayShell (save, copy link, admin portada/delete, close, comments rail `C`, Esc) | **Lectura** shell |
| EventoOverlay (flyer, facts, fader, entities, lineup, attendance poll, tickets) | **Noche** |
| MixOverlay (player, contexto, tracklist, poll, O/P keys, siguientes mixes) | **Sesión** |
| ReaderOverlay (editorial/review/opinion/noticia; rail ESCUCHAR/ARCHIVO/CONTEXTO; F flyer; scroll %) | **Texto** |
| ArticuloOverlay (índice, body blocks, footnotes, related) | **Crónica** |
| ListicleOverlay (track blocks, queue, poll from list) | **Lista** |
| FranjaOverlay (identity, kind slot, peeks, mercado) | **Estación** (franja peek) |
| MarketplaceOverlay + ListingDetail + listing comments | **Tienda** + **Pieza de mercado** |
| VibeFader (arm → drag → commit, author ticks, crowd ≥5, your bracket) | **Calibrador** |
| Comments (tree, `!`/`?`, save, reply, edit 15 min, tombstones, restore, report, emoji tokens, firma) | **Hilo** |
| PollSection / PollCardCanvas (anonymous-until-vote) | **Encuesta** |

## Other routes

| Today | V2 |
|---|---|
| `/agenda` (search, archive toggle, `rankAgenda`) | **Agenda** — timeline + mosaic |
| `/mixes /editorial /noticias /reviews /articulos /opinion` | Type pages via one **Sección** template |
| `/foro` catalog (30 cap, bump order, search, vibe via genres) + thread + compose | **Muro** (30 slots) + **Hilo de foro** + **Nuevo hilo** |
| `/marketplace` (piezas + tiendas) | **Mercado** |
| `/f/[slug]` dossier | **Franja** page |
| `/e/[slug]` entity | **Ficha** page |
| `/u/[username]` (expediente, trofeos, publicados) | **Credencial** |
| `/mapa` (honeycomb, afinidad, focus, filters, keyboard) | **Territorio** |
| `/dashboard` spaces: PANEL widgets, PUBLICAR, FRANJA, MERCADO, ACTIVIDAD (+HP view) | **Taller** |
| Composer (8 types, steps, autosave, undo/redo, readiness hard/soft, preview, guide) | **Mesa** |
| CULTIVAR → COSECHAR harvest | **Cosecha** (hold gesture) |
| `/admin` 7 tabs | **Central** |
| `/welcome` gate + invite 3D + registro + terms | **Puerta** (+ **Credencial** invitation state) |
| `/espera` waitlist | **Espera** |
| `/about /manifesto /equipo` | **Casa** pages |

## Rules carried unchanged

Size & position only · no per-user feed · drag-to-calibrate (login-gated, one mutable reading) · crowd ≥ 5 → median band (feed eligibility) · franjas out of the mosaic and deaf to the fader · publisher-only HL words · trophies/firma/emoji as the only public progression · `!`/`?` only · ranks: < 2 reactions NORMIE, ≥ 65 % `!` DETONADOR, ≤ 35 % `!` ENIGMA, else ESPECTRO · harvest once, 40 % echo, 1.7× decay · foro 30 cap, bump order, 1–5 genres, 1–5 tags, ≥ 1 image · polls anonymous until vote · Spanish UI.
