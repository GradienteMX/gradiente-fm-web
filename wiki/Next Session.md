# Next Session — start here

> Brief for picking up where the previous session ended.
> Last updated: **2026-05-05 · late** — site is now invite-only behind a `/welcome` cockpit (NGE terminal landing with ASCII vinyl). Anonymous → 302 to `/welcome`. Authed → bounces off `/welcome` to `/`. RLS shifted from `seed = false`/public to `auth.uid() is not null`, so beta testers now see seeded mockdata too (the page feels populated before they contribute). Plus owner+admin item delete with typed `BORRAR <title>` confirmation, eventos appear in rail+mosaic when `editorial: true`, and two publish-flow bugs fixed. Migrations 0013 + 0014 applied to remote. See top entry in [[log]] for the full breakdown.
>
> **Outstanding visual work**: the welcome page's ASCII vinyl is functional but still off-design vs reference — see "Open" in the log entry for the levers (groove pitch, tilt, ambient hardening).

## How to start this session

> **Site is live at https://gradiente.org** (Vercel auto-deploys on push to `main`). Reads from Supabase project `gradiente-fm` (ref `dcqbtcpqbqrtxbshhlkd`). Real auth at the LOGIN button. Iker is admin (`@iker`). Migration history: 9 linear files (`0001_init` → `0009_partner_kind_dealer`); originals from the pre-squash era preserved locally in `supabase/migrations.bak/` (untracked).

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
- **Reduced motion respect** — pending-publish glitch + CRT scanline + chip pulse run regardless of `prefers-reduced-motion`. WCAG-relevant.
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
