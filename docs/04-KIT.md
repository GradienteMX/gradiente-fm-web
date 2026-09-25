# 04 · KIT — how to build a surface in V2

> The contract every surface follows. Read [01-CONCEPTO](./01-CONCEPTO.md) and [05-TRAMA](./05-TRAMA.md) (the visual direction) first; this page is the practical *how*.

## Stack

Next 16 (App Router, Turbopack) · React 19 · TypeScript 5.9 strict · CSS Modules (no Tailwind) · three.js (raw, one context) · GSAP 3.15 (all plugins free: Flip, Draggable, Inertia, SplitText, CustomEase…) · zustand · immer · date-fns 4.

- Every interactive component is `'use client'`. Pages under `app/` are thin server files that render a client surface.
- Import with `@/…`. Named exports. English code, **Spanish UI**.
- **No new dependencies** without a very good reason.

## Non-negotiable product rules (from 01-CONCEPTO)

1. No visible engagement metrics on content (likes, views, play counts, trending, followers). Size + position are the only ranking signals. Counts that are *catalog facts* (pieces per format, listings in a store) are fine; poll results only after voting; comment/reaction counts on comments are fine (conversation, not ranking).
2. No per-user feed ordering. Everything is global.
3. Calibration is drag-to-set, login-gated, one reading per person (use `<Calibrador>`).
4. Franjas never enter the mosaic; their lists ignore the Horizonte.
5. Cards always carry artwork (use `<Pieza>`; if there's no image it paints an energy plate).
6. HL is private: only the publisher sees HL **words** on their own pieces (`hlBracket(currentHp(item, now))`). Public progression = trophies, rank frames, firma, emoji. `/central` is the only place raw numbers appear.
7. Content opens over the field (`openLectura(slug, originRect)`), never a new page (except identity hubs `/f/`, `/u/`, `/e/`).
8. **No decorative chrome.** Every element works today or has a named future. No fake HUDs, tickers, "SYSTEM NOMINAL".
9. Ink hue means energy and nothing else. Formats are distinguished by pictograms (`FormatGlyph`) and paper **stock** (`FORMAT_STOCK`, pale flat plates) — never by ink hue.

## Tokens (app/globals.css)

Paper `--paper` (page), `--paper-2` (raised sheets), `--paper-3` (sunken/inputs), `--paper-4` (pressed) · ink `--ink`, `--ink-2`, `--ink-3`, `--ink-4` (never body copy) · rules `--rule` (1px ink), `--hair`, `--hair-2`, `--hair-3` · wells (the only dark surfaces) `--well`, `--well-2`, `--on-well`, `--on-well-2`, `--on-well-3`, `--on-well-hair` · signals `--red` / `--red-ink` (live, alerts, destructive, active, section names), `--acid` (creation, as a ground only), `--cobalt` (private HL) · stock `--p-mix`, `--p-lista`, `--p-evento`, `--p-review`, `--p-texto`, `--p-noticia`, `--p-franja` · energy `--e0 … --e10` (the real thermal ramp), `--spectrum`, `--spectrum-steps` · field state `--field-e`, `--field-color`, `--field-lo`, `--field-hi` · fonts `--font-display` (Anybody), `--font-ui` (Space Grotesk), `--font-mono` (Space Mono), `--font-read` (Newsreader) · motion `--ease-platen`, `--ease-release`, `--ease-materia`, `--t-micro|base|stage` (130/220/520) · shape: square (`--r-*` = 0), `--lift` / `--lift-deep` (the only shadows) · layout `--gutter`, `--max`, `--read`, `--nav-h`. The old `--obs-*` names are aliases of the paper tokens.

Global utility classes (only these): `.label` (mono tracked uppercase), `.meta` (mono), `.num`, `.display`, `.sr-only`, `.hairline`, `.hatch` (the printed "nothing here"), `.print-fresh` (first-hour misregister).

## Energy typography

- `energyVariation(e)` → `font-variation-settings` string for Anybody at energy `e` (0–10). **Every display title is set at its piece's energy** (mid of `effectiveBand(item)`).
- `fitTitle(text, e, maxPx, minPx?, share?)` → a CSS `font-size` (clamp with `cqi`) so the longest word always fits. The title's container needs `container-type: inline-size` (or `size`).
- `energySlotHex(e)` (the printed slot), `energyOn(e)` (text colour on an energy ground), `bandSteps(min, max, dir?)` and `SPECTRUM_STEPS` (the band as hard-edged swatches — how energy is printed on paper), `energyHex(e)`, `energyRGB(e)`, `bandGradient(min, max, dir?)`, `SPECTRUM_HEX`, `VIBE_NAMES`, `bandLabel(min,max)` (words, never numbers), `effectiveBand(item)` (author until 5 readings, then crowd median), `bandOverlaps(item, range)`.

## Kit components (`components/kit/*`)

| Component | Use |
|---|---|
| `Button` | `variant: 'ink' \| 'ghost' \| 'quiet' \| 'danger' \| 'energy'`, `size: 'sm'\|'md'\|'lg'`, `icon`, `iconRight`, `href` (internal Link or external `<a>`), `full` |
| `HoldButton` | Commitment gesture (publish, harvest, destructive admin). `onConfirm`, `energy`, `tone: 'ink'\|'danger'`, `holdingLabel` |
| `Sheet` | Every modal that isn't a reading. `open`, `onClose`, `label`, `variant: 'center'\|'right'\|'top'`, `width`, `z`. Dims the field, traps focus, Esc closes |
| `TextField`, `TextArea`, `Select`, `Segmented` | Forms. `label`, `hint`, `error`, `counter={{value,max}}`, `required` |
| `Avatar`, `Badge`, `Flags`, `UserChip`, `ROLE_LABEL`, `ROLE_MEANING` | Identity. Rank frames are drawn by `Avatar` for readers |
| `BandChip`, `SectionHead`, `Empty`, `Chip`, `Kbd` | Small pieces |
| `FormatGlyph`, `RankSigil`, `Mark` (icons), `FORMAT_LABEL`, `FORMAT_PLURAL`, `FORMAT_CODE` (two-letter codes), `FORMAT_STOCK` (stock plate), `RANK_LABEL`, `RANK_MEANING` | Pictograms (`components/kit/Glyph.tsx`) |

Content: `<Pieza item layout imprimir? />` (card; `imprimir` = print the art out of blocks after that delay), `<Organismo ranked={RankedItem[]} empty={…} />` (mosaic with physical reflow). Rank with `rankHome(items, now)`, `rankCategory(items, now)`, `rankAgendaItems(items, now)` from `lib/logic/feed.ts`. Filters: `applyFilter(items, {range, type, genres}, {typeAndGenre})`.

Reading: `components/lectura/*` — `LecturaShell` (frame), `Calibrador` (vibe check), `Hilo` (comments), `Prosa` (`Paragraphs`, `BodyBlocks`, `renderInline`), readers in `readers/` (`ReaderProps = { item }`, shared parts in `readers/parts.tsx`: `Kicker`, `Title`, `Dek`, `Byline`, `Taxonomia`, `Contexto`, `Siguientes`, `Progreso`, `Presenta`, `Art`, `mid`). Polls: `components/encuesta/PollCanvas` (`variant: 'card' | 'section'`).

Instruments: `Horizonte` (`components/horizonte`) — put it at the top of any feed-like page (`<Horizonte showFormats={false} />` outside the home).

## State (`lib/store/*`)

- **World** (`world.tsx`): `useItems()` (all items with crowd stats merged), `useItemBySlug(slug)`, `useItemById(id)`, `useWorld(selector)` (select primitives or memoized references — never build new objects/arrays inside a selector), `useDispatch()`, `useNow()` / `useNowMs()` (ticks every 30 s), `newId(prefix)`, `nowIso()`.
- The world is **seed + replayed action log** (`world-core.ts`). All writes are `dispatch(action)` with an `at` ISO timestamp. Actions: `touch` (click/open HL), `save`, `reading` (vibe check; `band: null` clears), `comment`, `comment-edit`, `comment-tombstone`, `comment-restore`, `react`, `save-comment`, `vote`, `thread`, `reply`, `foro-tombstone` (`reason: null` restores), `draft-save`, `draft-delete`, `publish` (create or update an item; spawns HL), `item-delete`, `pin`, `harvest`, `hp-adjust` (admin), `profile`, `user-admin`, `follow`, `report`, `report-resolve`, `waitlist`, `waitlist-status`, `invite`, `signup`, `franja-patch`, `listing-upsert`, `listing-delete`, `listing-comment`, `seen`.
- Derived helpers in `world-core.ts`: `crowdStats`, `currentPresence(world, userId, atIso)` (private HL of a person), `trophiesFor(world, userId)`, `activityFor(world, userId)`, `reactionsReceived`, `resolvePollChoices`, `noveltyMultiplier`, constants (`KIND_WEIGHTS`, `ECHO_FACTOR` 0.4, `HARVEST_MULTIPLIER` 1.7, `PUBLISH_WEIGHT`, `FORO_THREAD_CAP` 30, `SPAWN_HP_*`).
- **Session** (`session.ts`): `useMe()` (User | null), `useRank(userId)`, `useSessionStore` (`login(id)`, `logout()`), `perm` (= `lib/seed/permissions`: `canCreateContent(user, type)`, `canModerate`, `canAssignRoles`, `FRANJA_PUBLISHABLE_TYPES`, `hasRole`…).
- **Campo** (`campo.ts`): `useCampo` (`range`, `type`, `genres`, `setRange`, `setType`, `toggleGenre`, `setGenres`, `setPresent`, `setCounts`), `useIntegerRange()` (subscribe to this, not the raw range, when filtering).
- **UI** (`ui.ts`): `openLectura(slug, origin?, {comments, focusComment})`, `closeLectura`, `openAccess(reason?, mode?)` (the Acceso sheet: `<Identidad>` from `components/acceso` — `mode 'registro'` opens its code tab, which hands a valid code to La Puerta, the one sign-up; any new identity sheet uses `<Cabeza librea title chip? band?>` for its head), `ask(DialogSpec) → Promise` (confirm / input / typeToConfirm), `notify(text, {tone, energy})`, `openReport({type,id,label})`, `setSearch(open)`.
- **Player** (`player.ts`): `usePlayer` (`track`, `queue`, `playing`, `time`, `duration`, `play(track, queue?)`, `toggle`, `pause`, `seek`, `next`, `prev`, `registerTransport`, `report`), `playableSource(item)`, `openSourceUrl(item)`, `PLATFORM_LABEL`, `PLAYABLE` (soundcloud/youtube/spotify; bandcamp & mixcloud are link-out only).

Seed & logic: `lib/seed/*` is the production code ported verbatim (types, genres — `getGenreById`, `getGenreNames`, `getSelectableGenres`, `getRootGenres`, `TAGS`, `tagLabel`, `getSelectableTags`; curation — `currentHp`, `rankItems`; trophies — `TROPHY_CATALOG`, `getEmojiTokenMap`, `unlockedEmojisFor`; `hlBracket`; `franjaAttributionPrefix`; `mapa/*` engine; `identity`, `waitlist` constants). `lib/logic/time.ts` (`fmt.*`, `ago`, `until`, `eventProximity`, `PROXIMITY_LABEL`, `isLive`, `isUpcoming`, `itemDate`), `lib/logic/genres.ts` (`rootOf`, `shortGenreName`, `presentGenres`), `lib/logic/polls.ts`.

## Printing gestures (`components/trama/*`)

One transparent WebGL canvas **above** the DOM. Real DOM underneath, always; the canvas paints only while a gesture runs, then hands the element back and stops. Reduced motion or no WebGL → every gesture resolves instantly. See the table in [05-TRAMA](./05-TRAMA.md).
- `<Revelado as="h2" energy={e} trigger="load|inview|manual" dir? delay? preset?>` — real text that prints itself (silhouettes in the energy's ink → ink → type). `useRevelar(ref, opts)` for your own element (render it with `data-trama="pendiente"`).
- `useRevelarImagen(imgRef, {trigger})` / `revelarImagen(img, {origin?, enfoque?, ceniza?})` — an image prints out of its blocks (render the img with `data-trama-img="pendiente"`); `ceniza` un-prints it (exits).
- `cruzar(frame, fromImg, toImg, {dir})`, `imprimirHoja(panel, {origin, energy, reverse?})`, `barrido(el, {energy})`, `chispa(x, y, energy)`, `asentar(root?)` (finish everything outside a modal that's opening).
- `flare(elementOrPoint, energy)` (from `components/stage/api`) is the same small burst — use it for meaningful acts only (save, vote, publish, react).

## Liveries (`lib/librea.ts`, `components/librea/*`) — see [06-LIBREA](./06-LIBREA.md)

- `LIBREA_FORMATO[type]` / `LIBREA_SECCION[key]` / `libreaDe(pathname)` — code, canal, nombre, lema, color, on, alt, patron, wdth/wght.
- CSS tokens `--l-ev … --l-fr` (+ `-on`); `FORMAT_STOCK[type]` / `FORMAT_ON[type]` (kit/Glyph) point at them — use them for format chips, rules, plates.
- `<Cabecera librea datos lema size? glyph?>{controls}</Cabecera>` — a section's masthead; it **morphs** when `librea` changes (Lecturas' tabs). Put it before the Horizonte. `datos` are real counts only.
- `<Descifrar text />` — text that decodes when it changes (codes, section names, filter labels).
- `patronCss(patron, ink, k?)` — a livery pattern as CSS background (`tile` = drift period).
- `Relevo` runs in `app/template.tsx` on section changes; `SeccionGlyph` (kit/Glyph) draws section pictograms.

## GL islands (`components/stage/*`)

The context **behind** the DOM survives only for GL islands (the map, the credencial). `useStageWindow(ref, (el) => ({ render(ctx), order?, resize?, idle?, dispose? }), deps)` draws into a DOM element's rect (scissored); the element must be transparent where GL shows. Give it `idle: () => boolean` and the engine stops rendering while it's at rest (it always draws the first resting frame). `setFieldDim`, `setFieldIntensity`, `setFieldAudio` still feed `ctx.state` but paint nothing by themselves. Custom shaders work in **display space**: `ShaderMaterial` without colorspace chunks, textures with `colorSpace = THREE.NoColorSpace`. Images for GL: take `img.currentSrc` from a rendered `next/image` (same-origin) so remote art never taints the texture.

Because the stage sits behind the DOM, **any ancestor that paints an opaque background hides a GL window** — the credencial then falls back to its CSS card (`paintedOver` in `credencial/cssColor.ts`). A page that needs its own ground colour paints it on `<html>` (see La Puerta: `html:has([data-ruta='puerta'])` in `globals.css`), never on its root element.

## Collectibles — the bragging surface (see [06-LIBREA](./06-LIBREA.md) §3–5)

The one place for rich material rendering: objects you own, not UI chrome. All three rest at zero render cost and degrade to a flat CSS/SVG version without WebGL or with reduced motion.

- **Credencial «ESTUCHE»** (`components/credencial/*`): `<Credencial data arrive? onFlip? hint? hintBack? userId? editor? />` — the card in a collector's case (`geometry.ts`: pocket, sandblasted inner band, fillet + sanded side + parting seam; the outer skin as `EDGE_PATH` / `edgeAt` / `outlineDistance` / `clampToOutline`, which stickers wrap on), printed on its role's feed colour (`libreaDeRol`, matte cotton board, letterpress, triplex edge), role foils in `foils.ts` (lector rainbow, curador glitter, guía lenticular, insider cracked ice, admin ember), drag-to-turn with an elastic sling to front/back, the owner's stickers rendered on the case (`stickerGL.ts`, `stickerShader.ts`; flat fallback `StickersCSS.tsx`). `credencialForUser` / `credencialForInvite` (`data.ts`) build `data`; `userId` defaults to `data.userId`. The Taller drives placement through `editor: CredencialEditor` (`editor.ts` documents every gesture: pointer places, wheel/Q/E rotate, Ctrl+wheel or +/− scale, F flips face, arrows nudge, Enter presses, Esc cancels; clicks pick applied stickers for scraping). Coordinates are face coordinates, 0–1 over the printed card, reaching past it onto the case's margin (`PLACEMENT_BLEED`). Dev: `window.__credencial` (`pose(yaw, pitch)`, `debugSpeed`, `debugMotion`, `setPointer`).
- **Calcos** (`components/stickers/*`, data in `lib/stickers/*` + world actions `sticker-get` / `sticker-apply` / `sticker-scrape`): `<Calco def seed? …>` (one sticker, art from `lib/stickers/arte.ts`, its finish painted per copy by `lib/stickers/acabado.ts` — pass `copySeed(copy.uid)` so each copy shows its own foil). Finishes follow the spec in `lib/stickers/finish.ts` (materials, 8 holo families, metals, reliefs, `finishOf`, `foilLayout`, `foilWindow`, labels) — the 3D case follows the same spec; the same design comes in several finishes as separate catalog entries grouped by `design`. `<Carpeta>` (the binder), `<Estante>` (a franja's shelf, in its store and page), `<StickerEvento item>` (a night's stub claim in the Noche reader; one per person per night, until `STUB_WINDOW_MS` after it ends; scraped stubs stay claimed). Placement and scraping happen in the Taller's **Credencial** space (`components/taller/CredencialSpace.tsx`). Dev: `window.__calcos.hoja()`.
- **Insignias** (`components/insignias/*`): `<Insignias items={InsigniaItem[]} variant="vitrina" | "compacta" />` — trophies as die-struck enamel pins pressed into the page: soft debossed wells in the page's own paper (the GL layer stays transparent over flat paper, so the match is exact), locked ones as blind-debossed outlines (metal by family, `catalog.ts`; glitter and nacre fills), hover tilt, click turns a pin over (engraved month + story on the back). `vitrina` on the public profile, `compacta` in the Taller spine. Pin sigils come from `credencial/sigils.tsx` — keep that export stable. Dev: `window.__insignias`.

## Motion

Mechanical, never floaty: platen passes (`--ease-platen`), registration jumps (`steps()`), one-step inversions for pressed states. Entry waits for intent (~60 ms) and passes in ~220 ms; release is immediate (~130 ms). GSAP for choreography (FLIP, drag, inertia, detents with `back.out`); CSS for hover states. Nothing strobes faster than 3 Hz. Reduced motion: no loops, instant.

## Voice

Spanish, human. Labels are short and uppercase via `.label`; indexical heads read `01 / NOMBRE — lo que es`; sentences are sentence-case. No machine jargon. Empty states say what is true in one line (*«Nada en esta temperatura. Mueve el horizonte.»*).

## Verifying your work

- `npx tsc --noEmit -p .` from `C:\Users\Iker\Documents\GradienteV2` — other surfaces are being built in parallel; only fix errors in **your** files.
- The dev server is already running at `http://localhost:3100` (HMR). **Never** start/stop servers or run `next build`.
- Headless screenshots: `cd <scratchpad>; SHOT_PROFILE=<you> SHOT_DIR=<you> node shot.mjs steps.json` then Read the PNGs in `shots/<you>/`. Steps: `{"session":"u-ikerio"}` (log in a demo user before `goto`), `{"goto":"/path"}`, `{"wait":ms}`, `{"click":"css"}`, `{"hover":"css"}`, `{"mouse":[x,y]}`, `{"drag":[[x0,y0],[x1,y1]]}`, `{"key":"Escape"}`, `{"scroll":y}`, `{"eval":"js"}`, `{"shot":"name.png","full":false}`, `{"viewport":[w,h]}`, `{"burst":["name-#.png",count,everyMs]}`. Headless Chrome uses SwiftShader: WebGL works (slowly) and screenshots take ~1 s — to see a gesture mid-flight run `{"eval":"window.__trama.speed = 0.05"}` first, and never take a clipped screenshot during one (it resizes the viewport and ends it).

Demo identities: `u-datavismo` (admin), `u-hzamorate` / `u-ikerio` (guía), `u-insider-tlali` (insider), `u-curator-radiolopez` (curador), `u-og-loma` (lector · OG · franja admin of `pa-naafi`), `u-normal-yag` (lector · team `pa-naafi`), `u-normal-meri` (lector), `u-mod-rumor` (lector · MOD). Password for the login form: `gradiente`. Invite codes: `INV-c0ffee01`, `INV-5ca1e002`, `INV-0bf10003`.
