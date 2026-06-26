# Next Session — start here

> Brief for picking up where the previous session ended.
> Last updated: **2026-06-25** — **PARTNER DOSSIER REVAMP — MERGED TO `main` + LIVE (`617acfb`).** The thin partner overlay → a full partner destination: [[PartnerOverlay]] is now a standalone wide two-pane dossier (own chrome, catalog facts replacing vanity, folded-in `//MERCADO`, a `[ENTRAR AL PERFIL DE PARTNER]` CTA), and a NEW real route [[Partner Page]] (`/p/[slug]`) recreates the Concept-1 dossier (stats · última actividad · `//PRÓXIMOS` · `//ARCHIVO` tabs · `//MERCADO` · `//SEÑALES` mockup · `//COMUNIDAD`), with attributed content fetched SERVER-SIDE (`getItemsByPartner`) so direct visits render. **STILL PENDING: apply migration `0040` (`verified` + `featured_item_id`) via the Supabase SQL editor** — the deploy is safe without it (graceful: fields read undefined via the cast, write spreads empty so publishing is unaffected), but the verified badge + featured block stay dormant until applied. `/p/[slug]` is a REAL route → relaxes [[Partners Isolation]] + [[Contained Single Surface]] (precedent: `/e/[slug]`, `/u/[username]`); flag datavismo. NEXT: authoring UI for verified/featured/tags/bio/year; `//SEÑALES` needs the payments spine; attribution is sparse (only Club Japan). Full detail in top [[log]] entry.
>
> Previous update: **2026-06-23** — **PARTNER LOGOS — landed on the `/partners/` static-file scheme; 62/70 now have logos.** The gap was never data (all 70 rows seeded) — it was logos (59/70 `image_url=null` → [[PartnersRail]] showed empty boxes). My first pass uploaded 49 to Supabase **storage** + wrote prod, but the push collided with **Johan's PR #6** (just merged), which does logos as **static files in `public/partners/<slug>.jpg`** + `/partners/…` in the 0031 seed — and that seed is `ON CONFLICT DO NOTHING`, so his paths **never reached prod**. Iker's call: **standardize on the static-file approach.** Copied my 33 unique + 8 `from-db` logos into `public/partners/` (kept Johan's 21) → **62 files**; [scripts/applyPartnerLogos.ts](../scripts/applyPartnerLogos.ts) generates [0032_partner_logos.sql](../supabase/migrations/0032_partner_logos.sql) (idempotent UPDATE for all 62) and applies it `--apply` AFTER deploy (push first → files live → then flip prod, else 404s). **7 still logo-less** (no source; want handles from Iker): `cdisidente, dance-your-name, ensamble, memoria-local, mvmpmp, resonancias, ruido`. bg-removal still deferred; rail still desktop-only. Orphaned storage objects pruned. Full detail in top [[log]] entry.
>
> Previous update: **2026-06-22** — **DB-OPS SESSION (no feature build).** Reviewed Johan's two PRs and applied their migrations to prod via the SQL editor (both PRs shipped code ahead of schema): **0029** scene-entity registry (`entities` + `item_entities` + `items.format` — had been silently breaking publishing for *every* item type via a missing `format` column), **0030** +5 `partner_kind` enum values, **0031** 62-partner seed (59 landed, 3 pre-existed). Redesign 2026 + scene-entities (PR #4) are now MERGED to `main` and live at gradiente.org. Partner PR merged (**PR #5**, `49a73a0`) + pulled to local main, so the new-kind labels now render (blank-tag window closed once Vercel redeploys). PR #5 also added genre-catalog entries (`lib/genres.ts`, code-only, no migration). **Remaining open item: `touch_entities_updated_at()` search_path nit (one-liner — `alter function touch_entities_updated_at() set search_path = ''`).** Migration drift: prod `schema_migrations` stops at 0016 but the DB has objects through **0031** (0017–0031 applied out-of-band) — **never `supabase db push`.** See `migration-history-drift` memory.
>
> Previous update: **2026-06-12** — **REDESIGN 2026 PHASE A LANDED ON BRANCH `redesign/2026` (not merged, not pushed — Vercel auto-deploys main).** The NGE aesthetic is being replaced by a "CDMX transmission authority" identity (teletext/broadcast lineage, thermal instrument ramp, every readout true data). Landed: 11-slot thermo-diverging vibe ramp replacing the rainbow (`lib/utils.ts::VIBE_SLOT_COLORS` + `vibe-0..10` tokens), new [[VibeMeter]] on all cards/overlays (renders the EFFECTIVE band), [[VibeSlider]] rebuilt as a station dial (static printed plate, needles, PPM ballistics, release detents), [[ContentGrid]] motion constitution (size snaps / position slides, 0.25s, stepped reveals), [[Navigation]] de-NGE'd (real CDMX clock, honest ticker, MAGI palette gone), charcoal base `#0D0D0D`. `tsc` + `next build` + :3003 smoke tests pass. Full detail + phase B/C/D roadmap in the 2026-06-12 [[log]] entry. **Before merging: mobile pass + Iker's eyeball on the new ramp.** Gotcha: don't run `next build` while `next dev` is serving — corrupts the dev chunk map; restart dev after builds.
>
> Previous update: **2026-05-12** — two beta-feedback rollups landed back-to-back, both about surfaces holding open after the user had already committed. (1) **Header trim + MX rebrand** — nav row 9→4 (`HOME · AGENDA · FORO · MARKETPLACE`); inactive items now solid NGE orange (no more dim-until-active), active state is an orange→red gradient via `bg-clip: text` with `filter: drop-shadow()` for the glow (text-shadow doesn't render on bg-clipped glyphs). Logo + data-strip token rebranded `GRADIENTE·FM → GRADIENTE·MX`. (2) **Vibe chip strip auto-hides on idle** — replaced the range-driven `chipsVisible` rule with a 2s interaction timer; container drops its `min-h-[3.5rem]` and the chips wrapper transitions `max-height` in lockstep with `opacity`. Per-chip visibility uses the same gate, so once a filter is committed the strip settles to just the yellow selections. See top entry in [[log]] for full breakdown; updated [[Navigation]] + [[VibeSlider]].
>
> Latest three commits on `main` for this session: `ab9561b` `b106b2e` `668b921` — `git log --oneline main -5` for current state.
>
> **Outstanding visual work**: the welcome page's ASCII vinyl is functional but still off-design vs reference — see 2026-05-05 entry in the log for the levers (groove pitch, tilt, ambient hardening). Still not addressed.
> **Responsive coverage gap**: viewports ≤1280px (older Intel MacBook 13", iPad landscape) previously overflowed the header. The 2026-05-12 trim (9 links → 4) likely resolves this — verify on a 1280px window before declaring it closed. If still tight, the deferred path-2 hamburger drawer + horizontal SECCIÓN strip remains the answer (tiny demographic, may not be worth the redesign per Iker).

## How to start this session

> **Site is live at https://gradiente.org** (Vercel auto-deploys on push to `main`). Reads from Supabase project `gradiente-fm` (ref `dcqbtcpqbqrtxbshhlkd`). Real auth at the LOGIN button. Iker is admin (`@iker`). Migration history: files run through `0031_seed_partners` in `supabase/migrations/` (0030/0031 land with the unmerged partner PR), but the prod `schema_migrations` table only records 0001–0016 — **0017–0031 were applied out-of-band via the SQL editor, so never `supabase db push`** (it would replay/conflict). See `migration-history-drift` memory. Pre-squash originals preserved in `supabase/migrations.bak/` (untracked).

1. Read [[index]] (orientation), the top entry in [[log]] (the vibe arc), and [[Vibe Philosophy]] (the spine — every vibe/genre decision should check against the four ideas).
2. Boot the preview (`.claude/launch.json` → `dev`, port 3003). Log in via the LOGIN button as `iker` + your password. **Session doesn't persist across dev-server restarts (Windows quirk)** — log in fresh each session.
3. **Vibe Checks smoke test** — open any review/editorial overlay, click the [[VibeFader]] band, drag, release. Vote should commit (PUT 200). On a second tab the aggregate should update via realtime. The `◇N` count badge becomes `◆N` once `N >= 5`.
4. **Threshold demo via Studio** — for any item, insert 5+ rows in `vibe_checks` with different `user_id` UUIDs (any from `auth.users`) to push past threshold. Then reload home with the slider narrowed; the item's effective band should be the crowd median, not the author's range. Confirms `filterByVibe`'s eligibility fall-through.
5. **`/admin`** is live for admin-role users — three tabs: //INVITACIONES (invite-code generator), //USUARIOS (two-pane panel editor with RECIENTES + LECTOR/CURATOR/GUIDE/INSIDER/ADMIN/MOD chips), //PARTNERS (onboarding composer; vibe field is a two-thumb range; create-only — edit/delete pending).

## Pattern conventions (re-use these — codified in `project_backend_architecture` memory)

- **Server vs browser data modules** — `lib/data/*.ts` server-only (cookies-aware client); `lib/hooks/*.ts` browser-only. Don't cross-import; row mappers duplicate locally.
- **Optimistic write shape** — module-scoped cache + listener Set + sync `getXSync` + async `toggleX` that flips locally + API-confirms or rolls back. See `lib/savedCommentsCache`, `lib/itemSavesCache`, `lib/pollVotesCache`, `lib/draftsCache`, `lib/reactionsCache`, `lib/itemsCache`, `lib/publishedItemsCache`, `lib/userRanksCache` — all the same shape.
- **`authResolved` gate** — `useAuth` exposes `authResolved = ready && fetchedAuthId === sessionAuthId`. Use this NOT `ready` when deciding to redirect / open login.
- **Realtime subscriptions** — one shared channel per page, broadcast to existing per-key bus. `useThreads` mounts `foro:all` channel that calls `invalidateThreadOnly(id)`. See [[Backend Plan]] § Realtime architecture.
- **`router.refresh()` after every mutation** — login, signup, logout, comment posts, drafts, publishes, foro, admin role/partner edits all do this. Server components re-render; client components stay mounted.
- **Tabbed admin pattern** — `/admin?tab=…` with conditional server prefetch per tab so each load is bounded. Use this if adding more admin surfaces (review queue, etc.).

## What's unblocked right now

### A. Image cleanup for deleted listings (~30min)

When a listing is deleted, its image rows in `storage.objects` (uploads bucket) become orphans. The orphan-storage-prune we deferred earlier in the chunk-4 ops layer can now traverse the listings table cleanly (FK target was the design blocker), but it's still not built. Wire it in if we hit storage growth, otherwise leave for later.

### B. Chunk 5 — Scraper Phase 3 (~1-2 hr)

(Section letters above shifted up by one — the prior `A` slice shipped this session.)

GH Actions cron MWF (`0 12 * * 1,3,5` UTC = 06:00 CDMX). Idempotent `upsert_scraped_events()` RPC with field-level allowlist (scraper can update RA-source-of-truth fields, but **cannot touch `vibe_min`/`vibe_max`, `editorial`, `pinned`, `elevated`, `hp`** — editor-owned columns are off-limits). No notification surface needed — success is self-evident from new events in `/admin` review queue + agenda; check Actions tab if expected events don't show. Admin review queue surface in `/admin` for newly-ingested events that need human elevation.

### C. HP writer side — deferred (was Chunk 4 last item)

Migration 0008 shipped `apply_hp_rollup()` running every 5 min, but nothing currently inserts into `hp_events` — the rollup is sitting idle. Deferred per `project_hp_writer_deferred` memory until there's real user traffic to feed it. Don't pitch unless beta is actively generating signals.

### D. Vibe Philosophy follow-ups (the natural next slices)

The vibe arc landed ideas 1, 2, and 4. Idea 3 ("the system learns context") still has open work:

- **Composer prior** — at compose time, pre-fill `vibeMin/vibeMax` from a server-computed prior across the author's past items + the venue's past items + the genre tags' historical vibe distributions. Cleanest implementation: `lib/data/vibePriors.ts` server module + a dashboard hook that hydrates the form. Backed entirely by what's already in the DB (no new schema). Editor can override; the prior is a starting position, not a constraint.
- **Visual cue for crowd-author divergence** — when crowd median ≠ author band by more than a few slots, surface it (e.g. tiny `Δ` indicator on the author tick marks, or a brief flash). Currently it's only readable as the gap between ghost and lit band. Sit and watch; only build if users ask.
- **`GENRE_VIBE` deprecation** — replace foro's `genresIntersectVibeRange` with a real per-thread vibe so the stereotype map can finally die. Defer until foro grows.
- **Hierarchy-aware composer picker** — flat search-with-filter works but a collapsible parent → children view would be cleaner with ~190 entries. Out of scope for the migration slice.

### E. Other smaller items

- **`Mi Partner` composer** — marketplace_listings jsonb still on session. Migrate to a `partner-listings` flow (probably: per-partner-row PATCH on `items` for the embedded jsonb, or a separate `marketplace_listings` table). Will likely fold into the partner self-service slice (A's third bullet) since they touch the same surface.
- **Reduced motion respect** — fresh-publish glitch + CRT scanline + chip pulse run regardless of `prefers-reduced-motion`. WCAG-relevant.
- **Dead `_pendingConfirm` field** — still on `ContentItem` and stripped defensively in `Fields.tsx:1140` even though no renderer references it after the 2026-05-07 publish-flow restructure. Cleanup pass when next touching the type.
- **Component-page wiki backfill** — [[ContentCard]].md and [[HomeFeedWithDrafts]].md still describe the retired pending-card flow. Update opportunistically.
- **Skill-tree for ranks** — post-beta only; tier within branches (detonador 1→2→3, etc.). See `project_skill_tree_ranks` memory.
- **`lib/mockData.ts` cleanup deferred** — Iker uses it for testing how content behaves in dev.
- **Duplicate `GenreFieldset`** — exists in both [Fields.tsx](../components/dashboard/forms/shared/Fields.tsx) and [MixForm.tsx](../components/dashboard/forms/MixForm.tsx). Pre-existing smell; both updated in the migration slice for the legacy filter, but worth dedup later.
- **Hand-author a wide-band item to demo gradient** — most existing rows backfilled with `vibe_min === vibe_max`, so the gradient code path renders only as solid color today. Smallest visual demo: pick a label/venue partner and widen its range in Studio.

### E. Mobile pass

Desktop locked, mobile still untested. Includes [[EventosRail]] (180px cards, drag-to-scroll) + agenda archive treatment + foro catalog grid + dashboard composer + all overlays + new admin tabs.

### Deferred ops-layer pieces (revisit when traffic grows)

Decided 2026-05-04 that the personal/direct beta posture makes these overkill until users grow. Listed here so they're not forgotten:

- **`/api/health` + external uptime monitor** — endpoint cheap to add anytime; external monitor (BetterStack/UptimeRobot) waits until beta is large enough that Iker can't notice an outage himself.
- **Sentry** — same reasoning; beta testers report bugs directly to Iker.
- **Anti-spam (captcha, NOT rate limits)** — when needed, the preferred shape is captcha-after-N-rapid-actions (e.g. 5+ comments in a short window → captcha challenge), NOT hard Upstash rate-limit blocks. See `feedback_captcha_over_rate_limits` memory.
- **Restore drill** — disaster prep, not pre-beta blocker.
- **Orphan storage prune** — needs JSONB-aware traversal (image refs in `items.article_body[].src` and `items.marketplace_listings[].images[]`), and current scale (4 storage objects) makes false-positive risk worse than the bloat. Manual sweep in Studio is fine until storage grows.

## Where we are

**Backend chunks 1+2+3+Realtime done. Site is on production at gradiente.org.**

| Subsystem | DB | API | UI |
|---|---|---|---|
| Items / type pages / overlays | items + polls | reads only | live |
| Comments | comments + saved_comments + comment_reactions | `/api/comments/*`, `/api/saves/comments/*` | live |
| Item saves (★) | user_saves | `/api/saves/items/*` | live + dashboard view |
| Polls (vote) | polls + poll_votes | `/api/polls/[id]/vote` | live |
| Drafts CRUD + autosave | drafts | `/api/drafts/*` | live |
| Publishing + edit-republish | items (`created_by`) | `/api/items` (upsert) | live + edit-loads-existing |
| Image uploads | uploads bucket | client → Supabase Storage | live |
| Foro threads + replies + bump trigger + tombstones | foro_threads + foro_replies | `/api/foro/*` | live |
| Saved-comments dashboard | (cache + view-derived) | (none) | live |
| Saved-items dashboard | (cache + items join) | (none) | live |
| Live updates across tabs | (publication) | Realtime channels | live |
| User ranks (signal/prov counts) | `user_rank_signals` view | (browser-side select) | live |
| /admin invite codes | invite_codes | `/api/admin/invite-codes` | live (//INVITACIONES tab) |
| /admin role/flag editor | users (RLS) | `/api/admin/users/[id]` + `/search` | live (//USUARIOS tab) |
| /admin partners onboarding | items (type='partner') | `/api/admin/partners` | live (//PARTNERS tab, create-only) |
| **Vibe Checks** | `vibe_checks` + `vibe_check_aggregates` view | `/api/vibe-checks/[itemId]` (PUT/DELETE) | live in every overlay via [[VibeFader]] |
| **Multi-genre filter** | (read-side: items.genres + rollup via [[genres]]) | (none — pure client filter) | live in [[VibeSlider]] chip strip |

## Don't forget

- **Append to [[log]] as you go.** Top entry covers the post-Vercel polish day; future slices append above it.
- **Update [[Open Questions]]** when an item closes.
- **Update [[index]]** when a new note is added.
- **Don't push to `main` casually** — Vercel auto-deploys to gradiente.org. Test locally first.
- Don't introduce engagement metrics, don't sort home feed by `publishedAt`, don't put partners in the main grid.
- For the rail: `scrollLeft` rounds to integers — any rAF loop that nudges sub-pixel deltas needs a fractional accumulator (see `EventosRail.tsx:142`).
- For sticky elements that need to sit below VibeSlider's chips strip: measure `[data-vibe-strip]` height in a useEffect and set top dynamically. See `CategoryRail.tsx` for the pattern.

## Open questions inherited

- See [[Open Questions]] for the full list.
- Tailwind `base` color collision still unfixed (patched locally in [[MixOverlay]]).
- Past-event treatment on home if editor `elevated: true`'s a past event — currently stays full-color on home, dimmed only in agenda.
