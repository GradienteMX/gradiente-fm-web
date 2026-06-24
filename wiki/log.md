# log.md

> Append-only. Newest at top. Every ingest / query / lint pass gets a line.
>
> Format: `YYYY-MM-DD · OP · short description · [[links]]`
>
> Operations: `INGEST` (source → wiki), `QUERY` (wiki → answer), `LINT` (vault health).

---

## 2026-06-23 · INGEST · Invite signup — password-confirm field + Terms & Conditions gate

Two adds to the invite-registration form ([[RegistroCard]] — the one form shared by BOTH the 3D invite unbox and the no-WebGL fallback, so a single edit covers both paths).

- **Confirm-password field** ([RegistroCard.tsx](../components/welcome/RegistroCard.tsx)) — new `CONFIRMAR PASSWORD` input. Submit now validates presence + `password === confirmPassword` client-side before anything else; a mismatch shows `LAS CONTRASEÑAS NO COINCIDEN` and does NOT proceed (guards against a typo'd password locking someone out).
- **T&C gate** — new [BetaTermsModal.tsx](../components/welcome/BetaTermsModal.tsx). Submit is now two-step: validate → open the Terms popup → account is created ONLY after the user clicks `ACEPTO Y CONTINÚO` (`acceptTermsAndRegister` calls `signup()`; CANCELAR/ESC returns to the form). Modal is `createPortal`'d to `document.body` (z-80) so it escapes the 3D experience's `pointer-events:none` overlay + `overflow:hidden` stacking. Closed-beta boilerplate copy (8 sections) lives in `BETA_TERMS` at the top of the file.
- **Verified** in preview by forcing the no-WebGL fallback (temp edit, reverted): 4 fields render; mismatch blocks with the error + no popup; matching → the T&C popup; signup only fires on accept (tested with a real unused code — left unconsumed). `tsc` clean.
- **Open / deferred:** T&C copy is placeholder, NOT legal-vetted — fill in contact address, real Aviso de Privacidad link, governing law, age threshold before relying on it. Acceptance is a UI gate only — NOT persisted (no `terms_accepted_at`); add a column + signup-payload field if an audit trail is wanted.

---

## 2026-06-23 · INGEST · Partner logos — landed on static-file scheme (`/partners/`) after collision with Johan's PR #6; 62/70 now have logos

Iker: "we were supposed to add the partner/labels/etc but they haven't been added." Diagnosis: the partner **data** was never the gap — all 70 `items` rows (`type='partner'`) have been in prod since the 0030/0031 seed (2026-06-22). The gap was **logos**: 59/70 had `image_url = null`, and [[PartnersRail]] renders a logo-less partner as an empty dark box, so the rail *read* as "not added" even though every record existed.

**Two parallel efforts collided this session — reconciled onto Johan's version-controlled static-file approach (Iker's call).**

- **My first pass (storage approach, then superseded):** found a prior session's scraped IG pfps in `Documents/Gradiente/partner-pfps/<slug>.jpg` (~50 files + `_manifest.json` + a `from-db/` copy of the 11 live ones). QA'd a 49-tile contact sheet (`partner-pfps/_qa_montage.png` — all real marks, no default-avatar silhouettes). Uploaded **49** to the `uploads` storage bucket via a service-role script + wrote `image_url` to prod (60/70). Then tried to `git push` and got rejected —
- **…because Johan (`datavismo`) had just merged PR #6**, which does the SAME logo work a different way: **static files committed to `public/partners/<slug>.jpg`** + `image_url = '/partners/<slug>.jpg'` in the **0031 seed**. PR #6 also carries unrelated UI de-flair + a `GRADIENTE` (drop MX/FM) brand rename across the app. **Key catch:** 0031 is `ON CONFLICT (slug) DO NOTHING` and the rows were already seeded → Johan's `/partners/` paths **never reached prod** (verified: his `cjantal`/`ten-toes`/`tra-tra` were still NULL in prod). So the only logos live were my storage writes — diverging from the repo's source of truth.
- **Reconciliation (this is what shipped):** standardize on `public/partners/` as the single source of truth. Copied my 33 unique pfps + the 8 original `from-db` logos into `public/partners/` **without clobbering Johan's 21** (his `revancha.svg` etc. kept) → **62 files**. New [scripts/applyPartnerLogos.ts](../scripts/applyPartnerLogos.ts) reads that dir, (1) regenerates [supabase/migrations/0032_partner_logos.sql](../supabase/migrations/0032_partner_logos.sql) — idempotent `UPDATE … image_url='/partners/<file>'` for all 62 (the UPDATE 0031's DO-NOTHING never did), and (2) with `--apply`, writes prod via service role. **Order matters:** push first (Vercel deploys the static files), *then* `--apply`, else the live site points at logos that 404 until deploy. Deleted the superseded `uploadPartnerLogos.ts`; the 49 storage objects are now orphans (pruned at end of session).
- **Result: 62/70 partners on `/partners/<file>`** (durable, version-controlled, matches the passline `/flyers/` precedent); `passline-promo` stays `/flyers/rf-078.jpg`. **7 still logo-less** (no source anywhere — generic one-word names, high IG-false-match risk; want handles from Iker): `cdisidente, dance-your-name, ensamble, memoria-local, mvmpmp, resonancias, ruido`. (Johan's PR closed `cjantal`/`ten-toes`/`tra-tra` from my earlier list of 10.)
- **Notes:** bg-removal → transparent PNG still deferred (raw pfps shipped). [[PartnersRail]] is `hidden md:block` — desktop-only, no partners on mobile (separate mobile-pass item). Migration drift continues: 0032 is a file applied out-of-band via the script, NOT recorded in prod `schema_migrations` — **never `supabase db push`** (see `migration-history-drift`).

---

## 2026-06-22 · INGEST · DB ops — applied 0029 entities + 0030/0031 partner migrations to prod; reviewed Johan's two PRs

Session was ops, not feature-build — reviewed two PRs from Johan (`datavismo`) and applied their migrations to prod, which the PRs had NOT (code shipped via Vercel ahead of schema — the recurring trap; see `migration-history-drift` + `stale-docs-trap` memories).

- **PR #4 `feat/scene-entities` (merged):** scene entity registry — `entities` + `item_entities` tables + `items.format` enum column (migration **0029**). Merged to main but 0029 was never run → **publishing was 500ing for ALL item types** (`contentItemToRow` now always sends `format`; missing column → PostgREST PGRST204). Reads stayed safe throughout (`ITEMS_SELECT` is `*`; `fetchEntitiesByItemIds` swallows its error → empty map, no crash). Applied 0029 verbatim via the SQL editor; verified 2 tables + `items.format` + 3 enums (`entity_kind`/`entity_relation`/`item_format`) + 6 RLS policies + touch trigger. **Open nit:** `touch_entities_updated_at()` has a mutable search_path → `alter function touch_entities_updated_at() set search_path = ''` (do as a follow-up or fold in).
- **Partner PR (`feat/scene-entities` @ `f320733`, still OPEN):** +5 `partner_kind` enum values (`colectivo`/`festival`/`club`/`medios`/`mix-series`, migration **0030**) + 62-row partner seed (**0031**). **Apply-order gotcha:** an enum value can't be USED in the same tx it's ADDED, and the Supabase SQL editor runs a pasted block as one implicit tx — so 0030 and 0031 must be **two separate editor runs**. Verified after applying: enum = 11 values, 59 of 62 partners seeded (`clima-calido`/`melodykrafter`/`wvwv` pre-existed by slug → skipped by `on conflict (slug) do nothing`), 22 use the new kinds (colectivo=14, festival=3, medios=3, club=1, mix-series=1). Partners are `items` rows (`type='partner'`), not a separate table; `items_slug_key` is a plain non-partial unique → ON CONFLICT(slug) infers fine. New-kind UI maps (PartnersRail/PartnerOverlay/admin) are typed `Record<PartnerKind,…>` so they're complete by construction. **Code not yet merged** — main degrades gracefully (guarded slot lookups + commented-out `//{LABEL[kind]}` → blank kind tag, no crash). **TODO: merge the partner PR** to clear the blank-tag window on the live rail.
- **Migration drift continues:** prod `schema_migrations` records only 0001–0016, but the DB now has objects through **0031**, all applied out-of-band via the SQL editor. **Never `supabase db push`** (would replay/conflict). Reconcile the history table eventually.
- **Local:** pulled `main` to `49a73a0` — **PR #5** merged the partner work (`f320733`) plus a genres-catalog commit (`ad0af23` — Árabe/SWANA, Tradicional/Folclórica, World roots + subgenres; `lib/genres.ts` only, **no migration** — genres are code-side, `items.genres` is free-form `text[]`). Redesign + scene-entities + partners + new genres are all in main now and auto-deploying via Vercel, which closes the new-kind blank-tag window. `gsap` added as a dependency earlier in the session.

---

## 2026-06-12 · INGEST · VibeSlider WebGL phosphor tape — BUILT then REVERTED (rejected). DO NOT REBUILD.

**OUTCOME: reverted.** Iker: "I don't like your change, it feels like you just made some kind of weird overlay which spawns over the phosphor detail, does nothing, doesn't feel interactive at all and dragging the slider makes the page very laggy." Three real failures: (1) the WebGL tape rendered as a flatter CONTINUOUS gradient that read as *less* detailed than the 200-dash tape it replaced (lost the phosphor-dash detail); (2) audio-reactivity is invisible with nothing playing → reads inert; (3) dragging was LAGGY — a perf regression on the app's signature control (the WebGL redraw + VibeSliderImpl re-rendering on drag). **Lesson: the DOM-dash station-dial tape was already good; a WebGL "upgrade" of it is a regression. Keep the dashes.** Reverted fully — deleted components/vibe/PhosphorTape.tsx + phosphorTapeShaders.ts, removed the gate hook + audio wiring + conditional from VibeSlider (the DOM-dash tape was the preserved fallback, now the only path); tsc clean, verified 200 dashes back + no WebGL canvas in the strip + handles intact + no lag. The original build notes are kept below for the record only.

~~Iker pushed back on me calling shipped surfaces "done": full redesign = everything's fair game, apply the research. Also corrected my over-conservative "2 WebGL contexts is the ceiling" — that was my budget, not Safari's (~16); a thin always-visible strip is a cheap context. So the VibeSlider tape (flagged in the surfaces research as the single highest-leverage WebGL swap) got the real treatment.~~ (Build details below — reverted, see above.)

- **[components/vibe/PhosphorTape.tsx](../components/vibe/PhosphorTape.tsx)** + **[phosphorTapeShaders.ts](../components/vibe/phosphorTapeShaders.ts)** (new) — the 200-DOM-dash tape replaced by a WebGL phosphor tube: ping-pong persistence accumulator (`max`-combine, decay 0.86 → range moves leave a glowing afterimage = the old PPM "slow decay leaving" now reads as tube persistence) + 9-tap horizontal bloom; thermal-ramp HARD slot color, in-range lit/glowing-filament, out-of-range dim same-hue. **Audio-reactive**: reads the global provider FFT (read-only) → 64 log-spaced taps (bass→glacial/left … treble→volcán/right), smoothed, brightest inside the selected range; energy lifts a clamped bloom breath; `data===null` → calm carrier glow on the lit range only. So the station dial becomes a live spectrum when a mix plays.
- **Functionality preserved (the hard rule)**: WebGL is the VISUAL tape only — `position:absolute inset:0 pointer-events:none` at the same band height. The needle handles (`role=slider` + aria + arrow/Home/End), printed scale plate, readout, genre chip strip + auto-hide, VibeContext filtering, detents, and the `[data-vibe-strip]` height contract (CategoryRail's ResizeObserver) are all unchanged. Mount-ONCE + ref-update (slider re-renders on filter/chip ticks never remount the GL context).
- **Gating/perf**: +1 WebGL context, desktop-only (min-width:1024 + fine pointer + deviceMemory≥4, client-evaluated, no hydration mismatch); mobile/coarse-pointer KEEPS the DOM-dash tape verbatim as fallback. DPR clamp, 40fps cap, visibility pause, HalfFloat→UnsignedByte fallback, full disposal, never loseContext. Photosensitivity: spatial drift only (~7s carrier), bloom/energy smoothed+clamped, luma capped — no >3Hz full-surface oscillation. reduced-motion → settled static glow.
- **Review WARN fixed**: shader axis was `uv.x*10.0` (10 bands) but the plate/needles/DOM-dashes use the 11-slot model (`(v+0.5)/11`, `floor(t*11)`) → the glow + lit edges drifted off the printed numerals for narrowed ranges. Changed to `uv.x*11.0` + lit test in 11-band space so color bands and lit edges land exactly under the numerals/needles. Verified: canvas 1372×40, context not lost (GLSL compiles), 6860 lit px / peak-lum 373, handles intact, no GL errors, tsc clean.
- NIT (not actioned): VibeSliderImpl re-renders per FFT tick during playback (harmless — WebGL path reads refs/no remount; ref-only subscriber if it ever matters). Future: GL singleton would consolidate CRT+fluid+slider+visualizer into one renderer (deferred — isolated contexts are low-risk and the working showpieces shouldn't be refactored under them yet).

---

## 2026-06-12 · INGEST · Redesign 2026 card/layout tier — re-curation sweep, signal-panel tilt, thermal card↔fluid coupling

Iker asked what cutting-edge technique we could apply to LAYOUT + CARDS *without affecting functionality*. Honest expert framing first: the single craziest move (card grid as a live WebGL scene, Phantom.land-style) is exactly what that constraint forbids — it means rendering card content in canvas → loses a11y/SEO/text-select/keyboard. So cards stay real DOM; everything here is a visual LAYER. Iker picked all three offered. All verified live on :3003; functionality-safe (card click still opens overlay); tsc clean; no new WebGL context.

- **Re-curation sweep** — [components/grid/RecurationSweep.tsx](../components/grid/RecurationSweep.tsx) (new) + [ContentGrid.tsx](../components/ContentGrid.tsx). A transient canvas-2D teletext band sweeps the mosaic (~500ms, SignalTransition vocabulary, grey estática → active-vibe-slot accent) the instant the ranked set genuinely changes (signature = vibeRange|category|genre|mode + ordered visible ids; first signature silent, no per-render thrash). The grid reads as a live broadcast monitor retuning. `pointer-events-none` + capped alpha → cards stay fully interactive underneath; cards reflow (Framer layout) WHILE the band passes. Verified: clicking a genre chip fired a transient grid canvas (0→1). reduced-motion → skipped. NOTE: load-bearing `position:relative` on gridStyle (offsetParent for the sweep host) — comment says don't remove.
- **Cards as signal-panels** — [lib/hooks/useCardTilt.ts](../lib/hooks/useCardTilt.ts) (new) + [ContentCard.tsx](../components/cards/ContentCard.tsx). Subtle 3D pointer-tilt (cap 7°) + parallax: CardImage split into a recessed image plane (translateZ −18) behind a lifted chrome plane (+18) inside a preserve-3d INNER wrapper — NOT the Framer layout="position" element (fighting it would break reflow). will-change toggled only during active tilt (no resting layer bloat). Verified: identity matrix → matrix3d on pointermove. Touch/reduced-motion → flat (no tilt); develop-on-hover + click-to-overlay + all card chrome intact. Knobs in useCardTilt: MAX_TILT_DEG 7, PARALLAX_Z 18, EASE_MS 260, PERSPECTIVE 900.
- **Thermal card↔fluid coupling** — [lib/heatField.ts](../lib/heatField.ts) (new shared store, I wrote it as the contract) + [VibeFluid.tsx](../components/fluid/VibeFluid.tsx) consumer + [lib/hooks/useHeatReport.ts](../lib/hooks/useHeatReport.ts) (new producer — I wrote it; the workflow left this gap, nobody was scoped to the card-side reporter). Hot cards (vibe temperature ≥ 0.35) report normalized TOP-DOWN viewport center + heat; the fluid injects a faint warm glow at those positions via its existing splat path (HEAT_INJECT_SCALE 0.05 vs pointer 0.32, every 4th frame, broader radius) so the signal field warms in the gutters around prominent hot content. Producer gated to warm cards on desktop only (≥1024 + fine pointer) — cold cards + mobile attach nothing. Purely additive to the fluid (pointer stir/carrier/mosaic/dissipation/disposal untouched — Iker likes the fluid, must not regress). Coords: producer stores top-down, consumer does `1 - y` flip → aligned. Wiring confirmed producer+consumer+store all present; the warmth is faint-by-design (dials: HEAT_INJECT_SCALE/THRESHOLD in VibeFluid, HEAT_REPORT_THRESHOLD in useHeatReport) and best judged live.

Review = NITs only: backdrop-blur badges on the tilted chrome plane may mis-sample in some Safari/Blink builds (cosmetic; eyeball, else drop blur or move to z=0); //PASADO badge sits on the flat plane so it doesn't tilt with a past-evento card (intentional).

---

## 2026-06-12 · INGEST · Redesign 2026 spectacle tier — kinetic headers REJECTED, ASCII brand mark (placeholder), broadcast fader

Built three "spread the language" moves in parallel; Iker reviewed live and made calls.

- **Kinetic teletext section headers — REJECTED & FULLY REMOVED. Do not rebuild.** Built a `KineticHeading` that resolved labels (AGENDA/EDITORIAL/…) out of teletext block-noise on viewport-enter + sheared with scroll velocity, wired into FeedHeader + 7 page headers + a `useScrollVelocity` hook. Iker: "I hate the kinetic section headers." Reverted all 9 sites back to the plain `<span class="font-mono text-xs tracking-widest text-primary">LABEL</span>` headings; deleted the component, the hook, and the (now-empty) components/type dir. tsc clean, zero refs remain. Lesson: the ASCII-text-as-heading treatment is off the table.
- **Living ASCII brand mark — KEPT as a PLACEHOLDER.** [components/brand/SystemObject.tsx](../components/brand/SystemObject.tsx) (new) + mounted in [Navigation.tsx](../components/Navigation.tsx) logo lockup (~40px, canvas-2D, NO WebGL context): a rotating icosahedron lattice rasterized to a character grid, density/spin/heat driven by `useFeedPulse` activeCount ("tonight's signal strength" — no raw number shown). Iker's call: "even though it looks good, we still have no logo or 3D model or concept for it… no need to remove it for now." So it STAYS as a working stand-in until a real Gradiente logo/3D mark is designed — when that exists, SystemObject is the swap point. (Note it IS the same ASCII-art family as the rejected headers, but logo-placed + small; accepted in that context only.)
- **Broadcast vibe-fader — LANDED (unreviewed; verify-by-feel).** [VibeFader.tsx](../components/VibeFader.tsx) rewritten (+359/−110): VU/PPM ballistics on the crowd-median needle, peak-hold tick for the user's committed vote, author range as calibration marks, fader-start arming (entering edit widens the throw = "going on-air", gold accent). The drag-to-commit FRICTION is preserved per [[vibe-check-friction]] (the `ARRASTRA … VOTA` prompt confirmed live). NOTE: the spectacle-tier workflow was STOPPED mid-flight (to pull the kinetic work immediately), so the adversarial review never ran on the fader — it's DOM/Framer (no WebGL), tsc-clean, and renders without error in an editorial overlay, but its ballistics/peak-hold/arming polish hasn't been adversarially reviewed and wants Iker's hands-on feel + a possible follow-up review.

**Reactivity addendum to the particle field also landed earlier this turn** — see the particle entry below: instantaneous-energy + kick-onset + mids overhaul, then dialed back from "too blinding" (bloom/brightness −30-50%, motion punch kept).

**State**: branch redesign/2026 still UNMERGED and UNCOMMITTED (Iker opted to keep building over committing). Large surface area now at risk in the working tree — committing the branch is the recommended next checkpoint.

---

## 2026-06-12 · INGEST · Redesign 2026 — GPU particle audio visualizer (the spectacle) replaces the line waterfall

Iker's feedback: the redesign read as "subtle changes," the mix analyzer looked dead when playing, and the new 2D ESPECTRO panel was a boring downgrade next to the 3D viz. Root cause of "dead when playing": audio-reactivity depends on the Chromium getDisplayMedia tab-capture FFT, which is usually absent — so everything audio-driven sat still. Fix = a visualizer that's spectacular and ALIVE with zero audio, FFT as a supercharge layer.

- **[ParticleField3D](../components/audio/ParticleField3D.tsx)** (new) + **[particleShaders.ts](../components/audio/particleShaders.ts)** (new) — a GPU particle field, drop-in replacement for the old line-waterfall (identical prop interface). GPGPU via `GPUComputationRenderer`: 256×256 = 65,536 particles (128² = 16,384 portrait), position+velocity ping-pong FBOs, velocity advected by divergence-free curl of 3D simplex noise around a central attractor, deterministic per-texel hash respawn (no per-frame RNG, HMR-stable). Additive `THREE.Points` with a procedural soft-circular sprite (no texture file), colored by sampling ALONG VIBE_SLOT_COLORS. `EffectComposer` → `RenderPass` → `UnrealBloomPass` for the glow. **Alive at rest** (curl flow + slow camera orbit with `data===null`); FFT supercharges: trackEnergy EMA → flow speed/size/alpha, bass → attractor relax + radial expansion (kick breath), highs → curl tightening/sparkle, log-centroid brightness → cool↔hot color position. All band inputs enveloped; bloom strength EMA-smoothed + hard-clamped (≤3Hz, no strobe). HalfFloat→Float capability fallback; tears down cleanly if vertex-texture-fetch unavailable.
- **Swapped** into [AudioPlayer3D.tsx](../components/audio/AudioPlayer3D.tsx) (field 320→440px — now the star; removed the lying frequency/dB scale overlays for an honest legend) and [NowPlayingHud.tsx](../components/audio/NowPlayingHud.tsx) (portrait, gated on `currentItem`).
- **Removed the boring 2D analyzer** from [MixOverlay.tsx](../components/overlay/MixOverlay.tsx): the `02 ESPECTRO // ANALIZADOR` Panel + SpectrumPanel/SpectrumCanvas/BandReadout + useAudioFeatures wiring; panels renumbered (CONTEXTO 02 / TRACKLIST 03 / SIGUIENTES 04). The 3D field is now the single analyzer.
- **DELETED** (unreferenced after swap): `lib/hooks/useAudioFeatures.ts`, `components/audio/Reproductor3D.tsx`, `components/audio/asciiPass.ts`. The ASCII+phosphor waterfall showpiece is retired — superseded by the particle field.

**Context budget**: net WebGL context UNCHANGED — ParticleField3D opens the one context Reproductor3D used to; home idle still 2 (CRTShader + VibeFluid, field mounts on track-load). **Review = all NITs**; disposal chain (GPUComputationRenderer + EffectComposer + UnrealBloomPass render targets, on unmount AND resize) verified line-by-line against the installed addon source — the #1 leak risk, handled. `tsc` + `eslint` clean.

**Verified live on :3003** (mix overlay): field mounts at 465×440, pixel readback over 40 frames shows it rendering AND animating self-driven (11 distinct frame-states, no audio) with a healthy sparse-glow distribution (62% dark / 25% dim / 9% mid / 4% bright blooming cores) — not a washed-out solid. NOTE: WebGL canvases can't be screenshotted in the preview, so aesthetic knob tuning (CURL_SCALE, ATTRACTOR_STRENGTH, FLOW_SPEED, POINT_SIZE, BLOOM_*) wants Iker's real eyes — all named constants at the top of ParticleField3D for fast iteration. Full audio-reactivity needs the tab-capture permission granted (known Chromium constraint); the field is alive regardless.

**Reactivity overhaul (same day, Iker: "little reactivity to kicks/bass/mids/highs").** Root cause: every motion/size term hung off `trackEnergy`, a ~1s EMA — it smeared all transients. Fixes in [ParticleField3D.tsx](../components/audio/ParticleField3D.tsx) applyAudio + [particleShaders.ts](../components/audio/particleShaders.ts): (1) `trackEnergy` now drives COLOR drift only; motion/size driven by INSTANTANEOUS band energy with fast attack (`env` 0.6 atk / 0.18 rel). (2) KICK ONSET detector — `lowAvg` running mean, fire `u_kick` when live low jumps >1.25× it, snap-up/fast-decay (KICK_GAIN 7) → sharp radial BURST + size swell + warm/brightness pop + flow surge + a clamped bloom pulse. (3) MIDS now used — new `u_mid` drives a tangential SWIRL (distinct from bass=radial breath, highs=curl turbulence). (4) Per-band gains up (low×1.5, mid×1.8, high×1.7), ENERGY_GAIN 2.2→2.6. Photosensitivity preserved: the punch lives in per-particle (spatial) size/brightness pops — NOT full-surface luminance flips — so it can be snappy; only global bloom keeps the smoothed ≤3Hz clamp. **Proven** via a temporary synthetic-FFT inject hook (added, tested, REMOVED — grep-confirmed gone): canvas-readback mean luminance idle 15 → sustained-loud 234 (15×) → kick-pulse peaks 636 with bright-core count 203→8525; transients now spike unmistakably. tsc clean. (Real-track reactivity still needs the tab-capture permission; the synthetic test bypassed it to prove the mapping.)

---

## 2026-06-12 · INGEST · Redesign 2026 wave 2 — overlay signal-transition, HP death ritual, mix truth-up, context gate

Four disjoint-file moves on `redesign/2026` (still UNMERGED), built in parallel under a hard "no new persistent WebGL context" rule (home idle was at the Safari context ceiling). All canvas-2D / CSS / WAAPI — zero new GL contexts. `tsc` + :3003 smoke tests pass; review returned NITs only.

- **Overlay signal-transition** — [components/overlay/SignalTransition.tsx](../components/overlay/SignalTransition.tsx) (new) + [OverlayShell.tsx](../components/overlay/OverlayShell.tsx). Replaced the NGE CRT-boot `overlay-panel-in` reveal with a teletext block-mosaic "signal acquisition": on open the panel resolves coarse noise→clear in a ragged wavefront emanating from the clicked card (~520ms smootherstep), on close de-resolves into blocks + cut (~300ms). Transient canvas-2D (created on open, removed on finish/unmount, RAF cancelled both paths) — zero GL context. Cells = grey-ramp estática base + a hint of the item's vibe-slot color at the resolving front; per-cell variation is a deterministic sin-hash, not per-frame RNG. Click-origin is a viewport-center heuristic (gBCR is the near-zero-box trap here — documented); directionally correct, off by a few hundred px when comments column is open. Preserved: OverlayShellContext/useComments, [C]/ESC, comments max-width anim, header buttons, phosphor flash. reduced-motion → instant cut. The old `overlay-panel-in/out` keyframes are now dead (left in globals.css for a later cleanup).
- **HP death ritual** — [lib/hooks/useDecayState.ts](../lib/hooks/useDecayState.ts) + [components/cards/DecayState.tsx](../components/cards/DecayState.tsx) (new) + [ContentCard.tsx](../components/cards/ContentCard.tsx). `useDecayState` reads `currentHp(item, now)` (now memoized per mount) and maps the dying tail (HP < `DYING_THRESHOLD` 3 → `DEAD_HP` 0.4) to `mortality` 0..1. `DecayErosion` = three CSS-only layers driven by inline `--mortality`: coarsening halftone (pitch 4→10px), edge-fray mask painting the page bg inward, estática (slot 5) desaturation scrim — image/frame only, never text. Gated OFF for fresh, healthy, partner, and already-past items (no double-up with `//PASADO` grayscale). Healthy cards render zero erosion DOM (most seed items — so it shows nothing until items actually decay; that's correct/honest). The dissolve: `useDissolveOnUnmount` clones the dying card frame to a fixed body-level node and runs a WAAPI fade-to-FUEGO-ash (~600ms) on unmount — works around the grid's instant-unmount (popLayout NOT reintroduced); doesn't reflow as survivors slide, documented. reduced-motion → instant.
- **Mix truth-up** — [lib/hooks/useAudioFeatures.ts](../lib/hooks/useAudioFeatures.ts) (new) + [MixOverlay.tsx](../components/overlay/MixOverlay.tsx). New `02 ESPECTRO // ANALIZADOR` panel (existing panels renumbered). `useAudioFeatures` derives RMS energy + spectral centroid→0-10 temperature (log-freq mapped onto the vibe axis) + low/mid/high bands from the live FFT bins, NO new deps; returns honest IDLE when silent. When THIS mix is the tab-captured now-playing track: canvas-2D log-spaced bar field hard-quantized to the thermal ramp + readouts `ESPECTRO · EN VIVO` / `TEMPERATURA ≈ N · SLOT` / `ENERGÍA ▓▓▓░` / bands. When not: honest `ESPECTRO · INACTIVO · ▷ REPRODUCE PARA ANALIZAR` flat baseline. No fabricated BPM/key (ingest-time work, deferred). RAF only when live; DPR-clamped; visibility-paused; offsetWidth sizing. Note: the genuinely-fake [Waveform.tsx](../components/Waveform.tsx) turned out to have ZERO importers (orphan dead code) — MixOverlay never rendered it; left for separate cleanup.
- **Context gate** — [NowPlayingHud.tsx](../components/audio/NowPlayingHud.tsx). Reproductor3D now mounts only when `audio.currentItem` exists; idle shows a CSS `MatrixIdlePlaceholder` (`SIN·SEÑAL · MATRIZ EN ESPERA`, glacial-slot baseline). **Home idle WebGL contexts 3 → 2** (verified live: only the fluid z0 + CRT z100 canvases remain) — restores headroom under the Safari cap for the overlay transition + expanded player.

### Deferred / cleanup

- Dead `overlay-panel-in/out` keyframes + orphan `Waveform.tsx` → a globals.css/dead-code sweep. `wiki/40-Components/MixOverlay.md` describes the old decorative waveform + old panel numbering (now stale). SignalTransition click-origin exactness (pass panel offset from shell) only if it ever matters. Mix spectrum display columns use ASSUMED_SR for layout (cosmetic ~9% Hz spacing drift; temperature/bands use the true rate).
- Still pending from the roadmap: composite-shader (DOM-texture) overlay transition was done as the lighter canvas-2D teletext version instead (no context cost — the right call at the ceiling); GL singleton + frame governor (phase C) still the proper long-term home for all canvases; kinetic section headers, reader phosphor, broadcast vibe-fader, living brand mark — all still unbuilt.

---

## 2026-06-12 · INGEST · Redesign 2026 phase D (showpieces) — teletext vibe fluid, ASCII+phosphor visualizer, document-mount flyers

The Three.js/WebGL showpieces the research was for. Same branch `redesign/2026` (still unmerged). Three surfaces, raw three@0.184 + GLSL (WebGLRenderer, not WebGPU — matches the codebase), all obeying the phase-A constitution (thermal ramp only, no RNG decoration, every visual carries data/interaction, ≤3Hz luminance, designed reduced-motion state, full disposal).

### What landed

- **[[VibeFluid]]** (new, [components/fluid/VibeFluid.tsx](../components/fluid/VibeFluid.tsx) + [shaders.ts](../components/fluid/shaders.ts)) — a stable-fluids sim (128×72 velocity+dye on ping-pong half-float RTs, ~20 Jacobi pressure iterations) behind the home feed, output quantized through a **teletext 2×3 block-mosaic display pass** hard-mapped to VIBE_SLOT_COLORS. Pointer stirs the field (dye scaled by speed); one ~21s analytic carrier keeps it alive at rest; dye dissipates back to dark. The low sim res is invisible — the mosaic eats it (the perf gift). Fixed `z-[-1]` behind a `relative z-0` feed wrapper (was the reviewer's one CRITICAL — stacking was source-order-luck; now robust by rule). DPR clamped 1, 30fps gate, idle-mount (LCP untouched), gated to `(min-width:1024px) and (pointer:fine)` + deviceMemory≥4, visibility-paused, reduced-motion → one frozen settled frame. Knobs at file top (SUBCELL_THRESHOLD/SPLAT_HEAT/LUMA_CAP are the feel dials). Three.js traps hit + fixed during build: fullscreen-quad attribute MUST be named `position` (else 0 draw calls); half-float LinearFilter samples zero without `OES_texture_half_float_linear` (fell back to Nearest); vec2 position → NaN boundingSphere (padded to vec3).
- **Reproductor3D reborn** ([components/audio/Reproductor3D.tsx](../components/audio/Reproductor3D.tsx) + new [asciiPass.ts](../components/audio/asciiPass.ts)) — the matrix visualizer renders to target, then two hand-rolled fullscreen passes: **(1) phosphor afterimage** via `max(scene, prev*damp)` ping-pong (damp 0.80→0.93 mapped from the existing trackEnergy EMA, hard-clamped ≤0.94 — the trails ARE the music's energy; `max`-blend can only decay, never strobe → photosensitivity-safe by construction); **(2) procedural ASCII pass** — per-cell luminance → 5-glyph ramp (`· : + #` block) drawn on a 3×5 subcell bitmask IN-SHADER (no font atlas), glyph color = the cell's ramp-quantized source color. Internal 8-stop palette lerp replaced with a hard VIBE_SLOT_COLORS quantize. Works in both mounts (rail + overlay), targets resize+dispose with the existing offsetWidth path, reduced-motion skips the trail pass and freezes one frame, all GPU resources join the disposal block. Black-when-silent is the honest rest state.
- **Document-mount flyers** ([components/cards/ContentCard.tsx](../components/cards/ContentCard.tsx) + `.flyer-*` block in [globals.css](../app/globals.css)) — every feed flyer at rest is `grayscale(1) contrast(1.05)` + a `mix-blend-mode:color` vibe-slot tint (0.22, inline per-item color) + a deterministic 45° halftone screen (multiply 0.35), contained by `isolation:isolate`. Hover/focus **develops** the print to full color in 350ms (filter+opacity only, compositor-cheap at 100+ cards, photosensitivity-safe). Zero GPU/JS cost — the change that makes the feed read as a collected archive of tinted prints instead of a generic image grid. Fresh-published items excluded (their `fresh-cover-flicker` owns `filter`); drafts/imageless/hero untouched. Verified visually (DOM/CSS) — the only showpiece the screenshot tool can capture.

### Verification + the visual-capture limitation

`tsc` + clean `next build` pass (had to `rm -rf .next` once — a prior build collided with the running dev server). Flyer mount visually confirmed via screenshot (desaturated archival prints across home + agenda). **The two WebGL surfaces could NOT be captured visually**: the preview screenshot tool doesn't composite WebGL canvases, and the canvases use `preserveDrawingBuffer:false` so post-hoc readPixels returns zeros. Verified instead by: the build agents' render-target readback (fluid produces correctly-colored warm teletext blocks, warmFrac climbs cyan→ember with stir; visualizer glyph masks + damp mapping reviewed), correct buffer sizing (1440×900 @ DPR1 once the 1024 gate passes — at ≤1023px wide it's correctly disabled, which is why a 1009px preview shows no fluid), and crash-free live runtime under synthetic pointer stirring (zero console errors). **TODO: Iker eyeballs both in a real ≥1024px foreground tab** — tune SUBCELL_THRESHOLD/SPLAT_HEAT/LUMA_CAP (fluid density/brightness) and LUMA_THRESHOLD (visualizer silent-state busyness) to taste; play a SoundCloud mix to see the character rain + phosphor trails.

### Reviewer findings — dispositions

- CRITICAL stacking fragility → FIXED (z-[-1] + relative z-0 wrapper).
- WARN context count: home idle now = CRTShader + VibeFluid + NowPlayingHud Reproductor3D = 3; opening the expanded player = 4. Pre-existing (HUD viz mounts unconditionally) but VibeFluid consumes the last headroom slot. Safari caps contexts and drops on backgrounding. **Deferred fix worth doing**: gate the NowPlayingHud Reproductor3D mount behind `audio.currentItem` so idle holds 2. Not done this phase.
- NITs (deferred): NowPlayingHud/AudioPlayer3D legend dots still hardcode off-ramp hues (#D946EF/#0EA5E9) — should derive from VIBE_SLOT_COLORS slots 1/5/9 to match the now-ramp-true field; dead `u_simTexel` uniform in DISPLAY_FRAG; reduced-motion re-warmup on every visibility restore (cosmetic); pre-existing unused `smoothScratch`.

### Deferred / still open (phases B/C remainder)

ch-grid typographic constitution + commercial-font decision; dither flyer pipeline at INGEST (current treatment is at-rest CSS, not baked); GL singleton + frame governor (the proper home for all three contexts — would also solve the context-count WARN structurally); Meyda spectral-centroid→vibe wiring; composite-shader overlay transition; Gommage HP-death ritual; departure-board agenda tick. Mobile pass still untested (fluid + visualizer are desktop-gated; flyer mount is mobile-safe).

---

## 2026-06-12 · INGEST · Redesign 2026 phase A — thermal vibe ramp, VibeMeter, station dial, motion constitution, broadcast header

First implementation slice of the full redesign (branch `redesign/2026`, NOT yet merged/pushed — Vercel auto-deploys main). The brief: ditch the NGE aesthetic, modernize the analog feel as a hybrid of ASCII/teletext lineage + 2026-grade craft. Direction set by a four-pass research sweep (≈2.4M tokens, 25 agents): codebase deep-read, six-lens web research + critic + gap-fill, a 2026-only frontier sweep, and a focused pass on colormaps / grid motion / fader hardware. The strategic spine: **terminal-on-dark is now AI-startup sameness — the differentiator is a fictional CDMX *transmission authority*** (teletext block-mosaic lineage, NAAFI bureaucratic register, rave-flyer print hierarchy) **where every readout is true data**. Scene-credible terminal displays the SCENE's state, not the machine's.

### What landed (phase A — the design constitution)

- **Thermal vibe ramp** — [lib/utils.ts](../lib/utils.ts) `VIBE_SLOT_COLORS`: the saturated rainbow lerp (cyan→magenta→red, non-monotonic lightness — the "AI gradient" tell) replaced by an 11-slot **thermo-diverging instrument ramp**: glacial cyan arm (`#087487`…) → near-neutral *estática* hinge at slot 5 (`#948E85`) → ember/brand-orange overload zone 8-10 (`#FC6C0F` `#FC9414` `#FEB225`). Strictly monotonic OKLCH lightness 0.515→0.815 (energy = brightness; survives grayscale), no hue transit through green/purple/magenta, every slot ≥3:1 on the new base. OKLCH anchors documented inline; structure = Kovesi "linear-diverging" / FLIR Arctic precedent. `vibeToColor` API unchanged so all ~29 consumers picked it up for free. Tailwind tokens `vibe-0…vibe-10` replace the dead pastel set.
- **One expressive variable** — vibe temperature is now the only expressive color on cards: type badges demoted to `text-secondary` (category hues retired from card chrome; ★ editorial stays sys-red, PINNED sys-green, //PRESENTA orange — system colors, not category hues).
- **[[VibeMeter]]** (new, [components/VibeMeter.tsx](../components/VibeMeter.tsx)) — 11-segment stepped meter, the canonical band display: full calibrated scale always renders; in-band slots lit at full slot color, out-of-band dimmed to **low-alpha versions of their own hue** (unlit LEDs, never gray). Renders the **effective** band (`effectiveVibeBand` — crowd median past threshold) so the meter can never disagree with the filter that admitted the card. Replaced every `vibeBandGradient` strip (ContentCard / HeroCard vertical / Evento·Generic·Reader overlays / orphan Mix·ArticleCard); `vibeBandGradient` deleted from utils (zero call sites).
- **[[VibeSlider]] → station dial** — fixed printed scale plate (zero-padded numerals + slot names, dim mono, **static** — labels no longer travel with handles), needle handles, tape dashes hard-assigned to slot colors (no per-dash lerp), **PPM ballistics** (light ~100ms entering range, decay ~600ms leaving), release-snap detents with CSS spring overshoot, magnetic 0/10 edges, arrow-key stepping (new), reduced-motion → instant. `[data-vibe-strip]` contract + chip-strip auto-hide preserved verbatim. Fixed a tape/plate ~1% misalignment (99% vs 100% scale mapping).
- **[[ContentGrid]] motion constitution** — *position interpolates, size quantizes*: `layout="position"` (tier changes snap, field slides), one 0.25s ease-out (was 0.4/0.7s asymmetric — ~2× too slow for user-initiated motion per craft guidance), standing-scale breathing + prominence padding removed (`--prominence` var kept as future treatment hook, currently no visual consumer), entrants reveal via stepped opacity (4 hard steps, 40ms stagger — signal acquisition, not fade), direction-tracker machinery deleted, `useReducedMotion` → broadcast cuts.
- **[[Navigation]] → broadcast header** — fake T+ countdown + 33ms frame counter replaced by ONE true readout (real CDMX clock, `America/Mexico_City`, 1Hz). Data-strip fiction (`A·T·FIELD·STABLE`, `MAGI·SYSTEM·NOMINAL`, `FREQ·ACTIVA·128BPM`) replaced by identity mottos that claim no state (`TRANSMISIÓN·CDMX`, `FRECUENCIA·ABIERTA`, `ARCHIVO·VIVO`, `SIN·ALGORITMO`, `00·GLACIAL····10·VOLCÁN`). EVA unit-designation logo box + bar-graph + holo-flicker → clean `GRADIENTE·MX` lockup. All 18 MAGI-fire inline hexes eliminated for tokens. Waveform axis numbers (fake data) removed.
- **Charcoal base** — `#000` → `#0D0D0D` with the grey elevation ramp re-derived above it (RA brutalism teardown: pure black fails nighttime readability). `--vibe-gradient` token collision resolved (one canonical definition in globals.css, 11 hard steps); dead `.eva-glow`/`.eva-glow-sm`/`holo-flicker` CSS deleted (Navigation was the last consumer).

### Verification

`npx tsc --noEmit` + `next build` pass; smoke-tested on :3003 — home (120 cards, 111 meters), card meter lit/unlit per effective band (verified segment-by-segment), overlay boot, agenda. Console: only pre-existing pollVotesCache anon noise. Gotcha for the record: running `next build` while `next dev` is serving corrupts the dev server's chunk map (`Cannot find module './9276.js'`) — restart dev after builds.

### Deferred / next phases

- **Phase B (DOM layer)**: ch-grid typographic constitution, type-system decision (Monument Semi-Mono / GT Pressura vs free JetBrains+Departure tier — commercial fonts need a budget call), grayscale-dither flyer pipeline at ingest (tint-by-vibe via mix-blend-mode), document-mount card chrome (folios), global scanline consolidation, `eva-box`/`eva-scanlines`/`nge-*` class renames (still referenced by OverlayShell, Login/Search/Thread/Marketplace overlays).
- **Phase C (GL)**: single GL singleton + frame governor, ASCII pass over Reproductor3D, Meyda spectral-centroid→vibe mapping, AfterimagePass phosphor trails.
- **Phase D (signature moments)**: vibe fluid (ASCII liquid), composite-shader overlay transition, Gommage HP-death ritual, departure-board agenda tick, photosensitivity luminance limiter.
- **Known leftovers**: ListicleOverlay header still says `GRADIENTE·FM` (pre-existing rebrand miss); EventCard keeps its solid border-left vibe accent (decide later); `fresh-*` glitch suite still wired to categoryColor (replaced in phase B); MosaicItem's unused `id` prop; mobile pass still untested.

Research catalogs (110+ verified findings with URLs/licenses/perf notes) live in this session's temp files — to be distilled into a `70-Roadmap/Redesign 2026.md` note.

---

## 2026-06-02 · INGEST · "make it alive" — HP loop reconciled + crowd-weighted, novelty weighting, composer prior, feed heartbeat

A session-long arc making the reactive machinery *actually* reactive (and legible), plus two dashboard bugs surfaced while testing. Through-line: the NGE aesthetic promises a living system — make every readout true rather than decorative.

### What landed

- **HP rollup ↔ read-side reconciliation** — migration [0024_hp_rollup_imminence.sql](../supabase/migrations/0024_hp_rollup_imminence.sql). `apply_hp_rollup()` ignored event-imminence (always flat type half-life), so a popular *upcoming* event got flat-decayed + re-anchored on every engagement tick — eroding the imminence lift meant to keep tonight's party on top. Ported `decayLambda()`'s modulation (live-window freeze → λ=0; <7d-out → ×(daysUntil/7)²; >30d-past → ×2) into the cron, composed with the harvest decay multiplier. Cron and [[curation]] now agree.
- **Balanced engagement weights** — [api/hp-events/route.ts](../app/api/hp-events/route.ts): open 1→1.5, save 3→4, comment 2→3. Validated with a population sim ([scripts/hpSim.mjs](../scripts/hpSim.mjs)) that showed weight *magnitude* is a minor lever (score normalizes by per-type peak), and that at growth scale a runaway item compresses the feed to `sm` — the real fix being `max` → rolling p90 normalization (TODO at `curation.ts:99`). Logged as scale-up roadmap, not shipped.
- **Novelty weighting — box-breaking under the hood** — migration [0025_novelty_weighting.sql](../supabase/migrations/0025_novelty_weighting.sql) + [[Novelty Weighting]]. The HP a user *grants* is scaled by how novel the content's (genre · type · vibe-band) are to them: echo-chamber engagement discounted (~0.8×), cross-genre amplified (≤1.5×). New private `user_axis_affinity` store (RLS-locked, 0 policies — only the SECURITY DEFINER `record_hp_event()` touches it) replaces the bare hp_events insert. **Reads stay global** (one shared `items.hp` for everyone; only the write-weight is personal), so [[No Algorithm]] holds. Gentle spread (M_MIN 0.6 / M_MAX 1.5 / γ1 / 45d half-life / 15-interaction cold start), tuned in [scripts/noveltySim.mjs](../scripts/noveltySim.mjs). Relaxes the `curation.ts:5` "No per-user logs" line — intentional, documented.
- **Composer vibe-prior** (Vibe Philosophy idea #3) — [lib/data/vibePriors.ts](../lib/data/vibePriors.ts) (weighted prior from author×3 + venue×2 + genres×1, confidence→narrowness, no new schema) → [api/vibe-prior](../app/api/vibe-prior/route.ts) → [useVibePrior](../lib/hooks/useVibePrior.ts) → [VibePriorHint](../components/dashboard/forms/shared/VibePriorHint.tsx), wired under the VibeField in all 8 compose forms. Suggest-and-apply (`≈ SUGERIDO 5–9 · tu historial · APLICAR`), non-destructive, renders nothing when there's no history.
- **Feed heartbeat** — [Navigation.tsx](../components/Navigation.tsx) + [useFeedPulse](../lib/hooks/useFeedPulse.ts). The fake `● LIVE` data-strip slot is now real: `RECURADO HACE Xm` (from `max(items.hp_last_updated_at)` — honest at any traffic level since a no-op rollup doesn't advance it) + active piece count. Dot `motion-safe:animate-pulse`s only when re-curated within the last rollup cycle. Authed-only data (items reads auth-gated, 0014); anon sees just the dim dot.

### Bugs fixed (dashboard LivePreview)

- **`useOverlayShell must be used inside <OverlayShell>`** on editorial/review/opinion/noticia previews — latent since the 2026-05-21 comments work ([ReaderOverlay](../components/overlay/ReaderOverlay.tsx) reads the comment count via `useOverlayShell()`, but [LivePreview](../components/dashboard/LivePreview.tsx) renders it without a shell). Fix: new exported `OverlayShellPreviewProvider` (inert stub — 0 comments, no-op toggle; module-const value to dodge the SWC parse gotcha) in [OverlayShell.tsx](../components/overlay/OverlayShell.tsx); LivePreview wraps `PreviewBody` in it.
- **Articulo previewed via GenericOverlay** — added the `articulo` case so [ArticuloOverlay](../components/overlay/ArticuloOverlay.tsx) renders in preview.

### Infra

- 0024 + 0025 applied to prod via the Supabase SQL editor — **not** `db push` (prod migration history stops at 0016 though the DB has 0017–0023, applied out-of-band; a push would replay + conflict). [database.types.ts](../lib/supabase/database.types.ts) regenerated from the live schema (also closes the older Functions/columns drift); harvest route dropped its now-unneeded rpc cast; CLAUDE.md "No backend yet" line corrected.

### Wiki touched

- [[Novelty Weighting]] — new §90 decision. [[index]] — added it under §90.

### Deferred / open

- **`max` → rolling p90 normalization** in [[curation]] — the real scale-up knob so a runaway item can't compress the feed. Defer until traffic.
- **Re-tune novelty spread + engagement weights from production data** after a few weeks of beta (shipped numbers come from assumed profiles; the sims are the bench).
- **Voting-budget normalization** for novelty (avg multiplier ≈ 1.0) — add only if heavy users' total influence needs reining in.
- **Reconcile migration history** — mark 0017–0023 as applied so future `db push` is sane.

---

## 2026-05-21 · INGEST · COMENTARIOS button promoted to a real CTA

Beta feedback rollup: multiple users were missing the comments surface entirely. The vertical rail button on the right edge of every overlay looked like decorative chrome — gray-on-near-black, 10px rotated text, no count, no presence signal. The closed-state color (`#9CA3AF` muted gray) only flipped to orange `#F97316` *after* a click, which is exactly backwards: the invitation to click was inert, the confirmation of having clicked was loud. Four converging changes, all on existing surfaces, no new chrome introduced.

### What landed

- **Rail button — live system readout** ([OverlayShell.tsx](../components/overlay/OverlayShell.tsx)). The vertical chip now reads `00 / COMENTARIOS / ● N` (zero-padded count at top, label in the middle, presence dot + number at bottom when N > 0). Closed-state color is EVA orange-at-rest (`#FF9A33` text, `rgba(249,115,22,0.55)` border, `#0a0a0a` bg) so the button carries CTA color rather than only on-press. Hover slides the chip inward 8px and brightens border + text to full `#F97316`. Sized up significantly: 44×220px (was 33×145), 12px text (was 10), 14px icon (was 11), `px-3 py-5` padding. The button now reads as a substantial drawer handle, not a vestigial strip.
- **Inline DISCUSIÓN entry in the article metadata `<dl>`** ([ReaderOverlay.tsx](../components/overlay/ReaderOverlay.tsx)). New row alongside PUBLICADO / VIBE: `DISCUSIÓN · 00 COMENTARIOS · → ABRIR` in orange, clickable to toggle the panel. This is the second discovery path: the eye is already inside the metadata row reading the byline, so the comments affordance gets surfaced inside the reading flow rather than asking the user to scan the right margin. Mobile users still get this entry because it's in-body, not in the `hidden sm:flex` rail.
- **`[C]` keyboard binding** ([OverlayShell.tsx](../components/overlay/OverlayShell.tsx)). Pressing `c` toggles the comments column. Ignored when focus is in `input`/`textarea`/`contentEditable` so the composer still receives the letter. Extends the existing ESC handler (which also collapses comments-first, overlay-second).
- **Footer legend `[C] COMENTARIOS · N`** ([ReaderOverlay.tsx](../components/overlay/ReaderOverlay.tsx)). New button in the sticky reader footer alongside `[F] VER FLYER`. Functions as both a click target AND the printed legend for the `[C]` keystroke — shipping the keybind without the legend is invisible; shipping the legend without the bind is a lie. They go together.

### Architectural detour worth knowing

The count needs to be live before the user opens the column (for the rail badge + metadata row + footer counter). The naive move — call `useComments(item.id)` once at the shell, once again inside [[CommentsColumn]] — crashed: both subscribed to a Supabase realtime channel named `comments:${itemId}` from the same client and the second subscription's mount threw a notFound boundary trip. Fixed by lifting `useComments` to OverlayShell, exposing the full result (`comments`, `usersById`, `loading`) through a new `OverlayShellContext`, and refactoring [[CommentsColumn]] to read from that context instead of calling the hook itself. The dedupe is now structural, not coincidental — if a future overlay surface needs the same data, it consumes the context.

### SWC parser gotcha

Next 14's SWC choked on `<OverlayShellContext.Provider value={{ inline... }}>` even though the exact same pattern works in [`context/VibeContext.tsx`](../context/VibeContext.tsx). Aliasing the Provider to a const (`const Foo = Ctx.Provider`) didn't help. The workaround that unblocked it: extract `value` into a `const shellCtxValue = { ... }` above the return, then write `value={shellCtxValue}` — a single identifier reference. If we hit "Unexpected token X. Expected jsx identifier" on a context provider elsewhere, this is the shape to reach for.

### Wiki touched

- [[OverlayShell]] — rail button updated, context + `useOverlayShell()` added, `[C]` shortcut added to close affordances section.
- [[CommentsColumn]] — data source switched from `useComments(item.id)` to `useOverlayShell()` context.

### Deferred / open

- **Onboarding hint (#3 in the proposal)** — the "← abrir discusión" one-shot annotation tied to localStorage was deferred. Ship the four structural fixes first and see if users still miss it. If they do, this is the fallback.
- **Edge rail (#2) and ghost preview (#9)** — both decorative additions that would solve "looks like chrome" by adding more chrome. Cut deliberately; revisit only if the structural changes underperform.
- **Other overlay types** — the metadata row + footer legend currently live in [[ReaderOverlay]] only (covers editorial/articulo/review/opinion/noticia). [[MixOverlay]], [[EventoOverlay]], [[ListicleOverlay]], [[GenericOverlay]] still need the same treatment. The rail button + `[C]` shortcut are universal (live in OverlayShell) so all overlay types benefit immediately from those two.

---

## 2026-05-21 · INGEST · invitation HTML adopted as /about + fifth nav link

The closed-beta invitation deliverable from the sibling [gradiente-ops repo](../../../Gradiente-ops/deliverables/INVITACION_v2.html) (1,564 lines, the GRADIENTE·MX · BETA 150 dossier the team mails per-recipient) was being used by recipients as the de-facto explanation of how the app works — it carries the entire mental model (vibe, HL, roles, content types, the manifesto). The user surfaced the friction directly: as an *invite*, it's over-loaded; as an *about page*, it's exactly right. Move not refactor — the invitation file stays untouched in `gradiente-ops`, we copy its shape here.

### What landed

- **[app/about/page.tsx](../app/about/page.tsx)** — the prior `BrandPageShell`-based /about (subsystem/title/lead + three short sections — see git for the deleted content) was replaced by the invitation inlined as a `'use client'` page. All CSS scoped under `.qe-root` (~640 lines), keyframes renamed `qe-*` to avoid clashing with Tailwind's `blink`. Fonts (Rajdhani + IBM Plex Mono + Space Grotesk) loaded via Google Fonts `<link>` tags inline — direct port from the invitation, no migration to `next/font/google`. Scripts (UTC clock, scroll progress, TOC IntersectionObserver, phosphor-tape vibe-fader build) hoisted into a single `useEffect` with proper cleanup. Manifesto gate ported to React state (`useState locked`) which drives a `data-locked` attribute the existing CSS selector reads — no DOM mutation in event handlers. Password is `centro`, case-insensitive compare, lives as a module constant.
- **Two intentional divergences from the invitation source:**
  1. **Welcome-section activation copy stripped** — the four paragraphs explaining "para activar tu cuenta necesitas dos cosas" + the "si ya tienes un proyecto o colectivo" onboarding block + the `accessCodeInput` + ENTRAR button are gone. A visitor who navigated here from the nav doesn't need the redeem flow. What survives: the greeting, the "si llegó esto a tus manos" + "te invitamos a la beta cerrada" + "más sobre la plataforma en las secciones siguientes" + the "el archivo no tiene dueños" closing line. (Note: the "si llegó esto a tus manos" copy still reads as if the user is opening private mail — flag for editorial revision if it bites.)
  2. **Internal `.topbar` and `.progress` de-stickied** — the original used `position: sticky; top: 0` for both, which conflicts with the site's own sticky `<Navigation>`. Now `position: relative` — they preserve the chrome on first paint but scroll away after the first viewport. TOC sticky top bumped 4rem → 6rem so it clears the site nav. Dossier-section `scroll-margin-top` bumped 4.5rem → 7rem for anchor-jump alignment.
- **[components/Navigation.tsx](../components/Navigation.tsx)** — fifth nav link `QUÉ ES GRADIENTE → /about` added after MARKETPLACE. Longest label in the row by 5 chars; at MacBook widths the row will tighten. Padding stays at `px-6` for now; if it crowds the timer/badge slot, drop to `px-4` (noted in updated [[Navigation]]).
- **Layout escape** — the new about page uses `-mx-4 -mt-4 -mb-24 md:-mx-8` on the wrapper to negate the root layout's `<main className="mx-auto max-w-screen-2xl px-4 pb-24 pt-4 md:px-8">` padding so the invitation's topbar and footer can reach the viewport edges as designed.

### Why the copy-don't-share approach

The invitation file is a deliverable: it ships per-recipient via email with a code, gets opened standalone, has hard requirements (lowercase normalization before redirect to `/welcome?codigo=`, the `accessCodeInput` flow). The about page is a public surface inside a Next.js app: it has React state, a wrapping layout, a different audience. Sharing source would force one to bend to the other — the invitation would have to learn JSX, or the about page would have to keep an unused redirect flow. Two truths, one short — copy now, dedup later if the divergence becomes painful.

### Wiki touched

- [[Navigation]] — 4 → 5 destinations + the `QÉ ES GRADIENTE` note + tighter-row caveat.
- [[About]] — still no standalone wiki file (same as [[Manifesto]] and [[Equipo]] — the index references them but they were never written). Skipped for now; if the about page grows complexity, write one.

### Deferred / open

- **The "si llegó esto a tus manos" greeting** is invitation-framing on a public page. The user explicitly opted to keep it; flagging here as an editorial revisit candidate.
- **`BrandPageShell`** still backs `/manifesto` and `/equipo`. Not orphaned. Leave alone until those pages get redesigned.
- **Stacking sticky chrome** — site Nav (~76px) + VibeSlider live above the about page content. The about page's TOC sticky-top is set to `6rem` which clears site Nav only. If VibeSlider gets taller or the TOC starts disappearing under it, bump TOC top.

---

## 2026-05-14 · INGEST · partner attribution chrome + //PUBLICAR authoring tab

Two layered slices shipping the partner-content pipeline locked in by the design conversation (see [[Partner Authoring]]). End state: any approved partner team can publish scene-voice content (`evento` · `mix` · `noticia` · `opinion` · `listicle`) into the main feed, with the //PRESENTA · X attribution chip rendering on cards + rail tiles + overlay byline so readers can apply their own trust calculus.

### Slice 1 — Attribution chrome (`partner_id` self-FK + chip + byline)

**Data model.** Added `partner_id text` self-FK on `items` ([0015_items_partner_id.sql](../supabase/migrations/0015_items_partner_id.sql), `ON DELETE SET NULL` so deleting a partner orphans attribution but preserves the content). Two new fields on `ContentItem`: `partnerId?: string` (the FK) and `partner?: { id, title, kind, slug, marketplaceEnabled }` (a minimal embedded shape populated server-side at read time).

**The PostgREST detour.** Initial attempt was a PostgREST embedded resource: `partner:items!partner_id(id, title, slug, partner_kind, marketplace_enabled)`. Two failure modes hit back-to-back:

1. After applying the migration, every `getItems()` call returned `PGRST200: Could not find a relationship between 'items' and 'items' in the schema cache` — PostgREST's schema introspection cache hadn't picked up the new FK. The error didn't differentiate between "FK missing" and "FK exists but cache stale," which made the diagnosis slow.
2. Tried both forms PostgREST documents for self-FK disambiguation — column-name hint (`items!partner_id`) and constraint-name hint (`items!items_partner_id_fkey`). Both failed identically — the schema cache is the bottleneck either way.

Pivoted to a **two-query merge pattern** mirroring the existing `fetchVibeCheckAggregates` in [items.ts](../lib/data/items.ts) — fetch items first, collect distinct `partnerId`s, fetch partner rows by id, attach via an `attachPartner` helper before returning. Schema-cache-agnostic, matches an existing pattern in the file, and survives future schema changes without coupling to PostgREST embed inference. Recommend this approach for all future relational reads where the relation cardinality is low — it's cheaper than the cognitive load of debugging embed inference.

**Rendering chrome.** Three surfaces light up when a non-partner item has `partnerId` set:

- **Mosaic card** — `//PRESENTA · CLUB JAPAN` chip in NGE orange (`#FF8800`), top-left chrome stack alongside `//EVENTO` and other type badges ([ContentCard.tsx](../components/cards/ContentCard.tsx)). Clickable through to `/marketplace?partner=<slug>` only when `partner.marketplaceEnabled` is true (V0 falls back to a static label otherwise — chip-as-label is the trust mechanism; click-through is a discovery affordance that lights up automatically when marketplace approval lands).
- **Rail tile** — same chip vocabulary on the smaller `EventoRailCard` ([EventosRail.tsx](../components/EventosRail.tsx)). Stacked below `//EVENTO` rather than alongside (180px tile width — alongside truncates).
- **Overlay byline** — `PUBLICADO POR //CLUB JAPAN` next to the slug in the OverlayShell header ([OverlayShell.tsx](../components/overlay/OverlayShell.tsx)). Same gating: clickable iff marketplace-enabled.

Prefix derives from `partner.partnerKind` — `venue → PRESENTA`, `label → SELLO`, `promoter|promo → PROMOTORA`, `dealer → DEALER`, `sponsored → PRESENTA` (neutral). Helper at [partnerAttribution.ts](../lib/partnerAttribution.ts) is shared across all three surfaces.

**Verification.** Stamped `partner_id = 'pa-club-japan-ppur'` on `ev-ra-2429949` (KØNTROL @ Japan Monterrey) and `editorial = true` (so it appears in both EventosRail AND the main mosaic — see Decision note below). Chip rendered on all three surfaces, click-throughs non-clickable as expected (Club Japan is `marketplace_enabled = false`, which doesn't gate publishing — see slice 2).

### Slice 2 — //PUBLICAR tab + partner-team write path

**The model correction.** Initial Decision note said marketplace approval was the publishing gate. Project lead corrected: publishing approval and marketplace approval are SEPARATE — a venue partner with marketplace off should still publish events / mixes / noticias normally. Marketplace is a commerce capability layered on top; the publishing trust gate is just "is there a partner row" (admin-created at onboarding). [[Partner Authoring]] updated to reflect.

**Permissions (`canCreateContent`).** Extended in [permissions.ts](../lib/permissions.ts) — partner team members (`!!user.partnerId`) gain the 5 scene-voice types (`evento` · `mix` · `noticia` · `opinion` · `listicle`) without needing guide tier. House-voice types (`editorial` · `review` · `articulo`) still require guide+; a partner-team DJ who wants to write a review does so via insider role on their User account, not via partner membership. Exported `PARTNER_PUBLISHABLE_TYPES` as a const so the //PUBLICAR tab picker has a single source of truth.

**Dashboard surface — //PUBLICAR tab.** Third tab in [[MiPartnerSection]] alongside MARKETPLACE + EQUIPO. Renders an orange `//PRESENTA · CLUB JAPAN` header strip (same chrome vocabulary as the public chip — reminds the user which partner they're authoring as), then the existing `NuevoSection` scoped to `PARTNER_PUBLISHABLE_TYPES`. On pick → `router.push('/dashboard?section=nuevo&type=<type>')`, which opens the existing per-type form. No new composer plumbing — the existing dashboard composer flow is reused entirely.

**Server-side stamping ([api/items/route.ts](../app/api/items/route.ts)).** On POST, look up the authenticated user's `partner_id` from the users table. If set AND the item type is in the 5 partner-publishable types, the upsert payload gets `partner_id` (from the user, not the client — single source of truth), `source = 'manual:partner'`, and `editorial = true` (so partner events default to appearing in BOTH the rail and the mosaic — partners ARE the curators of their own events). The client doesn't need to know about partner attribution; the server fills it in based on who's authenticated. Non-partner-team users skip this branch entirely — house-voice publishing path unchanged.

**RLS — [0016_partner_team_authoring.sql](../supabase/migrations/0016_partner_team_authoring.sql).** Two new policies on the items table:

- `items_partner_team_insert` — partner-team member can INSERT a row where `created_by = auth.uid()`, `source = 'manual:partner'`, `type IN (5 scene-voice types)`, AND the auth user's `partner_id` matches the row's `partner_id`. The combined check means the user is publishing for THEIR partner only, scoped to types they're allowed.
- `items_partner_team_update` — same shape but for UPDATE (covers re-publish on edit). USING + WITH CHECK both gated so a team member can't edit a different partner's row or re-target a row to a partner they don't belong to.

These are additive — the existing `items_staff_insert` / `items_staff_update` policies still cover guide/admin writes. Multiple INSERT policies combine with OR in Postgres, so any row meeting either gate passes.

**Editorial=true default.** Set on partner-stamped items via the API override. Per the Decision note's "rail AND mosaic" placement model (vs `elevated=true` which is mosaic-only), this is the right flag for partner-authored events — they appear on both surfaces. Confirmed during the chip verification: KØNTROL with `editorial=true` rendered in EventosRail AND the main mosaic.

### Wiki touched

- [[Partner Authoring]] — corrected: publishing gate ≠ marketplace gate; scope expanded from 3 to 5 types; default `editorial=true` documented; implementation order updated.
- [[Navigation]] · [[VibeSlider]] — earlier wiki refresh (alongside the pulled 2026-05-12 commits) captured the trim + MX rebrand + slider auto-hide; included in this commit batch.
- [[index]] — added [[Partner Authoring]] under §90 Decisions.

### Deferred (do not build pre-emptively)

- **Per-partner curation cap** — knob for fairness (limit one partner from concentrating at top of mosaic). Triggering condition: any partner with 3+ concurrent top-12 items, or sustained >2 items/week.
- **Scraper auto-claim** — when RA ingests an event whose venue fuzzy-matches a partner's title, route to that partner's pending queue for enrich-or-reject.
- **Recurring events / residencies** — high-ROI for venues but premature.
- **Inherited crowd vibe defaults** — partner-published events default their `vibeMin`/`vibeMax` to the median of past Vibe Checks.
- **Post-event recap nudge** — when an event ends, partner gets a one-click recap-draft.
- **Earned auto-publish per content type** — after N admin-approved items of a type, that partner unlocks auto-publish (currently auto-publish from day 1 since marketplace-approval is the existing gate; this would tighten if abuse appears).
- **Chip rendering on draft / saved-items surfaces** — partner attribution is currently only rendered on home / agenda / overlay surfaces (the server-side `attachPartner` only runs in `getItems` / `getItemBySlug`). If we surface partner content in dashboard drafts or saved-items lists later, extend the browser-side hooks to populate `partner`.

### Test setup

Iker assigned to Club Japan via `update public.users set partner_id = 'pa-club-japan-ppur' where username = 'iker'` — gives //PUBLICAR tab visibility. Site admin role still applies; admins-with-partnerId trigger partner stamping (intentional for V0 simplicity — admin-on-team behaves like any team member; can be refined later with a per-publish "publish as" toggle if needed).

---

## 2026-05-12 · INGEST · nav trimmed 9→4 + MX rebrand + vibe chip strip auto-hides on idle

Two beta-testing pain points landed in one session, both the same shape: surfaces that stayed open after the user had already committed to a choice.

### Header trim + MX rebrand — `ab9561b`

Testers were ignoring the header. The 9-item nav row read as a duplicate of the SECCIÓN filter rail — five of nine labels (`NOTICIAS / REVIEWS / MIXES / EDITORIAL / ARTÍCULOS`) matched `//NOTICIA / //REVIEW / //MIX / //EDITORIAL / //ARTÍCULO` content-type filters one-for-one. Worse, the original "dim until active" treatment made inactive items effectively invisible against the black chrome. Net result: **FORO and MARKETPLACE** — the only two destinations that AREN'T in SECCIÓN, and the only real net-new pages — were never discovered.

Trimmed to four: `HOME · AGENDA · FORO · MARKETPLACE`. Two-digit `00–05` route codes dropped along with the trimmed items.

Active treatment swapped:

- **Inactive** — solid NGE orange (`#FF8800`) + faint `text-shadow` glow. No more dim-until-active.
- **Active** — orange→red gradient (`#FF8800 → #E63329`) text via `bg-clip: text` + matching gradient bottom bar + ~6% opacity gradient bg tint. The differentiation is now "selected vs not," not "this item has its own color."

One gotcha worth recording: `text-shadow` doesn't render on `bg-clip: text` glyphs (the underlying glyph is transparent, so there's nothing to shadow). Routed the active glow through `filter: drop-shadow()` instead, which operates on the rendered pixels after the gradient is applied.

Logo rebranded `GRADIENTE·FM → GRADIENTE·MX`. Data-strip ticker token `GRADIENTE·FM·SUBSISTEMA·CULTURAL → GRADIENTE·MX·SUBSISTEMA·CULTURAL`. The repo folder name (`espectro-fm-web`) is unchanged — already noted in [CLAUDE.md](../CLAUDE.md) as historical.

[Navigation.tsx](../components/Navigation.tsx) · wiki: [[Navigation]]

### Vibe chip strip auto-hides on idle — `b106b2e` · `668b921`

Previously the chip strip was visible whenever `vibeRange ≠ [0, 10]` — it stuck open indefinitely after the user committed to a narrowed range and moved on to scrolling. Worse, the container held `min-h-[3.5rem]` even when chips were faded out, so the feed below was permanently pushed down by reserved-but-empty space.

Two layered fixes, second extends first:

**Container collapses on idle (`b106b2e`).** Replaced the range-driven `chipsVisible` rule with an interaction-gated one:

```ts
chipsVisible = pinned || activeIds.length > 0 || (!isFullRange && recentInteraction)
```

A 2-second timer resets on every `[min, max]` or `activeFilterCount` change. Continuous dragging keeps the strip open (each tick resets the timer); on `pointerup` the 2s starts ticking and the strip fades out. An `isFirstInteractionRender` ref skips the mount-time pseudo-change so chips don't flash open on page load.

The chip-strip container also dropped its `min-h-[3.5rem]`. The chips wrapper now transitions `max-height: 0 ↔ 7rem` in lockstep with `opacity: 0 ↔ 1` (both 200ms). When hidden, the row collapses to just the pin button's height (~22px). Trade-off: a small vertical shift below the strip on each interaction — accepted over the permanent dead space.

**Non-active chips inherit the same gate (`668b921`).** After the container change, the committed surface still read wrong — the candidate strip stayed visible whenever any chip was active, so the result was "you've picked three, plus here are 70 more options you might want." Opposite of what the user just did.

Extended the 2s gate to the per-chip level:

```ts
chipVisible = pinned || active || (!isFullRange && inFeed && recentInteraction)
```

Active (yellow) chips stay visible always — the user needs to see and clear them. Non-active chips fade out 2s after the last slider move or chip toggle, so once a filter is committed and 2s of idle pass, the strip settles to just the yellow selections. Toggling a chip resets the timer, so adding/removing a filter gives a fresh 2s window to pick another candidate before the strip settles.

Renamed `recentSliderInteraction → recentInteraction` since it now covers chip toggles too.

[VibeSlider.tsx](../components/VibeSlider.tsx) · wiki: [[VibeSlider]]

### Wiki touched

- [[Navigation]] — destinations list, active-state treatment, MX rebrand
- [[VibeSlider]] — visibility model rewritten; the old "Layout-shift hardening" section retired in favor of an honest "Layout & shift policy" (chip strip is no longer height-stable by design)
- [[Next Session]] — date stamp + responsive-coverage note softened (the 9→4 trim likely resolved the ≤1280px header overflow; Iker should verify)

---

## 2026-05-11 · INGEST · mosaic restructure — per-type md, xl 3×2 feature, L/R lg anchors, gradient sm weave

Iker flagged that the home mosaic wasn't really mosaicking — the grid felt stuck in two columns: a wide left band of lg/md cards (all `colSpan: 2` in a 3-col grid) and a thin right rail of sm 1×1 tiles. Scrolling down, the right column died entirely because the sm pool ran out before the lg/md tower did. Diagnostic: 28 of 33 cards on the home feed had `colSpan: 2`, and `grid-auto-flow: dense` always anchored them at cols 1–2 (the earliest valid slot). The remaining 5 sm tiles were the only thing column 3 ever saw — and once exhausted, column 3 was empty.

Three landed levers, layered:

### Lever 1 — per-type `md` geometry

Today `md` was `2×1` for every type — a slightly-shorter lg. Replaced with a `MD_GEOMETRY` map in [curation.ts](../lib/curation.ts):

- **Text-heavy** (review · articulo · listicle · editorial · opinion · noticia) → **`1×2` tall portrait**.
- **Visual** (evento · mix · partner) → **`2×1` wide landscape**.

Rationale: long-form prose reads better in a portrait card; flyers and cover art read better at width. Geometry now encodes type, not just rank. Side effect: tall `1×2` tiles slot into column 3 alongside wide `2×1` neighbors, so the right rail stops being a thin stack of squares.

Initial result was tiny (1 card flipped) because almost all text-heavy items were already promoted past the md tier into lg, so the new geometry never fired. Lever 2 fixed that.

### Lever 2 — `xl 3×2` tier + rank-aware caps with L/R anchor alternation

Threshold-only tiering produced 14+ lg cards on the typical feed (every fresh text-heavy item crossed `score ≥ 1.0` after the 1.3× multiplier). After tightening the threshold to 1.4 to push them down, we went the other way — 0 lg cards. Compromise: keep thresholds at the original 1.0 / 0.5 and apply **rank-aware caps** inside `rankItems`:

- **Top-1 lg-qualifying → promoted to new `xl 3×2`** — a single full-width feature card at the top of the feed.
- **Next `MAX_LG = 3` lg-qualifying → keep `lg 2×2`** with explicit `colStart` alternating between **1** (cols 1–2) and **2** (cols 2–3). Lg cards now distribute across both sides of the page instead of stacking left.
- **Further lg-qualifying → demoted to `md`** (per-type geometry from Lever 1). Lg becomes a true accent, ~2–3 per page.

`CardLayout` gained a `colStart?: 1 | 2 | 3` field; [ContentGrid:128](../components/ContentGrid.tsx:128) consumes it as `gridColumn: ${colStart} / span ${colSpan}` when set, else falls back to span-only (dense-flow places). `CardTier` gained `'xl'`; the only consumer ([ContentCard](../components/cards/ContentCard.tsx)) still takes `'sm' | 'md' | 'lg'`, so ContentGrid maps `xl → lg` on the way out — same chrome, bigger cell.

Result: a feed with 1 xl 3×2 + 2 lg-left + 1 lg-right + a mix of mdT/mdW + sm. Both sides of the page carry emphasis.

### Lever 3 — gradient sm weave + run-breaker

After Lever 2 the mid-feed looked mosaic, but the **bottom 13 positions were still all sm** — a wall of squares at the tail. Sort-by-prominence is monotone, so same-tier items naturally cluster.

First attempt was a swap-based run-breaker (forward search preferred, backward fallback). Worked for runs of mdT in the middle but couldn't reach the sm tail — once past position 20, every remaining item is sm and there's nothing left to swap with. Max run stayed at 11.

Replaced with a **gradient distribution**:

1. Preserve `TOP_KEEP = 4` positions (xl + lg cluster) intact.
2. For the rest, place the k-th sm at the position where the cumulative target `((p+1)/total)^K · sm.length` says it should — with `K = 1.5` biasing the curve toward the end. End-loaded but never bunched.
3. Follow with a small `MAX_PASSES = 4` run-breaker pass on the big-items zone to flatten leftover mdT/mdW clusters. Shape key includes `colStart` so lg-L / lg-R alternation doesn't count as a run.

Empirical result on the current 33-item feed: longest same-shape run dropped from 11 to 2. The grid ends with mdW landscape cards instead of a sm cluster. Doc height halved (8938px → 5990px) because the lg tower's row-doubling is gone.

### Knobs left exposed

All five tunables live in [curation.ts](../lib/curation.ts) and can be dialed without restructuring:

| Knob | Default | Effect |
|---|---|---|
| `MAX_LG` | 3 | How many lg cards after the xl promotion |
| `TOP_KEEP` | 4 | Positions reserved for pure emphasis before sm injection |
| `K` | 1.5 | Sm gradient exponent — higher = more end-loaded |
| `MAX_RUN` | 2 | Max same-shape neighbors before run-breaker triggers |
| `MAX_PASSES` | 4 | Run-breaker iteration cap |

### What's NOT done

- **HP writer side still deferred.** All these changes operate on `currentHp = spawnHp × decay(age)` because every item still has `hp = NULL`. The only active HP lever is the `editorial: true` flag. Migration 0008's `apply_hp_rollup()` cron runs every 5 min but `hp_events` is empty — has been since the rollup landed. Per the `project_hp_writer_deferred` memory, don't pitch the writer side until ~20+ active users are generating signal.
- **`computePeakByType` is still observed-max,** not the spec'd rolling-90d p90. Doesn't matter while the feed is small; revisit when items grow past a few hundred.
- **`xl` doesn't get bespoke chrome.** The 3×2 cell renders with the same `LgCard` internals. If the feature slot needs a different presentation (larger title, secondary line, etc.), that's a [ContentCard] pass.

### Wiki updates

- [[HP Curation System]] §§ 8–10 rewritten to cover per-type md, rank caps, gradient weave.
- [[curation]] tunables + Ranking pipeline section reflect the new pipeline.

### Verification

Live-verified at 1440×900 in the preview:
- **Top of grid**: xl `GUIA DE USUARIO | GRADIENTE MX` full-width, lg-left `LA LOGÍA`, sm tiles fill col 3 next to it.
- **Mid-grid (y≈2500)**: 3 tall portrait md cards side-by-side over a wide landscape — peak mosaic moment.
- **Lower (y≈4000)**: lg-right `PIXAN / VA` anchored cols 2–3, mdW `IA MIX 998` also right-anchored. Emphasis on both sides.
- **Bottom (y≈5500)**: ends with `SUBCONSCIOUS / ESPECTRO MIX 010` mdW landscapes, not a sm cluster.

`npm run build` clean.

---

## 2026-05-07 · INGEST · header trim — MAGI removed, tighter nav, no horizontal overflow at MacBook widths

Beta-feedback fix: Iker reported that on a MacBook the page horizontally overflowed — DASHBOARD button vanished off the right edge, // SECCIÓN rail got cropped on the left, two-finger trackpad scrolling was the only way to reach the right side. Root cause: top nav row (logo + 9 links + 3 MAGI indicators + clock + DASHBOARD + SALIR) had ~1750px of intrinsic width, all `hidden md:flex`, with no responsive collapse below 2xl (1536px).

### MAGI indicators removed entirely
The CASPAR / BALTHASAR / MELCHIOR cluster in [Navigation.tsx](../components/Navigation.tsx) (the three EVA-themed status pills with green pulses) is gone. Pure NGE chrome, no function — the cheapest ~290px of header space recovered. Iker's call was "remove entirely" rather than just hide responsively, since the indicators were not load-bearing for the brand identity now that the rest of the EVA chrome (logo box, orange glows, scanline ticker) carries the aesthetic.

### Clock pushed to 2xl+ only
The `T+ 06:24:01 :00500` countdown timer in [Navigation.tsx](../components/Navigation.tsx) is wrapped in `hidden 2xl:flex` — visible only at 1536px+ where the layout has room. Below 2xl it disappears. Decorative; no information loss.

### Nav-link padding permanently tightened
`px-4` → `px-2.5` on the 9 nav links. Recovers ~135px across all 9. Tried `2xl:px-4` to keep the spacious look at desktop, but at 1600px (just above 2xl=1536), reintroducing the bigger padding clipped SALIR off the right by ~40px under the new `overflow-x: hidden` (silent clip, worst-case UX). Permanent tighter padding is the cleaner choice — internal whitespace, invisible difference at desktop.

### `overflow-x: hidden` on body
Safety net in [globals.css](../app/globals.css). Prevents any future rogue child component from producing a horizontal scrollbar. Has the side effect of silently clipping anything past the viewport edge — so any genuine overflow needs to be fixed at the source, not hidden by this.

### Verification
Live verified across viewport widths:

| Width | Model | DASHBOARD | SALIR | Page width |
|---|---|---|---|---|
| 1600 | Above 2xl | ✓ | ✓ | 1596 |
| 1512 | MBP 14" | ✓ | ✓ | 1508 |
| 1440 | MBA 13" M-series | ✓ | ✓ | 1436 |
| 1280 | Older Intel MBP 13" | ✗ clipped | ✗ clipped | 1389 |

Path 1 (this slice) covers all current Apple Silicon MacBooks. The 1280px floor still needs the path-2 redesign (hamburger nav drawer + horizontal SECCIÓN strip below VIBE) to fully resolve. Deferred per Iker — sufficient coverage of the common-case fleet.

### CategoryRail scrollbar hidden
At intermediate viewport widths the //SECCIÓN sidebar showed a vertical scrollbar when SECCIÓN + NowPlayingHud combined exceeded the available height (ViewSlider chips strip eats vertical space dynamically). Iker accepted that the overflow-scroll behavior must stay (don't redesign the rail), but asked to hide the scrollbar.

Applied the same cross-browser hide pattern already in use on [[VibeSlider]]'s chip strip — `[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`. Container stays scrollable via wheel/trackpad, just no visible bar. Verified: `scrollHeight 734 > clientHeight 531` (content overflows) but `visibleScrollbarPx: 0`.

### Stale wiki references (cleanup deferred)
[[NGE Aesthetic]], [[Voice and Copy]], [[Typography]], [[AuthBadge]], [[Navigation]] all reference the MAGI cluster spatially or as design vocabulary. Not blocking — those notes describe historic state and the AuthBadge spatial reference is moot now (it just sits next to the trimmed status block). Sweep on a future doc-pass.

---

## 2026-05-07 · INGEST · publish gate on body + EXCERPT char cap + punched-up empty state

Beta-feedback fix: writers were filling only the EXCERPT in 02 LEAD and missing the rich block editor in 05 CUERPO entirely, then publishing articles with empty bodies. Iker's diagnosis was right — "we have proper formatting elements but it's not clear to them" — but a publish gate alone is symptom-treating. Shipped three coordinated changes so the layout itself teaches where the body lives.

### Per-type CUERPO gate
Added a body-presence check to the existing `errors[]` validator in five long-form composers:
- **ArticuloForm** + **ListicleForm** — `if (blocks.length === 0) errors.push('CUERPO')`. Block editor at section 05.
- **EditorialForm** + **ReviewForm** + **OpinionForm** — `if (!draft.bodyPreview?.trim()) errors.push('CUERPO')`. Plain textarea at section 02 COPY.

Untouched: `noticia`, `evento`, `mix`, `partner` — those legitimately ship without a body field.

The footer's `⚠ FALTA: …` chip already concatenates errors with `·` so all three (TÍTULO · SLUG · CUERPO) surface together. Both `▣ GUARDAR DRAFT` and `▶ PUBLICAR` disable while errors are present.

### EXCERPT char cap (TextArea component)
Extended `TextArea` in [shared/Fields.tsx](../components/dashboard/forms/shared/Fields.tsx) with optional `maxLength` prop:
- Hard-caps input at the limit via the native `maxLength` attribute (browser stops accepting keystrokes past it).
- Renders a live `123/280` counter inline with the field label, tabular-nums for stable width.
- Counter goes orange (`#F97316`) at ≥90% of the limit.

All five long-form composers now pass `maxLength={280}` on EXCERPT plus a relabel (`EXCERPT · una o dos oraciones · el cuerpo va en 05` for blocks-based forms; `· el cuerpo va abajo` for the COPY-pair forms). The physical cap is the strongest possible hint without long copy.

### Punched-up CUERPO VACÍO empty state
Articulo + Listicle had subtle muted-grey "CUERPO VACÍO" panels that vanished into the page chrome. Repainted both:
- Border: `2px dashed` orange (was 1px dashed border-grey).
- Background: `rgba(249,115,22,0.06)` orange tint.
- Heading: `⚠ AÑADE EL CUERPO DEL ARTÍCULO AQUÍ` / `⚠ AÑADE EL CUERPO DE LA LISTA AQUÍ` — bold orange, `text-[12px]`, replaces the muted "CUERPO VACÍO" sys-label.
- Body copy explicitly contrasts with EXCERPT: "Tu texto principal va en bloques de PÁRRAFO, H2/H3, citas… — no en el EXCERPT de arriba."

The visual weight of the empty panel now exceeds that of the EXCERPT field, so a writer scrolling down lands on it instead of bouncing back up.

### Editorial/Review/Opinion BODY field also marked required
Added `required` prop to the BODY TextArea in all three so it gets the red-tinted border + `*` asterisk affordance even before the writer hits PUBLICAR.

### Verification
- Live verified `/dashboard?type=articulo` (logged in @iker, fresh draft): footer chip reads `⚠ FALTA: TÍTULO · SLUG · CUERPO`, empty-state CTA reads `⚠ AÑADE EL CUERPO DEL ARTÍCULO AQUÍ` in orange, EXCERPT counter shows `0/280`.
- Live verified `/dashboard?type=editorial`: footer chip identical, BODY field carries the required `*`, EXCERPT counter `0/280`.
- Skipped admin-side retroactive surface per Iker — existing already-published items with empty bodies stay untouched; the gate only blocks new publishes / re-publishes from the composer.

---

## 2026-05-07 · INGEST · composer VibeField rewrite + canonical slot names

Two interlocking fixes touching the dashboard composer's vibe range picker.

### Composer single-point auto-switch
- `VibeField` in [Fields.tsx](../components/dashboard/forms/shared/Fields.tsx) was the third surface still suffering the "can't slide left from a collapsed range" bug — slider header (fixed prior) and [[VibeFader]] (fixed 2026-05-05) had already gotten the auto-switch treatment, but the composer was still using two stacked native `<input type="range">` elements.
- Native ranges can't mid-drag-swap which input owns the pointer (the browser owns the drag once mousedown fires), so the small-surgical fix was off the table. Replaced both inputs with a custom pointer-driven track + two thumb buttons mirroring the [[VibeFader]] pattern: window pointermove listener, `draggingRef` mutation for the auto-switch, single-point detection via `curMin === curMax`.
- Added explicit keyboard nav (Arrow ±1, Home/End for 0/10) since the native `<input type="range">` keyboard support is gone with the inputs.
- Track click drags the nearer thumb from the click point (mirrors the header VibeSlider).
- Verified live in `/admin?tab=partners`: starting at single-point=5, grabbing the max thumb and dragging left moves min from 5 → 2 (max stays at 5). Symmetric: starting at single-point=7, grabbing min and dragging right moves max from 7 → 9.
- Dropped `.vibe-range-thumb` CSS block in [globals.css](../app/globals.css) — no remaining consumers.

### Canonical 11-name slot set
- Iker flagged that the composer's vibe label said GLACIAL twice for slots 0 and 1, vs the slider's distinct GLACIAL/POLAR. Root cause: two parallel naming schemes. `vibeToLabel` in [utils.ts](../lib/utils.ts) returned only 8 names spanning ranges (0-1 → GLACIAL, 8-9 → FUEGO), while the header [[VibeSlider]] kept its own 11-name `Record<number, string>` inline. Wiki documented the split as deliberate ("different granularities for different UIs"), but in practice the composer reading the 8-name set looked broken next to the slider.
- Unified on the slider's 11-name set as the single source of truth. `VIBE_SLOT_NAMES` now exported from [utils.ts](../lib/utils.ts); `vibeToLabel(v)` is `VIBE_SLOT_NAMES[round(v)]`. [VibeSlider.tsx](../components/VibeSlider.tsx) drops its local copy and imports from utils.
- Side effect: every overlay's vibe chip now reads from the 11-name set too via `vibeRangeLabel`. E.g. an item authored at 4-7 used to show `4-7 · COOL → HOT`; now shows `4-7 · FRESH → HOT`. Cosmetic ripple, intentional consistency.
- Verified live: composer at single-point=5 reads `5 · GROOVE` (was `5 · NEUTRAL`); range 7-9 reads `7 HOT → 9 BRASA` (was `7 HOT → 9 FUEGO`).

### Wiki updates
- [[Vibe Spectrum]] · [[utils]] notes that documented the 8-vs-11 split as deliberate now describe the single canonical source.

---

## 2026-05-07 · INGEST · publish-flow restructure + dashboard ConfirmOverlay + content-rendering polish

Beta-tester feedback session. Six interlocking slices, mostly UX-and-rendering polish driven by collaborator reports. All in the working tree, going up as one commit.

### 1 — Pinned hero never opened its overlay

Reported by datavismo: clicking the `// EN PORTADA` hero changed the URL to `?item=<slug>` but no overlay mounted. Cause: the hero is excluded from the home `gridItems` so it never enters [[ContentGrid]]'s `recordItems` cache. The [[OverlayRouter]]'s slug resolver looks up via drafts → cache → mockData; with the hero missing from cache, the lookup returns null and the overlay silently no-ops. Fix: [HeroCard.tsx:46](../components/HeroCard.tsx) calls `recordItems([item])` on mount. Same defensive pattern as ContentGrid; the bug likely also bites `EventosRail` cards for rail-only events but unreported so left untouched.

### 2 — Reader/article paragraph splits

Two collaborator reports about content rendering as one wall of text:

- **stephan-mathieu-radioland (review)** — body had `\n\n` separators but [[ReaderOverlay]] split on `\n\n` only; paragraph breaks the writer typed as single Enter (just `\n`) collapsed. Unrelated to the original report, but the bigger issue is that **the review composer doesn't have block features at all** — it only has a plain BODY textarea writing to `bodyPreview`. Reviews/editorials/opinions/noticias all use [[ReaderOverlay]] which only reads `bodyPreview`. No markdown parsing. The reviewer either composed in another tool and pasted, or expected H2/Q&A/QUOTE blocks that don't exist for this type. Documented in conversation; no feature add.
- **entrevista-con-stephen-hitchell-echospace-intrusion (articulo)** — `articulo` does have block features ([[ArticuloForm]] with H2/H3/QUOTE/Q&A/IMAGE/LIST/footnotes), but the writer pasted the entire 13KB interview into a **single PÁRRAFO block** with `\n` separators. [[ArticuloOverlay]]'s `BodyBlocks` rendered each block as one `<p>`; HTML collapsed `\n` whitespace, producing one massive paragraph.

Both fixed with a defensive split. Touched [BodyBlocks](../components/overlay/ArticuloOverlay.tsx) for `lede` and `p` block kinds, and the legacy paragraph fallback in `buildBlocks` for both [[ArticuloOverlay]] and [[ListicleOverlay]]. Also [[ReaderOverlay]] for `bodyPreview` and [[HeroCard]] preview. New helper `splitParagraphs(text)` in `ArticuloOverlay.tsx` splits on `/\n+/`. Track-block commentaries in listicles also got the multi-paragraph treatment. Collaborator who pastes prose into one block now sees it render as multiple paragraphs.

### 3 — Image cropping favors the top

Reported pattern: card images were cropped to centre, so flyer headers (artist names, festival logos) and album cover titles got sliced. Added `object-top` next to every public-facing `object-cover` so cropping shaves the bottom instead of the centre. Touched: [[ContentCard]], [[HeroCard]], [[EventosRail]], [[PartnersRail]], [[ThreadTile]], [[MarketplaceCard]], [[MarketplaceListingCard]], [[ArticuloOverlay]] hero, [[EventoOverlay]] hero, [[ListicleOverlay]] hero, [[ReaderOverlay]] archival flyer, [[GenericOverlay]] hero. Skipped square album thumbnails (no cropping) and dashboard internals (low priority).

### 4 — Dashboard explorer ConfirmOverlay (replaces ExplorerDetails)

Beta testers couldn't find the right-side `USAR ESTA PLANTILLA` button under `?section=nuevo`. Tried two options visually before settling:

1. **First** ("option 2" in the conversation): tried making the existing `USAR ESTA PLANTILLA` button huge + persistent, plus a per-card `[+ USAR]` chip. Iker rejected — too many affordances, didn't feel right.
2. **Second** ("option 1" pivot): replaced the entire right-side DETALLES rail with an overlay that pops on tile click. Visual chrome borrowed from [[OverlayShell]] (CRT boot animation, NGE border, hazard-stripe accent above CTA, ESC/X/backdrop close, phosphor flash on mount). Lives in dashboard scope — doesn't touch [[useOverlay]] / [[OverlayRouter]] / URL state.

New component: [ConfirmOverlay.tsx](../components/dashboard/explorer/ConfirmOverlay.tsx). Takes `header`, `selection: SelectionMeta`, `ctaLabel`. Used for both the `?section=nuevo` template picker (header `// SELECCIONANDO PLANTILLA · MIX`, CTA `USAR ESTA PLANTILLA`) and the drafts/publicados sections (header `// ABRIENDO BORRADOR` or `// ABRIENDO PUBLICACIÓN`, CTA `ABRIR EN EDITOR`).

Knock-on changes:
- [[ExplorerShell]] reduced from 3 columns to 2 — removed `selection`, `detailsCta`, `hideDetails` props and the right-rail render. ~280px more horizontal space everywhere.
- [[NuevoSection]] dropped its `selectedType` prop + corner-bracket selection state; cards are pure single-click triggers now.
- [[DraggableFileGrid]] (drafts/publicados) reworked: pointer-down-without-drag triggers `onOpen` (via the pointer-up handler checking `draggingPosRef.current === null`); drag still moves the tile. Old `onSelect` + `selectedId` props removed. Tile no longer has a "selected" visual state.
- [[Dashboard]] page replaced `selectedTplType` + `selectedDraftId` state with a single discriminated `confirming: { kind: 'tpl', type } | { kind: 'draft', id } | null`. Helper `confirmOverlayContentFor` resolves it to overlay props.
- Exit animation added to the ConfirmOverlay matching [[OverlayShell]]'s pattern: internal `exiting` state + `pendingRef` tracking close-vs-confirm; on `overlay-backdrop-out` `animationend` we call the right callback.

### 5 — Publish flow restructure (the big one)

Iker's redesign of the three-state model. Beta testers kept refreshing after composing and not understanding why their content wasn't on the feed — the pending state was visually present (glitching card at curation rank) but easily missed amid real content, especially for someone who hadn't been told to look for it.

**New flow:** clicking `▶ PUBLICAR` in any dashboard composer opens [[PublishConfirmOverlay]] **inside the dashboard** — no navigation. Confirming publishes the row directly + pushes to `/?fresh=<id>`. The home page reads the param, scrolls the matching card into view (double-scroll: 120ms + 800ms to handle lazy-image layout shift), then `replaceState`s the param off the URL. See [[Publish Confirmation Flow]] for the rewrite.

**Fresh-published chrome:** any editor-composed item (`source !== 'scraper:ra'`) within 1 hour of `publishedAt` wears the glitch chrome on its [[ContentCard]] — type-colored border pulse, scanline, cover flicker, and a `[NUEVO]` chip. Color is the type's `categoryColor` passed via a per-card `--glitch-color` CSS variable. CSS keyframes renamed `pending-*` → `fresh-*` and rewritten to use the variable via `color-mix(in srgb, var(--glitch-color) X%, transparent)`. Per-card `setTimeout` flips fresh→stale at exactly the 1-hour mark — one shot, no `setInterval` polling. Editor-composed only so the RA Mon/Wed/Fri scrape batches don't all glitch at once.

**Form changes:** all 8 dashboard forms ([[ArticuloForm]] / [[EditorialForm]] / [[EventoForm]] / [[ListicleForm]] / [[MixForm]] / [[NoticiaForm]] / [[OpinionForm]] / [[ReviewForm]]) now `openConfirm(id)` instead of `router.push('/?pending=<id>')`.

**[[PublishConfirmOverlay]] changes:** removed the `[PROTOTIPO VISUAL]` paragraph (we have a backend now), removed the `?pending` URL clearing (no longer present), `router.push('/?fresh=<id>')` after successful publish.

**Pending pipeline retired:** [[HomeFeedWithDrafts]] no longer reads `?pending` or stamps `_pendingConfirm`; just merges `published` drafts into the feed. [[ContentCard]] dropped `_pendingConfirm` chrome, the `[✓ CONFIRMAR]` corner button, the auto-scroll-on-pending. `_pendingConfirm` field still exists on the `ContentItem` type but is unused by any renderer.

**Scanline traversal fix:** the original `pending-scanline-sweep` keyframe used `transform: translateY(percentage)` which is element-relative; with element height 18%, `translateY(130%)` only moved 23% of parent height. Switched to animating `top: -25% → 110%` (parent-relative). Sampled in the preview: line now traverses -13% → 102% of card height, full sweep confirmed.

### 6 — Image hosts allowlist

While testing, hit `next/image` errors on Substack-CDN and other third-party image URLs that beta testers pasted as `imageUrl`. Added `substackcdn.com`, `is1-ssl.mzstatic.com` (Apple Music covers seen in the jazz-espiritual listicle), and `i.discogs.com` to [next.config.mjs](../next.config.mjs) `images.remotePatterns`. Required dev-server restart since Next reads config at boot only.

### Decisions logged

- **Three-state model retired in favor of two-state.** Confirmation gate moves from "after navigation, on the public feed" to "in place, on the dashboard". Same affordance, much more discoverable. Pending was a clever architectural idea (no new storage state, just a URL flag) but the UX consistently confused beta testers.
- **Fresh chrome is editor-composed only.** Scraped events excluded by `source === 'scraper:ra'`. Seed data falls out naturally via stale `publishedAt`. Reasoning: editors should see their content land, but a Mon/Wed/Fri scrape batch shouldn't paint the whole feed orange.
- **DETALLES rail removed site-wide.** Was useful as a Windows-Explorer flourish but became dead weight once tiles became single-click triggers. The two-column layout reads cleaner.
- **One review-composer feature gap NOT closed.** datavismo expected block features in the review composer; we don't have them and intentionally won't add them — [[Reader Terminal Layout]] keeps reviews/editorials/opinions/noticias as prose-only by design. Pieces that need structure (interview, listicle) belong in `articulo`/`listicle`. Communicated to datavismo in conversation.

### Verification

- **Hero overlay**: clicked `200 grandes festivales europeos` hero → URL updates + overlay mounts (was no-op before).
- **Articulo paragraph split**: `entrevista-con-stephen-hitchell` overlay now renders 79 paragraph elements where there was 1 wall-of-text. First 10 sampled: distinct lines including the embedded pull quote.
- **Image cropping**: 12 sampled images on home all have `object-position: 50% 0%` — top-anchored.
- **ConfirmOverlay**: clicking LISTA card pops overlay with `// SELECCIONANDO PLANTILLA · LISTA` header + property table + `USAR ESTA PLANTILLA` CTA. ESC closes via the exit animation (`overlay-backdrop-out` + `overlay-panel-out` classes flip; on `animationend` overlay unmounts and body-scroll is restored).
- **Publish flow**: filled noticia form, clicked `▶ PUBLICAR` → URL stayed at `/dashboard?type=noticia` and `[role=alertdialog]` modal opened with `¿PUBLICAR EN EL FEED?` title + new (sans-PROTOTIPO-VISUAL) body copy.
- **Fresh chrome**: forced via DOM injection on a feed card with `--glitch-color: #3b82f6`. Border pulse + cover flicker + [NUEVO] chip render correctly. Scanline sampled at 6 timepoints over 2.4s: top% goes -12.9 → 10.3 → 32.8 → 56.0 → 79.2 → 101.7 — full traversal.
- **Dev server compiled cleanly after each batch of edits**, no console errors at home or dashboard. End-to-end publish round-trip (real DB write → fresh chrome on real card) NOT exercised — requires real auth + the typed-confirmation flow.

### 7 — CRT shader retune (commit a194e6a)

Beta-tester report: tube-edge curvature read as a milky border ring rather than CRT shape, and the grain/flicker texture vibrated enough to feel busy. Iterated a few values:

- **Rounded-rect tube simulation removed.** `float tube = 0.0` — the SDF + smoothstep that darkened past the rectangle is gone. `u_vignetteStrength` uniform stays plumbed for a softer revisit later. The visible CRT chrome is now just scanlines + grain + flicker + rolling bar.
- **Scanline period widened 2 → 4 physical px.** Retina DPR=2 was smearing 2-px lines into a flat tint. 4-px period (1 dark row of 4, 25% duty cycle) gives crisp lines that text reads through.
- **Scanline intensity** tuned 0.55 → 0.75 → 0.55. Final value reads cleanly without obscuring body type ascenders.
- **noiseIntensity** 0.10 → 0.04 and **flickerIntensity** 0.04 → 0.015 so the texture is ambient chrome rather than visual noise.
- **Grain quantization** 24Hz → 12Hz for a calmer per-second pulse.

### 8 — CalendarSidebar removed (commit 1bf80a0)

Iker's call: the slide-in calendar tab on the left of Home + Agenda was redundant with the date-forward Agenda sort + the [[EventosRail]] marquee. Beta testers ignored it. Stripping it lets the page breathe and removes ~180 lines of state + filter wiring.

- Component + wiki page deleted.
- Mounts removed from [[Home]] + [[Agenda]] pages.
- [[VibeContext]] dropped `selectedDate` / `setSelectedDate` / `calendarOpen` / `toggleCalendar`.
- [[ContentGrid]] + [[ContentFeed]] dropped the `selectedDate` "pin matching dates to top" branch (and the no-longer-used `isSameDay` import).
- `lib/utils.ts` dropped the orphaned `getEventDates` helper.
- Wiki references swept across 11 files: [[Home]], [[Agenda]], [[VibeContext]], [[ContentGrid]], [[ContentFeed]], [[CategoryRail]], [[utils]], [[Folder Structure]], [[App Router Patterns]], [[Data Flow]], [[CRT Scanline Sweep]], [[Gamification]] — the last two were passing references in roadmap docs.

### 9 — Event date label readability (commit 1bf80a0)

Beta-tester report: month + day-of-week (e.g. MAY / JUE) in the date block were `text-muted` while the day number was `text-white font-black` — barely visible. Bumped to `text-white font-bold` across all five surfaces that render this block: ContentCard SM + LG, [[EventCard]] (linear), [[EventoOverlay]], [[EventosRail]].

### Open

- The `_pendingConfirm` field on `ContentItem` and its defensive strip in `Fields.tsx:1140` are now dead code. Cleanup pass in a follow-up.
- [[ContentCard]].md and [[HomeFeedWithDrafts]].md component pages still describe the old pending flow. Backfill when next touching them.
- [[EventosRail]] cards for rail-only events likely have the same "missing from itemsCache" bug as the hero originally did, since rail-only events are excluded from `gridItems`. Unreported so far; defer.
- The fresh-chrome timer is purely client-side — server-rendered cards may briefly mismatch the client computation at the 1hr boundary. Acceptable jitter for now.
- `u_vignetteStrength` uniform on the CRT shader is plumbed but unused after the tube removal. If we revisit a softer radial vignette, that's where it'd hook back in.

---

## 2026-05-05 · INGEST · welcome gate + delete arc + rail/publish polish

Six interlocking slices shipped late-day, all driven by Iker's beta-prep agenda. Pushed across five commits on `main`: `d116bdf`, `7444f85`, `f482a80`, `07cad6e`, `fa65041`. The welcome-gate slice (this session's biggest piece) is in the working tree as a sixth commit, going up next.

### Welcome gate — the site is now invite-only

Anonymous visitors no longer see the home feed. They land on a NGE-themed terminal cockpit at `/welcome` with two CTAs that summon the existing `LoginOverlay` in the right initial mode.

- Middleware: [`lib/supabase/middleware.ts`](../lib/supabase/middleware.ts) gained an auth-gating step after `getUser()`. Anon page request → 302 to `/welcome`. Authed request to `/welcome` → 302 to `/`. API routes pass through (each handler self-401s; redirecting JSON consumers to HTML would corrupt their response).
- RLS migration: [`0014_auth_gated_reads.sql`](../supabase/migrations/0014_auth_gated_reads.sql) drops the `published = true and seed = false` `*_public_read` policies on `items`, `comments`, `foro_threads`, `foro_replies` and replaces with `auth.uid() is not null and published = true`. Two effects: anonymous reads return zero rows even if the middleware misses (defense in depth), and **authenticated beta testers now see seeded mockdata alongside real content** so the page feels populated before they've contributed anything. Reactions/polls/poll_votes left as `using (true)` — they're JOIN attachments that can't surface without their parent. `*_staff_read` policies stay in place; they cover draft visibility for staff (still needed).
- Welcome page: [`app/welcome/page.tsx`](../app/welcome/page.tsx) is a single client component. Full-bleed cockpit with a top status strip, left identity column + `ACTIVIDAD RECIENTE` panel, big `GRADIENTE` glitch wordmark, ASCII vinyl renderer in the center (perspective tilt + concentric grooves + top-down ambient + rim sparkle, 30fps cap), right column with `ESTADÍSTICAS DEL ARCHIVO` / `FRECUENCIA PORTADORA` / `SINCRONIZACIÓN`, two CTAs (`INICIAR SESIÓN` → login mode, `INSERTAR CÓDIGO` → signup mode), and a footer strip with `LOGS DEL SISTEMA`, `MENSAJE DEL OPERADOR`, animated spectrum waveform (`SpectrumAscii`, 90×4 block-glyph histogram), and `CANAL DE SALIDA`. Vinyl + spectrum both honor `prefers-reduced-motion` (single static frame).
- Atmosphere panels are corner-bracketed annotations rather than UI cards — `Brackets` component drops 4 orange `L`-shaped 3×3 spans, no border + no fill, content floats on the dark surface. Matches the cockpit feel of the reference mock.
- ChromeFrame: [`components/ChromeFrame.tsx`](../components/ChromeFrame.tsx) is a tiny `'use client'` wrapper that hides Navigation / VibeSlider / footer when `usePathname() === '/welcome'`. Avoids refactoring app/layout into a route group.
- LoginOverlay extension: `useAuth` now exposes `openLogin(mode?: 'login' | 'signup')` + `loginInitialMode`. Welcome's two CTAs route to the right initial tab so the user lands directly in the flow they picked.

### Delete arc — owner + admin hard-delete on items

`fa65041 feat(items): owner + admin hard-delete with typed confirmation`. Two surfaces, same convention as the partner-delete flow.

- Migration [`0013_items_delete_policies.sql`](../supabase/migrations/0013_items_delete_policies.sql) splits `items_staff_write` (which was `for all`) into explicit `items_staff_insert` + `items_staff_update`, then adds `items_owner_delete` (`created_by = auth.uid()`) + `items_admin_delete` (`auth_is_admin()`). Multiple permissive policies OR — owner-or-admin can delete, everyone else 0 rows.
- API: [`/api/items/[id]` DELETE](../app/api/items/[id]/route.ts). Auth-checks, runs `.delete().select('id')`, disambiguates 0-rows-affected into 404 vs 403 with a follow-up existence probe.
- "Publicados" surface (owner): tiny `×` corner button on each `DraggableFileGrid` tile when the parent passes `onDelete`. The dashboard wires `onDeletePublished` only for the `publicados` namespace.
- Overlay (admin): `ELIMINAR` action in `OverlayShell` header chrome, gated on `canAssignRoles(currentUser)` and hidden for session-only items (those still use the existing `SessionItemStrip`).
- Both surfaces use `typeToConfirm` with `BORRAR <title>` matching the partner-delete convention at [AdminPartnersComposer.tsx:271](../components/admin/AdminPartnersComposer.tsx).
- State sync: `publishedItemsCache` gained `removePublishedItemLocal(id)` + `useMyPublishedItems` subscribes to cache changes so optimistic eviction shows up in the dashboard before the refetch lands.

### Rail / mosaic placement — one rule for all eventos

Two commits, same arc:

1. `7444f85 feat(home): unify rail predicate — all eventos default to rail`. Dropped the `source === 'scraper:ra'` gate. Editor-authored events from venue partners (e.g. Club Japan, which announces through Instagram only) are listings, not curation — same shape as the RA firehose. They earn rail visibility for the same reason RA events do.
2. `07cad6e fix(home): editorial eventos appear in rail and mosaic`. The first version made the predicate mutually-exclusive (editorial=true → mosaic only). Iker's intent was additive — editor wants the event in the marquee AND in the curated grid. Final placement matrix on [`app/page.tsx:36`](../app/page.tsx):
    | | `elevated=false` | `elevated=true` |
    |---|---|---|
    | `editorial=false` | rail only | mosaic only |
    | `editorial=true` | **rail + mosaic** | mosaic only |
    `editorial` boosts spawn HP and promotes into the mosaic; `elevated` is placement-only.

### Publish-flow fixes

Two small bugs caught during Iker's first manual evento publish (the JUEVES DE JAPAN case):

1. `d116bdf fix(publish): coerce empty timestamp strings to null in row mapper`. `<input type="datetime-local">` returns `''` when blank, and the `??` fallback in `contentItemToRow` only catches null/undefined. Empty strings flowed through to Postgres → `invalid input syntax for type timestamp with time zone: ""`. Tiny `tsOrNull` helper applied to every optional timestamp column. Triple symptom: publish 500s, the optimistic draft eviction in `PublishConfirmOverlay` makes the draft appear to vanish entirely, and there's no UI feedback. Fix is single-mapper.
2. `f482a80 fix(publish): wipe per-type composer sessionStorage after publish`. After a successful publish the composer's autosave key (`gradiente:dashboard:<type>-draft`) was still hydrating into the form on next "new <type>" navigation, so opening the evento composer to draft a second event showed the previous one's title/dates/venue. Now: on success, drop the matching key. Targeted by `payload.type` so other in-progress composer drafts of unrelated types are preserved.

### Decisions logged

- **Beta posture flip**: pre-today, anonymous visitors saw real (non-seeded) published items so admins could see how a populated site would look. Decided this is wrong for beta — beta testers should also experience the populated feel, not be the source of all population. Hence the `auth.uid() is not null` gate (gives them seed visibility) plus the welcome wall (gives the site invite-only chrome).
- **`pretext` library**: Iker asked about [chenglou/pretext](https://github.com/chenglou/pretext) for the ASCII vinyl. Investigated — it's a text-measurement library (canvas font metrics, paragraph layout without DOM). Doesn't help with ASCII art / shaders / animated rendering. Math stays in `VinylAscii` / `SpectrumAscii`.

### Verification

- **Anon redirect**: fetch `/`, `/agenda` (deep link), `/welcome` with `credentials: 'omit'` → all final-URL into `/welcome`. `/welcome` itself returns 200, no redirect loop.
- **CTA → mode mapping**: clicking `INICIAR SESIÓN` opens overlay with `login·terminal` marker visible; `INSERTAR CÓDIGO` opens with `signup·terminal` marker. Both verified via DOM probe.
- **Vinyl renders**: 150×64 grid, mid-disc sample row at 1280px desktop reads `:::  +++  ***  ##  @@@@@@@@@@  @@·@@·@·@·@@@@  ##  *  ++  +++  :::` — distinct grooves, top-lit gradient, label legible.
- **Delete API**: `DELETE /api/items/nonexistent-id` returns `401 Unauthorized` without auth (route + handler exist). Full delete flow not exercised end-to-end via UI from Claude side (no admin password).
- **Migration applied**: Iker confirmed `supabase db push` for both 0013 and 0014 prior to code push.

### Open

- **Welcome polish** — Iker flagged the vinyl still doesn't quite match the reference. Levers: drop `GROOVE_PITCH` to 0.4 (more rings), bump `TILT_Y` to 0.36 (more squash), harden ambient to `cos⁶`. Also: the panels could use even tighter chrome and the CTAs scale further on small screens.
- **Guest mode** — the welcome reference originally had a third `ENTRAR COMO INVITADO` CTA. We deferred it; the current middleware + RLS architecture is hard-gated, and a real guest mode is a separate slice (new role, RLS exceptions, write-action gates).
- **Form `elevated` toggle** — the dashboard composer doesn't expose `elevated`. With the new placement model, an editor who wants an event in mosaic-only has to flip the column via Studio. Worth wiring as a small dashboard tweak.
- **`*_staff_read` redundancy** — after 0014, any authed user already sees published items, so `items_staff_read` is only meaningful for drafts (`published = false`). The other `*_staff_read` policies on comments / foro tables are now strictly redundant. Harmless but worth a follow-up cleanup migration.

---

## 2026-05-05 · INGEST · vibe arc — checks + fader UX + multi-genre filter + taxonomy migration

Five interlocking slices that together land the [[Vibe Philosophy]] model. Shipped as one big push (commit `e7db9fe`) because the changes were tangled across the same files.

### Vibe Checks (new feature)
- Schema: [`0011_vibe_checks.sql`](../supabase/migrations/0011_vibe_checks.sql) — table `(item_id text, user_id uuid, vibe_min/max smallint)`, PK `(item_id, user_id)`, RLS read-all + self-write, realtime on the table. Plus `vibe_check_aggregates` view (median min + median max + count). Follow-up [`0012_vibe_checks_security.sql`](../supabase/migrations/0012_vibe_checks_security.sql) cleared the security_invoker view + mutable-search_path lints.
- Cache + hooks: [[vibeChecks]] mirrors [[polls]]'s shape — module cache, listener Set, optimistic write, per-item realtime channel.
- API: `PUT /api/vibe-checks/[itemId]` upsert + `DELETE` revoke. Range-validated server-side.
- Display fall-through: at `checkCount >= 5`, the displayed band switches from author's `[vibeMin, vibeMax]` to crowd median. Affects both [[VibeFader]] visual and `filterByVibe` *eligibility* — vibe checks change what shows in the home grid, not just chrome (decided 2026-05-05).
- Joined into [[mockData|getItems()]] / `getItemBySlug()` so items expose `vibeCheckCount` / `vibeCheckMedianMin` / `vibeCheckMedianMax`.
- Threshold = 5, median over mean (outlier resistance).

### VibeFader (new component)
- Replaces the static `swatch + vibeRangeLabel` row in all six overlays ([[ReaderOverlay]], [[EventoOverlay]], [[MixOverlay]], [[ArticuloOverlay]], [[ListicleOverlay]], [[GenericOverlay]]).
- Five visual layers: faint full-axis backdrop, lit displayed band, user-vote ghost (25%/60%/100% by interaction), thumbs (white view / gold edit), persistent author tick anchors.
- Drag-to-set commits. Login-gated. Single-point auto-switch fix so leftward drags work from a collapsed range.
- Layout-shift hardening: `min-w` on label + count slots (so the meta strip's `ml-auto` doesn't shift on label content swap).

### VibeSlider chip strip (full rework)
- `genreFilter` migrated `string | null` → `string[]` in [[VibeContext]]. New helpers `toggleGenre`, `clearGenres`.
- Chip strip is now multi-select toggle badges; clicking adds/removes from the active set.
- **Visibility tied to range state** (not drag/hover): `chipsVisible = !isFullRange || pinned || activeIds.length > 0`. Hidden at full range with no filters; appears as soon as the user narrows.
- **Chip strip is feed-driven**: chip universe = `roots ∪ visibleGenres ∪ active filters`. `visibleGenres` pushed by [[ContentGrid]] (the union of vibe-filtered items' genres), consumed by [[VibeSlider]]. This is [[Vibe Philosophy]] idea 2 made concrete — chip strip mirrors feed reality, not `GENRE_VIBE` stereotype.
- Per-chip in-feed test rolls up via `getRollup` so root chips light up when any descendant leaf is in the feed.
- Smooth `transition-all duration-200` per chip (opacity + max-width + margin) — visible chips cluster tightly because hidden ones collapse `max-w` *and* `margin` together.
- Stable strip height (169px) across full → narrow → reset cycles. RESET button uses `invisible` instead of conditional unmount; `min-h-[3.5rem]` reserves chip-strip space.

### Genre taxonomy migration (Option B: leaves with parents)
- Replaced ~38-genre flat catalog with the 18-root + ~175-leaf Gradiente taxonomy from `generos.txt` (curator-authored). See [[genres]].
- Cross-listed leaves carry multiple parents (e.g. "Industrial Dub" → `[techno, dub-reggae, industrial-ebm]`).
- 47 legacy ids preserved with `legacy: true` and parented to their closest taxonomy root, so existing DB rows stay resolvable + filterable via parent rollup.
- New helpers: `getRootGenres`, `getDirectChildren`, `getRollup`, `itemMatchesGenreFilter`. The `Genre` type dropped the 4-bucket `category` enum, added `parents: string[]`.
- Transversal tag catalog expanded with curator-authored qualities (Greyscale, Ritual, Maximalista, Soundsystem, Diaspórico, etc.) — separate from genres because they cross genre lines.
- Dashboard composer's [GenreFieldset](../components/dashboard/forms/shared/Fields.tsx) hides legacy entries; both copies (Fields.tsx + MixForm.tsx duplicate) updated.
- [[ContentGrid]] genre filter now uses `itemMatchesGenreFilter` for rollup matching: filtering by `Techno` matches any item tagged with `techno-hard`, `techno-raw`, `techno-dub`, etc.
- Foro untouched — `genresIntersectVibeRange` still uses `GENRE_VIBE` (expanded with rough placements for new ids); fall-through semantics keep new genres visible.

### Vibe Philosophy (new doc — the spine)
- Codified the four ideas Iker laid out: (1) two-axis system, (2) genre alone is a lie, (3) system learns context, (4) grading is the engagement primitive. See [[Vibe Philosophy]].
- These rule out auto-derived vibes, genre-vibe substitution, one-tap vibe checks, and personalized feeds.
- Clarified: friction in the fader (drag-to-set vs tap-to-agree) is the design, not a defect.

### Verification
- Live verified vibe checks round-trip end-to-end on multiple items (PUT 200s in dev logs across review/listicle/articulo/mix items).
- Chip strip feed-driven behavior verified: at narrow `[0, 4]`, `Techno` parent + `techno-raw` leaf both light up because of items like `FASCINOMA 006 MIX: Itzvan` (vibe `[3, 7]`, genres include `techno-raw`).
- Layout-shift hardening verified: strip total = 169px through full → narrow → reset cycle (delta = 0).
- Composer picker verified: 193 chips visible (legacy hidden), search filters work, 13 results for "techno" query.

### Deferred / open
- **Composer prior** ([[Vibe Philosophy]] idea 3) — at compose time, pre-fill `vibeMin/vibeMax` from author/venue/genre history. Not built.
- **Visual cue when crowd diverges sharply from author** — currently it's just the gap between ghost and lit band. Defer.
- **`GENRE_VIBE` deprecation** — replace foro's `genresIntersectVibeRange` with a real per-thread vibe so the stereotype map can finally die. Defer until foro grows.
- **Hierarchy-aware composer picker** — flat search-with-filter works but a collapsible parent → children view would be cleaner. Out of scope for migration slice.
- **Duplicate `GenreFieldset` in [MixForm.tsx](../components/dashboard/forms/MixForm.tsx) vs [Fields.tsx](../components/dashboard/forms/shared/Fields.tsx)** — pre-existing smell; both updated for the legacy filter, but worth dedup later.

---

## 2026-05-05 · INGEST · partnerOverrides cleanup — file deleted

Closing slice on the partners arc. The two remaining `useResolvedPartner` callsites were migrated off the sessionStorage overlay; `lib/partnerOverrides.ts` deleted entirely.

### Shipped
1. **MarketplaceOverlay** — dropped its slug→id resolver (`useResolvedPartnerBySlug` + the `MOCK_ITEMS.find` lookup) and the `useResolvedPartner` hook. Now accepts `partner: ContentItem | null` as a prop. The catalog already had the resolved partner in its server-fetched `partners` array (with `marketplace_listings(*)` joined since migration 0010), so the lookup just lifts up to `MarketplaceCatalog`: `sorted.find((p) => p.slug === partnerSlug) ?? null`. No new fetches, no new infrastructure.
2. **ExplorerSidebar** — replaced `useResolvedPartner(partnerId)` with a small inline `useMyPartnerTitle` hook that does a one-shot fetch against the existing `/api/partners/[id]` GET (gated on canManagePartner, which the team-member user passes). Returns `string | null`. The sidebar only needed `myPartner.title` and a truthy check, so no need for a partner-shape return.
3. **`lib/partnerOverrides.ts` deleted.** No remaining importers (verified by grep). Stale comments referencing it cleaned up in `MiPartnerSection.tsx` and `PartnerApprovalsSection.tsx`.

### Verification
- Live verified `/marketplace` overlay against melodykrafter (real DB partner): URL `?partner=melodykrafter` mounts overlay, heading reads "MELODYKRAFTER", description / stats panel / location / currency / //SIN·LISTINGS empty state all render from the lifted-down prop.
- Dashboard returns 200 + ExplorerSidebar compiles cleanly. Live verification of the //Mi partner row label deferred to next login (auth gate).

### Edge case noted
Deep-link `/marketplace?partner=<slug>` for a *disabled* partner now shows the "PARTNER·NO·ENCONTRADO" panel instead of the prior "MARKETPLACE·INACTIVO" panel. No UI surface produces such a link (catalog only renders enabled partners), so accepted as a regression.

### Stale infra still in place
- `lib/userOverrides.ts` — read-side `useResolvedUser` is still used across foro / comments / dashboard surfaces; the write-side `setUserOverride` still has 1 caller flagged in older comments. Separate cleanup, not in this slice.
- PostgREST schema cache for `marketplace_listings(*)` join was intermittently failing at server startup with PGRST200 (FK not found), then recovering. Visible in dev logs but doesn't block traffic — likely needs a `NOTIFY pgrst, 'reload schema'` if it persists in prod.

---

## 2026-05-05 · INGEST · Listings persistence + PartnerApprovalsSection cleanup

Tail end of the partners arc. Partners arc closed out at 9 commits the day before; this session added the two follow-ups flagged in Next Session: PartnerApprovalsSection migration + listings persistence.

### Shipped
1. **`eafdb7a feat(dashboard): PartnerApprovalsSection on real DB endpoints`** — last sessionStorage holdout. Was using `useResolvedPartners` + `setMarketplaceEnabled` from `lib/partnerOverrides` (MOCK_ITEMS overlay). Now fetches via new GET `/api/admin/partners` (admin-only; returns id/slug/title/partner_kind/image/marketplace_enabled/listings) + PATCHes `marketplace_enabled` via the existing `/api/admin/partners/[id]`. Refetches after each toggle. After this commit, `partnerOverrides` write-side functions are effectively dead — only imported from MiPartnerSection's listings code path which the next commit replaces.

2. **`075f2c3 feat(marketplace): listings persistence — separate table + full CRUD endpoints`** — schema decision: separate `marketplace_listings` table over jsonb-on-items. Reasoning: per-listing CRUD on a jsonb array isn't race-safe (two team members editing rewrite each other), RLS can't gate per listing, and orphan-image cleanup gets simpler with a real listing→FK target.
   - **Migration 0010** creates the table (text id, partner_id FK CASCADE, title/category/condition/status with CHECK constraints, price, description, tags text[], shipping_mode, images text[], embeds jsonb, published_at, updated_at). Indexes on (partner_id, published_at desc) for the catalog read path + status. RLS: anon SELECT, INSERT/UPDATE/DELETE gated to admin OR `users.partner_id = listing.partner_id`. Migration data: copied existing items.marketplace_listings jsonb arrays into rows (NAAFI's 6 listings; real partners had 0), then dropped the legacy column. updated_at auto-bump via existing `set_updated_at` trigger.
   - **API**: POST `/api/partners/[id]/listings` (create), PATCH/DELETE `/api/partners/[id]/listings/[lid]`. Validation on category/condition/status/shipping_mode/price>=0. Partner-existence check on POST so a forged partner_id 404s before hitting FK.
   - **Read path**: ITEMS_SELECT in `lib/data/items.ts` switched to embed `marketplace_listings(*)`. New `rowToMarketplaceListing` helper centralizes snake→camel mapping. /api/partners/[id] GET + /api/admin/partners GET both use the embedded select. useSavedComments + useSavedItems mappers drop the listings field entirely (their cards don't render listings — comment + commented inline).
   - **MiPartnerSection composer**: drops the read-only banner from commit 9. Refactors per-keystroke `onPatch` (cheap on sessionStorage) into save-on-explicit-action: composer holds local draft state, GUARDAR BORRADOR + PUBLICAR ITEM both trigger the API write. onAdd/onDuplicate seed a local draft (no API call until save). onDelete fires DELETE + refetch. EditingId in the table also highlights `isNew` drafts so the row visibly maps to the composer.
   - **scripts/seed.ts**: inserts seeded listings into the new table after items + polls. Mock data unchanged; only the seed-runner needed the new pass.

### Verification
- Types regenerated via `supabase gen types --project-id ...` byte-identical to the hand-edit. No drift.
- tsc clean, lint clean (only pre-existing img/hooks warnings).
- Migration applied cleanly; 6 NAAFI listings copied into new table, 0 lost. Items table no longer has the `marketplace_listings` column.

### Memory + cleanup notes
- `lib/partnerOverrides.ts` write-side (`setPartnerOverride` / `setMarketplaceEnabled` / `addMarketplaceListing` / `updateMarketplaceListing` / `removeMarketplaceListing` / `clearPartnerOverride` / `newListingId` / `listResolvedPartners` / `listMarketplaceEnabledPartners`) is now dead — no callers. The read-side hooks (`useResolvedPartner` / `useResolvedPartners`) still serve `ExplorerSidebar` (current-user partner display) + `MarketplaceOverlay` (partner lookup by URL slug). Could be collapsed in a separate cleanup pass but not urgent.
- `MarketplaceOverlay` + `ExplorerSidebar` still read partners via `useResolvedPartner` — they'll show the cached MOCK_ITEMS partner data when the user has a fake partner_id, or stale data when DB partner is freshly created. Migrating those to real-DB hooks is the natural follow-up.

---

## 2026-05-04/05 · INGEST · Partners + admin arc (9 commits, complete)

Iker brought a list of 8 issues spanning admin / dashboard / partners / marketplace / users. Sized originally as "edit-in-place for partners ~30-60min" — actually a 2-session arc. Split into 9 focused commits, ordered to ship low-risk data + UI fixes first and save the unknown-scope marketplace investigation + partner self-service for the back end.

### Shipped
1. **`3fb560c feat(partners): add 'dealer' partner_kind`** — migration 0009 extends the partner_kind enum with `dealer` for record/equipment dealers. Updated PartnerKind type, AdminPartnersComposer label "DEALER · vinilos / equipo / merch" + color #10B981, PartnersRail label, /api/admin/partners VALID_KINDS allowlist, regenerated database.types.ts (also picked up apply_hp_rollup + sweep_old_foro_threads function types missing from the prior hand-edit).

2. **(no commit, data-only)** Mock users deletion via Supabase Studio. Iker confirmed 3 real registered users (`iker`, `datavismo@gmail.com`, `testuser`) and 9 seed users to drop. SQL: `delete from auth.users where id in (select id from public.users where seed = true)` — cascades wiped 9 auth.users + 9 public.users + 25 comments + 51 reactions + 8 foro_threads + 16 foro_replies. Items.created_by + audit_log.actor_id SET NULL preserved (none affected). Site went from "lots of seeded chatter" to fresh empty community.

3. **`582dcf0 feat(admin): surface recent signups in /admin?tab=users`** — newly-registered users (role='user' + no flags) were invisible by design. Added a second prefetch (latest 25 by joined_at desc) + a //RECIENTES section above the //ELEVADOS list. Dedupes by id.

4. **`f930b99 refactor(admin): port PermisosSection panel UX into AdminUsersEditor + delete dashboard duplicate`** — Iker flagged that the dashboard's PermisosSection was showing deleted seed users + missing testuser. Root cause: it read from MOCK_USERS + sessionStorage overrides (visual-MVP era), no DB connection at all. He liked the panel UX better than /admin's compact inline form. Resolution: kept the PermisosSection two-pane layout (list left, editor panel right with IdentityBlock + RoleEditor button row + full-size MOD/OG toggles + PartnerEditor) and rebuilt it inside /admin?tab=users with real DB writes via the existing PATCH /api/admin/users/[id]. Then deleted PermisosSection.tsx + its wiki note + the dashboard's `permisos` section entry (sidebar, types, NuevoSection prompt, lib/types.ts comment). 8 files / +498/-812. Note: lib/userOverrides.ts stays — its read-side `useResolvedUser` is used across foro / comments / dashboard surfaces; the write-side is only used by MiPartnerSection now (same problem, addressed in commit 9).

5. **`5e054df fix(admin): hide VibeSlider on /admin + widen layout for two-pane editor`** — Iker noticed VibeSlider was rendering at the top of /admin (root-layout-mounted) and the editor panel overflowed the section's bounds. Extended the existing `pathname.startsWith('/dashboard')` guard in VibeSlider to also match `/admin`. Widened /admin from max-w-4xl → max-w-5xl. Moved the side-by-side breakpoint from md to lg (was squeezed at 768-1024px). Added min-w-0 to grid columns + IdentityBlock Row's value span so long IDs/usernames truncate inside the panes.

6. **`5a5f709 feat(admin): LECTOR filter chip with dedicated lector prefetch`** — vanilla readers (role='user', no flags) only existed in the TODOS stat — couldn't be filtered to their own list. Added a third prefetch (lectorUsers — newest 50 with role='user' by joined_at desc). LECTOR chip count is the global lector total from roleCounts.user. When the prefetch caps below total, an overflow note appears: "mostrando los N más recientes de M — buscá por @username para encontrar a alguien anterior". Reordered chips by tier: TODOS · LECTOR · CURATOR · GUIDE · INSIDER · ADMIN · MOD.

7. **`97cdca9 fix(marketplace): real-DB partners feed catalog + home rail`** — same root cause as PermisosSection: /marketplace + the home `MarketplaceRail` both read from `useMarketplaceEnabledPartners()` (sessionStorage layer over MOCK_ITEMS), so admin-created partners with `marketplace_enabled=true` were invisible. Converted /marketplace/page.tsx to async + force-dynamic; threaded server-fetched partners as a prop into both `MarketplaceCatalog` and `MarketplaceRail`. Drops the `'use client'` directive on `MarketplaceRail` since it no longer uses any browser hooks. `useMarketplaceEnabledPartners` stays in `partnerOverrides` because `PartnerApprovalsSection` still depends on it (separate slice).

8. **`68e5789 feat(admin): partner edit + hard-delete with type-to-confirm gate`** — //PARTNERS tab v1 was create-only. v2 makes existing-partner chips clickable → loads the row into the composer for edit/delete. New `/api/admin/partners/[id]` route with GET / PATCH / DELETE; cascades for delete documented inline (per migration 0001 schema): comments / user_saves / polls / hp_events on the partner item CASCADE delete; users.partner_id + invite_codes.intended_partner_id SET NULL. Extended `usePrompt` + `PromptOverlay` with a `typeToConfirm` variant for the high-friction destructive gate — confirm button disables until input matches "BORRAR <partner title>" verbatim, input border flips green on match, title strip reads //CONFIRMACIÓN·DESTRUCTIVA. AdminPartnersComposer becomes mode-aware (create / edit) with appropriate buttons; slug becomes read-only in edit mode (changing it would break links).

9. **`9615f80 feat(dashboard): partner self-service backed by real DB endpoints`** — MiPartnerSection lived on the same sessionStorage simulation as PermisosSection (useResolvedPartner + useResolvedUsers + setUserOverride + setPartnerOverride). Resolution: same DB-backed treatment.
   - New `/api/partners/[id]` route (GET / PATCH gated on canManagePartner — any team member or admin) for partner profile self-service. Whitelist narrower than the admin route: marketplace_* + image_url + partner_url. Structural fields title/slug/partner_kind stay admin-only.
   - New `/api/partners/[id]/team` route (GET / POST / PATCH / DELETE; reads gated on team membership, mutations gated on canManagePartnerTeam — partner-admin or site admin).
   - MiPartnerSection top-level fetches partner + team via Promise.all on mount, holds in local state, refetches after mutations. snake_case ↔ camelCase mapping done in two helpers (mapPartnerRow / mapTeamMember) so the downstream components keep their existing field names.
   - ProfileEditor (replaces CardMetaEditor): adds image upload + partner_url + marketplace_enabled toggle, dirty-check + save button + saved flash.
   - EquipoTab kick / promote / add flows hit the new team endpoint. Add flow uses the existing /api/admin/users/search for lookup — that's admin-only at the moment, so partner-admin (non-admin role) can't find users by name. Future: narrower public search endpoint for the partner-admin add-member flow.
   - Listings deferred. Partner team can VIEW marketplace_listings from the real DB but the composer is forced canManage=false with a yellow `ListingsReadOnlyBanner` explaining the deferral. At current scale only the N.A.A.F.I. seed has listings; no real partner team is editing them today.

### Verification
- DB writes confirmed via MCP after Iker tested commit 4: `testuser` row updated to role=curator, is_og=true, partner_id=pa-fascinoma. Full PATCH → router.refresh chain works end-to-end.
- All 9 commits pass tsc clean. Live preview /admin?tab=users + /admin?tab=partners + /dashboard?section=mi-partner all return 200.
- VibeSlider hides on /admin + /dashboard; /foro keeps it (foro feed uses vibe filtering on tagged genres).
- Partner table after the arc: 10 partners (5 from datavismo@gmail.com, 1 from iker, 4 seed with no created_by). All preserved through every commit.

### Listings persistence — explicit follow-up
The partner-team marketplace listings CRUD remains read-only after this arc. Wiring it requires its own design pass: jsonb-on-items vs separate marketplace_listings table, image cleanup on listing delete (jsonb traversal — same problem we already deferred for orphan storage prune), ownership gating on listing-level edits. At current scale (only N.A.A.F.I. seed has listings) it's not blocking. Captured in [[Next Session]].

### Memory
- `feedback_captcha_over_rate_limits` (already from pg_cron session) — relevant when this arc circles back to anti-abuse for partners.
- `project_personal_direct_beta` (already from pg_cron session) — informs the whole "defer external monitoring / Sentry / restore drill" posture that shaped this arc's smaller-scope lens.
- Updated `feedback_read_wiki_at_session_start` mid-arc — Iker noticed I'd dropped the habit of appending to the log as commits land. Memory now explicitly says "append AS YOU SHIP, don't batch".
- Updated `project_gradiente_fm` to reference these admin/partner changes.

---

## 2026-05-04 · INGEST · pg_cron — HP rollup every 5min + foro 30-day sweep

First piece of the chunk-4 ops layer. Iker's call (2026-05-04): the personal/direct beta posture means external monitoring + error tracking + rate limits are deferred; only pg_cron is in scope today. Captcha-after-N-rapid-actions is the preferred anti-spam path when that becomes necessary (saved as `feedback_captcha_over_rate_limits` memory).

### Migration 0008_pg_cron_jobs.sql
- `create extension pg_cron` — extension was available, not installed.
- `apply_hp_rollup()` — security definer plpgsql. Snapshots event IDs upfront (concurrency-safe — inserts arriving DURING rollup land in the next batch). For each item with pending events: decays `items.hp` from `coalesce(hp_last_updated_at, published_at)` using the type's half-life from [[curation]] (port of `ATTENTION_HALF_LIFE_HOURS`), adds Σ weights, re-anchors `hp_last_updated_at = now()`. Event-imminence modulation (slow decay near doors, paused live window) deferred to V2 — read-side rendering still runs the full TS math, so the practical impact is just slight over-decay at rollup time for events near their start.
- `sweep_old_foro_threads()` — `delete from foro_threads where bumped_at < now() - interval '30 days'`. Replies cascade via the existing `foro_replies_thread_id_fkey ON DELETE CASCADE`.
- Both functions `security definer set search_path = 'public'` per Supabase advisor recommendation.
- `cron.schedule('hp-rollup', '*/5 * * * *', …)` and `cron.schedule('foro-30-day-sweep', '0 4 * * *', …)` (04:00 UTC = 22:00 CDMX, low-traffic window). Idempotent — re-running migration overwrites cleanly.

### Orphan storage prune — explicitly deferred
Image references live in **5 places** including JSONB columns:
- `items.image_url` (text)
- `items.article_body` (jsonb — `[].src`)
- `items.marketplace_listings` (jsonb — `[].images[]`)
- `foro_threads.image_url`
- `foro_replies.image_url`

A naive `delete from storage.objects where name not in (select image_url from items)` would delete real images referenced inside JSONB. Doing it right means JSONB-aware traversal in SQL — doable but error-prone. At current scale (4 storage objects) the false-positive risk outweighs the bloat. Revisit when storage actually grows; until then a manual sweep in Studio is fine.

### Verification
- `pg_extension`: pg_cron 1.6.4 installed.
- `cron.job`: 2 jobs active with the expected schedules + commands.
- `pg_proc`: both functions exist with `security_definer=true` and `proconfig=[search_path=public]`.
- Direct invocation via MCP fails with "read-only transaction" (expected — MCP connection is read-only; cron runs as the postgres role with write rights).
- First runs scheduled: `hp-rollup` on next 5-min boundary, `foro-30-day-sweep` at 04:00 UTC tonight. Both will be no-ops (0 hp_events, 0 30+ day old foro threads).

### Files / commits
- `supabase/migrations/0008_pg_cron_jobs.sql` — `62904ce feat(db): pg_cron jobs`

### Things known to be next
- **HP write path (writer side)** — currently nothing inserts into `hp_events`. Need a small `recordHpEvent(itemId, kind, weight)` API that the home grid + overlay open + save toggle + comment post calls into. Server-side (route handler) so the auth context is trusted. Until this lands the rollup just sits idle.
- **Edit-in-place for partners** — //PARTNERS tab v2.
- **Chunk 5 scraper Phase 3** — GH Actions cron MWF + admin review queue + ra_to_gradiente.py emitting vibe_min/vibe_max.
- Remaining smaller items: mobile pass, `Mi Partner` composer migration, reduced-motion respect, hand-author wide-band item to demo gradient.

---

## 2026-05-03 · INGEST · Vibe range arc — items.vibe → vibe_min/vibe_max

Items now express a vibe SPAN instead of a single point. Designed at the end of the previous session; full technical scope was sitting in `project_vibe_range_arc` memory. Shipped as commit `c4fff18` (37 files, 577+/404−). Site is live with the new schema.

### Migration
- `supabase/migrations/0007_items_vibe_range.sql` — adds `vibe_min` + `vibe_max` smallint cols (0-10), backfills both from the old `vibe` value, enforces `vibe_min <= vibe_max`, drops `vibe`. `npx supabase db push` applied cleanly. All 216 existing rows backfilled with `min === max`.
- Verified via MCP: `vibe` column gone, `vibe_min` + `vibe_max` present + NOT NULL.

### Filter logic
- `lib/utils.ts` — replaced point-in-range `isInVibeRange(item.vibe, range)` with overlap test `rangesOverlap(item, range)` (`item.vibeMax >= filterMin && item.vibeMin <= filterMax`). Two ranges overlap when neither sits entirely above or below the other.
- Added helpers: `vibeMid(item)` (single representative number for narrow chrome), `vibeRangeLabel(item)` ("3-7 · CHILL → HOT" or "5 · NEUTRAL"), `vibeBandGradient(item)` (CSS linear-gradient with discrete integer stops, or solid color when point).

### Row mappers
- 4 places (per chunk-3 server-vs-browser split): `lib/data/items.ts`, `lib/hooks/useMyPublishedItems.ts`, `lib/hooks/useSavedItems.ts`, `lib/hooks/useSavedComments.ts`. Each: `vibe: row.vibe` → `vibeMin: row.vibe_min, vibeMax: row.vibe_max`.
- Inverse `contentItemToRow` in `lib/data/items.ts` + `itemToRow` in `scripts/seed.ts` swapped same way.
- `lib/itemsCache.ts` — listed in the planning doc as a 5th mapper but actually has no row-mapping logic (slug-keyed cache only). Plan was wrong about that file. Real count: 4.

### Two-thumb VibeField
- `components/dashboard/forms/shared/Fields.tsx` — VibeField rewritten as two stacked overlaid `<input type="range">` elements with a gradient track behind them. Each thumb keyboard-accessible independently. Click a bar in the 11-strip to collapse the range to that point; shift+click to extend the nearer edge. Range label "3-7 · CHILL → HOT" vs point "5 · NEUTRAL".
- CSS in `app/globals.css` — `.vibe-range-thumb` rules to make the input transparent/pointer-none while keeping the thumb pseudo-element grabbable. Standard two-input slider pattern.
- All 8 dashboard forms (Evento/Mix/Articulo/Editorial/Listicle/Noticia/Opinion/Review) updated: empty draft `vibe: 5` → `vibeMin: 5, vibeMax: 5`, VibeField call swapped to `valueMin/valueMax/onChange(min, max)`.
- MixForm had a duplicate local VibeField (~50 lines, pre-existing tech debt) — deleted in favor of the shared one. Tracked vibeToColor/vibeToLabel imports also dropped (unused after).

### Card / overlay displays
- ContentCard top strip + HeroCard left edge: render `vibeBandGradient(item)` instead of single solid color. Point items stay solid (gradient collapses); range items show the band.
- MixCard top accent stripe + ArticleCard left accent: same gradient treatment.
- All 6 overlays (Evento/Mix/Articulo/Listicle/Reader/Generic) now show `vibeRangeLabel(item)` in the VIBE chip area instead of `{item.vibe} · {vibeToLabel}`.
- MixOverlay's 11-bar gauge: bars in `[vibeMin, vibeMax]` light up with their per-integer color (mirrors VibeField). Used to be `i < item.vibe` lighting up bars 0..vibe.
- EventCard FUEGO-stripe (the hazard pattern on hot items): triggered by `item.vibeMax >= 9` instead of `item.vibe >= 9` — if any part of the range hits FUEGO+, badge shows.
- Single-color chrome elsewhere (vibeColor used for borders, glows, accent) reads `vibeToColor(vibeMid(item))` — visually identical to the old behavior for point items, mid-color for ranges.

### Admin partners
- `/api/admin/partners` POST body: `vibe: number` → `vibe_min`/`vibe_max` numbers; validation enforces both 0-10 and `min <= max`; insert writes both columns.
- AdminPartnersComposer state split into `vibeMin`/`vibeMax`; dropped its inline range input + plugged in the shared VibeField. Default both at 5 (admin slides apart explicitly — no forced wide default).

### Genre/vibe coupling — deferred
- Open design call from the prior session: should the composer's vibe range and genre multi-select live-couple? Decision (Iker + me at end of last session): **option 2 — independent inputs, no live coupling**. Suggestion-button arc deferred. Field shapes don't need to know about each other; the decision didn't change any code in this slice.

### Files / commits
- `0007_items_vibe_range.sql` (migration) + `c4fff18 feat(vibe): items.vibe → vibe_min/vibe_max range` (37 files / 577 insertions / 404 deletions).

### Verification
- `tsc --noEmit` clean.
- `next lint` — no new warnings (pre-existing `<img>` + hooks warnings only).
- Dev preview compiles + renders home/admin pages without errors. Cards render new top-strip element with correct color (solid for the current all-point items; gradient logic verified mathematically — would render bands when an admin sets `vibe_min < vibe_max`).
- Schema verified via MCP: vibe column dropped, vibe_min + vibe_max NOT NULL.

### Things known to be next
- **A — Chunk 4 ops layer** — beta-open gate. pg_cron (HP rollup, foro 30-day delete, orphan storage prune), `/api/health`, Sentry, Upstash rate limits, restore drill, Runbook.md.
- **Edit-in-place for partners** — v2 of //PARTNERS tab.
- **Mobile pass** — desktop locked, mobile untested.
- **Chunk 5 scraper Phase 3** — GH Actions cron MWF + admin review queue.
- Remaining smaller items: `Mi Partner` composer migration, `lib/mockData.ts` cleanup, reduced-motion respect.

---

## 2026-05-03 · INGEST · Production live on gradiente.org + 10 polish slices

Big day. Deployed to production for the first time, fixed a long bug list surfaced by live testing, completed two backend follow-ups left over from chunk 3, and added the role/flag + partners composers to `/admin`.

### Production deploy
- Discovered the GitHub Pages workflow had been silently failing on every push since chunk 1 (when `output: 'export'` was removed). Site had effectively been un-deployed for the entire backend arc.
- Created Vercel project `gradiente-fm-web` (Hobby tier, Iker's personal team); imported the repo; pasted env vars (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`) for Production + Preview.
- DNS wired: Namecheap `gradiente.org` → Vercel anycast IP `216.198.79.1` (apex A record) + `cname.vercel-dns.com` (`www` CNAME with redirect to apex). SSL auto-provisioned by Vercel via Let's Encrypt.
- Deleted the dead `.github/workflows/deploy.yml` (commit `5c45f56`). Vercel's GitHub integration is now the deploy mechanism on push to main.
- One CI fix along the way: `tsconfig.json` had no explicit `target`, defaulting to `es5` — caused `for-of` over `Iterable<T>` to fail TS check (surfaced by `lib/draftsCache.ts:49`). Set `target: "es2020"` (commit `104eea2`).

### Live-testing bug fixes (one big batch + one followup)
Iker reported these from gradiente.org. Bundled into commit `313fa45` (`fix(ui): post-launch bug batch`) + `b1dc4e2` (EventosRail).

1. **Edit-published flow loaded blank composer + minted a new id on publish** (was the most embarrassing). Root cause: `getItemById` (lib/drafts.ts) only consulted the drafts cache + legacy session list — didn't know about `useMyPublishedItems` results. Added `lib/publishedItemsCache.ts` (mirror of draftsCache shape), useMyPublishedItems primes it on fetch, getItemById falls back to it, useAuth clears it on logout.
2. **F key in dashboard composer toggled the image flyer.** ReaderOverlay (mounted by `LivePreview` while editing) had a window keydown listener for f/F with no input-focus guard. Added `isEditableTarget(target)` helper in lib/utils.ts; applied to ReaderOverlay's two listeners + MixOverlay's o/p shortcuts (same bug class).
3. **Post-publish autoscroll landed below the pending card.** Lazy-loaded `<img>` elements above/below settled AFTER the smooth scroll completed → layout drift → user lands a few hundred px past the card. Re-scroll at 800ms corrects.
4. **EDITAR button on session-item overlays navigated to dashboard but left the overlay mounted on top.** SessionItemStrip now calls `useOverlay().close()` before `router.push`.
5. **SECCION rail covered by VibeSlider's sticky chips strip on scroll.** Two solutions tried — first a z-index/bg-base hack that just *masked* the chips (wrong: rail rendered ON TOP of vibe slider). Final fix: dynamic `top` measurement via `data-vibe-strip` selector + ResizeObserver, so the rail always sits cleanly *below* whatever the chips strip's actual height is. Plus `min-h-screen` on the aside so sticky always has parent room.
6. **Filter change after scrolling cropped cards.** Page kept scroll position past the new shorter list; Framer Motion `layout` animations on cards competed with a smooth scroll. Switched to instant scroll-to-top BEFORE `setCategoryFilter` so animations start clean.
7. **EventosRail drag broke after returning to TODOS from a non-event filter.** Component returns null when filtered out, so the JSX with `trackRef` unmounts and re-mounts on re-show — but the effect's dep array was `[sorted.length]` only. Listeners didn't re-attach to the new track DOM. Added `hiddenByCategoryFilter` to the dep array.

### Backend follow-ups completed
- **B — `useUserRank` migration** (commit `e90bef7`). Replaced the `getAllCommentsMerged() → getUserRank()` in-memory hook (always returned 'normie' on real DB) with a SQL view + browser-side cache. Migrations:
  - `0005_user_rank_signals.sql` — view aggregating signal/prov counts per author across non-deleted comments. `security_invoker = true` so existing RLS gates results naturally.
  - `0006_user_rank_signals_include_seed.sql` — dropped the `seed = false` filter so pre-beta testing surfaces meaningful ranks (the 51 seeded reactions now count). After pre-launch seed cleanup the filter is a no-op anyway.
  - `lib/userRanksCache.ts` — module-scoped Map + microtask-batched fetch (multiple components rendering badges hit one SELECT in (ids), not N).
  - `lib/hooks/useUserRank.ts` — replaces the old in-comments hook; 5 callers swap import path.
  - `RANK_THRESHOLD: 5 → 2` (lower bar to leave 'normie' during pre-beta testing).
  - Skill-tree expansion (tiers within branches) noted in [[Open Questions]] + project memory `project_skill_tree_ranks` as post-beta roadmap.

- **#2 — `useSavedItems` migration** (commit `ab17ab8`). The dashboard's saved-items panel had been showing 0 results because the legacy hook read sessionStorage that no writer populated. Mirrors `useSavedComments`: fetches from `items` (joined to `polls`) for the ids in `itemSavesCache`. Cleaned `lib/saves.ts` of the dead sessionStorage block.

### Admin tools
- **Discord scrub** (commit `4ea7d44`) — purged 5 wiki references to "Discord webhook for scraper notification" (hallucinated planning Iker corrected). Saved memory `feedback_no_discord_notifications`. Default observability: Sentry for app errors, GH Actions email for cron failures, "check the page" for scraper success.

- **Smaller items (4) — tabbed /admin + role/flag editor** (commit `3ced4e3`). New tabbed shell (`?tab=invites|users`) so admin sections don't share scroll. Built scale-aware from day one:
  - Server prefetch only ELEVATED users (role != user OR is_mod OR is_og OR partner_id IS NOT NULL) — bounded ~50 even at 10k accounts (audit-staff workflow).
  - Search bar hits `/api/admin/users/search?q=` (debounced 250ms, ilike on username + display_name, limit 25).
  - Stats strip doubles as filter chips: TODOS · ADMIN · GUIDE · CURATOR · INSIDER · MOD. Click to narrow elevated list, click again or TODOS to clear.
  - Per-row inline editor: role, partner, mod/og/partner_admin. Self-demote shows a warning chip.
  - PATCH `/api/admin/users/[id]` — admin-only, RLS-gated via users_admin_all. Field allowlist (no username/display_name).
  - Verified end-to-end: Iker promoted two test users to mod via the UI; rows persisted in `public.users`.

- **Smaller items (3) — partners onboarding composer** (commit `7da80ac`). Third tab //PARTNERS replaces "INSERT into items via Studio" for adding new partners.
  - POST `/api/admin/partners` — admin-only (stricter than the items_staff_write RLS); validates required fields + slug shape; returns 409 on slug collision. id format `pa-{slug}-{rand}`.
  - AdminPartnersComposer — existing-partners chips at top (duplicate-check reference) + composer below: title, auto-derived slug, partner_kind enum, partner_url, vibe slider, image upload (compressed → uploads bucket), marketplace toggle that exposes location/currency/description.
  - V1 is create-only; edit/delete deferred. Vibe is single value here — will get swapped to a two-thumb when the vibe-range arc lands.

### Steps that didn't ship
- **Smaller items (5) — Espectro→Gradiente rename** — Iker corrected mid-stream: "Espectro Mix" is a partner's brand (not the platform's old name). All staged renames reverted clean to HEAD; no commit.
- **Smaller items (1) — cross-tab save sync via BroadcastChannel** — Iker's call: not worth the effort. "A user that browses the page and saves an item from the feed or a comment won't really have 2 tabs open at the same time. The synching in real time is more for interactions that involve different users" — Realtime publication on comments/foro/reactions already covers cross-USER, which is the meaningful surface.

### Files / commits this session
| commit | scope |
|---|---|
| `3243dda` | (last session) chore(db): squash migrations 0001-0015 into 4 clean files |
| `502f830` | (last session) chore(config): Supabase + image-compression deps + Vercel deploy target |
| `2601beb` | (last session) feat(supabase): wire all surfaces to backend |
| `ccd9952` | (last session) docs(wiki): Backend Plan + chunks 1+2+3 logs + migration squash |
| `104eea2` | fix(build): add tsconfig target es2020 |
| `5c45f56` | chore(ci): remove dead GitHub Pages deploy workflow |
| `4ea7d44` | docs(wiki): remove Discord notification placeholders |
| `313fa45` | fix(ui): post-launch bug batch — edit-republish + 5 UX fixes |
| `b1dc4e2` | fix(EventosRail): re-attach listeners on filter re-show |
| `e90bef7` | feat(ranks): live useUserRank backed by SQL view + batched cache |
| `ab17ab8` | feat(dashboard): live useSavedItems backed by user_saves join |
| `3ced4e3` | feat(admin): tabbed /admin + role/flag editor with search & chip filter |
| `7da80ac` | feat(admin): partners tab with onboarding composer |

### Things known to be next
- **VIBE RANGE ARC** — Iker's call: every content item should have a vibe RANGE (vibeMin + vibeMax) instead of a single point. ~2-3hr arc touching schema, types, mock data, all rowToContentItem mappers, filter logic (overlap test instead of point-in-range), every card that colors by vibe. See `project_vibe_range_arc` memory for full technical scope. Card displays should render the range as a gradient band (not just midpoint).
- **A — Chunk 4 ops layer** — still the actual beta-open gate. pg_cron rollups (HP signals, foro 30-day delete, orphan storage prune), `/api/health`, Sentry, Upstash rate limits, restore drill, `wiki/Runbook.md`.
- **Edit-in-place for partners** — v2 of the //PARTNERS tab. Currently create-only; mistakes get fixed in Studio.
- **E — Mobile pass** — desktop locked, mobile untested.
- **C — Chunk 5 scraper Phase 3** — GH Actions cron MWF + admin review queue.
- Remaining smaller items: `Mi Partner` composer (marketplace_listings still session), `lib/mockData.ts` cleanup (importable fallback), reduced-motion respect.

---

## 2026-05-03 · INGEST · Migration squash — 0001-0015 → 4 clean files

[[Backend Plan]] § "Migration sprawl" debt closed. Staged 4 consolidated migrations from `supabase/squash-staging/` cut over to `supabase/migrations/` via the repair-history pattern. Schema on remote unchanged; only the `supabase_migrations.schema_migrations` table was rewritten.

### Bugs found in the staged squash (fixed before cutover)
1. **Forward FK** — `0001_init.sql` items table declared `created_by uuid references users(id)` inline before `users` was created. Postgres would have failed `relation "users" does not exist` on any fresh deploy. Fix: pulled `created_by` out of `CREATE TABLE items`; added as a trailing `ALTER TABLE items ADD COLUMN ... REFERENCES users(id)` after `users` exists. Same fix preserves the live ordinal_position 57 (last column) → keeps `pg_dump`/`db diff` parity.
2. **`set_updated_at` missing `SET search_path TO 'public'`** — Supabase advisor recommendation present in live, missing in squash. Added.

### Dropped from remote DB
- `private.lookup_email_by_username(text)` — dead code (login route uses `auth.admin.getUserById`). Dropped via Supabase Studio (MCP is `read_only=true`, psql not installed locally).

### Cutover sequence
1. `migration repair --status reverted` × 15 (0001-0015)
2. `mv supabase/migrations/000* supabase/migrations.bak/` — note: runbook's `000*` glob only catches 0001-0009; 0010-0015 needed a separate `mv`
3. `mv supabase/squash-staging/* supabase/migrations/`
4. `SQUASH_RUNBOOK.md` relocated → `supabase/SQUASH_2026-05-03_RUNBOOK.md` (it was getting moved into `migrations/` by the wildcard, which we don't want)
5. `migration repair --status applied` × 4 (0001-0004)
6. `gen types --linked` produced byte-identical TS types (only CLI noise differed)

### Verification
`supabase db diff` blocked (requires Docker; not running locally). Substituted MCP-based equivalent: tables + column ordinals, indexes, RLS policies, functions, triggers, storage policies, realtime publication tables — all match squash declarations. `private` schema confirmed to have exactly 6 functions (5 auth helpers + `bump_thread_on_reply`).

### Final state
- `supabase/migrations/` — 4 files (`0001_init`, `0002_rls`, `0003_storage`, `0004_realtime`)
- `supabase/migrations.bak/` — 15 originals, untracked (local safety net only)
- `supabase/SQUASH_2026-05-03_RUNBOOK.md` — preserved as historical reference (with the BOOT-* code value scrubbed)
- Remote `supabase_migrations.schema_migrations` — 4 rows, in sync with local
- Commit: `3243dda chore(db): squash migrations 0001-0015 into 4 clean files` (5 files / 1058 insertions, squash + runbook only — chunks 2/3/Realtime work still uncommitted in 38+ modified + many untracked files; separate commits)

### Lessons worth keeping
- **Squash files must be runnable on a fresh deploy**, not just reflect final state. Inline FKs that forward-reference later tables fail. Read carefully for table-creation order before swapping.
- **Live column `ordinal_position` matters** when reproducing existing schemas. `ALTER ADD COLUMN` columns end up last; squash needs equivalent execution order to keep `pg_dump`/`db diff` parity.
- **Read-only MCP can't do DDL**. For one-off cleanup drops during ops like this, either flip the MCP to read-write, install psql, or paste into Supabase Studio.

---

## 2026-05-03 · INGEST · Backend chunk 3 COMPLETE — saves, polls, tombstones, drafts, publishing, storage, foro, realtime, saved-comments view

[[Backend Plan]] chunk 3 finished in a single multi-hour pickup session. Every user-facing surface is now real DB / Storage / Realtime; zero sessionStorage in the user-facing path. Eight slices shipped in order:

### Slices (in order)
1. **Item saves (`★` chips)** — `/api/saves/items/[itemId]` POST + DELETE; `lib/itemSavesCache.ts`; AuthProvider loads on auth state change. Verified iker → ed-001 row in `user_saves`.
2. **Polls (vote)** — `/api/polls/[pollId]/vote` upsert by composite PK; `lib/pollVotesCache.ts` (per-poll Map with lazy `ensurePollVotesFetched`); `lib/data/items.ts` extended to embed `polls` join via `polls.item_id` FK so `item.poll` populates from DB. All 4 poll kinds verified (attendance / from-tracklist / freeform / from-list); revote upserts in place.
3. **Comment tombstones** — `/api/comments/[id]/tombstone` POST + DELETE; lib/comments.ts `tombstoneComment` / `clearCommentDeletion` async + invalidateAllComments. Mod-delete + author-self-delete + revert all verified. Foro tombstones deferred to the foro slice.
4. **Drafts CRUD** — `/api/drafts` POST upsert (jsonb path lookup by ContentItem.id), `/api/drafts/[itemId]` DELETE; `lib/draftsCache.ts` + lib/drafts.ts hybrid. AuthProvider primes the cache on auth.
5. **Publishing items** — `/api/items` POST upsert by id, INSERTs poll if `item.poll` set, DELETEs the matching draft atomically. New `lib/data/items.ts` `contentItemToRow` mapper (mirrors `itemToRow` from seed.ts). PublishConfirmOverlay awaits `publishItem` then `router.refresh()` so server components re-render with the new row.
6. **Two follow-up bugs caught + fixed**: (a) `OverlayRouter` couldn't open published items because it only knew MOCK_ITEMS — added `lib/itemsCache.ts` slug-keyed cache populated by ContentGrid on every render. (b) Dashboard "Publicados" was empty because items had no `author_id` column — migration 0012 added `items.created_by`, route handler stamps it, new `lib/hooks/useMyPublishedItems` filters by it.
7. **Image uploads to Storage** — migration 0013 created `uploads` bucket (public read, self-only writes by path prefix `${user.id}/...`); installed `browser-image-compression@2.0.2`; `lib/imageUpload.ts` `compressAndUploadImage(file, userId, opts?)`; `Fields.tsx` ImageUrlField + foro composers all swapped from `FileReader.readAsDataURL` to compressed Storage uploads. GIFs pass through uncompressed (preserves animation). Verified: a 2.7MB inline data URL on `items.image_url` shrunk to a 135-char CDN URL on the same row after re-publish.
8. **Foro writes (the big one)** — `lib/data/foro.ts` server reads, `lib/hooks/useForo.ts` browser hooks with per-thread + catalog invalidation buses, four routes (`/api/foro/threads`, `.../[id]/replies`, `.../[id]/tombstone`, `/api/foro/replies/[id]/tombstone`), migration 0014 (foro_replies INSERT trigger that bumps parent thread `bumped_at` via SECURITY DEFINER `private.bump_thread_on_reply`), `lib/foro.ts` rewritten (DB-backed; `addThread`/`addReply`/`newThreadId`/`newReplyId` dropped — DB generates UUIDs), NewThreadOverlay + ReplyComposer rewired to upload-then-POST. Verified: thread create, reply create with image, parent bumped to microsecond, mod-tombstone, restore.
9. **Saved-comments dashboard view** — `lib/hooks/useSavedComments.ts` fetches comments where `id IN savedCommentsCache` + parent items + authors in parallel; SavedCommentsSection + ExplorerSidebar swap to it. Last user-facing sessionStorage holdout gone.
10. **Realtime layer** — migration 0015 added `comments`/`comment_reactions`/`foro_threads`/`foro_replies` to the `supabase_realtime` publication. `useComments` mounts per-item channel. `useThreads` mounts ONE shared `foro:all` channel that broadcasts `invalidateThreadOnly(id)` to per-thread bus — covers reply counts on N tiles + open thread overlays from a single websocket. `useThread`/`useReplies`/`useReplyCount` no longer mount their own. Cross-tab live updates verified.

### Bug fix worth remembering: dashboard login overlay race
Dashboard popped login over an already-authed user during mount. Root cause: `isAuthed = profile !== null` is false during the async profile fetch even though session is set. Added `authResolved = ready && fetchedAuthId === sessionAuthId` to useAuth context, derived from current state (the earlier separate-boolean attempt had a stale-true race). Dashboard gates `openLogin` on `authResolved` now. Also added a safety net: when `loginOpen && profile !== null`, force-close.

### Migrations added
| # | Purpose |
|---|---|
| 0011 | `saved_comments` table |
| 0012 | `items.created_by` column + index |
| 0013 | `uploads` Storage bucket + 4 RLS policies on `storage.objects` |
| 0014 | `private.bump_thread_on_reply()` + AFTER INSERT trigger on `foro_replies` |
| 0015 | Add comments/reactions/foro_threads/foro_replies to `supabase_realtime` publication |

### Patterns crystallized this session (now codified in `project_backend_architecture` memory)
- **Optimistic write shape**: cache + listener + sync getter + async writer that flips local then API-confirms-or-rolls-back. Used 6+ times now (saves, comments-saves, reactions, polls, drafts, items publish).
- **`authResolved` gate**: `ready && fetchedAuthId === sessionAuthId`. Use this not `ready` when deciding to redirect / show login.
- **Single shared Realtime channel + bus broadcast**: don't mount N channels for N tiles. `foro:all` covers the entire foro from useThreads; useReplyCount on each tile listens to the existing per-thread bus.
- **`invalidateThreadOnly` vs `invalidateThread`**: the *Only variant for Realtime callbacks (catalog refreshed by the same channel's foro_threads handler), the standard variant for API callers (instant local feedback).
- **Server-vs-browser modules**: `lib/data/*` server-only (createClient from `@/lib/supabase/server`); `lib/hooks/*` browser-only. Row mappers duplicated locally — `next/headers` poisons the client bundle.

### Squash + handoff
Drafted consolidated migrations in `supabase/squash-staging/` (0001 init + 0002 rls + 0003 storage + 0004 realtime — replaces 0001-0015) plus `SQUASH_RUNBOOK.md` with `migration repair` cutover steps. Not yet executed; safe to apply when fresh.

### Open follow-ups
1. **Squash** — staged, run runbook when fresh
2. **`useUserRank`** — still computes from MOCK + session; everyone shows as 'normie' rank in PostHeader/CommentList badges. Needs a SQL view aggregating per-user reaction counts OR a batched server fetch
3. **`Mi Partner` composer** — marketplace_listings jsonb still on session
4. **lib/mockData.ts cleanup** — still imported as fallback in OverlayRouter
5. **Chunk 4 ops** — pg_cron rollups (HP signals, foro 30-day delete sweep, orphan storage prune), Sentry, /api/health, Upstash rate limits, restore drill, `wiki/Runbook.md`
6. **Chunk 5 scraper Phase 3** — GH Actions cron + admin review queue

### Files created (~25) / modified (~10)
- New routes: `app/api/saves/items/[itemId]/route.ts`, `app/api/polls/[pollId]/vote/route.ts`, `app/api/comments/[id]/tombstone/route.ts`, `app/api/drafts/route.ts`, `app/api/drafts/[itemId]/route.ts`, `app/api/items/route.ts`, `app/api/foro/threads/route.ts`, `app/api/foro/threads/[id]/replies/route.ts`, `app/api/foro/threads/[id]/tombstone/route.ts`, `app/api/foro/replies/[id]/tombstone/route.ts`
- New caches/hooks: `lib/itemSavesCache.ts`, `lib/pollVotesCache.ts`, `lib/draftsCache.ts`, `lib/itemsCache.ts`, `lib/imageUpload.ts`, `lib/data/foro.ts`, `lib/hooks/useForo.ts`, `lib/hooks/useMyPublishedItems.ts`, `lib/hooks/useSavedComments.ts`
- Major rewrites: `lib/saves.ts`, `lib/polls.ts`, `lib/comments.ts` (tombstones), `lib/drafts.ts` (hybrid), `lib/foro.ts` (DB-backed), `components/auth/useAuth.tsx`, `components/dashboard/forms/shared/Fields.tsx` (ImageUrlField), `components/foro/NewThreadOverlay.tsx`, `components/foro/ReplyComposer.tsx`, `components/foro/ThreadOverlay.tsx`, `components/dashboard/explorer/sections/SavedCommentsSection.tsx`, `components/HomeFeedWithDrafts.tsx`, `components/overlay/OverlayRouter.tsx`, `components/ContentGrid.tsx`, `components/publish/PublishConfirmOverlay.tsx`, `app/dashboard/page.tsx`
- Deps: `browser-image-compression@2.0.2`
- next.config.mjs: allowlisted `*.supabase.co` for Next/Image

---

## 2026-05-03 · INGEST · Backend chunk 3 — Comment overlay user-writes shipped (same session as chunks 1+2)

[[Backend Plan]] chunk 3 — User writes — half-shipped in the same 05-03 mega-session. The whole **comment overlay subsystem** is now real-data backed: read, post, react (`!`/`?`), save (`★`). All optimistic, no perceived latency. Foro writes, drafts/publishing, item saves, polls, tombstones, dashboard views still pending — see the punch list at the bottom.

### Migration added

| # | Migration | Purpose |
|---|---|---|
| 0011 | `saved_comments` | Per-user comment-save table (`user_id`, `comment_id`, `saved_at`). Self-only RLS via `saved_comments_self_only`. Symmetric with the existing `user_saves` (item saves) table — comment-saves land here, item-saves there. |

### Route handlers

- `app/api/comments/route.ts` — POST (create comment). Trusts RLS (`comments_authenticated_insert` requires `auth.uid() = author_id`); we just attach `user.id` and let Postgres enforce.
- `app/api/comments/[id]/reactions/route.ts` — POST (set/replace reaction with `kind: 'signal' | 'provocative'`) + DELETE (clear). Server-side mutual-exclusivity: deletes any prior reaction by this user before inserting.
- `app/api/saves/comments/[commentId]/route.ts` — POST (save) + DELETE (unsave). Idempotent — duplicate save returns success; nothing-to-unsave returns success.

### Frontend additions

- `lib/data/users.ts` — server-only: `getUserById`, `getUsersByIds(ids)`, `listUsers`. `rowToUser` mapper.
- `lib/data/comments.ts` — server-only: `getCommentsForItem(itemId)` with `comment_reactions(*)` joined.
- `lib/hooks/useComments.ts` — browser-side hook. Fetches comments + reactions in one query, then a batched users-by-ids query for distinct authors + tombstone moderators. Returns `{ comments, usersById, loading }`. Subscribes to a per-itemId invalidation bus + the global reaction-override cache; merges optimistic reaction overrides over server-fetched `comment.reactions`.
- `lib/savedCommentsCache.ts` — module-scoped Set + listener pattern. Set populated by AuthProvider on auth-state change (`select comment_id from saved_comments where user_id = auth.uid()`). `useIsCommentSaved` subscribes; `toggleSavedComment` updates locally + API-confirms.
- `lib/reactionsCache.ts` — module-scoped Map<commentId, Reaction[]> with the same listener shape. Holds optimistic overrides. Cleared in bulk by `useComments` on every full refetch (server is fresh truth).
- Modified `lib/comments.ts`:
  - `toggleReaction` is now async, optimistic: writes to `reactionsCache`, fires API in background, rolls back on failure. **Does NOT call invalidateAllComments** — full refetch isn't needed because the override carries the truth until `useComments` next runs `load()`.
  - `toggleSavedComment` likewise optimistic via `savedCommentsCache`.
  - `isCommentSaved` reads sync from cache (matches the previous prototype's call-site shape).
  - `setCurrentAuthUidForComments(id)` + `recordCommentReactions(list)` exported as glue between `useAuth` / `useComments` and the toggle logic so toggleReaction knows the calling user + has a baseline to compute against without an extra round-trip.
  - `addComment` left as-is on sessionStorage (dead code now — `CommentComposer` posts via API directly). Cleanup in next slice.
- Modified `lib/userOverrides.ts` — added `realUserCache` (Map) + `setRealUsers(iterable)` + `getRealUserById`. `getResolvedUserById` now consults the real cache before falling back to `MOCK_USERS`. Means `useResolvedUser(id)` resolves real Supabase users without changes to the 542-line CommentList.
- Modified `components/auth/useAuth.tsx` — on auth-state change, also calls `setCurrentAuthUidForComments(authId)` + `setSavedCommentIds([...])` (loaded from `saved_comments` where `user_id = authId`). Logout clears both.
- Rewrote `components/overlay/CommentsColumn.tsx` — uses the new `useComments(item.id)` hook; pushes fetched users into the global `realUserCache` via `setRealUsers(usersById.values())` so existing `useResolvedUser` calls inside CommentList resolve real rows.
- Rewrote `components/overlay/CommentComposer.tsx` — POSTs to `/api/comments` and dispatches `invalidateComments(itemId)` after success.
- 7 type-page swaps from earlier in the session: `/agenda`, `/mixes`, `/noticias`, `/reviews`, `/editorial`, `/opinion`, `/articulos` all `await getItems()` from `lib/data/items.ts`. Each marked `dynamic = 'force-dynamic'` because cookies-aware reads can't be statically rendered.

### Patterns worth keeping

- **Optimistic write shape**: `apply locally → API → confirm-or-rollback`. Used twice this session (saves, reactions). The two caches (`savedCommentsCache`, `reactionsCache`) have identical shapes — module-scoped state + listeners + a tick-based React subscription. Re-use this structure for item saves, polls, foro reactions when those land.
- **Don't clear the optimistic override on API success.** First reaction migration tried `clearReactionOverride(commentId)` on success — UI snapped back to the pre-toggle state for ~1s because `comments` React state was never updated. The override IS the local truth until the next full refetch (which clears all overrides via `clearAllReactionOverrides()` in `load()`). Documented in the toggleReaction comment.
- **`realUserCache` bridge** — the lowest-touch way to migrate user-display surfaces off mocks. Add a runtime cache to the existing override module; existing `useResolvedUser` consumers automatically pick up real users without prop drilling.
- **`next/headers` import poisoning** — `lib/supabase/server.ts` calls `cookies()` from `next/headers`, which can't be bundled for the browser. Any module imported by a client component cannot transitively import server.ts. Solution: split `lib/data/*` (server-only reads) from `lib/hooks/*` + the in-component `createClient()` calls (browser reads). Mappers (`rowToComment`, `rowToUser`) get duplicated; small price.
- **ALTER POLICY syntax**: USING and WITH CHECK are full restatements, not patches. Confirmed when 0006 had to re-state every helper-using policy after moving the auth helpers to `private` schema.

### Open follow-ups (next session pickup, in priority order)

1. **Item saves** (warm-up) — `★` on cards. `user_saves` table already exists from 0001. Symmetric to comment saves: `/api/saves/items/[itemId]`, replace `lib/saves.ts` toggleItemSave/isItemSaved with API + cache + listener. AuthProvider also loads saved item ids alongside saved comments. ~20 min.
2. **Polls** — `lib/polls.ts` (vote store) → `polls` + `poll_votes` tables. Optimistic with the same cache pattern. ~30 min.
3. **Tombstones** — comment + foro-reply mod-delete flows. Update existing `tombstoneComment` / `clearCommentDeletion` to call API; mods see the affordance in CommentList already (gated by `canModerate`). ~30 min.
4. **Drafts CRUD** — `/api/drafts/*`, `lib/data/drafts.ts`. Drafts table already in schema. Each composer in `/dashboard` writes here on every keystroke (debounced). ~1 hr.
5. **Publishing items** — `/api/items/route.ts` POST, `[id]/route.ts` PATCH/DELETE. Requires guide/admin role — RLS already enforces. Updates the publish-confirmation flow to write through. `HomeFeedWithDrafts` either disappears (drafts no longer in home feed because they're in the drafts table) or stays only for the editor's pending-confirmation preview. ~1 hr.
6. **Supabase Storage bucket + presigned uploads** — image uploads currently stuff data URLs into sessionStorage (5MB inline strings — embarrassing). Stand up the bucket, RLS, upload route handler with `browser-image-compression` per the [[Backend Plan]] § "Image upload — limits + auto-compression" table. Foundation for many features (foro images, marketplace listings, draft images). ~1-2 hr.
7. **Foro writes** — threads + replies + bumped_at trigger + 30-day delete sweep prep. The foro catalog is a CLIENT component reading mock state; it'll need server-side prefetch + prop drilling pattern. ~1.5 hr.
8. **Dashboard view migrations** — `Guardados/Comentarios`, `Drafts list`, `Mi Partner` sections. Mostly straightforward swaps once the underlying tables are wired. ~1 hr.
9. **Realtime channels** — `comments:item_id=X`, `foro:thread_id=X`, `foro:catalog`. Layered on top of revalidation; doesn't replace router.refresh / event-bus. ~1 hr.
10. **Chunk 4 — ops layer** — pg_cron jobs (HP rollup, foro 30-day sweep, orphan storage prune), Sentry, `/api/health`, Upstash rate limits, restore drill, `wiki/Runbook.md`. ~2 hr.
11. **Migration squash** — 11 migrations, several debugging fixups (0003 → 0006 → 0007 → 0008; the dead `private.lookup_email_by_username` from 0009). Squash into a clean linear history before opening the beta. ~1 hr.

**Roughly 12-15 hours of focused work** to take the visual prototype fully off sessionStorage and ready for the 50-person beta. None hard — all patterns established this session — just volume.

### Files

- Created: `supabase/migrations/0011_saved_comments.sql`
- Created: `lib/data/users.ts`, `lib/data/comments.ts`
- Created: `lib/hooks/useComments.ts`
- Created: `lib/savedCommentsCache.ts`, `lib/reactionsCache.ts`
- Created: `app/api/comments/route.ts`, `app/api/comments/[id]/reactions/route.ts`
- Created: `app/api/saves/comments/[commentId]/route.ts`
- Modified: `lib/comments.ts` (toggleReaction async; toggleSavedComment async; isCommentSaved → cache; useIsCommentSaved → cache subscribe; new exports for the auth glue)
- Modified: `lib/userOverrides.ts` (added realUserCache + setRealUsers; getResolvedUserById prefers real cache)
- Modified: `components/auth/useAuth.tsx` (loads saved comment ids on auth-state change; sets currentAuthUid for the comments module)
- Rewrote: `components/overlay/CommentsColumn.tsx`, `components/overlay/CommentComposer.tsx`
- Modified: `app/page.tsx` and the 7 type-pages (`agenda`, `mixes`, `noticias`, `reviews`, `editorial`, `opinion`, `articulos`) — all async, `await getItems()`, `dynamic = 'force-dynamic'`

---

## 2026-05-03 · INGEST · Backend chunk 2 — Auth + admin shipped (same session as chunk 1)

[[Backend Plan]] chunk 2 — Auth + admin minimum — landed in the same session as chunk 1. Real admin account `@iker` exists, signup + login flow works end-to-end, dev-visibility relaxation tightened, `/admin` invite-code generator running with a partner dropdown.

### Migrations added

| # | Migration | Purpose |
|---|---|---|
| 0009 | `auth_trigger` | `handle_new_auth_user` AFTER-INSERT trigger on `auth.users` (validates invite code, applies role/partner metadata to new `public.users` row, marks code used; seed users bypass via `raw_user_meta_data->>'seed' = true`); `private.lookup_email_by_username` function (kept but unused — route handler uses admin API instead); `BOOT-93b83a6f9c323370` admin invite code |
| 0010 | `tighten_dev_visibility` | Restored `seed=false` filter on `items_public_read` / `comments_public_read` / `foro_threads_public_read`. Anon stops seeing seeded data; admin/guide still see all via `*_staff_read`. Reverses 0005's relaxation now that real auth exists. |

### Frontend additions

- `middleware.ts` + `lib/supabase/middleware.ts` — per-request session cookie refresh
- `lib/supabase/admin.ts` — service-role client (server-only; powers signup pre-validation + auth admin API calls)
- `app/api/auth/signup/route.ts` — pre-validates invite code with service-role, then `auth.admin.createUser({ email_confirm: true, user_metadata: { username, invite_code } })`. Trigger applies metadata atomically; if it raises (invalid code, taken username) the auth.users insert rolls back.
- `app/api/auth/login/route.ts` — accepts `identifier` (username or email — detected via `@` presence). Username path looks up `public.users.id` then `auth.admin.getUserById(id).email`, then `signInWithPassword` via the SSR client to set the session cookie.
- `app/api/auth/logout/route.ts` — `supabase.auth.signOut()` via SSR client
- `components/auth/useAuth.tsx` — full rewrite. Replaces the prototype sessionStorage hack with `onAuthStateChange` subscription + `from('users').select('*')` profile fetch. Exposes the same API shape as before so existing consumers (AuthBadge, dashboard chrome, canModerate checks) don't change. `loginAs` retained as a no-op stub for back-compat. `login`/`signup`/`logout` all call `router.refresh()` after the mutation so server components re-render with the new auth state — see "router.refresh pattern" below.
- `components/auth/LoginOverlay.tsx` — full rewrite. Two-tab UI (`▶ INGRESAR` / `▶ REGISTRARSE`); login takes username-or-email + password; signup takes email + username + password + invite code. Quick-switch UI dropped (impossible without target user's password under real auth).
- `app/admin/page.tsx` — server-component-gated `/admin` route. `redirect('/')` if no session OR if `users.role !== 'admin'`. Pre-fetches existing invite codes + the partner roster (from `items where type='partner'`).
- `app/api/admin/invite-codes/route.ts` — GET lists, POST creates. Uses the SSR client (caller's session) so `invite_codes_admin_all` RLS does the gating; explicit role check up front for clean 403s.
- `components/admin/AdminInviteCodes.tsx` — client form with role select / mod checkbox / partner dropdown (replaces the original text-input UX wart) / partner_admin checkbox (only visible when partner is selected) / expires-in-days; existing-codes table shows partner TITLE not id, with copy buttons.

### Notable decisions / patterns

- **router.refresh() after every mutation.** Iker observed during testing that login succeeded but the home grid stayed empty until a hard reload. Root cause: server components rendered as anon BEFORE the cookie was set; React tree just sat there showing the anon view. Fix: every mutation route in [[useAuth]] (login, signup, logout) calls `router.refresh()` from `next/navigation` after the fetch returns. Server components re-fetch with the new auth cookie. The same pattern will apply to chunk 3 user writes — comment posted → server returns ok → `router.refresh()` → comments column re-renders. Documented in the [[useAuth]] login useCallback comment.
- **Email confirmation skipped during signup.** `auth.admin.createUser({ email_confirm: true, ... })` from the server-side handler bypasses the email-verification round-trip. Justified for the beta because the invite code itself is the trust signal — anyone presenting a valid unused code is by-definition a known invitee. When opening to public signup we re-enable verification. The route handler still validates the invite code BEFORE creating the auth row to avoid orphan auth.users on bad codes.
- **Username login via the admin API, not a custom RPC.** Earlier plan (in [[Backend Plan]]) was to add a `lookup_email_by_username` RPC. Built it in 0009 inside `private` schema, then realized PostgREST doesn't expose `private` for RPCs, so it'd require a config change. Pivoted to using `auth.admin.getUserById` instead — the route handler queries `public.users` for the id by username (anon-readable), then asks the admin API for the email. Function in 0009 is now dead code; will be cleaned up in the migration squash. The user-facing flow is unchanged.
- **Partner dropdown** uses an `export interface PartnerOption` from `app/admin/page.tsx` so the prop surface to the client component stays narrow (no full ContentItem in the bundle). When real partners get added later (admin/partners flow, or chunk 3 dashboard migration), they appear automatically.
- **Bootstrap admin flow.** Iker signed up with `BOOT-93b83a6f9c323370` carrying `intended_role: 'admin'`. No manual `update users set role='admin'` needed — the trigger applies it on signup. Used `iker` (not `ikerio`) as username because the seed roster has `@ikerio`; the seed twins all get deleted pre-beta anyway so he can reclaim the handle later.

### Files

- Created: `supabase/migrations/0009_auth_trigger.sql`, `0010_tighten_dev_visibility.sql`
- Created: `middleware.ts`
- Created: `lib/supabase/{middleware.ts,admin.ts}`
- Created: `app/api/auth/{signup,login,logout}/route.ts`
- Created: `app/api/admin/invite-codes/route.ts`
- Created: `app/admin/page.tsx`
- Created: `components/admin/AdminInviteCodes.tsx`
- Rewrote: `components/auth/useAuth.tsx`, `components/auth/LoginOverlay.tsx`

### Open follow-ups (carry to next session)

- **Add-partner UI in `/admin`** — currently the only way to add a partner is direct INSERT into `items`. A small composer (title, partnerKind, partnerUrl, image upload to Supabase Storage when chunk 4 storage policies land) closes this loop. Could pair with the partner dropdown for a tighter UX.
- **Role / flag editor for existing users in `/admin`** — promote a user from `user → guide`, add `isMod`, etc. without going through Supabase Studio.
- **Migrate `/foro` + `/marketplace` catalogs off mocks** — chunk 1.5 leftover. Both are client components reading mock state directly. Naturally folds into chunk 3 (foro writes; marketplace listings).
- **Client-side user lookups still on mocks** — CommentList / PostHeader / etc. import from `lib/mockUsers`. Build `lib/data/users.ts` (`getUserById`, `getUserByUsername`, `listUsers`) reading from Supabase, swap imports.
- **Migration squash before beta** — 10 migrations now, several of them debugging fixups (0003 → 0006 → 0007 → 0008; the 0009 `lookup_email_by_username` dead code). Pre-beta task in chunk 4.
- **The dev-server cookie quirk** — Iker observed that restarting the Next.js dev server cleared his session. Repro is non-deterministic; might be a Windows-specific cookie persistence issue or a `@supabase/ssr` middleware interaction. Worth investigating if it bites again under chunk 3 load.

---

## 2026-05-03 · INGEST · Backend chunk 1 — Foundation shipped

[[Backend Plan]] chunk 1 complete: schema + RLS + grants + seed + first server component reading from Supabase. Site renders with full visual parity from the DB — verified live in preview after migration 0008.

### What landed

**8 migrations** in `supabase/migrations/`:

| # | Migration | Purpose |
|---|---|---|
| 0001 | `init` | 13 tables + 7 enum types + indexes + FTS tsvector column + RLS-on (no policies yet) |
| 0002 | `rls` | All RLS policies + 5 auth helper functions (auth_role, auth_is_admin, auth_is_guide_or_admin, auth_is_mod_or_admin, auth_is_authoring_role) |
| 0003 | `function_hardening` | Revoked EXECUTE on helpers (Supabase advisor recommendation) |
| 0004 | `grants` | Standard role privileges (anon/authenticated DML, service_role ALL) — needed because we picked "auto-expose new tables OFF" at project creation |
| 0005 | `dev_visibility` | TEMPORARY: dropped `seed=false` filter from public-read policies on items / comments / foro_threads so anon can see seeded data during dev. **Must tighten before beta.** |
| 0006 | `private_helpers` | Moved auth helpers to a non-exposed `private` schema + updated all 12 policies to reference `private.X()` instead of `public.X()` |
| 0007 | `helper_grants_fix` | Re-granted EXECUTE in the new schema |
| 0008 | `pgrst_reload` | `notify pgrst, 'reload schema'` to flush PostgREST's cached call plan |

**Seeded data** (all `seed=true`):
- 214 items: 151 eventos (mostly RA-scraped) + 16 mixes + 14 reviews + 11 editorial + 5 noticia + 5 opinion + 4 articulo + 3 listicle + 5 partner
- 4 polls (extracted from item.poll attachments; mock IDs replaced with fresh UUIDs)
- 9 users (mock roster) — real `auth.users` rows with placeholder `<username>@gradiente.local` emails + random per-user passwords saved to `.local/seed-credentials.txt` (gitignored)
- 25 comments + 51 reactions
- 8 foro threads + 16 replies (UUID maps built per-table to translate mock string ids → real UUIDs while preserving parent / quoted-reply references)

**Frontend**:
- `lib/supabase/client.ts` + `server.ts` — browser + RSC clients (using `@supabase/ssr`)
- `lib/supabase/database.types.ts` — generated via MCP `generate_typescript_types`
- `lib/data/items.ts` — `getItems()` + `getItemBySlug()` + `rowToContentItem` mapping helper (snake_case → camelCase ContentItem)
- `app/page.tsx` — now `async`, reads from Supabase via `await getItems()`, marked `dynamic = 'force-dynamic'`
- `next.config.mjs` — removed `output: 'export'` + GH-Pages basePath/assetPrefix/trailingSlash; added `images.ra.co` to remote patterns. Site is now Vercel-targeted (server runtime required for cookies-based auth).
- `scripts/seed.ts` — idempotent one-shot port from mock files to DB. Run via `npm run seed`.

**Tooling**:
- `@supabase/supabase-js` + `@supabase/ssr` + `tsx` + `dotenv` installed
- Supabase CLI linked via `npx supabase link --project-ref dcqbtcpqbqrtxbshhlkd`
- Supabase MCP added at `--scope project` (`.mcp.json` at repo PARENT — Claude Code is launched from `Gradiente/`, not `espectro-fm-web/`), read-only mode
- New `seed` npm script

### Diversion box: the function-permission rabbit hole

0003 → 0006 → 0007 → 0008 was a four-iteration walk through "how do RLS policies legally call helper functions in Supabase":

1. **0003**: Advisor said "revoke EXECUTE from anon/authenticated to remove RPC surface". Did that. Result: RLS policies that called these helpers started failing with `permission denied` because Postgres checks EXECUTE before evaluating policy bodies — even for SECURITY DEFINER functions.
2. **0006**: Right answer is to put helpers in a non-public schema (PostgREST only exposes `public` as RPCs). Created `private`, moved helpers, updated all 12 policies to use qualified names.
3. **0007**: Grants in 0006 didn't seem to land — verified via `pg_proc.proacl` they were correct on disk, but anon STILL got `permission denied`.
4. **0008**: PostgREST was caching a pre-move schema plan. `notify pgrst, 'reload schema'` flushed it. Site immediately started rendering content.

The lesson worth keeping: the Supabase advisor's "revoke EXECUTE on SECURITY DEFINER" recommendation is technically incomplete — the right pattern is non-public schema + grant EXECUTE, NOT public schema + revoke EXECUTE. Documented in 0006's header comment.

### Debt flagged for chunk 4 / pre-beta

- **Migration sprawl** — 8 migrations where half are fixups. Pre-beta, squash into a clean linear history (chunk 4 / pre-beta task).
- **Dev visibility relaxation in 0005** — anon currently sees seeded rows. Must tighten when chunk 2 brings real auth.
- **Other pages still read mock** — `/agenda`, `/mixes`, `/noticias`, `/reviews`, `/editorial`, `/articulos`, `/foro`, the dashboard, every overlay. They work because `lib/mockData.ts` is still imported, but the migration isn't done. Next session picks this up.

### Files

- Created: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/database.types.ts`
- Created: `lib/data/items.ts`
- Created: `scripts/seed.ts`
- Created: `supabase/migrations/0001_init.sql` through `0008_pgrst_reload.sql`
- Modified: `app/page.tsx` (async, Supabase reads, force-dynamic)
- Modified: `next.config.mjs` (removed static-export config)
- Modified: `package.json` (deps + `seed` script)
- Modified: `.gitignore` (`.local/`, `supabase/.temp/`, `supabase/.branches/`)
- Modified: `.env.local` (gitignored — Supabase URL + anon key + service-role key)
- Created: `.mcp.json` at repo PARENT (`Gradiente/`)

### Open follow-ups

- Migrate remaining surfaces (mock → DB) using the same `getItems()` / `getItemBySlug()` pattern × ~10 files. Next-up.
- Build `lib/data/{users,comments,foro}.ts` for the surfaces that need them.
- Chunk 2: Supabase Auth + invite codes + minimal `/admin`. Removes [[useAuth]] sessionStorage hack and lets real users sign in. After this, we can re-tighten 0005's dev-visibility relaxation.
- Squash migrations pre-beta.

---

## 2026-05-02 · INGEST · Backend Plan — full consolidated plan written, Supabase project created

After multi-pass design conversation with Iker, wrote [[Backend Plan]] as the consolidated reference for moving Gradiente FM off `sessionStorage` + mock data onto a real backend. Supersedes [[Supabase Migration]] (kept as historical sketch with a header pointer); absorbs Phase 3 of [[Scraper Pipeline]]. [[Admin Dashboard]] stays current and complementary.

### Stack settled

Supabase (Free) for DB + Auth + Realtime + Storage; Vercel Hobby for app; Cloudflare Turnstile for captcha (progressive rollout); Sentry + Axiom for alerting + log drain; Resend for transactional email; GitHub Actions cron for the RA scraper (Python script stays as-is); Upstash Redis for rate limiting. Image storage starts on Supabase Storage; migrate to Cloudflare R2 if egress matters.

### Supabase project created (gradiente-fm)

Region: **East US (North Virginia)** `us-east-1` (lowest latency to CDMX of free-tier regions). Settings chosen for strict-by-default: Data API ON, **auto-expose new tables OFF** (closes the #1 cause of public-Supabase breaches), **automatic RLS ON** (every new table is RLS-enforced from creation). Personal MFA enabled on the dashboard account; org-wide MFA enforcement is paid-only and not necessary at this stage.

### Notable decisions (full detail in [[Backend Plan]])

- **Auth shape**: magic-link for signup + password reset; username/password for routine logins (Supabase keys on email; client resolves username → email via public RPC, then standard auth). Removes the `admin/admin` sessionStorage shortcut in [[useAuth]].
- **Bootstrap admin**: no template/seeded users in DB. Iker signs up with first invite code, sets `role='admin'` manually in Studio once, all further roles flow through `/admin` invite generator.
- **Beta gate**: invite codes carrying `intended_role` + `partner_id` + `partner_admin`; pre-generate ~80, single-use, atomic redemption RPC. Single Postgres trigger applies the carried metadata on signup.
- **Mock data migration**: add `seed boolean default false` to `items` / `comments` / `foro_threads` / `users`; seed all current mock with `seed=true`; RLS hides seed rows from public reads (admins still see them for testing). When real content lands: `delete where seed=true` — one transaction.
- **Image uploads**: client-side `browser-image-compression` in Web Worker; per-surface raw caps (foro 3 MB, marketplace 4 MB, editorial flyer 6 MB) auto-compressed to ~400 KB / ~700 KB / ~1.2 MB respectively. GIFs allowed in foro under stricter caps (no recompress — breaks animation), 800×800 dim. Server-side fallback via Storage triggers. Presigned URLs only — never through the app server.
- **Foro retention**: hard delete thread + replies + R2 images **30 days after `bumpedAt`**, regardless of catalog position. The existing 30-thread soft cap on the catalog is preserved; off-cap threads stay URL-accessible until deletion.
- **RA scraper cadence**: **MWF** (`0 12 * * 1,3,5` UTC = 06:00 CDMX Mon/Wed/Fri). Daily was overkill, weekly too sparse. Field-level UPSERT rules enforced by RPC: scraper can update RA-source-of-truth fields (title, venue, date, etc.) but **cannot touch `vibe`, `editorial`, `pinned`, `elevated`, `hp`** — editor- / curation-owned columns are off-limits. `genres`/`tags` merge: scraper adds, editor never loses additions.
- **Realtime**: comments + foro thread + foro catalog get Supabase Realtime channels. **Home feed deferred** — too much bandwidth for HP-curated content. Instead, [[FeedHeader]] gets a 5-min countdown chip — `// SISTEMA · ACTUALIZACIÓN EN 04:23 · CURVA HP` — synced with HP rollup pg_cron + Next.js `revalidate=300`. Counter-zero triggers a [[CRT Scanline Sweep]] (first ship of that roadmap idea) + `router.refresh()`. The displayed count stays honest: when it says 04:23, the feed really is unchanged for the next 4:23.
- **HP write path**: append-only `hp_events` table with view/click/save/comment signals; pg_cron batches into `items.hp` deltas every 5 min; lazy `currentHp(item, now)` from [[curation]] unchanged on reads.
- **Captcha rollout**: Turnstile on signup only at Phase 0 (don't punish 50 known beta users); add to first-foro-post + first-marketplace-listing at Phase 1; rate-aware comment composer at Phase 2 if abuse appears.
- **Future-proofing for the achievement system**: backend leaves space for `event_attendances` + `badges` + `user_badges` tables and `users.profile_meta jsonb` (already in initial schema). Verification gesture (QR / NFC / partner-code) stays out of scope until partnership conversations actually start.

### Phasing

Five chunks, ~2.5-3 weeks total focused work, longer if interleaved. Loose timeline — getting it right beats getting it fast.

1. Foundation (~3-4 days): schema + RLS + migrations; mock data seeded; server components read from DB.
2. Auth + admin (~3 days): Supabase Auth + invite codes + minimal `/admin`. [[useAuth]] sessionStorage hack removed.
3. User writes (~4 days): comments / saves / polls / foro through Supabase + Realtime + image uploads.
4. Ops layer (~2 days): pg_cron + Sentry + Axiom + `/api/health` + rate limits + restore drill + runbook.
5. Scraper productionization (~1-2 days): GH Actions MWF cron.
6. Beta open: 80 invite codes + k6 load test + send first 50.

### 25-launch-blockers checklist

The full list (no load testing, session in memory, uploads on app server, etc.) gets mapped to architectural decisions in [[Backend Plan]]'s checklist table. Every item has a named answer.

### Files

- Created: `wiki/70-Roadmap/Backend Plan.md`
- Updated: `wiki/index.md` (added [[Backend Plan]] under 70-Roadmap, demoted [[Supabase Migration]] description to "older, narrower draft superseded")
- Updated: `wiki/70-Roadmap/Supabase Migration.md` (header pointer to [[Backend Plan]])
- Updated: `wiki/70-Roadmap/Open Questions.md` (closed "when do we commit to [[Supabase Migration]]")

---

## 2026-05-02 · INGEST · Agenda — chronological sort + archived-past visual treatment

`/agenda` was displaying events latest-date-first (May 30 at top, May 2 at bottom) — opposite of what users expect from a calendar page. The page even labeled itself `FUTURO → PASADO` while doing the reverse. Iker flagged it: "the sooner the event will appear, the closer to the top."

### What changed

**New sort key for the agenda surface only.** Added `mode="agenda"` to [[ContentGrid]]; `/mixes`, `/noticias`, `/reviews`, etc. keep their existing date-desc behavior since "newest first" is the right metaphor for editorial content. Inside `mode="agenda"`:

1. **Future block first, soonest at top.** `parseISO(item.date) >= now` items sort ascending by `date`.
2. **Past block at the bottom, most-recent past first.** `parseISO(item.date) < now` items sort descending by `date`.
3. **Same-day tiebreak: `prominence`** (the curation `0.5 × freshness + 0.5 × score + imminenceBonus` composite). On a busy night, the buzzy event of the night sits at the top of that day. HP still influences ordering — just doesn't override chronology.

**Past events are demoted, not hidden.** Two reasons: (a) past events still accumulate comments and HP via the foro and overlay discussion column, so the historical record matters; (b) the [[HP Curation System]] already accelerates decay 2× past 30 days, so a past event nobody talks about fades to near-zero HP within weeks — that's the democratic mechanism doing its job. Visual demotion is `filter: saturate(0.4) brightness(0.85); opacity: 0.7` with a 0.3s ease transition, applied only when `mode === 'agenda' && item.type === 'evento' && parseISO(item.date) < Date.now()`. Future events stay full color.

**Label updated.** `EVENTOS · N ENTRADAS · FUTURO → PASADO` → `EVENTOS · N ENTRADAS · PRÓXIMOS · ARCHIVO ABAJO`. The new copy reads correctly given the new ordering and signals the archive section.

### Why HP doesn't override chronology on /agenda

Considered using full `prominence` ranking (same as the home grid). Rejected — a high-HP editorial event 3 weeks out would outrank a quieter event tomorrow, which is wrong for a calendar page. Users reading `/agenda` are answering "what's happening soon," not "what's most popular." HP/prominence-driven ranking is the home grid's job; `/agenda` is chronological with HP as a tiebreaker only.

### Why past events stay visible

User flagged the redundancy concern with the [[Foro]] (which also hosts post-event discussion). Conclusion: not a duplication — an event card carries structured metadata (date, venue, lineup, flyer, ticket link) that a foro thread can't, so it's the canonical artifact even after the conversation has migrated. If a past event spawns a long foro thread, that's a signal of HP, not a duplication.

### Verified in preview

- Top 6 cards: all `MAY 2` (today).
- Bottom 4 cards: `ABR 25 → ABR 19 → ABR 19 → ABR 18` (past, most-recent first).
- 36 of 151 cards have the desaturate + opacity treatment applied.
- Future cards keep `filter: none; opacity: 1`.
- Page label reads `EVENTOS · 151 ENTRADAS · PRÓXIMOS · ARCHIVO ABAJO`.
- Click-to-overlay still works on past events — just visually muted.

### Files

- `components/ContentGrid.tsx` — added `'agenda'` to the `mode` union, new sort branch, `isPast` prop on `MosaicItem`, conditional CSS filter + opacity.
- `app/agenda/page.tsx` — `mode="agenda"` + label rewrite.

### Open follow-up

- **Past-event treatment on home** if an editor `elevated: true`'s a past event into the main mosaic. Currently the demotion only fires in `mode="agenda"` so home keeps full color. Probably right — home is HP-driven and editor's intent is "boost this" — but flagged in [[Next Session]] S5 as a deliberate design call.

---

## 2026-05-02 · INGEST · EventosRail — Windows/high-refresh fixes (subpixel scroll + drag-to-scroll)

Iker pulled the morning's [[EventosRail]] work onto a Windows PC and hit two failure modes that didn't surface on the MacBook. Both got root-caused via instrumented `preview_eval` and shipped today.

### Failure mode 1 — auto-scroll appears to start, then freezes

Symptom on Windows: rail nudges ~1px on first frame, then sits still. Same code on MacBook works fine.

**Diagnosis.** `scrollLeft` rounds to integers on this engine (verified empirically — writing 0.21 reads back 0; writing 0.7 reads back 1). The auto-scroll loop was doing `track.scrollLeft += SCROLL_SPEED_PX_PER_SEC * dt` per frame. At 60Hz (`dt ≈ 16.6ms`), the per-frame increment is 0.58px — rounds up to 1, accumulates correctly. At 120Hz+ (`dt ≈ 8ms`), the per-frame increment is 0.29px — rounds to 0 every frame, scroll never advances. The MacBook ran at 60Hz so it worked; Windows monitor was high-refresh and exposed the bug.

**Fix.** Keep a fractional accumulator (`let accum = 0`) outside `scrollLeft`. Per frame: `accum += SCROLL_SPEED_PX_PER_SEC * dt`, then commit only `Math.floor(accum)` whole pixels and subtract them from `accum`. The fraction carries across frames regardless of refresh rate. Verified in preview: 162fps headless, scrollLeft advances 62px over 2s (target 70px, accounting for sample quantization).

### Failure mode 2 — "ARRASTRA O ESPERA" copy lied about drag-to-scroll

The morning ship added the `ARRASTRA O ESPERA` ("drag or wait") sub-line, but native `overflow-x: auto` only wires drag-to-scroll for trackpad/touch — mouse drag on Windows did nothing. The label was aspirational.

**Fix.** Pointer events (mouse + touch + pen unified):
- `pointerdown` → record `dragStartX`, `dragStartScroll`, set pause; don't yet flag as drag.
- `pointermove` → if motion exceeds `DRAG_THRESHOLD_PX = 5`, flip `dragged = true`, set pointer capture, change cursor to `grabbing`. Set `track.scrollLeft = dragStartScroll - dx`.
- `pointerup` / `pointercancel` → if `dragged`, release capture, restore cursor, override the lingering pointermove pause with a shorter `PAUSE_AFTER_DRAG_MS = 500` so auto-scroll resumes promptly after release.
- `click` (capture phase) → if `dragged`, `stopPropagation` + `preventDefault` so the post-drag click doesn't accidentally open a card overlay.

Genuine taps below the threshold still open the card. Cursor: `grab` on the track, `grabbing` while actively dragging.

**Pause-tuning side effect.** While auditing the pause logic I noticed `PAUSE_AFTER_INTERACTION_MS = 3000` was being refreshed on every pointermove during a drag — so a 5-second drag + release meant a 3s wait before auto-scroll resumed. Dropped the wheel/touch constant to 1500ms (`user is reading a card`) and added `PAUSE_AFTER_DRAG_MS = 500` (`user just repositioned the rail; resume quickly`) applied explicitly in `endDrag`.

### Defensive try/catch on pointer-capture

`setPointerCapture` / `releasePointerCapture` can throw `InvalidStateError` if the pointer isn't an active browser pointer (synthetic events, element re-attachment, etc.). The optional chain `?.` doesn't catch exceptions. Wrapped both in try/catch + a `hasPointerCapture` guard. Production code path doesn't hit this, but it kept biting during synthetic-event testing in the preview.

### Verified in preview

- Subpixel: scrollLeft advances steadily at 35 px/s under 162fps headless.
- Drag: 6 pointermove events × 12px = 72px drag → scrollLeft moves exactly 72px.
- Tap (no drag): card overlay opens normally.
- Drag + release: auto-scroll resumes at ~560ms after release (target 500ms).
- Cursor: `grab` over the track; `grabbing` mid-drag.

### Files

- `components/EventosRail.tsx` — accumulator, pointer event handlers, pause constants split, capture try/catch, `cursor-grab` class.

### Open follow-ups

- **Mobile pass for the rail** — drag uses pointer events so should work on touch, but the 180px card width means ~1.8 cards visible on a 360px viewport. Probably want a smaller variant. Tracked in [[Next Session]] S4.
- The subpixel-scroll trap is a generic gotcha — any future rAF loop nudging sub-pixel deltas to `scrollLeft` / `scrollTop` needs the same accumulator pattern. Worth a wiki page if a second offender shows up.

---

## 2026-05-01 · INGEST · EventosRail — manual + auto scroll cooperation

Quick fix to the rail shipped earlier today. Iker hit the obvious failure mode: "once an event has scrolled, it is gone until the carousel restarts." The CSS marquee + `overflow-hidden` meant the only motion was auto-scroll, and there was no way to backtrack to a card you missed without waiting ~240s for the next cycle.

### What changed

- **Replaced the CSS animation with a `requestAnimationFrame` loop** that nudges `track.scrollLeft` by `SCROLL_SPEED_PX_PER_SEC * dt` pixels per frame (35 px/sec). Manual scroll (wheel, touch, drag) and auto-scroll now operate on the same `scrollLeft` property — they cooperate naturally.
- **Wrapper is now `overflow-x-auto`** (was `overflow-hidden`). Users can scroll/swipe/wheel through cards at will. Native scrollbar hidden via `scrollbar-width: none` (Firefox) + a new `.evento-rail-track::-webkit-scrollbar { display: none }` rule in `globals.css` (WebKit) — the rail keeps its clean look; the auto-motion + edge fades carry the scrollability affordance.
- **Pause rules:**
  - Hover or focus-within → paused indefinitely (so users can target a card without it sliding away).
  - User-initiated scroll (`wheel` / `pointerdown` / `touchstart`) → paused for 3s after last interaction. Auto-scroll resumes from wherever the user landed; no jump-back.
- **Seamless wrap preserved.** Cards are still duplicated (`[...sorted, ...sorted]`); when `scrollLeft >= scrollWidth/2`, the loop subtracts `scrollWidth/2`. Since the second-half cards are identical to the first-half cards at the same on-screen position, the wrap is invisible. Verified with eval: scrollLeft 22418 → 50, leftmost visible card unchanged.
- **Reduced-motion** still respected: the rAF effect short-circuits when `prefers-reduced-motion: reduce` matches. Manual scroll always works regardless.
- **Sub-line copy updated** from `PRÓXIMOS · ORDEN CRONOLÓGICO · CLICK PARA DETALLE` → `PRÓXIMOS · ORDEN CRONOLÓGICO · ARRASTRA O ESPERA · CLICK PARA DETALLE` — the `ARRASTRA O ESPERA` ("drag or wait") signals the new affordance without adding chrome.

### Verified in preview

- `track.overflowX === "auto"`, `track.scrollbarWidth === "none"`, scrollWidth 44736px (vs viewport ~1400px in headless preview), 238 cards.
- Manual scroll to position 5000 → fired wheel event → after 1.5s scrollLeft is still 5000 (pause-on-interaction works).
- Manual scroll back from 3000 → 1000 → leftmost visible card changed to "ROOFTOP PARTY 'ANGEL DE LA INDEPENDENCIA'" (backward scroll works, user can revisit cards).
- Wrap math sanity: scrollLeft 22418 → after wrap step → 50. (Auto-tick of the rAF loop doesn't run reliably in the headless background tab, but the wrap math is verifiable directly.)

### Why rAF instead of CSS scroll-snap + auto-cycling

Considered a `scroll-snap-type: x mandatory` + `setInterval(scrollBy(cardWidth))` approach. Rejected because it produces jerky stepwise motion, conflicts with smooth user dragging mid-snap, and snap points feel wrong for a continuous "live ticker" surface. The rAF + `scrollLeft` approach is what carousel libraries like Embla and Splide do under the hood; doing it in 50 lines without a dep felt like the right tradeoff at this scale (single rail, single page, no edge cases).

### Files

- `components/EventosRail.tsx` — rewrote the scroll mechanism (added `useEffect` with rAF loop + event listeners; replaced `motion-safe:animate-[...]` classes with a plain `evento-rail-track` className).
- `app/globals.css` — added the WebKit scrollbar-hide rule.
- `wiki/40-Components/EventosRail.md` — updated the Behavior + What it depends on sections.

### Open follow-up

- **`overscroll-behavior-x: contain`** — already added to prevent horizontal swipes from triggering page-level back-nav on touch devices. Worth verifying once the mobile pass happens.
- The CSS `nge-ticker` keyframe is still in `globals.css` and still used by [[Navigation]]'s data-strip ticker. Don't remove it.

---

## 2026-05-01 · INGEST · EventosRail — early Phase 2 demotion of scraped events

Third change in today's scraper arc, driven by the obvious failure mode of the morning's ship: 128 RA events landed in the home mosaic and immediately swarmed it (190 cards total, mostly scraped). Iker's framing in the chat: "the entire feed got swarmed by them — there's basically 81 events flooding the entire page." Two ideas weighed: HP penalty alone vs horizontal carousel. Recommendation was rail-first with HP/elevation as the editor lever, since pure HP doesn't fix the visual real-estate problem (events sink to the bottom but still consume mosaic positions).

This is functionally [[Scraper Pipeline]] **Phase 2 arriving on day one** — see that doc for the updated phase narrative. Editorial dominates home, scraped lives in its own surface, editor elevation pulls individual scraped events into the mosaic.

### What shipped

- **New field** on [[types]] · `ContentItem.elevated?: boolean` — editor lever. When true on a scraped event, that event leaves the rail and joins the main mosaic where it competes via HP. Default `false` (script never sets it). No-op for non-scraped items.
- **New component** · [[EventosRail]] — auto-scrolling horizontal marquee under the [[HeroCard]]. ~5-7 cards visible at desktop width, marquee speed scales with item count (`max(60, count*2)` seconds per cycle ≈ 2px/sec at 119 events). Cards are 180px wide with `aspect-[4/5]` image, //EVENTO label, date chip (month/day/weekday), 2-line title, 1-line venue. Pauses on hover/focus; reduced-motion users get a manually-scrollable list (`motion-reduce:overflow-x-auto`). Click → same `useOverlay` flow as [[ContentCard]].
- **Wiring** · [[Home]] page splits `homeItems` via the `isRailEvent` predicate (`source === 'scraper:ra' && !elevated`). `railEvents` feeds the rail, everything else flows to the mosaic as before. Single source of truth for the split lives in `app/page.tsx` so the filter can be tweaked without touching component internals.

### Visible result (verified in preview)

- Home grid header dropped from `190 ENTRADAS` → `71 ENTRADAS`. The mosaic now reads as editorial-led with the Club Japan editorial pinned hero, then the agenda rail, then editorial + manually-authored event cards.
- Rail header reads `// AGENDA · 119 EVENTOS · LIVE FEED · RA` with a pulsing green dot — matches the existing system-terminal voice.
- Rail card click → URL → `?item=ra-<slug>` → EventoOverlay mounts (verified with Salón Sölín card; same flow, same overlay component).
- Marquee animation configured + running (`animation-play-state: running`, transform offset `-1847px` after page-load). Was paused in headless preview because Chrome throttles backgrounded tabs; will run for users.

### Architectural significance

Original phase plan had the scraper firehose in the home grid for launch (event-listing-first user acquisition) and Phase 2 demotion only after editorial/foro gained organic traction. In practice the firehose was visually unworkable from minute one — 128 cards in a single mosaic is just noise, regardless of HP ranking. The rail solves that without giving up the user-acquisition benefit (the LIVE FEED chip + auto-motion under the hero is highly visible, and the rail is the first thing below the editorial pinned hero — not buried).

The `elevated` lever preserves the [[Guides Not Gatekeepers]] thesis: editor judgment can still pull individual scraped events into the editorial competition. Scraper output is leads, not content.

### Open follow-ups

- **//FUENTE · RA chip** in [[EventoOverlay]] — still pending from the morning's ship. Now that rail cards exist, the chip should also appear on those (small mirror).
- **Editor-elevation surface** — flipping `elevated: true` is currently file-edit only (write `elevated: true` on the item in `lib/scrapedEvents.ts`). A proper UI lives behind [[Supabase Migration]] / [[Admin Dashboard]] (Phase 3).
- **Mobile pass** for the rail — touch + reduced-motion fallback path (`overflow-x-auto`) needs testing on small viewports. Consistent with the broader mobile-pass debt in [[Next Session]].
- **Date-tab filter** above the rail (TONIGHT / TOMORROW / THIS WEEKEND) — option (b) from the ship discussion. Skipped for first ship; revisit if the rail feels too undifferentiated.

---

## 2026-05-01 · INGEST · Scraper Pipeline — hotlink images + RA descriptions

Two follow-up changes to the Phase 1 ship from earlier today, both driven by Iker's feedback:

### Switch from rehosted flyers to hotlinking RA's CDN

Original Phase 1 ship downloaded each flyer to `public/flyers/ra-<id>.jpg` and committed them. Iker's call: hotlink directly to `images.ra.co` instead. Strongest "we're an aggregator" signal — we literally point at RA's files rather than copying them — and zero repo growth from re-scrapes.

**Verified empirically**: `curl -sI -H "Referer: http://localhost:3003/" https://images.ra.co/<sha>.jpg` returns HTTP 200. RA's Cloudflare CDN doesn't enforce a referer check, so hotlinking from any origin works.

**Code changes** in `Webscraper/ra_to_gradiente.py`:
- Removed `download_flyer()`, `flyer_filename_for()`, the `FLYERS_DIR` constant, and the `--no-flyers` CLI flag.
- `get_flyer_url()` now returns the raw RA CDN URL; the main loop stores it directly in `imageUrl` (no `/flyers/` prefix).
- Stats updated: `with_image` / `no_image` / `with_description` instead of `flyers_saved` / `flyers_failed`.
- Header comment in the script documents the decision + the empirical referer check, so future readers know why we hotlink instead of download.

**Cleanup**: deleted 83 `public/flyers/ra-*.jpg` files left over from the rehost run. Repo back to the original 98 seed flyers.

**Tradeoff to accept**: if RA cycles a URL or takes an event down, the thumbnail breaks (404). Acceptable for MVP; failure mode is "broken thumbnail" not "broken page." Falling back to local rehost is a 5-line revert if it ever becomes a problem.

### Pull RA event descriptions into `excerpt`

Iker noticed scraped cards lacked the well-written event paragraphs that some RA events carry. RA exposes this on `Event.content` (introspected the GraphQL schema to confirm — also saw `pick.blurb` for editorial picks but it's null in the CDMX sample, deferred). Length varies wildly: some events have a one-liner ("Open hours: Wed-Sun 6pm-3am"), others have multi-paragraph copy with line-up bios, pricing details, and credits.

**Code changes** in the same script:
- Added `content` to the GraphQL query.
- New `clean_description()` helper that strips stray HTML-ish tags (RA's `lineup` field has `<artist id="...">name</artist>` markers that occasionally bleed into `content`) and collapses whitespace.
- `emit_item()` writes an `excerpt: "..."` line when present (omitted when null, no empty-string noise in the file).
- `parse_existing_items()` updated to round-trip `excerpt` across re-runs so manual edits aren't lost (still doesn't preserve manual non-id field edits in general — the open-follow-up flagged earlier today).

**No new types** — the existing `excerpt?: string` field on `ContentItem` already wires through to both the card preview and the EventoOverlay reader pane.

### Verified in preview

- 99 hotlinked images render on the home page, all `complete: true` with non-zero `naturalWidth` (sampled). RA's CDN serves them with permissive caching headers.
- Clicking a card with a description (`Deseo x fiestuki`) opens the EventoOverlay with: hotlinked flyer at top → structured fields (FECHA, HORA, LUGAR, PRECIO, VIBE, LINE-UP) → full multi-paragraph RA description → `ra` tag chip → orange `COMPRAR BOLETOS ↗` CTA linking back to `https://ra.co/events/<id>`.
- The aggregator framing is now visibly load-bearing: the image *is* RA's, served by RA, and the only purchase path goes back to RA. We're orienting users toward the event, not capturing them.

### Updated stats (re-run, CDMX-only, 4 weeks)

```
New events            : 128
Multi-day collapsed   : 22
With hotlinked image  : 108
No image on RA        : 20
With description      : 81
```

81 of 128 events (63%) carry an RA-authored description that now renders in the overlay. The other 37% have no `content` on RA — those are the bare cards with just venue + date + lineup.

### Open follow-ups (still pending from this morning's ship)

- **//FUENTE · RA chip** in EventoOverlay when `source === 'scraper:ra'`. The `COMPRAR BOLETOS ↗` button already links to RA, but an explicit attribution chip alongside the //EVENTO label would make the "RA-sourced, edited by us never" framing unambiguous.
- **Editor review surface** — still file-based for now.
- **Vibe assignment** — still defaults to 5; manual edits still get clobbered on re-scrape (the round-trip parser preserves `id`, `slug`, `excerpt`, etc. but treats RA as the source of truth on re-fetch).
- **Phase 2 demotion** — when foro/editorial gain traction, filter `source === 'scraper:ra'` out of home and limit them to `/agenda`.

---

## 2026-05-01 · INGEST · Scraper Pipeline — Phase 1 (direct RA → app, skip Excel)

The RA scraper is back in scope. Iker's call: event listing is the launch user-acquisition draw, so the scraper has to ship for the visual MVP — but feeding directly into the app, no Excel intermediate, no Supabase. See [[Scraper Pipeline]] for the phase strategy (Phase 1 firehose → Phase 2 demotion to /agenda once editorial/foro mature → Phase 3 Supabase + cron).

**New files:**
- `Webscraper/ra_to_gradiente.py` — adapted from `ra_scraper_v2.py`. Same RA GraphQL fetch + flyer download, but writes a typed `ContentItem[]` TS file instead of an Excel sheet. Dedups against an existing scrape file (regex-parsed for `externalId` values) so re-runs UPSERT, and within-batch dedups multi-day events that RA returns as multiple listings sharing one event.id.
- `lib/scrapedEvents.ts` — auto-generated. Exports `SCRAPED_EVENTS: ContentItem[]`. Header marks it as machine-written + tells the reader how to regenerate. Items are sorted by date ascending so re-scrape diffs are readable.

**Type additions** ([`lib/types.ts`](../lib/types.ts)):
- `source?: 'scraper:ra' | 'manual:editor' | 'manual:partner'` — provenance, drives the future //FUENTE attribution chip and the Phase 2 home-vs-/agenda filter.
- `externalId?: string` — upstream id (RA event id), the dedup key on re-scrapes.
- New `ContentSource` type alias.

Both fields are optional → no migration needed for existing items.

**Wiring** ([`lib/mockData.ts`](../lib/mockData.ts)) — one-line change: `[...RAW_ITEMS, ...SCRAPED_EVENTS]` instead of just `RAW_ITEMS`. All 7 downstream MOCK_ITEMS consumers (page.tsx, partnerOverrides, saves, category routes, etc.) automatically pick up scraped events without modification because they're already typed `ContentItem`s.

**Field mapping (RA event → ContentItem evento):**

| RA field | ContentItem field | Default |
|---|---|---|
| `title` | `title` | "untitled" |
| `id` | `externalId` + `id: ev-ra-<id>` | — |
| `date + startTime` | `date` (ISO) | midnight + 22:00 |
| `date + endTime` (with day-roll if past midnight) | `endDate` | undefined |
| `venue.name` | `venue` | "Venue TBA" |
| `venue.area.name` (mapped to short code) | `venueCity` | "Mexico City" |
| `artists[].name` | `artists` | `[]` |
| `cost` | `price` (or "Gratis" for "0"/empty + free) | undefined |
| `contentUrl` | `ticketUrl` (full RA URL) | — |
| `genres` (mapped via RA_GENRE_MAP) | `genres` | `[]` |
| `images[FLYERFRONT or first]` (downloaded to `public/flyers/ra-<id>.jpg`) | `imageUrl` | undefined |
| — | `vibe` | `5` (neutral, editor-set later) |
| — | `editorial` | `false` |
| — | `source` | `'scraper:ra'` |
| — | `tags` | `["ra"]` |
| — | `slug` | `ra-<sanitized-title>-<external-id>` |

**Phase 1 first run** (CDMX-only, 4 weeks):
- 150 listings fetched from RA → 128 unique events after collapsing 22 multi-day duplicates.
- 108 flyers downloaded to `public/flyers/ra-*.jpg` (committed per Iker's call — option (a)). 20 events had no image on RA.
- Home grid header updated from ~70 entries → 190 entries (190 = ~62 seed + 128 scraped, partners excluded).
- Real CDMX events render in the mosaic with the same EventoOverlay path as seed content. Verified in preview: "Imago & K'OLIS + LUCRECIA @ Terraza Catedral", "Deseo x fiestuki @ CHICO", etc., with downloaded flyers + date chip + venue subtitle + genre tag.

### Three bugs caught + fixed before final ship

1. **Within-batch duplication** — RA's `eventListings` API returns multi-day events as multiple listings sharing one `event.id`. The first run wrote each event N times. Fix: a `batch_seen_ids` set in the main loop; collapses to one item per `externalId` per scrape. (22 collapses on the first real run.)
2. **Price `"0"`** — RA returns literal `"0"` for free events. The first run rendered cards with `price: "0"`. Fix: `re.fullmatch(r"0+(?:\.0+)?", s)` returns `"Gratis"`.
3. **EndDate day-roll** — events ending past midnight (e.g. starts 18:30, ends 01:00) wrote `endDate` on the same calendar day, producing non-monotonic ISO. Fix: if endTime ≤ startTime, bump the date by one day.

### Aggregator framing (per Iker's "we're not stealing data" goal)

- `ticketUrl` always points back to RA (`https://ra.co/events/<id>`). Card CTA is link-out, never an in-house ticketing flow.
- `source: 'scraper:ra'` on every item — drives the future //FUENTE · RA chip in EventoOverlay (small follow-up, not blocking this ship).
- Flyers re-hosted to our `public/flyers/` rather than hotlinked — kinder to RA's CDN, faster for our users. The downloaded image is RA's; attribution belongs in the overlay.

### Open follow-ups

- **//FUENTE · RA chip** in EventoOverlay when `source === 'scraper:ra'`. Mirrors the `//FUENTES` pattern from [[ArticuloOverlay]] / [[MarketplaceListingDetail]]. Small one-overlay edit.
- **Editor review surface**. Today the team reviews scraped output by reading `lib/scrapedEvents.ts` directly. Crude but works at MVP scale. A proper queue UI lives behind [[Supabase Migration]] (Phase 3).
- **Vibe assignment**. All scraped items default to `vibe: 5`. Editorial team can override case-by-case by editing the file in-place (the file's not regenerated unless `ra_to_gradiente.py` is re-run, and even then the parser preserves existing items via externalId merge — but it does NOT preserve manual edits to non-id fields, so an edited vibe gets clobbered on re-scrape). Worth flagging: a `vibeOverride` side-table or persisting parsed-then-merged-with-edits behavior is the correct fix once we feel the pain.
- **Phase 2 demotion**. Scraped events currently appear in the home grid alongside editorial. Once foro/editorial gain organic traction, filter `source === 'scraper:ra'` out of the home query and limit them to `/agenda`. Architecture supports this — the `source` field is already filterable from day one.
- **Cadence + automation**. Manually re-run for now. When Iker wants a schedule, cron lives in [[Supabase Migration]] (Phase 3).

---

## 2026-04-30 · INGEST · Marketplace v2 — Chunk C (sub-overlay listing detail)

Closes the read loop. Clicking any listing in [[MarketplaceOverlay]] now opens a sub-overlay with the full ficha — image gallery, full description, embeds, tags, shipping, vendor link back. Deep-linkable via `?partner=<slug>&listing=<id>`. ESC peels one layer at a time: sub-overlay → partner overlay → catalog.

**New component** — [[MarketplaceListingDetail]] (`components/marketplace/MarketplaceListingDetail.tsx`). Same visual idiom as the partner overlay (eva-box + scanlines + black/85 backdrop with blur, role="dialog"). Stacks at z-60 above the partner overlay's z-50 so the parent stays visible behind the backdrop. Body lock is left to the parent overlay since both stacks share `body.style.overflow = 'hidden'`. Layout splits left/right at the md breakpoint:

- **Left — gallery (55% width on md+)**: large 4:3 main image + thumbnail strip below (orange-bordered active thumb, opacity dim on inactive, `PORTADA` badge on the first thumb). Click any thumb → main image swaps. Single-image listings drop the strip; zero-image listings render the `//CATEGORY` placeholder. `activeImage` resets to 0 on listing-id change so deep-link re-entries always start at the portada.
- **Right — meta**: `★ MARKET · <PARTNER>` chip, big syne title (`id="listing-detail-title"` so the dialog gets `aria-labelledby`), category/subcategory line in vibe-orange, $price MXN in syne 3xl, a single horizontal strip combining `CONDICIÓN <X>` and the color-coded status pill (so the reader sees "what is it / can I buy it" together), then **//FUENTES** (link-out chips for any embeds, mirrors the `[[Embed Primitive]]` idiom from [[ArticuloOverlay]]'s track blocks — same `<a>` chip with `PLATFORM_LABEL` + `ExternalLink`), **//DESCRIPCIÓN** (free text), **//ETIQUETAS** (`#tag` chips), **//ENTREGA** (icon + label, only when `shippingMode` is set), **//VENDEDOR** (an in-app `← <PARTNER>` button that calls `onClose` to return to the partner overlay, plus an outbound `partnerUrl` chip when present), and a footer disclaimer reminding the buyer that GRADIENTE FM doesn't process pages or shipping.

**MarketplaceOverlay rewiring** — the partner overlay now reads both `?partner=` and `?listing=` from URL via `useSearchParams`. When `listing` is set, it resolves the listing off the partner's `marketplaceListings` (in publishedAt-desc order, mirroring the grid's index badge), and mounts `MarketplaceListingDetail` siblingwise inside its outer container. The detail's `onClose` strips `listing=` *only* via `router.replace`, leaving `partner=` untouched — closer drops back into the partner overlay, not the catalog. Card-click handler in the listings grid pushes `?listing=<id>` on the same URL using `router.replace({ scroll: false })` so the URL stays clean and history doesn't accumulate.

**MarketplaceListingCard becomes optionally clickable** — the card grew an `onClick?: () => void` prop. When provided it renders as a `<button>` with `aria-label="Ver detalle de <title>"` + hover/focus border in vibe-orange; otherwise it stays a presentational `<article>` (the GRID-mode preview in the dashboard composer doesn't get the click affordance, since clicking a preview to open another preview would be silly). Body markup extracted into a sibling `CardBody` component — both branches reuse the same render tree.

**ESC handling** — both overlays bind `keydown` on `window`. To prevent a single ESC from collapsing both at once, the partner overlay's handler is gated on `!listingId` (closure-captured at effect run time). Press order:

1. `?partner=…&listing=…` open → ESC → sub-overlay handler runs → strips `listing=` → next render, parent's effect re-runs without the gate → sub-overlay unmounts.
2. `?partner=…` open → ESC → parent's handler runs → strips `partner=` → catalog visible.

[[MarketplaceCatalog]]'s `onCloseOverlay` now strips both `partner` and `listing` so closing the partner card via the [×] button never leaves an orphaned listing param.

**Seed enrichment** ([[mockData]]) — `mkl-naafi-01` (Siete Catorce — Volcán) gained 3 images (`/flyers/rf-074.jpg`, `rf-075.jpg`, `rf-076.jpg`), 2 embeds (SoundCloud + YouTube placeholder URLs), and a real description. `mkl-naafi-02` got 2 images. This exercises the gallery-strip swap, the //FUENTES embed chip render, and the embed-less branch (the other 4 listings) in one catalog browse.

### Verified in preview

- `/marketplace?partner=naafi` → 6 listing cards, all `<button data-listing-id>` with proper aria-labels.
- Click `mkl-naafi-01` → URL becomes `?partner=naafi&listing=mkl-naafi-01`, sub-overlay (`role="dialog"`) mounts. Title strip `//LIST · ID·NAAFI-01`, gallery shows the rf-074 portada + 3 thumbnails with the PORTADA badge on the first, full meta on the right (Siete Catorce — Volcán h1, VINYL · 12" subcat in orange, `$450 MXN` in syne 3xl, CONDICIÓN NM + DISPONIBLE green pill row, //FUENTES with SOUNDCLOUD + YOUTUBE chips, //DESCRIPCIÓN with the full seed copy, //ETIQUETAS with `#limited #club-music #mexico`, //ENTREGA with the truck/AMBOS icon, //VENDEDOR back-button + naafi.net outbound link).
- Click second thumbnail → main image swaps from `/flyers/rf-074.jpg` to `/flyers/rf-075.jpg`, the second thumb gets `aria-pressed="true"`.
- Press ESC once → URL → `?partner=naafi`, dialog count drops to 0, partner overlay still open with all 6 listing buttons intact.
- Press ESC again → URL → `/marketplace/`, both overlays gone, catalog grid visible with the N.A.A.F.I. card.
- Direct deep-link `?partner=naafi&listing=mkl-naafi-01` opens both overlays from the URL alone (validates the composer's VISTA PREVIA button workflow — the URL pattern Chunk B already targets).
- Zero console errors throughout. Build clean (no new lint warnings).

### Open follow-ups

- **Embeds editor in the composer**. The detail consumes `embeds`, but the dashboard composer doesn't yet expose an editor for them. Easy follow-up — the existing `EmbedList` from `Fields.tsx` (used by mix/listicle forms) drops in directly with `value={listing.embeds ?? []}` / `onChange={(embeds) => onPatch({ embeds })}`.
- **Image lightbox**. Clicking the big main image could expand to a full-viewport zoom (similar to the foro thread image float). Today the gallery is "click thumb to swap"; lightbox is a separate gesture.
- **Inline embed players**. Today embeds are link-outs, not inline iframes. The audio system has SoundCloud working as a live embed (see [[Audio reactive subsystem]]); plumbing that here would let buyers preview without leaving the overlay. Outside the v2 scope.
- **Quick-filter chips inside MarketplaceOverlay**. The reference screenshot showed `/ VINYL · / CASSETTE · …` chips above the listings grid. Still pending; would let buyers narrow by category without leaving the partner overlay.
- **Per-listing `sellerId`**. Carry-over from v1 — the detail still shows the partner's name uniformly as the vendor.
- **Sub-overlay back button on mobile**. The chrome strip's `← VOLVER` button is `hidden sm:flex`. Below sm, only the [×] CERRAR button is visible. Functionally fine (both call the same `onClose`), but a small visual gap.

---

## 2026-04-30 · INGEST · Marketplace v2 — Chunk B (composer rewrite, 3-zone layout)

The visual centerpiece of the v2 plan. Replaces the inline `ListingsEditor` (compact rows + per-row inline editor) inside [[MiPartnerSection]] with a 3-zone layout matching Iker's mockup. Pure UI work on top of Chunk A's type extensions; partnerOverrides write idiom unchanged. See [[MiPartnerSection]].

**Architecture** — single new orchestrator `ListingsManager` owns three sibling regions:

- **LEFT — `ListingComposer`**. Hot-resolved each render from `partner.marketplaceListings` by id, so partnerOverrides writes propagate instantly to both the composer and the preview pane. Empty-state placeholder when nothing is selected. Form fields (each in its own `FormField` wrapper):
  - `CharCountedInput` — title, max 80, counter flips red on overflow.
  - `CategorySubcategoryPair` — paired selects; subcategory `<select>` reads `SUBCATEGORIES_BY_CATEGORY[category]` and shows `// n/a` when the catalog is `[]` (only `other`). Switching category drops a now-orphan subcategory.
  - `<select>` condition + numeric `<input>` price (currency suffix in label from partner).
  - `StatusRadioRow` — 3-button radio (DISPONIBLE green / RESERVADO yellow / VENDIDO red); active button gets vibe-color border + tinted bg + matching dot.
  - `MultiImageGallery` — drag-drop drop zone (whole region; data URLs via `FileReader.readAsDataURL`), `+ AGREGAR` empty slot opens the file picker, per-image `↑ / ↓` reorder buttons + `×` remove (revealed on hover or focus-within), `PORTADA` star badge on `images[0]`, `ARCHIVO` label on data-URL slots so partners can spot uploaded vs linked images at a glance, `+ AÑADIR URL` fallback toggles an inline URL input (Enter commits, Esc cancels).
  - `CharCountedTextarea` — description, max 1000, same overflow treatment.
  - `TagsChipInput` — chip-style input. Enter or `,` commits; Backspace on empty input removes the last chip; click `×` per chip to remove. Stored lowercase, deduped. Renders as `#name` chips.
  - `ShippingRadioCards` — 3-card radio (ENVÍO / RECOGIDA / AMBOS) with icon (Truck/MapPin/Package) + label + sublabel. Click again on the active card clears (matches the optional `shippingMode?` shape).
  - `ActionRow` — `VISTA PREVIA` (Eye icon, opens `/marketplace/?partner=<slug>&listing=<id>` in a new tab — that URL is what Chunk C will react to), `▣ GUARDAR BORRADOR` (gray), `▶ PUBLICAR ITEM` (green primary). Edits are already auto-saved through inline writes, so both action buttons just close the composer and fire a 2.5s flash chip (`◉ GUARDADO` / `▶ PUBLICADO`). A real draft pipeline would need a new `_draft?` flag on `MarketplaceListing` + filter in the public catalog — flagged as a follow-up.

- **RIGHT — `ListingPreviewPane`**. Three-mode toggle in the header (`DESTACADA` / `GRID` / `LISTA`):
  - `DestacadaPreview` — large 4:3 image (or `//CATEGORY` placeholder), big title + category/subcategory line in vibe-orange, large price, meta block (CONDICIÓN / VENDEDOR / ENTREGA), description preview (line-clamp-4), `#tag` chips, status pill at the bottom.
  - `GRID` — embeds the existing public-side [[MarketplaceListingCard]] component verbatim, capped at 280px wide for the pane. Single source of truth — when the public card visual changes, the preview follows. (This is the shared component Iker asked about; deferring an extracted `ListingDetailView` until Chunk C lands and we can see the actual sub-overlay shape side-by-side.)
  - `ListaPreview` — linear row variant (thumb + title + category line + price + status pill).
  - Empty state when nothing is selected.

- **BOTTOM — `ListingsTable`**. Replaces the v1 compact-row UL.
  - Columns: thumb (32px), title, category+subcategory, condition, price, status pill (color-coded), updated (relative-ago), actions.
  - `SortHeader` per sortable column — click to toggle asc/desc; active column shows `↑`/`↓` indicator in orange. Default sort: `updated desc`.
  - Pagination at 5 per page with chevron-prev / chevron-next + `PÁGINA N / M` indicator. The N.A.A.F.I. seed (6 listings) renders 5 on page 1 + 1 on page 2 — exercises pagination out of the box.
  - Per-row actions: `Pencil` (edit; opens listing in composer, shows orange-active state when editing), `Copy` (duplicate; clones with new id + ` (copia)` title suffix + `status: 'available'` + `publishedAt: now`, auto-selects clone), `Trash2` (delete; red border).
  - `+ NUEVO LISTADO` in the header creates a fresh draft (`images: []`) and auto-opens it in the composer.
  - Editing-row highlight: orange-tint bg + orange-active edit pencil button so the user can always see which listing the composer is bound to.

**Sub-control implementation notes**:

- `relativeAgo(iso)` — handcrafted bucket helper (HOY / Nh / Nd / Nsem / Nmes), avoids pulling in another date-fns format for the table cell.
- Image gallery's drop zone wraps the entire region (drag highlight on the dashed border) but only `+ AGREGAR` does the file-picker click, so dragging an image directly onto an existing slot doesn't trigger a confusing per-slot replace.
- ImageSlot key is `${i}-${src.slice(0,24)}` so React doesn't reuse the same DOM node across reorders (the prior key would have caused image flashes during the swap).
- Auth context's `useResolvedUser` was already synchronous — the composer's hot-resolve trick is just `listings.find((l) => l.id === editingId)` each render; no extra subscription plumbing needed.

**Type changes** — none. Chunk A's `MarketplaceListing` shape carries through cleanly. Used the new `MarketplaceShippingMode` + `SUBCATEGORIES_BY_CATEGORY` exports.

**v1 inline editor + helpers** (`ListingsEditor`, `ListingRow`, `ListingEditor`, `Field`) deleted — not retained as a fallback since Chunk B is a clean replacement for the same surface.

### Verified in preview

- Logged in as `@loma_grave` on `/dashboard?section=mi-partner` → MiPartnerSection mounts MARKETPLACE tab. Both composer and preview show empty placeholders; table shows 6 ITEMS with pagination at PÁGINA 1 / 2 (5 rows page 1).
- Click pencil on `mkl-naafi-01` → composer header reads `EDITANDO · NAAFI-01`, every field hydrates: title `Siete Catorce — Volcán` (counter 22/80), CATEGORÍA VINYL + SUBCATEGORÍA `12"`, CONDICIÓN NM, PRECIO 450, status DISPONIBLE active, IMÁGENES · 0 with empty drop zone, ETIQUETAS shows `#limited #club-music #mexico` chips, MODO ENTREGA AMBOS active. Preview pane in DESTACADA renders the seed listing with full meta block, status pill, tags, description (when present).
- Type `TEST · Live Sync` into title → preview's `h3` updates instantly. Restored to original.
- Click RESERVADO → status active flips, preview pill switches to yellow. Restored to DISPONIBLE.
- Toggle preview mode to GRID → renders the public [[MarketplaceListingCard]] inside a 280px frame; LISTA → linear-row variant; DESTACADA → full ficha. All three live-bind to the listing.
- Click PRECIO sort header → table sorts ascending ($200 → $450), header label becomes `PRECIO ↑`. Click again → descending.
- Click chevron-right → PÁGINA 2 / 2 with the 6th row (`Girl Ultra`). Click duplicate on it → composer opens on the new clone with title `Girl Ultra — Sofía 12" (copia)`, total flips to 7 ITEMS.
- Click delete (red) on the (copia) row → row gone, total back to 6 ITEMS, composer drops to empty state (since the editing target was deleted out from under it).
- VISTA PREVIA opens `/marketplace/?partner=naafi&listing=mkl-naafi-01` in a new tab. Chunk C will mount the sub-overlay against this URL pattern; today the partner overlay opens but the listing param is ignored — by design.
- Zero runtime errors throughout (`preview_console_logs level=error` returned empty).
- Visual screenshot matches the v2 mockup: composer left, preview right (stacking on narrow viewports — `lg:grid-cols-2` breakpoint), table below with editing-row orange highlight.

### Open follow-ups (carry into Chunk C)

- **Sub-overlay listing detail at `?listing=<id>`**. The composer's VISTA PREVIA button already targets the URL pattern; Chunk C's overlay reacts to it.
- **Embeds editor inside the composer**. Chunk A's `embeds?: MixEmbed[]` field is on the type but not yet exposed in the composer — Chunk C surfaces the consumer first (read-side embed render in the sub-overlay), Chunk D could add the dashboard editor reusing [[Embed Primitive]]'s `EmbedList` from `Fields.tsx`.
- **Real draft pipeline**. The GUARDAR / PUBLICAR distinction is cosmetic today (both close + flash). When partners need true save-then-publish semantics, add `_draft?: boolean` on `MarketplaceListing` + filter in the public catalog + a BORRADOR pill in the table.
- **Publish-confirm flow integration**. The existing [[PublishConfirmOverlay]] could wrap the PUBLICAR ITEM button if the partners want the same glitch-card confirmation gate as content items get.
- **Drag-handle reorder** in the image gallery. `↑/↓` buttons cover the use case; HTML5 drag-drop reorder would be ergonomic but is non-trivial. Defer.
- **Image gallery within published listings**. The public listing card still shows only `images[0]`. Chunk C's sub-overlay surfaces the full gallery.

---

## 2026-04-30 · INGEST · Marketplace v2 — Chunk A (type + storage + seed migration)

Foundation chunk for the v2 refinement laid out in [[Marketplace]] § "Planned refinement". Pure type/storage work; v1 UI continues to render unchanged. See [[types]] / [[mockData]] / [[partnerOverrides]].

**Type extensions** ([[types]]). `MarketplaceListing` reshaped:

- `imageUrl?: string` → **`images: string[]`** (required; first index is the portada). Empty array means no portada — the card falls back to the existing category-label placeholder.
- New `subcategory?: string` — member of the catalog below; the composer's dependent dropdown reads from here.
- New `tags?: string[]` — free-form chip input (e.g. "limited", "first-press", "sealed").
- New `shippingMode?: 'shipping' | 'local' | 'both'` (`MarketplaceShippingMode` union).
- New `embeds?: MixEmbed[]` — reuses the existing audio-system shape so SC/YT/Spotify/Bandcamp/Mixcloud preview links work without new infrastructure.

New const **`SUBCATEGORIES_BY_CATEGORY`** alongside the type — `Record<MarketplaceListingCategory, string[]>` with the catalog from the design doc:

- `vinyl` → `7"` `10"` `12"` `LP` `EP` `Single` `Compilation` `Box Set` `Picture Disc` `Coloured`
- `cassette` → `Album` `EP` `Mixtape` `Bootleg`
- `cd` → `Album` `EP` `Single` `Compilation` `Box Set`
- `synth` → `Analog` `Digital` `Modular` `Module` `Software`
- `drum-machine` → `Analog` `Digital` `Sampler` `Hybrid`
- `turntable` → `Direct Drive` `Belt Drive` `Cartridge` `Slipmat`
- `mixer` → `2-channel` `4-channel` `Rotary` `Battle` `Club`
- `outboard` → `Effects` `Compressor` `EQ` `Preamp` `Other`
- `merch` → `Camiseta` `Sudadera` `Gorra` `Tote` `Poster` `Otro`
- `other` → `[]` (composer should hide the subcategory field when this is selected)

**Seed migration** ([[mockData]]). All 6 N.A.A.F.I. listings rewritten to the new shape: `images: []` (none had portadas), seeded `subcategory` matching their format (the three `12"` vinyl pressings, the `Album` + `Mixtape` cassettes, the `Camiseta` merch), seeded `tags` (e.g. `["limited", "club-music", "mexico"]` on the Volcán pressing) and seeded `shippingMode` per real-world feel (`both` for vinyl/cassette, `shipping` for the merch tee, `local` for the Debit cassette to exercise that branch). No `embeds` on the seed — that's exposed by Chunk B's composer when partners want to attach a SoundCloud preview.

**Consumer migration** — only two read sites touched the old `imageUrl`:

- [[MarketplaceListingCard]] reads `listing.images[0]` for the public card hero, falling back to the same category placeholder as before. Comment refreshed to point at the composer drag-drop landing in Chunk B.
- [[MiPartnerSection]] inline editor — the single `IMAGEN URL` field now writes back as `images: [value]` (or `images: []` when cleared); the draft-creation default seeds `images: []`. v1 still feels identical to a partner editing one URL, but the field is plumbed through the new array shape so Chunk B can swap in the multi-image gallery without another migration.

[[partnerOverrides]] needs no structural change — `MarketplaceListing` is just typed differently; the override map shape and listing CRUD writers carry through unchanged.

### Verified in preview

- `npm run build` clean — 19/19 routes prerender, only the pre-existing `next/image` lint warnings.
- `/marketplace?partner=naafi` overlay mounts: `[data-listing-id]` returns all 6 ids (`mkl-naafi-01..06`); `h3` text matches every original title (Siete Catorce — Volcán, Girl Ultra — Sofía 12", BLAKK — Máquina Negra, N.A.A.F.I. 10 Años Camiseta, Debit — Live Recordings, Tatiana Heuman — Sismograma 12"); category placeholders render in lieu of portadas.
- No console errors after navigation; no runtime type errors.
- Dashboard inline editor unchanged — the IMAGEN URL field reads/writes through `images[0]` transparently; "AGREGAR LISTING" creates a draft with `images: []`.

### Open follow-ups (carry into Chunk B)

- Composer rewrite — drag-drop multi-image gallery (data URLs in `partnerOverrides`), tags chip input, shipping-mode 3-card radio, character counters, three-view live preview pane, paginated table with duplicate/delete-red.
- Composer to hide subcategory field when `category === 'other'` (catalog is `[]`).

---

## 2026-04-30 · INGEST · Marketplace v2 plan — composer rewrite + listing detail

Session ran out of context after Iker reviewed v1 and shared a richer composer mockup. Two pain points flagged:

1. **Listings are barebones on the public side** — no detail surface beyond the catalog tile, no embed support.
2. **Composer is too thin on the dashboard side** — current inline editor has title / category / condition / price / status / image-URL / description. Iker's mockup adds: subcategory pair, multi-image with portada + reorder, character counters on title (80) + description (1000), tags chip input, shipping-mode 3-card radio, three-view live preview pane, proper listings table with sort/paginate/duplicate/delete actions.

Locked design calls before context ended:

- Public listing detail = **sub-overlay** (not expand-in-place). URL pattern `?partner=<slug>&listing=<id>`.
- Image upload = **drag-drop AND URL fallback**, matching the existing dashboard-form `ImageUrlField` idiom (data URLs in sessionStorage via partner override).

Three chunks laid out in [[Marketplace]] § "Planned refinement":

- **Chunk A** — type extensions: `images: string[]` (replaces `imageUrl?`), `subcategory?`, `tags?: string[]`, `shippingMode?: 'shipping' | 'local' | 'both'`, `embeds?: MixEmbed[]`. Migrate 6 N.A.A.F.I. seed listings. Add `SUBCATEGORIES_BY_CATEGORY` const (vinyl gets 7"/10"/12"/LP/EP/Single/Compilation/Box Set/Picture Disc/Coloured; cassette gets Album/EP/Mixtape/Bootleg; etc.).
- **Chunk B** — rewrite [[MiPartnerSection]] composer to 3-zone layout: `ListingComposer` (left, full mockup), `ListingPreview` (right, 3 view modes — destacada / grid / lista), `ListingsTable` (bottom, with sort + paginate at 5/page + duplicate + delete-red).
- **Chunk C** — sub-overlay listing detail from [[MarketplaceOverlay]]. Image gallery, full description, embeds via existing [[Embed Primitive]], tags, shipping line, vendor link back to partner.

Suggested order: A → B → C. Foundation first, then visual centerpiece, then read-loop closure.

[[Next Session]] is the entry point for the next session — has auth shortcuts and smoke-test paths.

---

## 2026-04-30 · INGEST · Marketplace — partner-only commerce, dedicated route

Built the marketplace system end-to-end across four chunks: data + storage + permissions + seed; admin approval surface; partner-team dashboard; public surfaces. See [[Marketplace]] for the full design rationale.

**Identity model — no new role tier.** Per Iker's call: roles stay `user` / `curator` / `guide` / `insider` / `admin`. Partner-team membership is a new `partnerId?: string` field on User (references a partner ContentItem.id), and an in-team admin flag `partnerAdmin?: boolean` (only meaningful when `partnerId` is set). Mirrors the `isMod` / `isOG` flag pattern from [[Roles and Ranks]]. Capability matrix:

- Site `admin` → can approve any partner, manage any team, edit any marketplace card.
- `partnerAdmin: true` (in-team) → can add/kick team members of *their own* partner only.
- Regular team member (`partnerId` set) → can edit marketplace card + listings; cannot manage team.
- Outside the team → read-only via `/marketplace`.

**Types** ([[types]]). New `MarketplaceListing` (id / title / category / price / condition / status / image? / description? / publishedAt) with three string-union helpers (`MarketplaceListingCategory` × 10, `MarketplaceListingCondition` × 7, `MarketplaceListingStatus` = available/reserved/sold). ContentItem extended with `marketplaceEnabled` / `marketplaceDescription` / `marketplaceLocation` / `marketplaceCurrency` / `marketplaceListings`.

**Storage** ([[partnerOverrides]]). New `lib/partnerOverrides.ts` mirroring [[userOverrides]] — sessionStorage `gradiente:partner-overrides` keyed by partner id. Generic `setPartnerOverride` / `clearPartnerOverride` plus convenience listing CRUD: `addMarketplaceListing` / `updateMarketplaceListing` / `removeMarketplaceListing` / `setMarketplaceEnabled`. Hooks: `useResolvedPartner(id)`, `useResolvedPartners()`, `useMarketplaceEnabledPartners()` — all synchronous-per-render with tick-state listeners (matching the auth-flicker fix). [[userOverrides]] extended with `partnerId?: string | null` (null = explicit clear) and `partnerAdmin?: boolean`.

**Permissions** ([[permissions]]). Three new helpers:

- `canApprovePartner(user)` — admin-only; toggles `marketplaceEnabled`.
- `canManagePartner(user, partnerId)` — admin OR `user.partnerId === partnerId`. Edits the marketplace card + listings.
- `canManagePartnerTeam(user, partnerId)` — admin OR (`user.partnerId === partnerId && user.partnerAdmin`). Adds/kicks team members.

**Seed data**. N.A.A.F.I. (`pa-naafi`) marketplace pre-enabled with 6 listings spanning all three statuses (`available`, `reserved`, `sold`) and 3 categories (vinyl, cassette, merch) plus description / location / currency / listing count. `loma_grave` set as `partnerId: pa-naafi` + `partnerAdmin: true` (team manager); `yagual` set as `partnerId: pa-naafi` (regular team member). Lets every gating path be exercised without a single admin action.

**Admin approval surface** (chunk 2):

- [[PermisosSection]] user editor — added a `PARTNER · TEAM` block with a partner dropdown (with `· MKT` suffix on enabled partners) + a `PARTNER · ADMIN` toggle (disabled when no partnerId).
- [[PartnerApprovalsSection]] — new admin-only ExplorerSection. Searchable list of every partner with a `MARKETPLACE OFF/ON` chip + a per-row toggle (ToggleLeft/Right icon flips color and writes via `setMarketplaceEnabled`). Sidebar entry titled `Marketplace` (Lock icon → ShoppingBag).

**Partner-team dashboard** (chunk 3) — [[MiPartnerSection]]:

- Mounts when `currentUser.partnerId` is set. Sidebar row uses the partner's title.
- Two-tab switcher (MARKETPLACE default / EQUIPO).
- **Marketplace tab** — card meta editor (description / location / currency, disabled for non-managers) + listings grid with compact summary rows. `EDITAR` toggles inline editor per listing (title / category select / condition select / price number / status select / image url / description). `+ AGREGAR LISTING` creates a draft and auto-opens its editor. `BORRAR` removes (with sys-red border).
- **Equipo tab** — current team list with per-row promote/demote/kick affordances (gated by `canManagePartnerTeam`). Search-picker `AGREGAR · MIEMBRO` filters off-team users; click adds with `partnerId` set. Read-only notice for regular members.
- Marketplace-disabled banner at top when `marketplaceEnabled === false` — team can prep content while waiting for approval.

**Public surfaces** (chunk 4):

- [[MarketplaceCatalog]] — `/marketplace` body. Grid sorted by listing count desc, alphabetic tiebreaker. URL-driven overlay open via `?partner=<slug>`.
- [[MarketplaceCard]] — partner tile in the catalog. Image-forward with stats footer (ITEMS / DISPONIBLES / ZONA).
- [[MarketplaceOverlay]] — full-screen reader matching Iker's reference screenshot. Identity panel (★ MARKET chip + partner name in massive Syne + description + total/available/reserved/sold stats + location/currency/web + helper note). Listings grid sorted by `publishedAt` desc.
- [[MarketplaceListingCard]] — single listing tile. Numbered corner badge (01..N), image (or category placeholder), title + category line, price in vibe-orange, meta rows (CONDICIÓN / VENDEDOR / PUBLICADO), status pill at bottom (color-coded with dot).
- [[MarketplaceRail]] — home-page entry below [[PartnersRail]]. `//MARKETPLACE` strip, up to 3 partner thumbnails (smaller than catalog cards, link to `?partner=<slug>`), `EXPLORAR MARKETPLACE →` orange-bordered CTA linking to `/marketplace`. Per Iker: Spanish UI keeps "marketplace" as the loanword.
- [[Navigation]] — added `08 MARKETPLACE` link, between `07 FORO` and the auth badge.
- New route file `app/marketplace/page.tsx` wraps `MarketplaceCatalog` in Suspense for static export.
- New `ExplorerSection` values: `permisos`, `aprobaciones-mkt`, `mi-partner`. URL guards in the dashboard page route admin-only sections to home for non-admins, and the partner-only section to home for non-team users. `hideDetails` extended to drop the right pane on all three.

### Verified in preview

- `/` (any auth) → home shows the existing partners rail plus a new `//MARKETPLACE 01 ACTIVOS` strip below it with N.A.A.F.I. thumbnail + `EXPLORAR MARKETPLACE →` CTA.
- Top nav `08 MARKETPLACE` lands on `/marketplace`. Catalog grid renders 1 partner card with N.A.A.F.I. (6 ITEMS, 04 DISPONIBLES, ZONA CDMX, MX).
- Click N.A.A.F.I. tile → URL becomes `/marketplace/?partner=naafi`. Overlay mounts: identity panel (description, totals 06 / 04 / 01 / 01, ubicación CDMX MX, moneda MXN, web naafi.net) + listings grid with all 6 listings (Siete Catorce — Volcán $450 NM AVAILABLE; Girl Ultra — Sofía 12" $520 NEW AVAILABLE; BLAKK — Máquina Negra cassette $250 NEW AVAILABLE; N.A.A.F.I. 10 Años Camiseta merch $380 NEW RESERVED yellow; Debit — Live Recordings cassette $200 VG+ SOLD grey; Tatiana Heuman — Sismograma 12" $420 VG+ AVAILABLE).
- ESC / `[× CERRAR]` strips `?partner=` and returns to catalog.
- Login as `@datavismo-cmyk` (admin) → sidebar gains `Permisos` and `Marketplace` rows. `Marketplace` shows all partners with toggle chips; clicking a row's toggle flips the `MARKETPLACE OFF/ON` state live (storage write in `gradiente:partner-overrides`). `Permisos` user editor shows the new `PARTNER · TEAM` block with the dropdown.
- Login as `@loma_grave` → sidebar gains `N.A.A.F.I.` row (named after her partner). MiPartnerSection mounts with both tabs visible. EQUIPO shows herself (TÚ + ADMIN chip) and yagual; she can promote/demote and kick. MARKETPLACE shows all 6 listings + the description editor.
- Login as `@yagual` → same `N.A.A.F.I.` row but EQUIPO is read-only with the explanation. MARKETPLACE editor lets her edit listings + meta but not team.
- `npm run build` passes; `/marketplace` prerenders cleanly. Lint warnings unchanged (pre-existing `next/image`).

### Open follow-ups (tagged in [[Marketplace]])

- **Per-listing `sellerId`.** The reference screenshot shows different vendor names per item; today the listing card shows the partner name uniformly. Add an optional field + dashboard team-member dropdown.
- **Listing detail expansion.** Clicking a listing in the public catalog overlay does nothing yet. Sub-overlay or in-place expand for the description / contact / image-zoom.
- **Status transition / reservation flow.** Manual flips today; real-backend phase will need timeouts + buyer signals.
- **Filter chips inside the overlay.** Reference screenshot shows `/ VINYL`, `/ CASSETTE`, etc. Easy follow-up.
- **Listing image upload.** Currently a free-text URL. Use the same drag-drop idiom as [[Dashboard Forms]].

---

## 2026-04-30 · INGEST · Polls — attachment model, card-as-canvas, anonymous-until-vote

Shipped the polls system end-to-end: types + storage + card affordance + overlay section + dashboard authoring. See [[Polls As Attachments]] for the full design rationale.

**Model — attachment, not a content type** ([[types]]). Polls live as an optional `poll?: PollAttachment` on `ContentItem`. The `kind` field — `from-list` / `from-tracklist` / `attendance` / `freeform` — controls how choices are resolved per parent type. Embedding on the parent keeps it the source of truth: edit a listicle's tracks and the poll's choices update automatically.

**Storage** ([[polls]]). New `lib/polls.ts` mirrors the listener idiom from [[comments]] / [[foro]] / [[userOverrides]]. SessionStorage shape `gradiente:polls = { votes: { [pollId]: { [userId]: PollVote } } }` — only votes are session-scoped; poll definitions ride with the parent. Writers: `castVote(pollId, userId, choiceIds)` (replaces on revote), `clearVote` (re-anonymize, not exposed yet). Hooks: `useUserVote(pollId, userId)`, `usePollResults(pollId, choices)`. `resolvePollChoices(item, poll)` is the per-type variant resolver — derives choices from the parent for non-freeform kinds, returns `poll.choices` verbatim for freeform.

**Card-as-canvas** ([[PollCardCanvas]]). The visual challenge — how to surface a poll on a card without competing with the image or breaking mosaic heights. Solution: when the parent has a poll, the card renders one small chip in a corner of the image. Click → the canvas takes over `absolute inset-0` of the image area. Image dims under a black scrim; choices stack on top; vote casts; rows flip to vibe-colored result bars. ESC / click-outside / close button restores the image. The card chrome (title, badges, save mark) stays put — the canvas borrows the image's real estate, never the chrome. Mosaic grid never reflows.

Per-kind chip copy: `?VOTAR · FAV` (listicle), `?VOTAR · TRACK` (mix), `?VAS?` (evento attendance), `?VOTAR` (freeform). After voting → `✓VOTASTE` (sys-orange). After close → `CERRADA`.

**Overlay section** ([[PollSection]]). Sibling component, same data + same anonymous-until-vote gate, laid out as a permanent section inside the parent overlay. Mounted in [[ListicleOverlay]] (between body and `//SIGUIENTES·LISTAS`), [[MixOverlay]] (between tracklist and hotkeys footer), [[EventoOverlay]] (between artists/genres and tickets CTA), [[ReaderOverlay]] (between body and sticky footer), [[ArticuloOverlay]] (between body+footnotes and `//SIGUIENTES·LECTURAS`). Each renders `{item.poll && <PollSection ... />}` so polls only appear when the parent has one.

**Anonymous-until-vote.** Aggregate counts hidden behind `useUserVote(...) !== null`. Closed polls (past `closesAt`) reveal results unconditionally — the gate is for active polls. Carve-out from [[No Algorithm]] / [[Size and Position as Only Signals]]: the rules forbid engagement metrics on the *content surface*; poll counts on the *poll itself* are fine. Counts never affect feed ordering, card size, or curation.

**Authoring** ([[PollFieldset]] + [[Dashboard Forms]]). New shared component dropped into all 8 compose forms (`MixForm`, `ListicleForm`, `ArticuloForm`, `EventoForm`, `ReviewForm`, `EditorialForm`, `OpinionForm`, `NoticiaForm`). One `+ INCLUIR ENCUESTA` toggle to opt in; opens an editor panel with prompt + (for freeform only) choices list + close-date + multi-choice toggle. Editors don't pick the kind — it's auto-derived from the parent's content type. For listicle/mix/evento the choices auto-derive from the parent so the editor just authors the prompt; for noticia/review/editorial/opinion/articulo the editor authors choices manually.

**Seeded mock polls** in [[mockData]] — one per kind:

- `li-hard-techno-cdmx-2026` — `from-list`, "Tu favorito?" (5 tracks)
- `mx-001` — `from-tracklist`, "Mejor track del set?" (5 tracks)
- `ev-fascinoma-2026` — `attendance`, "Vas a FASCiNOMA?" + `closesAt`
- `no-001` — `freeform`, "Headliner que más quieres ver?" + 5 hand-authored choices

### Verified in preview

- Home grid: 4 poll chips render with correct per-kind labels (`VOTAR · FAV`, `VOTAR · TRACK`, `VOTAR`, `VAS?`).
- Click chip on listicle → canvas opens with 5 auto-derived track choices, prompt "Tu favorito?", reveal-after-vote copy. Vote → results show Phase Fatale 100% (1/1), others 0%, "1 VOTO" footer. Close → chip flips to `✓VOTASTE` (sys-orange).
- Open evento overlay (`?item=fascinoma-2026-cdmx-outdoor`) → PollSection renders with 3 attendance choices. Vote VOY → storage records `voy`, UI shows VOY 100% (1).
- Open NoticiaForm in dashboard → Section "05 ENCUESTA (opcional)" with `+ INCLUIR ENCUESTA`. Click → editor surface with `//ENCUESTA · LIBRE` header, prompt input, choices editor with `+ AGREGAR OPCIÓN`, close-date input, voto-múltiple checkbox.
- `npm run build` clean across all 8 form changes + 5 overlay changes + 2 card changes.

### Open follow-ups

- **Multi-vote UI** — `multiChoice: true` polls let a user pick multiple options, but the card canvas + overlay section only handle the click-once flow. Need: checkbox-style choice rows + an explicit `CONFIRMAR VOTO` button. Not exposed via the seed polls (none use multiChoice yet).
- **Close-date countdown** — closed polls render `CERRADA` chip + reveal results, but there's no "cierra en 3h" preview while open. Cosmetic; minor.
- **Vote-undo affordance** — `clearVote` exists but no UI consumer. Could surface as a small "QUITAR VOTO" link inside the canvas/section for already-voted users.

Next chunk per Iker's plan: marketplace surfaces (partner-only feed at its own slug below the partners rail).

---

## 2026-04-30 · INGEST · Loose-end pass — auth-overrides, tombstone revert, empty-Nuevo polish

Closed the three small follow-ups left after the role/permissions arc.

**Auth resolves through overrides** ([[useAuth]]). Refactored `AuthProvider` to hold `userId: string | null` in state; the exposed `currentUser` is now `useResolvedUser(userId)` from [[userOverrides]]. Admin self-edits (and any cross-edit that targets the logged-in user) propagate to every consumer that reads `currentUser` — sidebar `Permisos` row, `canModerate` gates, foro mod buttons, dashboard `Permisos` URL guard — without a page reload. Credential resolution still hits the seed (`MOCK_USERS`) so identity fields can't be unlocked by editing a role override. **Side fix:** rewrote `useResolvedUser` to compute synchronously per render (was effect-driven). The previous shape lagged one render between a `userId` change and the resolved value, which briefly dropped `currentUser` to null and flickered the [[LoginOverlay]] open on first dashboard render. Now uses a tick-state pattern: subscribe via effect to bump a counter; the value itself is derived synchronously from `getResolvedUserById(id)`.

**Tombstone revert.** Two new writers, both gated by the same role rules as the corresponding deletes:

- `clearTombstone(postId)` in [[foro]] — drops the deletion record so the post reappears (catalog re-includes the thread; reply body restores). One writer for both kinds since `tombstones` is keyed by post id, not type.
- `clearCommentDeletion(commentId)` in [[comments]] — handles both storage paths (drops `deletionOverrides[id]` for mock comments, or clears the `deletion` field on session-added comments).

UI affordance — orange `RESTAURAR` chip (RotateCcw icon) inline with the tombstone heading on each surface:

- Foro Tombstone: visible to `canModerate(currentUser)` (mods + admins).
- Comment Tombstone: visible to `canModerate` OR `deletion.moderatorId === currentUser.id`. The broader gate gives an author an undo for an accidental self-delete without exposing the affordance to anyone else.

**Empty-Nuevo polish.** Added one condition to the dashboard's `hideDetails`: `(section === 'nuevo' && allowedTypes.length === 0)`. The right details panel now drops out of the user-tier empty Nuevo view — there's nothing to bind a SelectionMeta to since no template can be selected. Pure cosmetic, but cleans up the layout for the user-tier case.

### Verified in preview

- Logged in as `u-datavismo` (admin), open Permisos, click `tlali.fm` row, click `LECTOR` role button → list row updates live to `DETONADOR @tlali.fm EDITADO ›` (rank derives from her !/? reactions; EDITADO chip flips on).
- Switch auth to `u-insider-tlali` (insider seed → user via override). On `/dashboard?section=nuevo` the page renders `▸ 0 plantillas`, the empty state, and **no Permisos sidebar row** — auth flowing through the override layer is what made `canAssignRoles` and `canCreateContent` see the demoted role.
- No flash of LoginOverlay during initial dashboard render. The synchronous `useResolvedUser` removed the one-frame `currentUser=null` window that previously triggered `openLogin`.
- As `u-mod-rumor` on `/foro/?thread=fr-002` (tombstone preset via storage): RESTAURAR chip rendered next to the `//HILO·ELIMINADO·POR·MODERACIÓN` heading. Click → tombstone block gone, composer reappeared (`<textarea>` back), `gradiente:foro.tombstones` is `{}`.
- As mod on `cm-002` tombstone: RESTAURAR chip click → `gradiente:comments.deletionOverrides` is `{}`, comment body restored.
- As `u-normal-meri` (user) on `/dashboard?section=nuevo`: empty state renders full-width; the right details pane is hidden.
- `npm run build` clean across all changes.

### Open follow-ups

The role/permissions arc is now complete. Next chunk per Iker's plan: polls + marketplace surfaces (consumers for `canCreatePoll` / `canCreateMarketplaceCard` — the curator role currently gates nothing visible).

---

## 2026-04-30 · INGEST · NGE prompt overlay + comment delete (author + mod)

Two paired requests: replace the browser-chrome `window.prompt()` calls in the foro mod tools with a modal in the project's visual language, and add the missing delete affordance for comments (author self-delete and mod-delete with reason).

**Generic prompt provider** ([[PromptOverlay]]). New `components/prompt/` with `PromptProvider` + `PromptOverlay` + a `usePrompt()` hook that returns Promise-based `confirm(opts)` and `input(opts)` methods. Mounted once at the layout root (between `AuthProvider` and `PublishConfirmProvider`). Two variants:

- `confirm` — title + optional body + CANCELAR / CONFIRMAR. Returns `boolean`. Title strip `//CONFIRMACIÓN·REQUERIDA`.
- `input` — same chrome plus a single text field. Returns `string | null`. Title strip `//ENTRADA·REQUERIDA`. Auto-selects the field on open so the `defaultValue` is replaced by typing. Enter inside the field confirms.

`destructive: true` flips the confirm button color from sys-orange to sys-red. ESC and backdrop click both resolve to cancel. Visual idiom matches [[PublishConfirmOverlay]] — eva-box + scanlines + black backdrop with blur, `role="alertdialog"` with proper `aria-labelledby` / `aria-describedby`.

**Foro migration** ([[ThreadOverlay]]). Replaced both `window.prompt()` calls (`onTombstoneThread` and `onTombstoneReply`) with `usePrompt().input` calls — `destructive: true`, NGE chrome, placeholder `spam · acoso · off-topic · …`, default value `spam`. Identical behavior on confirm/cancel.

**Comment delete** ([[CommentList]] + [[comments]]). The `Comment.deletion` field already existed (consumed by the existing `Tombstone` for seed `cm-009`); what was missing was the writer + UI.

- New `tombstoneComment(commentId, actorId, reason)` writer in [[comments]]. One writer covers both flows. For session-added comments the deletion record lands directly on the record; for mock comments it lands in a new `deletionOverrides: Record<string, CommentDeletion>` map and `applyOverrides` merges it at read time. `getCommentsForItemMerged`, `getAllCommentsMerged`, and `getSavedComments` all route through `applyOverrides` so reactions + deletions stay in sync.
- New `BORRAR` chip in the comment header strip (right-aligned, sys-red border + Trash2 icon). Visible only when `canDelete = !isTombstone && (isOwn || canModerate(currentUser))`. Click branches:
  - **Author** → `usePrompt().confirm({ destructive: true })` (no reason required) → writer with empty reason.
  - **Mod** → `usePrompt().input({ destructive: true })` (reason required) → writer with the trimmed value.
- `Tombstone` component now branches on `deletion.moderatorId === authorId` — renders `//ELIMINADO·POR·AUTOR` (no reason line) for self-delete vs `//ELIMINADO·POR·MODERACIÓN @actor · RAZÓN: …` for mod-delete. [[SavedCommentsSection]]'s tile preview text mirrors the same branch (`[eliminado por autor]` vs `[eliminado · …]`).

### Verified in preview

- `u-mod-rumor` on `?thread=fr-002` → click reply BORRAR → NGE prompt opens with title strip `//ENTRADA·REQUERIDA`, h2 "Borrar respuesta", body description, prefilled `spam`, placeholder copy, CANCELAR + BORRAR buttons. Confirm → `tombstones["fp-002-01"]` written; tombstone block reads `//RESPUESTA·ELIMINADO·POR·MODERACIÓN @rumor.static · RAZÓN: spam`.
- `u-og-loma` on her own seed comment `cm-006` (articulo overlay): click `Borrar mi comentario` → confirm modal opens with title `//CONFIRMACIÓN·REQUERIDA`, h2 "Borrar tu comentario", **no input field** (correct), CANCELAR + BORRAR. Confirm → `deletionOverrides["cm-006"]` written with `moderatorId: 'u-og-loma'`, empty reason; comment body collapses to `//ELIMINADO·POR·AUTOR` with no reason line — the branch correctly hides it because `moderatorId === authorId`.
- `u-mod-rumor` on someone else's comment `cm-002`: click `Borrar comentario` → input prompt opens, default `spam`. Confirm → tombstone reads `//ELIMINADO·POR·MODERACIÓN @rumor.static · RAZÓN: spam`. Branch correctly hits the mod path because `moderatorId !== authorId`.
- `u-og-loma` on someone else's comment: zero `Borrar comentario` buttons (only `Borrar mi comentario` on her own). Defense-in-depth — the storage layer doesn't re-check, but the writer is unreachable from the UI.
- `npm run build` clean, all routes prerender. Lint warnings unchanged (pre-existing `next/image`).

### Open follow-ups (carried over)

- **Mod-revert action.** Tombstones are still one-way (`clearTombstone` not exposed yet).
- **Auth context resolves through overrides** — admin self-edits via [[PermisosSection]] don't reflect until reload.

---

## 2026-04-29 · INGEST · Foro mod tools (tombstones)

Closes the third of the three follow-ups from the role/rank chunk. The foro now has the moderation surface that `canModerate` was waiting for. See [[ThreadOverlay]] / [[foro]].

**Type changes** ([[types]]). New `ForoDeletion { moderatorId, reason, deletedAt }` mirroring `CommentDeletion`. Optional `deletion?: ForoDeletion` added to both `ForoThread` and `ForoReply`.

**Storage** ([[foro]]). New `tombstones: Record<postId, ForoDeletion>` in the session state. Read-time merge applies the override on top of the seed/session record. Two new writers:

- `tombstoneThread(threadId, modId, reason)` — soft-delete. Body preserved in storage so quote-links keep resolving. `getMergedThreads` filters tombstoned threads OUT of the catalog (8→7 tiles after one delete) but `getThreadById` still returns them with `deletion` set, so the URL keeps working and the moderator's reasoning is reachable.
- `tombstoneReply(replyId, modId, reason)` — same shape. Reply position is preserved (article still renders, backlinks still work) but the body is replaced with the moderator stub.

Both writers trust the UI to gate via `canModerate(currentUser)` from [[permissions]] — no re-check at the storage layer. Real backend will enforce in RLS.

**UI** ([[ThreadOverlay]]). `canModerate(currentUser)` flips an `isMod` flag threaded through the article components. When true, each post renders a small red `BORRAR HILO` / `BORRAR` button (Trash2 icon) in the top-right of its header strip. Click → `window.prompt('Razón…')` → tombstone writer.

`Tombstone` component mirrors the [[CommentList]] tombstone — replaces the body with `//HILO·ELIMINADO·POR·MODERACIÓN` or `//RESPUESTA·ELIMINADO·POR·MODERACIÓN` block + `@mod · RAZÓN: …`. Article container, `PostHeader`, and `Backlinks` continue to render normally so quote-IDs and `>>id` navigation still work — pruning is visible in context, not erased.

**Composer closure.** When a thread is tombstoned, the `ReplyComposer` is replaced with `//HILO·CERRADO·POR·MODERACIÓN — no se aceptan respuestas nuevas.` Disables further engagement with a deleted thread.

**Prompt-as-UI.** The reason is collected via `window.prompt()` — intentional cheap UI for the prototype. A real backend would put this behind a structured confirmation modal with a category dropdown. Flagging as a follow-up.

### Verified in preview

- Logged in as `u-mod-rumor` (role: user, isMod: true) on `?thread=fr-001` → 1 `BORRAR HILO` button on the OP + 3 `BORRAR` buttons on the 3 replies.
- Click `BORRAR` on `fp-001-01` with reason `"spam · prueba"` → sessionStorage gets `tombstones["fp-001-01"]`, the article body collapses to `//RESPUESTA·ELIMINADO·POR·MODERACIÓN @rumor.static · RAZÓN: spam · prueba`, the BORRAR button disappears for that reply (remaining BORRAR count: 2).
- Click `BORRAR HILO` with reason `"tema duplicado"` → OP body becomes `//HILO·ELIMINADO·POR·MODERACIÓN`, composer replaced with the closed-thread notice (textarea count: 0).
- Navigate back to `/foro` → catalog shows 7 tiles (was 8); `fr-001` is gone from the list. Direct URL `?thread=fr-001` still loads and shows the tombstone.
- Switch auth to `u-normal-meri` (user-tier, no mod flag) on `?thread=fr-002` → zero `BORRAR` buttons rendered. Defense-in-depth: storage layer doesn't re-check, but the writer is unreachable from the UI.
- `npm run build` clean; 16 routes prerender; lint warnings unchanged.

### Open follow-ups

- **Mod-revert action.** Tombstones are one-way today. A `clearTombstone(id)` writer + admin-only RESTAURAR button would let an over-eager mod's call be reversed. Storage layer is ready (just delete the entry from `tombstones`); UI piece pending.
- **Structured-reason modal.** `window.prompt()` works but breaks the NGE/terminal aesthetic. A category dropdown (`spam` / `off-topic` / `acoso` / `otro`) + freeform line, behind an inline modal, would land closer.
- **Auth context resolves through overrides** — same caveat as the previous chunks. Admin self-edits to `isMod` via [[PermisosSection]] don't flip the foro mod buttons until reload.

---

## 2026-04-29 · INGEST · Dashboard form gating + curator seed user

Closes the second of the three follow-ups from the earlier `Roles, ranks, and the !/? reaction palette` entry — the dashboard compose surface now respects the role tier.

**Permission helper** ([[permissions]]). New `canCreateContent(user, type)` — single per-type gate that maps every `ContentType` to a creation tier:
- `listicle` → curator+ (lists / polls / marketplace are the curator's surface)
- `mix` / `opinion` / `editorial` / `review` / `articulo` / `noticia` / `evento` → guide+
- `partner` → admin only (rail, not in the SUPPORTED set anyway)

`canCreateList` / `canCreatePoll` / `canCreateMarketplaceCard` / `canCreateOpinion` / `canCreateMix` remain as more specific helpers; `canCreateContent` is the generalized switch the dashboard consumes.

**Dashboard wiring** (`app/dashboard/page.tsx`). `allowedTypes = SUPPORTED.filter(t => canCreateContent(currentUser, t))` filters the template grid by capability. Threaded through to [[NuevoSection]] as the new `supported` prop value (was the static SUPPORTED list). Count label shifts to `▸ N plantilla(s)` and reflects the actual visible count per role.

**Compose URL guard**. `composeBlocked = composeType !== null && !canCreateContent(currentUser, composeType)`. A `useEffect` calls `router.replace('/dashboard?section=nuevo')` when the requested compose type isn't allowed — covers URL-typing `?type=mix&edit=…` as a non-guide. The form render condition becomes `if (composeType && !composeBlocked)` so there's no flash of the form before the redirect lands.

**Empty state in NuevoSection**. When `supported.length === 0` (a `user`-tier viewer with no creation rights), the grid is replaced with a `//SIN·PLANTILLAS·DISPONIBLES` block + explanation copy + a pointer at the admin's `Permisos` surface ("if you should have access, ask an admin to adjust your role"). Reads as a permissions explanation, not a "coming soon" tease.

**Curator seed user**. Added `u-curator-radiolopez` (`radiolopez` / display `radio lopez`) to [[mockUsers]] for full role coverage. Without it, the new `canCreateContent` curator path had no integration-test path — every other seed user was admin / guide / insider / user. radiolopez sees exactly `LISTA` in the template grid and otherwise behaves like the rest.

### Verified in preview

- Logged in as `u-datavismo` (admin) → 8 templates rendered, count label `▸ 8 plantillas`.
- `u-hzamorate` (guide) → 8 templates (curator-tier listicle inherited + 7 guide-tier types).
- `u-curator-radiolopez` (curator) → 1 template (`LISTA`), count label `▸ 1 plantilla`.
- `u-normal-meri` (user) → 0 templates, empty state with `//SIN·PLANTILLAS·DISPONIBLES` + the role explanation copy.
- URL guard: `u-normal-meri` typing `/dashboard?section=nuevo&type=mix` → instant redirect to `/dashboard?section=nuevo`, empty state renders. No form flash.
- `npm run build` clean; 16 routes prerender; lint warnings unchanged.

### Open follow-ups (carried over)

- **Foro mod tools** — `canModerate` exists; [[ThreadOverlay]] still has no delete-thread / tombstone-reply affordance.
- **Auth context resolves through overrides** — admin self-edits via [[PermisosSection]] don't reflect in the dashboard's own gates (which read `currentUser` from [[useAuth]]) until reload. Small follow-up; affects only self-edits.
- **`hideDetails` for nuevo when empty** — when the empty state renders, the right details panel is still visible. Cosmetic; could conditionally hide.

---

## 2026-04-29 · INGEST · Admin role-assignment surface (PermisosSection)

Closes the first of the three follow-ups flagged at the bottom of the earlier `Roles, ranks, and the !/? reaction palette` entry. The admin surface that the rank/role design implied now exists end-to-end. See [[PermisosSection]] / [[userOverrides]].

**Storage layer** ([[userOverrides]]). New module `lib/userOverrides.ts` modelled after [[comments]]: `gradiente:user-overrides` sessionStorage shape `Record<userId, { role?, isMod?, isOG? }>`. Identity fields (id / username / displayName / joinedAt) are immutable. Listener pattern via in-module `Set<() => void>`; every write fires `notify()`. Hooks: `useResolvedUser(id)` returns the live override-applied User (replaces `getUserById` in badge consumers), `useResolvedUsers()` returns the full live roster, `useHasOverride(id)` powers the `EDITADO` chip. Noop-collapse: a patch that leaves a user matching their seed exactly drops the entry from the map rather than persisting `{}`.

**UI** ([[PermisosSection]]). New dashboard section at `/dashboard?section=permisos`. Two-pane layout — searchable user list + per-user editor. Editor surfaces a read-only identity block, a five-button role grid (LECTOR / CURADOR / GUÍA / INSIDER / ADMIN), MOD and OG flag switches, and a self-edit warning when the admin selects themselves. **Self-demote guard** — when editing yourself, every non-admin role button is disabled. UI-layer only; the storage layer doesn't enforce it (a deliberate caller could still write the patch directly). Real backend will enforce in RLS. **Commit-on-click** — no draft/save dance; every change is a single `setUserOverride` call. `RESTAURAR` button (visible only when an override exists) clears it via `clearUserOverride`.

**Sidebar gate** ([[ExplorerSidebar]]). The `Permisos` row (Lock icon) renders only when `canAssignRoles(currentUser)` is true. Non-admins never see it.

**URL gate** (`app/dashboard/page.tsx`). Defense-in-depth: a non-admin URL-typing `?section=permisos` falls back to `home`. The check happens at section-resolution time, so the breadcrumb / window title / hideDetails all reflect the home path.

**Live propagation**. Migrated [[CommentList]], [[PostHeader]], [[SavedCommentsSection]] from `getUserById` to `useResolvedUser`. Edits in the admin surface propagate to comment columns and foro posts in real time without a page reload.

**Notable non-changes**:
- `useAuth.currentUser` still returns the seed user — not override-resolved. Means `AuthBadge` and dashboard chrome don't reflect *self-edits* until reload. Acceptable for prototype; rare edge case (admin editing isMod/isOG on themselves), and the rest of the app DOES update live.
- [[LoginOverlay]]'s quick-switch picker still calls `listUsers()` (seed). The picker is a credential entry point, not a live status display, so showing pre-override values is fine.
- ThreadTile uses `getUserById(thread.authorId)` only for `displayName` (no badge rendering), so it didn't need migration.

### Verified in preview

- As `u-datavismo` (admin): sidebar shows `Permisos` row. Section renders 8 user rows with correct primary chips + flag chips (`ADMIN @datavismo-cmyk`, `GUÍA @hzamorate`, `GUÍA @ikerio`, `NORMIE + MOD @rumor.static`, `ESPECTRO + OG @loma_grave`, `INSIDER @tlali.fm`, `ESPECTRO @merimekko`, `ESPECTRO @yagual`). Editor shows identity block + role grid + flag switches + self-edit banner.
- Click `@loma_grave` row → editor switches to her. Click `GUÍA` button → sessionStorage `gradiente:user-overrides` becomes `{"u-og-loma":{"role":"guide"}}`, list row updates to `GUÍA + OG @loma_grave EDITADO ›`.
- Open the comment column on `?item=festivales-latam-presion-europea-2026` → loma_grave's comment header now reads `@loma_grave GUÍA OG · hace 7 días` (was `ESPECTRO OG` before the override). Live propagation confirmed.
- Switch auth to `u-hzamorate` (guide) and visit `/dashboard?section=permisos` → sidebar shows no `Permisos` row, URL silently falls back to the home Dashboard view.
- `npm run build` clean, all 16 routes prerender. Lint warnings unchanged (pre-existing `next/image` only).

### Open follow-ups (carried over)

- **Dashboard form gating** — [[Dashboard Forms]] still lets any logged-in user reach every compose form. Wire `canCreateOpinion` / `canCreateMix` (guide+) and `canCreateList` / `canCreatePoll` / `canCreateMarketplaceCard` (curator+) into [[NuevoSection]] and the per-type forms.
- **Foro mod tools** — `canModerate` exists; [[ThreadOverlay]] still has no delete-thread / tombstone-reply affordance.
- **Auth context resolves through overrides** — small follow-up so admin self-edits update AuthBadge without reload.

---

## 2026-04-29 · INGEST · Roles, ranks, and the !/? reaction palette

Locked in the new identity model end-to-end. Three orthogonal axes per user — see [[Roles and Ranks]] for the full design.

**Role axis** — hierarchical creation tier with one sibling pair: `user (0) < curator (1) < {guide, insider} (2) < admin (3)`. `guide` and `insider` share rank 2 with equivalent publishing rights (opinion / mixes); they differ only in *byline framing* — guide is staff editorial voice, insider is scene voice (DJs, promoters, venue folks). The old `collaborator` was rolled into `guide`; `moderator` was split off into a flag (see below).

**Flag axis** — `isMod: boolean` (pruning capability — delete comments / threads, admins implicit) and `isOG: boolean` (cosmetic first-wave-registrant badge). Orthogonal to role; a `user`-tier `isMod` is a regular reader the team trusts to prune, separate from publishing trust.

**Rank axis** — derived on read from received !/? reactions (`user` tier only). NORMIE (floor) → DETONADOR (!-dominant) | ENIGMA (?-dominant) | ESPECTRO (balanced + active). Threshold currently 5 received reactions before leaving NORMIE; bucket boundaries at ≥65% / ≤35% signal-ratio. Pure derivation in [[permissions]] (`rankFromCounts` / `getUserRank`); live React-side hook `useUserRank(userId)` in [[comments]] reads `getAllCommentsMerged()` and re-renders on any reaction toggle.

**Reaction palette** — dropped `+` (resonates) and `−` (disagree). Kept only `!` (signal) and `?` (provocative) — both abstract enough to mean many things, neither reducible to "I like / I don't like." Mutual exclusivity per (user, comment): `toggleReaction` in [[comments]] now *replaces* a user's prior reaction when they pick the other kind, *clears* it when they click the same kind. Seed reactions in [[mockComments]] hand-migrated to the new palette, preserving the controversy hot-spot on `cm-006` (mix of !/? from different users).

**Why ranks aren't an "algorithm".** [[No Algorithm]] forbids engagement-driven *content surfacing* — what gets shown and at what size. Ranks label *people*, not content. They don't affect feed ordering, comment ordering, foro bump-order, or visibility. Added a carve-out section to the No Algorithm decision doc clarifying the line: labels on people OK, weights on content not OK.

**Type system rewrite** ([[types]]):
- `Role` — new union (`'user' | 'curator' | 'guide' | 'insider' | 'admin'`).
- `UserRank` — new union; not stored on User, derived.
- `User` — `userCategory` removed. Replaced by `isMod?`, `isOG?` flags. The old `og` / `insider` / `normal` triple split three ways: og became the flag, insider became a sibling role, normal became "no flag, rank derives."
- `ReactionKind` — pruned to `'provocative' | 'signal'`.

**Permissions module rewrite** ([[permissions]]):
- `hasRole(user, atLeast)` retained, with insider/guide sharing tier 2 so `hasRole(insider, 'guide')` returns true.
- New per-content-type gates: `canCreateList` / `canCreatePoll` / `canCreateMarketplaceCard` (curator+), `canCreateOpinion` / `canCreateMix` (guide+).
- `canModerate` checks `isMod || role === 'admin'`. `canModerateComment` wraps it.
- `canEditContent` / `canDeleteContent` admin-or-author. Author still matched by username — switch to authorId post-Supabase.
- `RANK_THRESHOLD = 5` exported so the gate is tweakable.

**Mock roster migration** ([[mockUsers]]):
- `hzamorate` / `ikerio` collaborator → guide.
- `rumor.static` moderator → user + isMod.
- `loma_grave` user/og → user + isOG.
- `tlali.fm` user/insider → role: insider (promoted to creation tier).
- `merimekko` / `yagual` user/normal → user (rank derives).
- New label/color maps: ROLE_LABEL/ROLE_COLOR, RANK_LABEL/RANK_COLOR, FLAG_LABEL/FLAG_COLOR. New helpers `badgeFor(user, rank)` returns `{label, color}` (was a string), `flagsFor(user)` returns the ordered flag list.

**UI rewiring**:
- [[CommentList]]: replaced `RoleBadge` with `AuthorBadges` — primary chip (role for staff, derived rank for users) + sibling flag chips. Reaction palette pruned to `[?]` / `[!]`. Reaction button code unchanged; the store-level mutual exclusivity makes click-the-other-kind feel like a single transition (see verification below).
- [[PostHeader]]: same badge stack as `AuthorBadges`. Removed the unused `inlineRoleLabel` / `inlineRoleColor` exports (no consumers).
- [[SavedCommentsSection]]: comment-tile badge now uses `badgeFor(user, useUserRank(authorId)).label`. Flag chips intentionally kept off the tile to keep it scannable.
- [[LoginOverlay]]: quick-switch picker badge updated to read `badgeFor(u).label` (was a bare string under the old API).

**Beta sign-up** — the model intentionally doesn't address public sign-up. The plan is invite-only beta when real auth lands. `useAuth.tsx` still resolves logins against MOCK_USERS; the invite-token gate goes in front of registration when [[Supabase Migration]] starts.

**Marketplace + polls** — deferred. The `curator` role gates `canCreatePoll` and `canCreateMarketplaceCard` already; no UI surface yet. Both can ship later without touching the role model.

### Verified in preview

- Logged in as datavismo (admin) on `?item=festivales-latam-presion-europea-2026`, opened the comment column. Sample badges rendered:
  - `@datavismo-cmyk` → `ADMIN` (orange) + `[TÚ]`
  - `@hzamorate` → `GUÍA` (green)
  - `@loma_grave` → `ESPECTRO` + `OG` (amber) — balanced rank + cosmetic flag
  - `@merimekko` → `ESPECTRO`
- Reaction palette: only `[?]` and `[!]` buttons render. No `[+]` or `[−]` anywhere.
- Mutual exclusivity: clicked `[!]` on `cm-006` (where datavismo has `?` in the seed) — `?` count went 3→2 with aria-pressed false, `!` count went 2→3 with aria-pressed true. Clicked `[!]` again — count went 3→2 with both buttons aria-pressed=false (cleared).
- Foro `?thread=fr-005` (rumor.static's recordatorio thread): `@rumor.static` rendered as `NORMIE` (grey) + `MOD` (red) — confirms user-tier rank chip + orthogonal mod flag chip together. `@datavismo-cmyk` reply rendered as `ADMIN`. `[TÚ]` marker on datavismo (logged-in viewer).
- `npm run build` passes — 16 routes prerendered as static content. Lint clean (only pre-existing `next/image` warnings, none touching files I edited).

### Open follow-ups

- **Admin role-assignment UI.** `canAssignRoles` exists; no surface consumes it yet. Plan: hidden dashboard section visible only when `canAssignRoles(currentUser)`, search by username, edit `role` / `isMod` / `isOG`. Rank stays derived (not assignable).
- **Per-type dashboard form gating.** [[Dashboard Forms]] currently lets any logged-in user reach every compose form. The new permission gates need wiring: opinion/mix forms behind `canCreateOpinion`/`canCreateMix`, future poll/marketplace forms behind their respective gates. Admin can author anything.
- **Foro thread/reply moderation surface.** `canModerate` exists; no foro mod tools yet (delete thread, tombstone reply). The wiki notes this gap was already deferred from the foro INGEST.
- **`User.role === 'user'` everywhere as the badge fallback** when `useUserRank` returns 'normie' for a user who literally has no comments. Currently shows `NORMIE` which is honest; no action needed but worth flagging if the badge should suppress until first comment.

---

## 2026-04-26 · INGEST · Audio reactive subsystem

Built end-to-end: persistent global SoundCloud playback that survives overlay close, three.js waterfall spectrogram visualizer reacting to live tab audio, and integration into [[MixOverlay]] + the home rail. New mix entry `mx-goodies-igtt` (lo-fi house, vibe 3) added to [[mockData]] as the canonical test track.

**Stack.** New components under `components/audio/`:

- `audioContext.ts` — shared lazy `AudioContext` singleton, FFT size constants.
- `Reproductor3D.tsx` — three.js wireframe waterfall spectrogram. Joy-division-plot proportions (48 cols × 80 rows), per-band envelopes (LOW punchy, MID flowy, HIGH spike), soft noise gate, vibe-gradient colors keyed to a mix of rolling track energy + per-cell magnitude + frequency stratification. Has `orientation: 'landscape' | 'portrait'` and `interactive: boolean` props. Portrait rolls the camera 90° via `up = (1, 0, 0)`.
- `useAudioElementAnalyser.ts` — file-picker source (used by `/lab/audio`).
- `useTabAudioCapture.ts` — `getDisplayMedia({ audio: true, preferCurrentTab: true })`. The only path to FFT data from cross-origin SC/YT iframes; Chromium-only by browser policy. See memory `reference_get_display_media`.
- `useSoundCloudWidget.ts` — wraps SoundCloud's Widget JS API (`https://w.soundcloud.com/player/api.js`). Returns the platform-agnostic `EmbedWidget` shape from `types.ts` (`play / pause / toggle / seek / load / isPlaying / currentTime / duration / track`). YT/Mixcloud/Spotify are pending implementations of the same interface; Bandcamp has no JS widget API and will need a fallback path.
- `AudioPlayerProvider.tsx` — global context at the layout root. Owns one persistent hidden iframe + widget + tab capture for the page lifetime. Track switches happen via `widget.load(url)` (same iframe, no remount), so the user-granted tab-capture permission persists across overlays. `loadAndPlay(item)` lazily requests `getDisplayMedia` on the first play (within the click gesture); subsequent plays don't re-prompt.
- `AudioPlayer3D.tsx` — composite player chrome used inside [[MixOverlay]]. LIVE MATRIX is a passive status pill (the request is folded into the play button).
- `NowPlayingHud.tsx` — persistent sidebar block in [[CategoryRail]]; portrait Reproductor3D + transport. The only audio control visible when no overlay is open.

**MixOverlay** is now a *view* — drops the local iframe + hooks, reads/writes everything via `useAudioPlayer()`. Closing the overlay does NOT stop playback. Opening another mix and pressing play calls `widget.load()` to switch tracks; no permission re-prompt.

**Lab** at `/lab/audio` — standalone test bench. Has its own local widget + tab-capture instance for file-picker testing; doesn't share with the global provider.

**Bug fix landed in this session:** Reproductor3D was using `getBoundingClientRect()` to size its WebGL buffer, which includes ancestor CSS transforms — inside the OverlayShell CRT boot animation, this read as ~140 × 1.6 px and locked the canvas to 1px tall. Switched to `offsetWidth` / `offsetHeight` (layout box, ignores transforms). See memory `feedback_layout_box_in_overlay`.

---

## 2026-04-26 · INGEST · Foro basePath fix for GitHub Pages

User reported foro mock images don't appear on the deployed Pages site (the home grid did, since [[mockData]] already had the fix from commit 12a4b04). Same root cause: GH Pages serves under `/gradiente-fm-web/`, and `<img src="/flyers/...">` doesn't get auto-prefixed by Next.js — only `next/image` and asset imports do. Applied the same `BASE_PATH` prefix pattern to [[mockForo]]: internal `RAW_THREADS` / `RAW_REPLIES` → exported `MOCK_THREADS` / `MOCK_REPLIES` derived via `.map()` that prepends `process.env.NEXT_PUBLIC_BASE_PATH` to any `imageUrl` starting with `/`. Data URLs (user-uploaded session images) pass through untouched.

Verified the inlined `/gradiente-fm-web` literal lands in the foro client chunk under a `GITHUB_ACTIONS=true` build, and that the runtime `.map()` produces the correct prefixed paths. Locally `NEXT_PUBLIC_BASE_PATH` is empty so images still resolve as `/flyers/orbital-omen.jpg`.

---

## 2026-04-26 · INGEST · Foro (imageboard-style discussion)

A new top-level destination at `/foro` — imageboard-style threaded discussion, kept fully isolated from the curated content grid. Threads aren't `ContentItem`s, never enter the home feed, never get HP/curation scoring. See [[Foro]] for the full route doc.

**Catalog rules.** Bump-order desc, hard cap at 30 visible threads (`FORO_THREAD_CAP`). New threads bump to top; new replies bump their parent. No likes, no reactions, no engagement scoring — reply count is the only ranking signal allowed (consistent with [[Size and Position as Only Signals]] / [[No Algorithm]]). The [[VibeSlider]] reappears on /foro and filters threads via genre intersection (`genresIntersectVibeRange` in [[genres]]).

**Thread model.** New `ForoThread` and `ForoReply` types in [[types]]. Threads require `subject`, `body`, `imageUrl` (mandatory on OP), `genres: string[]` (1–5 enforced via `FORO_THREAD_GENRES_MIN/MAX`), `createdAt`, `bumpedAt`. Replies are flat (no nesting), with optional image and `quotedReplyIds: string[]` parsed from `>>id` tokens in the body.

**Storage layer** [[foro]]. `gradiente:foro` sessionStorage with `{ addedThreads, addedReplies, bumpOverrides }`. Mirrors the [[comments]] / [[saves]] idiom — listener-pattern hooks, pure-function writers. `bumpOverrides[mockThreadId] = newBumpedAt` shadows immutable seed thread bumpedAt at read time. `useThreads` / `useThread(id)` / `useReplies(id)` / `useReplyCount(id)` cover the read paths.

**Session id format.** New `newThreadId()` and `newReplyId(threadId)` mirror the mock convention so user-authored ids are visually indistinguishable from seeds in `>>id` quote-tokens. Threads → `fr-s01`, `fr-s02`, … Replies → `fp-{threadShortRef}-s01` (e.g. `fp-003-s05` continues past the 4 mock replies on fr-003). The `s` marker prevents collision if seed numbering is later extended.

**Public-side surfaces:**
- [[ForoCatalog]] — page body. Reads `useThreads()` + `useVibe().vibeRange`, filters via `genresIntersectVibeRange`, mounts the URL-driven thread + compose overlays (`?thread=` / `?compose=`). Empty states differentiate "no threads at all" from "filtered out by vibe".
- [[ThreadTile]] — image-forward tile. R·NN reply-count chip top-left, SESIÓN chip top-right when session-authored, `//FR-XXX` id chip bottom-left. First 2 genres + `+N` overflow chip. Whole tile is a `<Link href="/foro?thread=…">`.
- [[ThreadOverlay]] — modal. Builds `inboundIndex: Map<postId, replyId[]>` for backlinks and `authorByPostId` for the inline-quote `TÚ` marker (see below). Image float-left on each post; body parsed for `>>id` tokens which become orange clickable buttons that scroll-and-pulse the target post (`data-postid` lookup, 1.6s outline pulse).
- [[NewThreadOverlay]] — composer. Login required, image required, 1–5 genre picker with vibe-color chips and 6th-rejection error. On submit, atomically swaps `?compose=1` for `?thread=<newId>` so user lands on their thread.
- [[ReplyComposer]] — pinned-bottom in [[ThreadOverlay]]. Login-gated, optional image, `>>id` parsing. Pre-fills with `>>id` quote-back when user clicks a post-id chip (composer remounts via `key` bump to apply `initialQuotedIds`).
- [[PostHeader]] — role-colored identity chip + `[TÚ]` when own post + clickable `>>postid` on the right.

**Backlinks.** Under each post header, `respondieron: >>id1 >>id2 …` lists inbound replies (only when there are any — quiet for unanswered posts). Map inverted from `quotedReplyIds` once per replies-change via `useMemo`.

**Inline `[TÚ]` on quote-tokens.** When a `>>id` token in body text resolves to a post authored by the current user, an orange `TÚ` chip renders next to it. Surfaces "someone is replying to me" without forcing the reader to scan the thread for the cited post. Complements PostHeader's existing `[TÚ]` (which marks "this post is mine"). Implementation: `authorByPostId` map in [[ThreadOverlay]], `isQuoteToMe(id)` helper threaded through `PostBody` → `BodyText`.

**Genre + vibe sharing.** `GENRE_VIBE` map (was inlined in [[VibeSlider]]) extracted to [[genres]] as an exported const, alongside new helpers `vibeForGenre` and `genresIntersectVibeRange`. Lets the foro catalog and the slider share the genre→vibe lookup, and any future surface can plug in.

**Navigation.** New `/foro` link at code `07` in [[Navigation]]'s NAV_LINKS, between `/articulos` and the auth badge. Mobile + desktop nav share the same source array.

### Verified in preview

- Catalog renders 8 mock threads with reply counts (R·04, R·03, …) and genre chips colored per `GENRE_VIBE`.
- Click tile → thread overlay opens at `?thread=fr-003`, shows OP + 4 replies with proper role badges (REDACCIÓN/OG/LECTOR/INSIDER), image float, working `>>id` quote-buttons, backlinks under each cited post.
- Logged out → reply composer shows "INICIA SESIÓN PARA RESPONDER"; "+ NUEVO HILO" trigger opens [[LoginOverlay]].
- Logged in as `loma_grave` → posting a thread persists to sessionStorage with id `fr-s01`, lands at position 1 in catalog (counter 08/30 → 09/30), overlay opens automatically.
- Posting a reply on fr-003 (which has 4 mock replies) → id `fp-003-s05`, parent thread bumps to top via `bumpOverrides[fr-003]`.
- Genre picker: 5/5 cap, 6th selection rejected with `Máximo 5 géneros.` error. Submit disabled until subject + body + image + genres ≥ 1.
- Vibe slider drag (max 10 → 3): catalog filters from 8 to 2 threads (fr-006 ambient-techno + fr-008 downtempo/dub), counter swaps to `02/08 EN RANGO`.
- Inline `TÚ` marker: logged in as `tlali.fm`, fp-001-02's body shows `>>fp-001-01` followed by orange `TÚ` chip (her seed reply is being quoted). Negative case verified — switching to `loma_grave` removes the chip in fr-001 and adds it in fr-007 (where her fp-007-01 is quoted by fp-007-02).
- `npm run dev` clean across all changes; no console or server errors after final reload.

### Open follow-ups

- Catalog cap is read-side only (slice 30). Storage can grow past 30 if a user authors many threads in one session; only the catalog is bounded. Real backend will need server-side prune-on-insert.
- No moderation surface yet — no thread/reply tombstone equivalent of [[CommentList]]'s deletion stub. Deferred.
- No per-user keying on session storage (same caveat as [[comments]] / [[saves]]). Real backend keys per user.

---

## 2026-04-26 · INGEST · Save-from-feed flow

Closes the long-deferred Guardados/* slot. Users can now bookmark publications from the public side and review them in the dashboard alongside saved comments.

**Storage layer** [[saves]]. `gradiente:saves` sessionStorage with shape `{ savedIds: string[] }`. Mirrors the [[comments]] store idiom — listener-pattern hooks (`useSavedItems`, `useIsItemSaved`), pure-function writers (`toggleSavedItem`, `clearSavedItems`). Resolver looks in `MOCK_ITEMS` first, falls back to [[drafts]] via `getItemById` so session-published items are saveable too. Items whose ids no longer resolve are silently dropped — no ghost rows when a user deletes a saved draft.

**Public-side affordance:**
- [[SaveItemButton]] — `★ GUARDAR / ★ GUARDADO` chip in the [[OverlayShell]] header, next to [[ShareButton]]. Login-gated, orange-when-active.
- [[SavedBadge]] — tiny orange `★` chip in the top-right corner of every [[ContentCard]] and [[HeroCard]]. Renders `null` when not saved so the unsaved feed has zero added chrome. Distinct from the red editorial-flag mark by both color (orange vs red) and position (top-right vs top-left).

**Dashboard surface.** [[GuardadosSection]] replaces the previous placeholder body. Filter prop generalized from `ContentType | null` to `ContentType[] | null` so the `editoriales` slot covers both `editorial` and `opinion`, and `articulos` covers `articulo` and `listicle` — keeps editorially-related types together rather than fragmenting them. Each tile uses [[DraggableCanvas]] under namespace `saves:<filterKey>` (e.g. `saves:articulos`) so each filter view has its own drag layout. Tile click navigates via `?item=<slug>` to open the overlay; inline `★ QUITAR` button on the thumbnail unsaves without bubbling to the tile click.

**Sidebar wiring.** Dropped `stub: true` from all 7 `Guardados/*` items in [[ExplorerSidebar]]; wired live count badges from `useSavedItems` (with editorial+opinion / articulo+listicle merging) plus the previously-already-real comments count. The dashboard page's hardcoded `savedCount = 0` became `useSavedItems().length` driving the storage panel total.

### Verified in preview

- Login as `loma_grave` → open `?item=festivales-latam-presion-europea-2026` → click `☆ GUARDAR` → flips to `★ GUARDADO`, aria-pressed=true, sessionStorage shows `{"savedIds":["ar-001"]}`.
- Close overlay → home grid → `ar-001`'s card shows the saved star badge with `aria-label="Guardado"` alongside its unrelated red editorial mark.
- `?section=guardados-articulos` → DraggableCanvas with 1 tile (thumbnail + `//ARTICULO` chip + title + inline `★ QUITAR`).
- Sidebar badges live-update: `Artículos: 01`, `Feed: 01`.
- `npm run build` passes; 16 routes prerendered as static content.

### Open follow-ups

- Saves are not user-keyed (same caveat as saved comments) — switching mock users in the same tab shows the previous user's saves. Real backend keys per user.
- The `partner` content type is excluded from saves by design (per [[Partners Isolation]]) — no UI surfaces it for save, no slot in `Guardados/*`.
- Click-vs-drag on saved-item tiles uses `DraggableCanvas`'s 4px threshold, same as saved-comments tiles. QUITAR button uses `e.stopPropagation()` so it doesn't fire the tile's open-overlay click — same isolation pattern.

---

## 2026-04-26 · INGEST · Comments system + saved-comments dashboard

Shipped a full discussion subsystem on top of the overlay layer plus a dashboard surface for saving comments back to user-specific bookmarks. Five surfaces + four library modules + a generic file-canvas primitive.

**Identity rework.** Replaced the binary `admin/insider/null` auth model with a strict role hierarchy `admin ⊃ moderator ⊃ collaborator ⊃ user`, where `user` carries a sub-`userCategory` of `og | insider | normal`. New types in [`lib/types.ts`](../../lib/types.ts): `Role`, `UserCategory`, `User`, `ReactionKind`, `Reaction`, `Comment`, `CommentDeletion`. Real handles for the project team (`datavismo-cmyk` admin, `hzamorate` + `ikerio` collaborators) seeded alongside synthetic personas in [[mockUsers]].

**Auth surface.** [[useAuth]] rewritten to expose `currentUser: User | null` derived from `MOCK_USERS`; storage shape moved from `{ role, username }` to `{ userId }`. Added `loginAs(userId)` for the new picker. [[LoginOverlay]] gained a `QUICK·SWITCH` panel listing all 8 mock users with role badges — log in as any tier without remembering credentials. Existing `admin/admin` shortcut preserved (resolves to canonical admin).

**Permission helpers.** [[permissions]] module — pure functions: `hasRole`, `canComment`, `canReact`, `canEditComment`, `canDeleteOwnComment`, `canModerateComment`, `canEditContent`, `canBanUser`, `canAssignRoles`. Anonymous = read-only. Authors edit only their own comments — admins explicitly cannot edit other users' words.

**Comment data model.** [[mockComments]] — 25 seed comments threaded across `ar-001`, `ed-001`, `mx-001`, `rv-001`. Exercises depth-5 threading, controversy hot-spot (cm-006: high-resonate AND high-disagree, both count toward engagement), moderator tombstone with preserved replies (cm-009), edited marker (cm-011). Helpers `engagementScore`, `descendantCount`, `directReplyCount`.

**Session-scoped overlay store** [[comments]]. `gradiente:comments` sessionStorage holds three slices: `added` (new top-level/reply comments), `reactionOverrides` (per-comment reaction lists that shadow seed data), `savedIds` (bookmarks for the dashboard surface). Hooks `useComments(itemId)`, `useIsCommentSaved(commentId)`, `useSavedComments()` subscribe via a small listener registry. Reaction toggles do not subtract — disagreement counts as engagement, not suppression. See [[No Algorithm]].

**Discussion UI surfaces:**
- [[CommentList]] — threaded renderer with recursive sort (activity → engagement → chronological), depth cap at 4 with `↳ VER N RESPUESTAS MÁS` collapse, role-colored badges (admin orange / moderator red / collaborator green / OG-INSIDER blue-purple / lector neutral), tombstone rendering with deletion reason, "EDITADO" marker.
- [[CommentComposer]] — login-gated dual-variant: `root` (always-expanded textarea pinned at column bottom) and `reply` (collapsed `↳ RESPONDER` trigger that expands inline). Enter posts, shift+enter newline, Esc cancels.
- [[CommentsColumn]] — column chrome (header + status strip + scroll body + composer footer) consuming `useComments(item.id)`.
- ASCII reaction palette `[+]` resonates / `[−]` disagree / `[?]` provocative / `[!]` signal — never emoji. Active state highlights the user's own reactions in orange.
- "TÚ" indicator on user-own comments — orange-tinted left rail + `[TÚ]` chip alongside the role badge.

**Split-screen overlay layout** in [[OverlayShell]]. Wrapper now hosts panel + comments column + a vertical rail button as flex siblings. Wrapper max-width animates between `64rem` (closed) and `1400px` (open) via Framer Motion; column slides in from the right with `flex-basis 0% → 40%`, `opacity 0 → 1`, `translateX 40 → 0`, `marginLeft 0 → 0.75rem` — all animated together so neither end of the close transition snaps. Rail button pinned at `right: 0` of the wrapper so it tracks the rightmost visible surface (panel when closed, column when open). ESC collapses comments first; `e.stopPropagation()` on the rail button prevents the backdrop close from firing.

**URL-driven overlay reactivity** in [[useOverlay]]. Replaced the `popstate`-only listener (which missed `next/link` navigation) with `useSearchParams()` from `next/navigation`. Now the overlay opens on any URL change with `?item=…` regardless of how the URL got there. New `?comment=<id>` deep-link param read by [[OverlayShell]] auto-opens the comments column AND focuses the matching comment.

**Focused-comment behavior.** When `?comment=` is present, [[CommentList]] threads the focused id down to the matching `CommentNodeView`, which after a 600ms delay (column slide-in completes first) calls `scrollIntoView({ behavior: 'smooth', block: 'center' })` and applies the `comment-focus-flash` class. The flash is a CSS keyframe outline pulse (cyan, 2.4s, no `fill-mode`) — non-permanent: outline reverts to none after animation, leaving the user-own-comment background intact.

**Saved-comments dashboard surface** [[SavedCommentsSection]] under `Guardados/Comentarios` (new sidebar entry, NOT a stub). Two-level draggable file explorer:
- **Folder grid** — one folder per publication with saved comments, showing the article thumbnail, title, type label, and comment-count badge. Single-click drills in. Namespace `saved-comments:folders`.
- **File grid** — one tile per comment within a folder, draggable. Click expands inline to reveal full body + `ABRIR EN OVERLAY ›` (deep-links via `?item=…&comment=…`) + `★ QUITAR`. Namespace `saved-comments:files:<articleId>` so each article's drag layout is independent.

**Generic primitive** [[DraggableCanvas]] — extracted the canvas + position store + drag mechanics so saved-comments can have free-form positioning matching Drafts/Publicados. Click-vs-drag disambiguated by 4px movement threshold so inner buttons (QUITAR, ABRIR) survive. Bails out of pointer capture on `target.closest('button, a, input, ...')`. Older [[DraggableFileGrid]] (used by Drafts/Publicados) left untouched — refactor to consolidate is a separate task.

### Verified in preview

- Login: log in as `loma_grave` via QUICK·SWITCH → AuthBadge shows `@loma_grave`, sessionStorage stores `{ userId: "u-og-loma" }`. `admin/admin` form path resolves to `u-datavismo`.
- Comments mount: open `ar-001` overlay → click rail button → column slides in at 40% width, 11 seed comments rendered, sort produces cm-001(4 replies) → cm-006(2) → cm-009(tombstone, 1) → cm-011(0).
- Reactions: click `[+]` on cm-001 → loma_grave's existing seed reaction removed → count drops `[+] 2 → 1`, button aria-pressed=false, `reactionOverrides` persisted.
- Composer: type "Comentario de prueba" in root composer → ENVIAR → new comment appears at end of list (0 activity, lowest sort priority), id `cm-session-…` persisted in `added`.
- Reply: click `↳ RESPONDER` under cm-006 → textarea expands inline, single textarea instance.
- Save: click `★ GUARDAR` on cm-001 → button flips to `★ GUARDADO` orange, `savedIds: ["cm-001"]` persisted.
- Dashboard: `Guardados/Comentarios` shows 3 folders for 4 saved comments (cm-001, cm-006, cm-014, cm-017). Click ar-001 folder → file view with 2 tiles. Click cm-001 → expands inline with body + ABRIR + QUITAR.
- Drag: pointerdown→move→up on first folder tile dragged it from `(12,12)` → `(82,93)`, position persisted under `gradiente:dashboard:positions:saved-comments:folders`.
- Deep-link: navigate to `/?item=festivales-latam-presion-europea-2026&comment=cm-005` → overlay mounts, comments column already open, cm-005 has `data-focused="true"` and `comment-focus-flash` class, no other comment is focused.
- TÚ indicator: as `loma_grave`, cm-006 (her authored comment) renders with `data-own="true"` and the TÚ chip; sibling comments don't.

### Memory updates

None this session — no new behavioral preferences or feedback surfaced; existing memos still accurate.

### Open follow-ups

- Wiki: per-component pages for [[CommentList]], [[CommentsColumn]], [[CommentComposer]], [[SavedCommentsSection]], [[DraggableCanvas]] landed alongside this entry. Module pages for [[mockUsers]], [[mockComments]], [[permissions]] are pointers in [[index]] only — write full pages if those modules grow new behavior worth documenting.
- Saved comments are not user-keyed in sessionStorage — switching between mock users in the same tab shows the previous user's saves. Acceptable for prototype; real backend keys by user.
- Closing the overlay leaves an orphan `?comment=` param in the URL (only `?item=` is cleared). Harmless visually since the overlay is unmounted, but worth scrubbing when we touch [[useOverlay]] again.
- Scroll-to-focused-comment doesn't expand a depth-cap-collapsed subtree if the focused id lives deeper than depth 4. None of the current seed targets exercise this; landing it requires walking the tree and auto-expanding on the path to the focused id.

---

## 2026-04-25 · INGEST · Dashboard explorer revamp + header auth

Replaced the flat dashboard with a retro file-explorer shell, restructured around a `Guardados/` future-purpose folder, and overhauled the header auth controls so LOGIN/DASHBOARD/SALIR actually read at a glance.

**New module** [[Dashboard Explorer]]. The shell wraps every dashboard surface in a 3-column window (sidebar + window + details panel) with a top breadcrumb. Single page at [`app/dashboard/page.tsx`](../../app/dashboard/page.tsx) dispatches sections via `?section=`. Old `/dashboard/drafts` becomes a client redirect to `/dashboard?section=drafts`.

**Sections wired:**
- `home` — landing tiles (Nuevo / Drafts / Publicados / Perfil)
- `nuevo` — 8 type templates rendered as folded-corner file icons; click → details panel + bottom info bar; double-click → form
- `drafts` / `publicados` — free-form draggable color-coded file workspace, positions persist per-namespace in sessionStorage
- `profile` — identity card + editable name/city/bio/firma (no pronouns — explicit user request)
- `guardados-{feed|agenda|noticias|reviews|mixes|editoriales|articulos}` — disabled stubs reserving slots for the future save-from-feed surface (see [[Guardados Roadmap]] in memory)

**Trim pass.** First iteration mirrored a Windows-style file manager more literally — Cut/Copy/Paste toolbar buttons, fake `48.7 GB / 120 GB` storage gauge, Media folder, Archivo grouping with Eliminados, orphan content-type sidebar entries, redundant bottom INFORMACIÓN bar duplicating the right-side DETALLES panel. All cut. Storage panel repurposed as **ESTADO DE LA UNIDAD** with real counts (drafts / publicados / guardados / last-edit) + soft 50-item cuota.

**Layout fixes:**
- VibeSlider hidden on `/dashboard` — feed-curation control, not editor concern. Implemented via `usePathname()` early-return wrapper around the impl ([VibeSlider.tsx](../../components/VibeSlider.tsx)).
- ExplorerShell now `min-h-[calc(100vh-200px)]` with the row `flex-1` and the window stretching — short sections (Profile) no longer leave a gap above the footer, since `body { min-height: 100vh }` was pushing the footer down past short content.

**Header auth redesign** — see [[AuthBadge]]. The previous chip used 8px text in dim `#FF6600` buried between near-invisible 6px captions (`UNIT·ACCESS`, `ID·NULL`). Replaced with: 13px Syne Black labels in bright `#FF8C00` / `#4ADE80` with EVA glow, blinking/pulsing dot, username inline at `#888`, and `SALIR` (icon + label, hover→sys-red) instead of a lone `⏻` glyph. Captions dropped — they only added noise around the actual button.

### Verified in preview

- `/dashboard` → home tiles render; sidebar shows the 5 flat items + Guardados folder with 7 stubs; ESTADO DE LA UNIDAD reactive
- `?section=nuevo` → 8 file icons, click MIX → details + CTA `USAR ESTA PLANTILLA`
- `?section=drafts` → seeded 4 drafts → drag from `(12,12)` → `(106,103)` → reload → position persists
- `?section=publicados` → separate position namespace
- `?section=profile` → no pronouns field; storage panel sits 720px+ above footer (no overflow)
- `?section=guardados-mixes` → placeholder explains future save flow + perks roadmap
- `/dashboard/drafts` → 200 redirect → lands on `?section=drafts`
- Header logged out → `LOGIN` at 13px `#FF8C00`, 139×53px tappable
- Header logged in → `DASHBOARD` at 13px `#4ADE80` + `@admin` username + `SALIR` button (79px, hover red)

### Memory updates

- [feedback: no decorative chrome](../../../C--Users-Iker-Documents-Gradiente/memory/feedback_no_decorative_chrome.md) — every affordance must work today or have a named future purpose
- [project: Guardados → club perks roadmap](../../../C--Users-Iker-Documents-Gradiente/memory/project_guardados_perks_vision.md) — three-stage arc (save-from-feed → attendance markers → verifiable partner perks)

---

## 2026-04-25 · INGEST · Chunk 3-C — Brand pages

Closes Chunk 3 (Discovery + identity). Adds three identity surfaces — `/about`, `/manifesto`, `/equipo` — with terminal-aesthetic chrome. Copy is intentionally placeholder; the editorial team fills in finished prose later.

**Shared shell** [components/brand/BrandPageShell.tsx](../../components/brand/BrandPageShell.tsx). Three tiny exports:
- `<BrandPageShell>` — header (orange `//SUBSISTEMA · X` chip + pulsing dot, font-syne display title, optional dek) + a single max-w-3xl reading column
- `<BrandSection index={N} title="...">` — `§01 TITLE` heading idiom borrowed from [[ArticuloOverlay]] so the visual language stays consistent across long-form
- `<Redactar note?="..." />` — bright red `[REDACTAR · note]` chip with a pulsing dot. Visible enough that finished copy can't be shipped without removing it

**Routes:**
- [app/about/page.tsx](../../app/about/page.tsx) — what Gradiente FM is, vibe filter explainer, FASCINOMA + Club Japan connections. 3 `[REDACTAR]` markers
- [app/manifesto/page.tsx](../../app/manifesto/page.tsx) — editorial declaration scaffolded around the principles in `wiki/90-Decisions/` (No Algorithm, Guides Not Gatekeepers, Vibe Spectrum). 7 `[REDACTAR]` markers — section bodies are placeholders
- [app/equipo/page.tsx](../../app/equipo/page.tsx) — list of collaborators (`datavismo-cmyk`, `hzamorate`, `ikerio` per [CLAUDE.md](../../CLAUDE.md)) with GitHub links + per-person `[REDACTAR]` bios

**Footer wiring** in [app/layout.tsx](../../app/layout.tsx) — added a `<nav>` between the SUBSISTEMA chip and the GRADIENTE strip with `/ABOUT · /MANIFIESTO · /EQUIPO` links. Footer becomes a flex-wrap on mobile so the link row stacks cleanly under the chip without crushing the lat/lon block.

### Verified in preview

- `/about` → renders `//SUBSISTEMA · ABOUT`, title "QUÉ ES GRADIENTE FM", 3 `[REDACTAR]` chips visible
- Footer → `/manifesto` → `//SUBSISTEMA · MANIFIESTO`, title "GUÍAS, NO PORTEROS", 7 `[REDACTAR]` chips, "NO HAY ALGORITMO" section present
- Footer → `/equipo` → all three collaborator handles + clickable `https://github.com/<handle>` links per row

### Chunk 3 status

| Chunk | Status |
|---|---|
| 3-A — Search overlay | ✓ done |
| 3-B — Clickable genre chips (incl. AnimatePresence-blocks-unmount fix) | ✓ done |
| 3-C — Brand pages | ✓ done |

[[Next Session]] closed out for Chunk 3. New roadmap items are open for whoever picks up next: mobile pass, dashboard chrome redesign, the deferred backend work, or the smaller [[Open Questions]] items (Tailwind `base` rename, reduced-motion respect, missing exit-fade).

---

## 2026-04-25 · INGEST · Chunk 3-B — Clickable genre chips

Genre chips on cards + overlays now filter the home grid in-page. Same idiom as the existing category filter ([[CategoryRail]] → [[FeedHeader]] reactive strip), composes with it (both can be active simultaneously and intersect).

**New module** [components/genre/GenreChipButton.tsx](../../components/genre/GenreChipButton.tsx) — reusable chip wrapper that:
- Calls `setGenreFilter(genreId)` on click
- Closes any open overlay via [[useOverlay]] (so clicking inside an overlay drops you back to the home grid showing the filtered set)
- `router.push('/')` if not already on home (since the filter only applies on the home feed)
- `e.stopPropagation() + preventDefault()` so the chip click doesn't bubble to the card and reopen the overlay

**[[VibeContext]]** extended with `genreFilter: string | null` + `setGenreFilter`. Stores the genre id (matches `ContentItem.genres` entries), parallel to the existing `categoryFilter`.

**[[ContentGrid]] filter pipeline** got a new step right after the category filter — `mode === 'home' && genreFilter ? filtered.filter(i => i.genres.includes(genreFilter)) : filtered`. Type-specific routes ignore both filters as before. Updated useMemo deps.

**[[FeedHeader]]** rewrote the reactive strip to surface BOTH filters when active. Header reads `//SUBSISTEMA · FILTRADO · CATEGORIA · GÉNERO·NAME`. Independent `[×] LIMPIAR SECCIÓN` and `[×] LIMPIAR GÉNERO` buttons clear each axis individually.

**Chip render sites wired** to `GenreChipButton`:
- [[ContentCard]] sm/md/lg variants
- [[HeroCard]]
- All six overlays: [[ReaderOverlay]] (two render sites — bordered chip + ETIQUETAS rail list), [[ArticuloOverlay]] (rail list), [[ListicleOverlay]] (rail list), [[MixOverlay]] (orange-bordered chip), [[EventoOverlay]] (vibe-bg chip), [[GenericOverlay]] (vibe-bg chip)

For each render site, swapped `getGenreNames(item.genres)` (names only) for `item.genres.map(id => ({ id, name: getGenreById(id)?.name ?? id }))` (id+name pairs) so the click handler can pass the canonical id while the chip displays the human label.

The orphan linear cards [[MixCard]] / [[EventCard]] / [[ArticleCard]] (used by the not-wired-to-pages [[ContentFeed]]) were intentionally NOT updated — they don't appear in the live UI.

### Pre-existing bug uncovered + fixed: AnimatePresence blocked unmount

While verifying the genre filter wasn't visibly reducing the grid (despite `ranked.length` correctly dropping from 78 to 15 to 3), discovered that the [[ContentGrid]] `<AnimatePresence>` wrapper had been keeping ALL filtered-out cards mounted in the DOM at full opacity — even with `mode="popLayout"`, even with the `MosaicItem` wrapped in `forwardRef`, even with `layoutId` removed. Cards' exit transitions weren't firing; they just stayed.

This explains why **the in-page category filter has been silently broken**: clicking a CategoryRail row would update `categoryFilter` state, [[FeedHeader]] would reflect the new filter, `ranked` would correctly compute only N items — but the grid still rendered all 78 because AnimatePresence held onto them. Easy to miss because the FeedHeader UX gives a strong "filter is active" signal. Likely been broken since the AnimatePresence wrapper was added.

Fix: removed `<AnimatePresence>` from [[ContentGrid]] entirely. Each `<motion.div>` (MosaicItem) keeps its own `layout` + `initial`/`animate` props, so cards still get a smooth mount + reflow when the grid changes. The trade-off is no exit-fade animation when items leave (they unmount immediately) — acceptable for filter UX. If a richer exit animation matters later, the path forward is to find a Framer Motion 12 incantation that actually lets `popLayout` complete the exit without the children getting stuck mounted.

Also added `forwardRef` to `MosaicItem` for future flexibility (any parent that wants to attach a ref).

### Verified end-to-end in preview

1. Click `[Cumbia Electrónica]` chip on a home card → grid filters to 3 cards, all cumbia, FeedHeader reads `//SUBSISTEMA · FILTRADO · GÉNERO·CUMBIA ELECTRÓNICA`
2. Click `[×] LIMPIAR GÉNERO` → grid restores to 78
3. Open `?item=espectro-mix-008` (mix overlay) → click a genre chip inside → URL drops `?item=`, overlay closes, home grid filters to 11 (Minimal / Deep Tech), FeedHeader reflects new filter
4. Category filter via [[CategoryRail]] now also visibly reduces the grid (incidentally fixed by the AnimatePresence change)

[[Next Session]] roadmap: 3-A and 3-B done; only 3-C (brand pages) remains in this chunk.

---

## 2026-04-25 · INGEST · Fix — overlay PUBLICAR AHORA now goes through confirm modal

User caught an inconsistency: clicking `▶ PUBLICAR AHORA` from the draft overlay published the item directly, bypassing the [[Publish Confirmation Flow]] gate that the pending-card corner button uses. Fix is one line in [components/overlay/OverlayShell.tsx](../../components/overlay/OverlayShell.tsx) — `SessionItemStrip.handlePublish` now calls `usePublishConfirm.openConfirm(item.id)` instead of `upsertItem(item, 'published')` directly. Both surfaces now route through the same `[[PublishConfirmOverlay]]` modal.

Verified end-to-end in preview: draft → overlay PUBLICAR AHORA → modal opens with item preview → cancel keeps draft in `draft` state, confirm flips it to `published` and re-renders the strip from orange `DRAFT·SESIÓN` to green `PUBLICADO·SESIÓN`.

[[Publish Confirmation Flow]] updated with a new "Draft → Confirm (from overlay)" subsection under `## How` documenting this third entry point to the gate.

---

## 2026-04-25 · INGEST · Chunk 3-A — Search overlay

First piece of the Discovery + identity chunk. Adds the `/`-invoked search overlay called for in [[Next Session]].

**New module** [components/search/useSearch.tsx](../../components/search/useSearch.tsx) — `<SearchProvider>` + `useSearch()`. Owns the open/close state and the global `/` keyboard listener. The listener skips editable targets (`<input>`, `<textarea>`, `<select>`, contenteditable) and skips when modifier keys are held, so typing `/` into form fields works untouched and OS shortcuts pass through. `preventDefault` only fires when actually opening, so unrelated keystrokes aren't eaten.

**New component** [components/search/SearchOverlay.tsx](../../components/search/SearchOverlay.tsx). Borrowed the panel chrome from [[LoginOverlay]] / [[PublishConfirmOverlay]] (`eva-box eva-scanlines`, EVA-orange `//BÚSQUEDA` header chip, `[ESC] CERRAR`, backdrop blur, body scroll lock). Anchored top-of-viewport (`pt-20 items-start`) instead of centered — reads more like a command palette than a modal.

Per Next Session's brief — **invoked mode, not a default top-bar input**. No engagement-driven autocomplete, no ranking. The search results render as a focused subsystem mirroring [[FeedHeader]]: `//SUBSISTEMA · BÚSQUEDA · 'query' // N RESULTADOS` (pulsing dot, EVA orange). Empty-query state shows the keyboard hint `ESCRIBE PARA BUSCAR · ↑↓ NAVEGAR · ↵ ABRIR · ESC SALIR`.

**Corpus**: `MOCK_ITEMS` ∪ `useDraftItems()` deduped by slug (drafts win — editor's working copy beats seeded version). `partner` items excluded (sponsor rail, never surfaced through reading flow — [[Partners Isolation]]).

**Match**: substring against per-item haystack of `title + subtitle + excerpt + author + venue + artists`. First 30 hits, then a `· REFINA EL TÉRMINO ·` footer prompt.

**Result row**: type chip in `categoryColor(item.type)`, mono title, per-type secondary line (venue + artists for evento, artists for mix, author/subtitle for editorial-family), `[↵]` chevron on the selected row.

**Keyboard**: `↑/↓` move selection (clamped, reset to 0 on query change), `Enter` closes search and opens the selected item via [[useOverlay]] — same flow a card click takes, URL syncs to `?item=`. `Esc` closes. Hover updates selection so keyboard resumes from cursor position. Listeners bound at window level so focus drift doesn't break navigation.

**Layout wiring**: `<SearchProvider>` placed inside `<OverlayProvider>` (since `<SearchOverlay>` uses both contexts) and above `<CRTOverlay>` so state survives CRT mode flips. Mounted alongside the other overlays.

**Verified end-to-end** in preview:
1. `/` opens, input auto-focused
2. `donato dozzy` → 4 results across event/mix/noticia (matches Next Session's example exactly)
3. ↑↓ moves selection (`[↵]` indicator follows)
4. ESC closes, body scroll unlocks
5. Enter on a result closes search and opens the content overlay (`?item=fascinoma-2026-cdmx-outdoor`)
6. `/` is correctly suppressed when typing in dashboard form fields

[[index]] updated. New note [[SearchOverlay]] in `40 — Components`. No [[Open Questions]] entry closed (the search question wasn't filed there — it was a Next Session item).

---

## 2026-04-25 · INGEST · Editor closure — chunks 1 + 2

Two long arcs that close the dashboard publishing loop end-to-end. Recorded as a single entry since the work was continuous.

### Arc 1 — Quick wins (the dashboard → feed loop)

**Drafts surface in the feed.** New module [[drafts]] (`lib/drafts.ts`) owns a sessionStorage-backed store of `DraftItem` (a `ContentItem` with frontend-only `_draftState` + `_createdAt` + `_updatedAt`). Subscriber pattern fires `notify()` on every mutation so consumers re-render without reload. Public API:
- `getAllItems() / getItemById(id)`
- `upsertItem(item, state)` — insert or update by id
- `removeItem(id)`
- `useDraftItems()` hook for components
- `newItemId(type)` — stable id generator

**HomeFeedWithDrafts** ([[FeedHeader]]'s sibling) — client wrapper around [[ContentGrid]] that merges session items into the feed. Two phases of evolution:
- v1: prepend ALL session items (drafts + published) so dashboard publish surfaces immediately
- v2: filter to only `published` items + the one matching `?pending=<id>`. Pure drafts no longer pollute the public feed; they live in [[Dashboard Drafts]]. Aligns with the editor's POV: drafts are private work-in-progress.

**[DRAFT·SESIÓN] chip** added to [[ContentCard]] when `_draftState === 'draft'`. Mostly dormant on the home feed (drafts hidden) but still useful in the drafts list view.

**Session item strip** in [[OverlayShell]] — when an item has `_draftState`, a horizontal action bar appears between the chrome and the content:
- Draft items: orange strip with `EDITAR / ELIMINAR / ▶ PUBLICAR AHORA`
- Published items: green strip with `EDITAR / ELIMINAR`
- Real MOCK_ITEMS content: nothing

**404 page** ([app/not-found.tsx](../../app/not-found.tsx)) — terminal-aesthetic glitch. `// SEÑAL PERDIDA` headline with red text-shadow, glitching path readout that scrambles every 220ms via a chained-pattern `scramble()` helper, terminal "DIAGNÓSTICO" block listing failed system checks, RETORNAR AL FEED + category quick-links, hazard-stripe chrome.

**ShareButton** ([components/overlay/ShareButton.tsx](../../components/overlay/ShareButton.tsx)) — slotted into [[OverlayShell]]'s header next to ONLINE. `[⎘ COPIAR ENLACE]` → flips to green `ENLACE·COPIADO` for 1.8s. Uses `navigator.clipboard.writeText` with `execCommand` fallback for non-secure contexts.

**MixOverlay related-mixes section** — `04 SIGUIENTES MIXES` after the existing 3 panels. Curated by genre overlap, falls back to recent. Mirrors the [[ArticuloOverlay]] / [[ListicleOverlay]] pattern.

**Save indicator** — [[Dashboard Forms]] `SubmitFooter` now shows `◉ AUTOSAVE · HACE Xs` next to the action chips. Updates every 5 seconds via setInterval; reads `lastSavedAt` from `useDraftWorkbench`.

**Type-specific empty states** in [[ContentGrid]] — instead of a generic `// SIN CONTENIDO`, each filtered type gets its own copy: `// CABINA · BOOTH VACÍO` for mix, `// AGENDA · CALMA TEMPORAL` for evento, etc. Reads the active categoryFilter from [[VibeContext]].

**Bugs caught mid-build:**
- `commitItem` import was wrong (named export lived in `Fields.tsx`, not `lib/drafts.ts`); fixed to `upsertItem as _commitItem`.
- [[OverlayRouter]] only resolved slugs from MOCK_ITEMS — extended to look in `useDraftItems()` first so draft cards open via overlay.

### Arc 2 — Two-state model + pending confirmation + edit flow

User feedback drove a refactor of how publishing actually works. The key insight: a single one-click `PUBLICAR` button is too dangerous; a draft-saved-but-not-yet-public state is meaningful; pending content should be visible in the feed during review but visually distinct.

**Two-state model:**
- `SubmitFooter` now has TWO actions instead of one: `▣ GUARDAR DRAFT` (grey) and `▶ PUBLICAR` (orange).
- `useDraftWorkbench`'s old `publish()` was renamed `requestPublish()` — saves as draft + returns the item id. The actual transition to `published` happens elsewhere (see below).
- `saveDraft()` unchanged.
- The form's `onPublish` handler is now: `requestPublish() → setCategoryFilter(null) → router.push('/?pending=<id>')`.

**See [[Publish Confirmation Flow]]** for the full design rationale and state-machine sketch.

**Visual primitives for the pending state:**
- New CSS keyframes in [globals.css](../../app/globals.css): `pending-border-pulse` (red↔orange, 1.6s), `pending-scanline-sweep` (vertical line traversal, 2.4s), `pending-cover-flicker` (CRT distortion on cover image, 3.2s with 4-step keyframe punches), `pending-chip-flicker` (subtle opacity pulse on the chip).
- [[ContentCard]] renders `[PENDIENTE·CONFIRMAR]` chip (red) + glitch border + scanline overlay + cover flicker when `_pendingConfirm` is set. Replaces the `[DRAFT·SESIÓN]` chip in this state — only one signal at a time, less visual noise.
- Auto-scroll-into-view on mount when pending so the editor doesn't have to hunt for their card.
- Corner button `[✓ CONFIRMAR]` floating top-right, opens the confirmation modal.

**Confirmation modal** — new [[PublishConfirmOverlay]], globally mounted at layout level (alongside [[LoginOverlay]]). Driven by `usePublishConfirm` context — same shape as `useAuth`. Modal shows item type/slug/title preview + warning copy + `CANCELAR` / `▶ PUBLICAR DEFINITIVAMENTE`. On confirm: `upsertItem(item, 'published')` + clears `?pending` URL param via `router.replace`.

**Filter clear on publish** — when a category filter is active and the editor publishes a different type, the new card would be filtered out and invisible. Each form's `onPublish` calls `setCategoryFilter(null)` before routing. Surgical: only fires at publish-time, not on dashboard entry, so browsing-time filters are preserved.

**Edit flow** — any session item (draft OR published) gets `[✎ EDITAR]` in its overlay strip. Routes to `/dashboard?type=<type>&edit=<id>`.
- `useDraftWorkbench` accepts `editItemId` prop. On hydrate, prefers `getItemById(editItemId)` over the per-form local-draft key.
- Strips `_draftState` and `_pendingConfirm` flags before populating form state.
- Sets `committedId` to the existing item's id so subsequent saves UPDATE the same row instead of creating a new one.
- Wired in all 7 forms via `useSearchParams().get('edit')`.

**Visual session-strip differentiation:**
- Drafts: orange chrome, all 3 actions
- Published: green chrome, just edit + delete (already live; no need to re-publish)

### Arc 3 — Chunk 2: Editor closure

**Drafts list page** — `/dashboard/drafts` ([[Dashboard Drafts]]):
- Auth-guarded same as `/dashboard`
- Header row counts (`3 ENTRADAS · 2 DRAFTS · 1 PUBLICADAS`)
- Type filter chips (only types present, with per-type counts)
- State filter chips (TODOS / DRAFTS / PUBLICADAS) — composes with type
- Table rows: type chip · state chip (orange-pulsing draft, green published) · title + slug · `hace Xh` updated · `[✎ EDITAR]` `[▶ PUBLICAR]` (drafts only) `[🗑]`
- Empty states: "BANDEJA VACÍA" for fresh sessions, "SIN COINCIDENCIAS" for over-narrow filters
- Sorted newest-updated first
- DRAFTS link in [[Dashboard]] header status strip with live count from `useDraftItems()`

**Form validation feedback:**
- New `required` prop on `TextField` / `TextArea` → renders red `*` next to label, red-tinted border when empty
- New `errors: string[]` prop on `SubmitFooter` → renders `⚠ FALTA: TÍTULO · SLUG` red chip when invalid
- Each form computes its own errors array from required-field rules
- Eventually replaces the silent disabled-button-with-no-explanation pattern

**Image upload** — `ImageUrlField` extended with three input modes:
- Type / paste URL (existing)
- `[⎘ ELEGIR ARCHIVO]` button → native file picker → reads as data URL via `FileReader`
- Drag image onto the field → reads as data URL
- Result stored as a string (URL or `data:image/...;base64,...`) — drop-in for `imageUrl` everywhere
- URL field shows truncated display when storing a data URL (`data:image/png… [archivo cargado · 142 KB]`) + readonly to prevent corruption
- `[×] LIMPIAR` button to clear
- Type validation: rejects non-image with red error chip
- When backend lands, file picker / drop swap to upload-and-return-URL; rest of the form contract unchanged

**Opinion form** ([[Dashboard Forms]]) — clone of EditorialForm with `type: 'opinion'`. Adds 7th type to the dashboard.

**Articulo form** — the long-deferred big one. Closes dashboard type coverage at 8/9 (only `partner` excluded — rail-only). Self-contained file (~620 lines):
- Same identity / lead / vibe / media / footer pattern as other forms
- Block editor supporting all 10 `ArticleBlock` kinds: `lede / p / h2 / h3 / quote / blockquote / image / divider / qa / list`
- Each kind gets a kind-specific editor body (text input for h2/h3, dual cite+text for quote variants, full ImageUrlField for image, list-items editor for list, speaker + isQuestion toggle for qa, etc.)
- Footnotes editor: id + text rows, add/remove, with usage hint (`[^id]` syntax)
- Glyph icons in block headers for visual scannability
- Up/down/delete per block

### Files added across both chunks (in chronological-ish order)

**lib/**
- [drafts.ts](../../lib/drafts.ts) — store + hook + types

**components/**
- [HomeFeedWithDrafts.tsx](../../components/HomeFeedWithDrafts.tsx)
- [overlay/ShareButton.tsx](../../components/overlay/ShareButton.tsx)
- [publish/usePublishConfirm.tsx](../../components/publish/usePublishConfirm.tsx)
- [publish/PublishConfirmOverlay.tsx](../../components/publish/PublishConfirmOverlay.tsx)
- [dashboard/DraftsList.tsx](../../components/dashboard/DraftsList.tsx)
- [dashboard/forms/OpinionForm.tsx](../../components/dashboard/forms/OpinionForm.tsx)
- [dashboard/forms/ArticuloForm.tsx](../../components/dashboard/forms/ArticuloForm.tsx)

**app/**
- [not-found.tsx](../../app/not-found.tsx)
- [dashboard/drafts/page.tsx](../../app/dashboard/drafts/page.tsx)

### Files modified
- [lib/types.ts](../../lib/types.ts) — `_draftState` + `_pendingConfirm` on `ContentItem`
- [components/cards/ContentCard.tsx](../../components/cards/ContentCard.tsx) — chip swap, glitch wiring, corner confirm button, auto-scroll
- [components/overlay/OverlayShell.tsx](../../components/overlay/OverlayShell.tsx) — `SessionItemStrip` (was `DraftActionStrip`), ShareButton slot
- [components/overlay/OverlayRouter.tsx](../../components/overlay/OverlayRouter.tsx) — resolves drafts before MOCK_ITEMS
- [components/overlay/MixOverlay.tsx](../../components/overlay/MixOverlay.tsx) — related section
- [components/ContentGrid.tsx](../../components/ContentGrid.tsx) — per-type empty states
- [components/dashboard/forms/shared/Fields.tsx](../../components/dashboard/forms/shared/Fields.tsx) — workbench split (saveDraft / requestPublish), CommitFlash, SaveIndicator, errors prop, required prop, FieldLabel helper, ImageUrlField with drag-drop + file picker
- All 7 form files (Mix / Listicle / Evento / Review / Editorial / Opinion / Noticia / Articulo) — useRouter + useSearchParams + useVibe; onPublish navigation; required props; errors arrays
- [app/dashboard/page.tsx](../../app/dashboard/page.tsx) — Articulo + Opinion routed; DRAFTS link with live count
- [components/dashboard/TypePicker.tsx](../../components/dashboard/TypePicker.tsx) — Articulo + Opinion meta
- [app/layout.tsx](../../app/layout.tsx) — PublishConfirmProvider + PublishConfirmOverlay mounted
- [app/globals.css](../../app/globals.css) — pending-* keyframes + utility classes

### Bugs caught mid-build (already fixed; noted for the record)

- `commitItem` import didn't exist in `lib/drafts.ts` (the named re-export lived in `Fields.tsx`). Fixed to `upsertItem as _commitItem`.
- [[OverlayRouter]] only knew about MOCK_ITEMS, so clicking a draft card opened nothing. Fixed: looks up drafts via `useDraftItems()` first.
- [[HeroCard]] `TYPE_LABEL` was missing the `listicle` entry (latent regression from listicle introduction). Fixed.
- Dashboard with active categoryFilter would publish a different type → invisible card. Fixed by `setCategoryFilter(null)` in each form's `onPublish`.
- Tailwind `base` color collision (still open as a deeper refactor; patched locally in [[MixOverlay]] earlier).

### Still open / explicitly deferred

- **Dashboard chrome redesign** — user noted DRAFTS link is too subtle in the header; deferred to a dedicated dashboard pass.
- **Real backend** — every "session" feature becomes a real DB write when [[Supabase Migration]] lands. The seam is `lib/drafts.ts`'s API — replace functions, callers don't change.
- **Audio context session** — mix transport + listicle inline track embeds + reactive HUD still deferred.
- **Inline track embeds in listicles** — still link-outs; same audio-context dependency.
- **Mobile pass** — accidental desktop-only bits (CategoryRail at lg+, AuthBadge at md+, dashboard split-view).
- **Tailwind `base` color rename** — spawned task, not yet picked up.
- **CRT scanline sweep on filter change** — user-suggested polish, see [[CRT Scanline Sweep]].
- **Reduced-motion respect** for the pending glitch + CRT animations (a11y).

### Where the dashboard now stands

| Type | Form | Notes |
|---|---|---|
| evento | ✓ | dates, venue, line-up, tickets |
| mix | ✓ | embeds, structured tracklist, contexto |
| listicle | ✓ | streamlined block editor (4 kinds incl. track) |
| articulo | ✓ | full block editor (10 kinds) + footnotes |
| review | ✓ | reader-family |
| editorial | ✓ | reader-family + editorial flag default |
| opinion | ✓ | reader-family columnist variant |
| noticia | ✓ | leaner, fast-decay |
| partner | — | rail-only, intentionally not editable |

8 of 9 types fully editable. Same pipeline for all: workbench autosave + edit hydration + filter clear + pending confirmation + drafts list management.

### New notes from this session

- [[Publish Confirmation Flow]] — design + state machine
- [[Dashboard Drafts]] — page note
- [[drafts]] — module note
- (Various component notes still pending — see [[Open Questions]])

### Updates

- [[Dashboard]] — drafts subpage link, two-state model
- [[Dashboard Forms]] — validation, image upload, articulo + opinion, edit hydration
- [[Open Questions]] — closed: drafts injection, articulo form, opinion form, save indicator, image upload, drafts list, validation feedback, MixOverlay related, 404 page
- [[index]] — new pages + components
- [[Next Session]] — fresh start brief

## 2026-04-25 · INGEST · Dashboard, in-page category filter, polish pass

Catch-up entry covering ~24h of work that wasn't logged in real time. Three big arcs.

### Arc 1 — Insider dashboard (visual prototype)

User-facing goal: editors / partners log in via header overlay, hit a `/dashboard` route, pick a content type, see a form whose layout mirrors how the type renders in the feed. Live preview panel on the right reflects edits in real time.

**Auth system** — visual prototype only, hardcoded `admin/admin`:
- [[useAuth]] context + `<AuthProvider>` wrapping the app, sessionStorage-backed.
- [[LoginOverlay]] — terminal-aesthetic modal triggered by a header button. Uses the same panel chrome as [[OverlayShell]] for visual coherence. Validates credentials, sets session, auto-closes.
- [[AuthBadge]] in [[Navigation]] — slots between MAGI cluster and timer. Swaps `LOGIN` (orange) ↔ `DASHBOARD` link (green) + `⏻` logout when authed. Mobile-only hidden for now (kept the existing `≡` toggle clean).
- When real auth lands (Supabase), `useAuth.login()` is the only thing that changes — rest of the app consumes via `useAuth()` and is provider-agnostic.

**Dashboard route** — `/dashboard`:
- Auth-guarded client component. Unauthed users get prompted via the login overlay.
- Type picker grid: 6 tiles (mix · listicle · evento · review · editorial · noticia). Each tile in the type's `categoryColor` with a top accent stripe.
- Picking a type routes to `/dashboard?type=mix` (URL-driven so back/forward works) and renders a split view: form (left) + [[LivePreview]] (right).
- Excluded from v1: `articulo` (needs full structured-block editor), `opinion` (trivial duplicate of editorial), `partner` (rail-only, separate flow). Placeholder shown if user lands on those.

**Forms — one per type**, per the per-type-components preference:
- [components/dashboard/forms/MixForm.tsx](../../components/dashboard/forms/MixForm.tsx) — full mix shape: identity, copy, vibe + genres, media, embeds, contexto (series/recordedIn/format/BPM/key/status), tracklist editor.
- [components/dashboard/forms/EventoForm.tsx](../../components/dashboard/forms/EventoForm.tsx) — date/end-date pickers (datetime-local), venue, line-up (StringListField), tickets, price.
- [components/dashboard/forms/ReviewForm.tsx](../../components/dashboard/forms/ReviewForm.tsx), [EditorialForm.tsx](../../components/dashboard/forms/EditorialForm.tsx), [NoticiaForm.tsx](../../components/dashboard/forms/NoticiaForm.tsx) — reader-family triplet sharing the same fields with type-appropriate defaults (e.g. editorial defaults `editorial: true`, noticia is leaner with no author/readTime).
- [components/dashboard/forms/ListicleForm.tsx](../../components/dashboard/forms/ListicleForm.tsx) — the most complex. Standard fields plus an `articleBody` block editor supporting four block kinds (`lede`, `p`, `divider`, `track`). Each track block has rank, artist, title, year, BPM, cover, embeds, commentary.
- Shared primitives in [components/dashboard/forms/shared/Fields.tsx](../../components/dashboard/forms/shared/Fields.tsx) — `Section`, `TextField`, `TextArea`, `Toggle`, `VibeField`, `GenreMultiSelect`, `StringListField`, `EmbedList`, `ImageUrlField`, `SubmitFooter`, plus `slugify` and `publishDraft` helpers.
- Each form: hydrate from sessionStorage on mount, autosave on change, slug auto-generated from title (overrideable).

**LivePreview** — right pane:
- Renders the draft `ContentItem` through its real overlay component (`MixOverlay`, `ListicleOverlay`, `EventoOverlay`, `ReaderOverlay`, etc.) inside a scaled-down panel that mimics [[OverlayShell]] without taking over the screen.
- Updates in real time as the form is edited. Verified by typing a title and watching the preview's H1 update synchronously.

**Submit / publish (visual only)**:
- Console-logs the constructed `ContentItem` with a fresh id + timestamp.
- Persists to `sessionStorage.gradiente:dashboard:published` (capped to 20).
- Brief green `◉ DRAFT PUBLICADO EN SESIÓN` confirmation chip.
- Drafts do NOT yet inject into the home feed — see [[Open Questions]].

**Block editor streamlined** (after first version was clearly cluttered):
- Track blocks now collapsible to a 1-row summary (rank · cover thumb · artist/title · embed count). Toggleable per block. Default expanded on add, collapsible after.
- Primary `AÑADIR TRACK` button (large, orange) + secondary chips for `LEDE` / `PÁRRAFO` / `DIVISOR` — weights the dominant content unit appropriately.
- **Auto-rank**: new track blocks pre-fill rank by detecting countdown vs. ascending pattern from existing tracks. First track 10 → next track auto-fills 9, etc.
- **Insert-between** rows: thin hairline gap between every pair of blocks; on hover a `+` reveals a mini picker to insert any kind at that position.
- **Auto-focus** lands on the first editable field of newly-added blocks (artist for track, textarea for lede/p).
- Inline cover thumb in the expanded track view — immediate visual feedback as URL is typed.
- Kind glyphs in headers (`Disc3` / `Type` / `Minus`) for quick scanning.

**Form polish — type-contextual paste handlers**:
- **Mix tracklist**: `PEGAR LISTA` toggle opens a textarea + parser. Recognizes `01. Artist - Title (134)`, `Artist — Title [134 BPM]`, `Artist - Title 134`, `Artist - Title`. Skips `#` comment lines. Live "N pistas detectadas" count. Enter in the last row's BPM cell adds a new row + auto-focuses ARTIST. Multi-line paste in any row also parses and splits in place.
- **EmbedList** (mix + listicle track blocks): URL input live-syncs platform dropdown as you type/paste (YouTube URL → tab snaps to YOUTUBE). Auto-focus on add. Multi-URL paste splits into rows with per-platform detection.
- **StringListField** (evento line-up, etc.): same `PEGAR LISTA` pattern, one entry per line. Per-row paste also splits multi-line. Enter creates new row.

**Tailwind `base` color collision regression** — see [[Open Questions]]. Hit again in `MixOverlay`'s excerpt; fixed locally with `md:text-[15px]`. Spawned task to rename the token.

### Arc 2 — Two new listicle fixtures

The user wanted to see how listicles actually look in the feed. Added two:

- **`5 eventos imperdibles · Mayo 2026`** — events-themed list using `lede / h2 / image / p / divider` blocks. Each event entry has a ranked h2, flyer image with date+venue caption, and editorial description. Demonstrates that the existing block kinds can carry an event listicle without a dedicated `event` block kind.
- **`10 tracks que definieron el verano · CDMX 2026`** — 10 track blocks countdown 10→1, summer-vibe BPMs (110-132), house/breaks/electro/disco genres. Real producers (DJ Tennis, Roman Flügel, Hagan, Anz, Karenn, Skee Mask, Floating Points, Siete Catorce, Loraine James, Donato Dozzy at #1).

### Arc 3 — In-page category filter

User flagged the rail as taking them to dedicated routes (`/agenda` etc.), breaking the contained-surface idiom. Reworked to filter the home grid in place.

**Mechanics**:
- Added `categoryFilter: ContentType | null` + `setCategoryFilter` to [[VibeContext]].
- [[CategoryRail]] refactored from `<a href>` links to `<button>` toggles. Click sets the filter; click again on the active category clears it. Added `//TODOS` pseudo-row at top (active when no filter). Added a `×` clear affordance in the SECCIÓN header that shows only when a filter is active.
- [[ContentGrid]] applies the category filter alongside the vibe filter on the home feed (mode === 'home' only — type-specific pages already filter at the route level so they're not affected).
- [[HeroCard]] returns `null` when a filter is active and doesn't match its type. Also caught a latent bug: `HeroCard.TYPE_LABEL` was missing the `listicle` entry — fixed.
- Active category dims inactive entries to 40% opacity for visual focus.

**Dedicated type routes preserved** — `/agenda`, `/mixes`, `/articulos`, etc. still exist for deep-linking and bookmarking. The rail simply no longer points to them. Editorial decision per the user.

**Transition polish** so filter changes don't snap:
- [[ContentGrid]] now wraps the items map in `<AnimatePresence mode="popLayout">`. `popLayout` is the right mode here — exiting cards stay in their original DOM slot until they finish animating, allowing remaining cards to reflow cleanly via Framer's shared-layout animation.
- Each card has explicit `initial / animate / exit`: exit is `opacity → 0`, `scale → 0.85`, 220ms easeIn (decommission feel). Initial is `opacity 0`, `scale 0.92` → animates to the prominence-driven standing scale.
- [[FeedHeader]] new client component replacing the previously static "TODO LO QUE VIENE" strip in [[Home]]. Reads `categoryFilter` and switches between the default editorial intro and a terminal-flavored `//SUBSISTEMA · FILTRADO · {TYPE}` status line (in the category color, with a pulsing dot) + a `[×] LIMPIAR FILTRO` button as a second clear affordance alongside the rail's `×`.

### Misc small things

- **Curation maps were missing `listicle`** — `ATTENTION_HALF_LIFE_HOURS`, `FRESHNESS_HALF_LIFE_HOURS`, `peaks` initializer, and `TYPE_SCORE_MULTIPLIER` all needed the new key, otherwise lookups returned undefined and produced NaN scores → invisible cards. Fixed.
- **CategoryRail was missing `listicle`** — same class of bug, same fix.
- **ContentCard / OverlayShell `TYPE_LABEL`** also needed `listicle: 'LISTA'`.
- Listicle track-block rank text overflowed its column (`md:text-6xl` in 80px col cropped under cover image). Adjusted to `md:text-5xl` in 96px col → 11px clearance.

### Out of scope / explicit deferrals

- **Drafts injecting into the home feed** — currently sessionStorage-only. The plumbing (`useDrafts()` hook + grid merge) is one focused change away. See [[Open Questions]].
- **Articulo dashboard form** — needs the `articleBody` editor to handle all block kinds (lede/p/h2/h3/quote/blockquote/image/divider/qa/list). Listicle covers the subset (lede/p/divider/track); articulo would extend.
- **CRT scanline sweep on filter change** — user-suggested polish. See new roadmap note [[CRT Scanline Sweep]].
- **Inline track embeds in listicles** — still link-outs. Deferred to the audio-context session for the same iframe-vs-Web-Audio reason as the mix player.

### New notes

- [[Dashboard]], [[useAuth]], [[LoginOverlay]], [[AuthBadge]], [[LivePreview]], [[Dashboard Forms]], [[FeedHeader]]
- [[CRT Scanline Sweep]]

### Updated notes

- [[CategoryRail]] — now in-page filter, not navigation
- [[VibeContext]] — categoryFilter added
- [[ContentGrid]] — AnimatePresence + exit animations + category filter
- [[Open Questions]] — draft injection, CRT scanline added; tailwind `base` collision still open
- [[Content Types]] — already updated previously for listicle
- [[index]]

## 2026-04-24 · INGEST · Mix overlay + Listicle content type shipped

Two deliverables, one shared infrastructure.

**Mix overlay** — mix no longer falls through to [[GenericOverlay]]. New [[MixOverlay]] renders a two-column terminal layout matching a mockup the user shared: editorial column (title, excerpt, metadata row with 10-bar vibe gauge, body, genres) + system column with three numbered panels — `01 AUDIO EMBED // REPRODUCTOR` (source tabs, cover, decorative seeded waveform, non-functional transport, `[ABRIR FUENTE]` link-out), `02 CONTEXTO` (SERIE / GRABADO EN / FORMATO / BPM / KEY / ESTATUS key-value grid), `03 TRACKLIST / ETIQUETAS` (numbered artist/title/BPM table + tag chips).

**Mix type fields extended** (see [[Content Types]]):
- `embeds: MixEmbed[]` — multi-platform sources (SoundCloud / YouTube / Spotify / Bandcamp / Mixcloud), drives the overlay tabs. `mixUrl` retained as legacy fallback.
- Structured `tracklist: MixTrack[]` — rows `{ artist, title, bpm? }` replacing the old `string[]`. Safe change — no existing mix had `tracklist` data populated.
- New context metadata: `mixSeries`, `recordedIn`, `mixFormat`, `bpmRange`, `musicalKey`, `mixStatus` (`'disponible' | 'exclusivo' | 'archivo' | 'proximamente'`).
- `mx-001` (Siete Catorce) and `mx-002` (Rat Pack Crew) enriched with full shape as visual test fixtures. Other mixes degrade gracefully — empty panels show explicit empty states ("Sin metadata de contexto.", "Tracklist no publicado.").

**Listicle** — ninth content type. Concept: ranked/structured list features ("Top N tracks that defined X"). Architecturally a sibling of [[ArticuloOverlay]]: same `articleBody: ArticleBlock[]`, same prose primitives, plus a new `track` block variant `{ kind: 'track', rank, artist, title, year, bpm, imageUrl, embeds, commentary }`.

**`track` block is shared infra** — the case lives inside `BodyBlocks` in [[ArticuloOverlay]] (which is now exported). This means any `articulo` can also embed track references with zero duplication. Listicle is where it's the primary content unit; articulo could use it for inline track citations.

**Routing/labeling:**
- `'listicle'` added to `ContentType`, `categoryColor` (`#FB923C` orange — shares the mix panel color family), `TYPE_LABEL` ('LISTA' — Spanish convention; internal key stays 'listicle' to match the user's terminology).
- Curation tuning: [curation.ts](../../lib/curation.ts) `ATTENTION_HALF_LIFE_HOURS`, `FRESHNESS_HALF_LIFE_HOURS`, `peaks` initializer, and `TYPE_SCORE_MULTIPLIER` (1.3, matches articulo) all extended. Without these, `Record<ContentType, number>` lookups returned undefined at runtime, producing NaN scores and invisible cards — caught during verification.

**Visual prototype scope:**
- **Audio playback is not wired anywhere** — transport controls in mix overlay are visible but disabled; track-block source buttons in listicles are link-outs (`<a target="_blank">`). Per user decision, all audio work (persistent audio across overlays, reactive-from-audio HUD, custom transport, click-to-embed facade for listicle tracks) is deferred to a dedicated audio-context session. See [[Open Questions]].
- Iframe-based embeds were explicitly avoided — iframes sandbox the audio stream and would have to be ripped out when the audio session happens anyway.

**Shared infrastructure landed:**
- [[Embed Primitive]] — `components/embed/platforms.ts` holds `PLATFORM_LABELS`, `PLATFORM_ORDER`, and `detectPlatform(url)`. Small by design; will grow (iframe src builders, `<EmbedPlayer>` component) when the audio session happens.

**Bug surfaced, partially fixed:** Tailwind config in [tailwind.config.ts](../../tailwind.config.ts) declares `colors.base: '#000000'`. This makes Tailwind generate `.text-base { color: #000000 }` alongside the default font-size rule. At md+ breakpoint, `md:text-base` overrode `text-secondary` on the excerpt `<p>`, rendering the text invisible on the black background (user-reported). Fixed locally in [[MixOverlay]] with `md:text-[15px]`; the latent bug remains anywhere else using `text-base` or `md:text-base`. A spawned task was filed to rename the `base` color token and sweep usages. Spot-check [[GenericOverlay]] at `text-base`. Flagged in [[Open Questions]].

**New fixtures:**
- One enriched mix (mx-001) matching the mockup's richness — multi-source embeds, full CONTEXTO, 5-row tracklist.
- One listicle (`li-hard-techno-cdmx-2026`) — "5 tracks que definieron el hard techno en CDMX · 2026" — with lede, intermission paragraphs, divider blocks, and 5 countdown-ranked `track` blocks each with 2-4 source embeds spanning all four major platforms.

**Layout fix during verification:** Rank digits in track blocks initially used `md:text-6xl` in an 80px column, overflowing into the cover image. Adjusted to `md:text-5xl` in a 96px column — 5px overflow absorbed by grid gap, 11px clearance to cover.

**New notes:**
- [[MixOverlay]], [[ListicleOverlay]], [[Embed Primitive]]
- [[Content Types]] expanded with listicle section and full mix field docs

**Updates:**
- [[Open Questions]] — MixOverlay resolved; audio-context session consolidation added; tailwind `base` color collision noted.

**Next up (per user):** admin dashboard with morphing upload forms. The listicle is ready — dashboard needs to offer it as one of the upload type options alongside evento / mix / noticia / review / editorial / opinion / articulo.

## 2026-04-24 · INGEST · VibeSlider redesigned — phosphor tape + continuous range

[[VibeSlider]] rebuilt end-to-end to resolve the choppy clipped-gradient look and the integer-snap slider feel.

**Visual — from clipped stripe band → phosphor tape:**
- Removed `STRIPE_MASK`, `NEON_GRADIENT`, and the `clipPath: inset()` overlay. The old design cropped a full-width rainbow with a 45° black mask; as the handle moved, the crop was visually choppy and the mask made the colors feel muddy.
- Replaced with **three horizontal rows of short vertical dashes** evoking a static waveform display: 120 dashes in the middle row (dense, near-continuous baseline), 40 in the top and bottom rows at a half-step offset from each other to create a subtle saw rhythm. All dashes 2.5px wide, 3–6px tall, with a tight colored halo glow when lit.
- Each dash's color is computed once via a new `interpolateVibeColor()` helper that linearly interpolates between adjacent `vibeToColor()` anchors — so the band is smooth but snaps to the discrete per-item slot colors at integer positions. See [[Vibe Gradient]] for the updated three-expression breakdown.
- Dash positions/widths use a `Math.imul`-based integer hash — bit-exact across Node SSR and V8 client, avoiding React hydration warnings (earlier `Math.sin`-based attempt produced last-digit FP drift between server/client).

**Mechanics — from stepped → continuous:**
- `getValueFromX` no longer rounds: `vibeRange` now stores continuous floats in `[0, 10]` rather than integers 0–10. Dragging from GLACIAL toward VOLCÁN glides smoothly instead of snapping per-slot.
- Handle label and label color still snap to the nearest integer slot via `Math.round(min)` — the named vibes (GLACIAL, POLAR, CHILL…) remain legible rather than reading `3.73`.
- The lit/unlit boundary inside the phosphor tape is **pixel-precise** — each dash stores its exact float vibe and the `d.vibe >= min && d.vibe <= max` check produces a crisp boundary that slides smoothly with the handle.
- Content filtering (`filterByVibe` in [[ContentGrid]] / [[ContentFeed]]) automatically benefits — items' integer vibes compared against float boundaries give smooth activation as handles cross half-integer thresholds.

**Deliberately preserved:**
- Sticky positioning below [[Navigation]], RESET button, click-track-to-move-nearer-handle, label overlap threshold (14%), genre chip strip below the band.
- The 11 slot names (GLACIAL → VOLCÁN) are unchanged — finer granularity than `vibeToLabel` by design, needed for slider positions.

**Out of scope / deferred:**
- Unifying the three color expressions (Tailwind pastel, discrete saturated, dash interpolation) — deferred. See [[Vibe Gradient#Should they unify]].
- Making the phosphor tape reactive to audio — still future. See [[project_audio_vision]] in memory. The current static 3-row print is deliberately shaped to read as a waveform preview, priming the eye for when embeds land and the tape becomes a real HUD.

## 2026-04-23 · INGEST · Articulo content type + longform overlay shipped

Added `articulo` as the eighth content type — the longform/deep-dive tier that sits alongside `editorial` / `review` / `opinion` / `noticia` in the editorial family but gets its own reader.

**Why a new type:** `editorial` carries a curatorial/positional connotation (editor-flagged opinions, scene-shaping takes). `articulo` is reportage + form — substack-style deep-dives with interviews, pull-quotes, footnotes, section headers. Different register, different reading shape, deserves a distinct surface.

**New:**
- `articulo` added to `ContentType`, `categoryColor` (`#FDE68A` warm off-white), `TYPE_LABEL` (`ARTÍCULO`), curation half-life maps, peak initializer, score multiplier (1.3, matches review).
- `ArticleBlock` discriminated union + `Footnote` type in [`lib/types.ts`](../lib/types.ts). Structured block kinds: `lede`, `p`, `h2`, `h3`, `quote`, `blockquote`, `image`, `divider`, `qa`, `list`.
- `/articulos` route ([[Articulos]]) and `//ARTÍCULO` row in [[CategoryRail]] + [[Navigation]].
- [[ArticuloOverlay]] — longform reader distinct from [[ReaderOverlay]]: hero image is primary (not archival), sticky TOC rail with active-section tracking, drop-cap lede, vibe-colored pull-quotes, Q&A speaker labels, inline `[^id]` footnote refs → numbered endnotes, FIN hazard-stripe marker, curated `SIGUIENTES·LECTURAS` that swap in-overlay via [[OverlayRouter]].
- Three seeded articulos in [[mockData]] demonstrating the block variety.

**Deliberately NOT in scope:**
- `articulo` excluded from `getPinnedHero` allowlist — competes in the feed but doesn't auto-promote to portada. Can be revisited later.
- No engagement metrics (per [[Size and Position as Only Signals]] + [[No Algorithm]]) — "Ready for more?" translates to curated related-reading, not subscribe/share CTAs.

**Design reference:** [firstfloor.substack.com](https://firstfloor.substack.com), translated through Gradiente's terminal idiom (monospace meta, `//` prefixes, block-bar progress indicators).

## 2026-04-23 · INGEST · Card → overlay system shipped

Built and documented the full card-click-to-overlay reading surface. PR open at [feat/card-overlay](https://github.com/datavismo-cmyk/espectro-fm-web/compare/main...feat/card-overlay?expand=1).

**New UX primitive:** click any card (including the pinned hero) → full-screen overlay with CRT boot-in animation + dim/blur backdrop. URL updates via `?item=<slug>` for deep-linking, but no route change. See [[Overlay System]].

**New components:**
- [[OverlayShell]] — frame chrome, close affordances, CRT boot animation
- [[OverlayRouter]] — mount/exit state machine, type dispatch
- [[ReaderOverlay]] — terminal reader for `editorial` / `review` / `opinion` / `noticia` (8/4 split, article primary, flyer demoted to archival rail, F-key flyer lightbox, sticky scroll-progress footer)
- [[EventoOverlay]] — flyer-as-hero for `evento` (date block, line-up, tickets CTA)
- [[GenericOverlay]] — fallback for `mix` until a dedicated overlay ships

**New module:**
- [[useOverlay]] — context + hook, URL sync via `history.replaceState` (not `router.replace` — that triggered RSC refetches that remounted the overlay mid-animation)

**Two new decisions enshrined:**
- [[Contained Single Surface]] — the page is one continuous surface; card click → overlay, never a route. External URLs become explicit user-chosen escape hatches, not the default.
- [[Reader Terminal Layout]] — long-form overlays are reading subsystems, not enlarged cards. Flyer demotes to archival evidence. Per-type overlays instead of a unified shell with `switch(type)`.

**Updates to existing notes:**
- [[ContentCard]] — now clickable; opens overlay via [[useOverlay]]
- [[HeroCard]] — now clickable (whole section, including `// EN PORTADA` header bar); became a client component, `getPinnedHero` moved to [utils.ts](../../lib/utils.ts)
- [[Open Questions]] — card-click-to-detail resolved; per-type-overlay resolved; Supabase migration explicitly deprioritized (visual MVP phase)

**Deferred (noted in [[Open Questions]]):**
- MixOverlay (mix still uses [[GenericOverlay]])
- Mobile swipe-down-to-close
- Text-size / copy-link / minimap affordances mentioned in [[Reader Terminal Layout]]
- Full `body` field on `ContentItem` (we render `bodyPreview` for now)

**Tech note:** Framer Motion was attempted first for the overlay animations; animations would not fire reliably and the root cause was never identified. Switched to pure CSS keyframes in [globals.css](../../app/globals.css) — simpler and sufficient for the current motion vocabulary.

---

## 2026-04-22 · INGEST · "Do now" fixes landed

Shipped the short-effort fixes from [[Open Questions]]:

- **`CLAUDE.md` and `README.md` rewritten** as real markdown (from the Python-wrapper corrupted state). Both now reflect Gradiente branding with links into the wiki.
- **`/opinion` page created** — `app/opinion/page.tsx`, follows the same shape as [[Editorial]]. [[CategoryRail]] link now resolves.
- **[[Agenda]] tagline fixed** — `HOY → PASADO` → `FUTURO → PASADO` to match the actual DESC-by-date sort.
- **[[Editorial]] tagline simplified** — `TEXTOS & OPINIÓN` → `TEXTOS` (opinion has its own route now).
- **[[ArticleCard]] TYPE_LABEL fixed** — added missing `opinion` and `partner` entries. (Was type-failing the build as soon as strict checking ran.)
- **Next.js 14.2.21 → 14.2.35** — minor bump, build verified. Remaining CVEs require a Next 16 major upgrade; deferred.
- **ESLint rule `react/jsx-no-comment-textnodes` disabled** project-wide — `//` tokens in JSX are a deliberate NGE branding element throughout (`//EVENTO`, `//EN PORTADA`, etc.), not accidental JS comments.

**New roadmap notes created:**
- [[CRT Shader Layer]] — full-viewport CRT post-processing (blend-overlay mode first, render-to-texture mode as V2)
- [[Three.js Islands]] — isolated 3D scenes per `<Canvas>`, with `<AsciiRenderer>` from drei as the signature trick

**Not touched (explicitly deferred):**
- [[Dual Feed Systems]] — orphan delete/toggle decision still outstanding
- Next.js 16 major upgrade — too much scope for a "do now" slot; save for deployment prep
- Espectro → Gradiente content migration — coordinate with scraper cutover
- Card-click → dedicated route implementation — awaiting direction confirmation

---

## 2026-04-22 · INGEST · Editorial philosophy + data pipeline context

Context from conversation with the user:

- **Brand confirmed:** Gradiente is the new name; Espectro is the old. Content slugs + mix series titles still say Espectro. Full migration pending — coordinate with the scraper cutover so we don't rename twice.
- **Data pipeline revealed:** a Resident Advisor webscraper already exists and produced the current [[mockData]] via Excel. Productionization is the critical path — see new [[Scraper Pipeline]] note.
- **Editor dashboard is a planned feature** — see new [[Admin Dashboard]] note.
- **Editorial philosophy corrected:** I misread [[Editorial Flag]] as a quarantine. It's a boost. Editorial content lives IN the main grid alongside scraped items, competing on HP. Fixed in [[Editorial Flag]] and enshrined in new decision note [[Guides Not Gatekeepers]].
- **HP V1 vision surfaced:** HP is designed to eventually accept aggregate user interaction signals (not personalization). Currently decay-only. Added to [[Open Questions]] and [[Guides Not Gatekeepers]].
- **Card expansion discussed:** four options considered (modal, in-place expansion, inspection panel, dedicated route). Recommendation — dedicated `/[type]/[slug]` route with NGE reader chrome. See [[Open Questions]].

**New notes created:**
- [[Guides Not Gatekeepers]] (Decisions)
- [[Scraper Pipeline]] (Roadmap)
- [[Admin Dashboard]] (Roadmap)

**Notes revised:**
- [[Editorial Flag]] — fixed the quarantine misreading
- [[index]] — added new notes
- [[Open Questions]] — updated with V1 interaction loop, card expansion recommendation, body field question

---

## 2026-04-22 · INGEST · Vault bootstrap

Initial analysis of `espectro-fm-web` codebase into the wiki.

**Sources read:**
- `app/layout.tsx`, all `app/*/page.tsx` (home + 5 category pages)
- All 12 `components/**/*.tsx`
- All 5 `lib/*.ts` + `context/VibeContext.tsx`
- `tailwind.config.ts`, `next.config.mjs`, `tsconfig.json`, `app/globals.css`
- `package.json`, `.gitignore`
- Partial read of `lib/mockData.ts` (first 200 lines + file size)

**Pages created:** scaffold + ~30 notes across all 9 categories. See [[index]] for full map.

**Key findings:**
- Brand is **GRADIENTE FM** (layout metadata), not "Espectro FM" despite repo name. See [[NGE Aesthetic]].
- `CLAUDE.md` and `README.md` at repo root are **corrupted** — saved as a Python wrapper script instead of the markdown it was meant to produce. Flag for cleanup. See [[Open Questions]].
- Next.js 14.2.21 has an active security advisory. Patched version available. See [[Open Questions]].
- Two card systems coexist: `ContentCard` (mosaic) is wired; `EventCard`/`MixCard`/`ArticleCard` + `ContentFeed` are not imported anywhere. See [[Dual Feed Systems]].
- `curation.ts` references `EspectroObsidian/Espectro/02 - Features/Curation Model.md` — a prior local vault gitignored. Doesn't exist in this checkout; may live only on the lead's machine.
- Pre-existing `.gitignore` entry `EspectroObsidian/` confirms the prior vault attempt.

**Wiki setup choices:**
- Vault relocated from `Gradiente/Gradiente/` to `espectro-fm-web/wiki/` so it ships with the repo (option 1 of the sharing discussion).
- `.gitignore` extended to exclude per-user Obsidian workspace files (`workspace.json`, `workspace-mobile.json`, `workspaces.json`, `cache`, `.trash/`) while committing shared config.

**Next passes:**
- Full ingest of `lib/mockData.ts` to populate [[Content Types]] with real examples.
- Ask the team about `EspectroObsidian/Espectro/02 - Features/Curation Model.md` — reconcile with [[HP Curation System]].
- Decide fate of [[ContentFeed]] and linear card components (delete or adopt).
