# Next Session — start here

> Brief for picking up where the previous session ended.
> Last updated: **2026-05-03** (Production live on https://gradiente.org via Vercel + Namecheap DNS. Backend chunks 1+2+3+Realtime + migration squash + 10 polish slices including admin tabs (users editor + partners onboarding) and useUserRank/useSavedItems migrations all shipped this day. See top entry in [[log]] for the full session breakdown.)

## How to start this session

> **Site is live at https://gradiente.org** (Vercel auto-deploys on push to `main`). Reads from Supabase project `gradiente-fm` (ref `dcqbtcpqbqrtxbshhlkd`). Real auth at the LOGIN button. Iker is admin (`@iker`). Migration history is clean — 6 linear files (`0001_init`, `0002_rls`, `0003_storage`, `0004_realtime`, `0005_user_rank_signals`, `0006_user_rank_signals_include_seed`); originals preserved locally in `supabase/migrations.bak/` (untracked).

1. Read [[index]] (orientation) and the top entry in [[log]] (the multi-slice session summary).
2. Boot the preview (`.claude/launch.json` → `dev`, port 3003). Log in via the LOGIN button as `iker` + your password. **Session doesn't persist across dev-server restarts (Windows quirk)** — log in fresh each session.
3. **`/admin`** is live for admin-role users — three tabs: //INVITACIONES (invite-code generator), //USUARIOS (role/flag editor with search + filter chips), //PARTNERS (onboarding composer for new labels/venues/promoters/sponsors).

## Pattern conventions (re-use these — codified in `project_backend_architecture` memory)

- **Server vs browser data modules** — `lib/data/*.ts` server-only (cookies-aware client); `lib/hooks/*.ts` browser-only. Don't cross-import; row mappers duplicate locally.
- **Optimistic write shape** — module-scoped cache + listener Set + sync `getXSync` + async `toggleX` that flips locally + API-confirms or rolls back. See `lib/savedCommentsCache`, `lib/itemSavesCache`, `lib/pollVotesCache`, `lib/draftsCache`, `lib/reactionsCache`, `lib/itemsCache`, `lib/publishedItemsCache`, `lib/userRanksCache` — all the same shape.
- **`authResolved` gate** — `useAuth` exposes `authResolved = ready && fetchedAuthId === sessionAuthId`. Use this NOT `ready` when deciding to redirect / open login.
- **Realtime subscriptions** — one shared channel per page, broadcast to existing per-key bus. `useThreads` mounts `foro:all` channel that calls `invalidateThreadOnly(id)`. See [[Backend Plan]] § Realtime architecture.
- **`router.refresh()` after every mutation** — login, signup, logout, comment posts, drafts, publishes, foro, admin role/partner edits all do this. Server components re-render; client components stay mounted.
- **Tabbed admin pattern** — `/admin?tab=…` with conditional server prefetch per tab so each load is bounded. Use this if adding more admin surfaces (review queue, etc.).

## What's unblocked right now

### A. Vibe range arc — content has a range, not a point (~2-3 hr) ← top of mind

Iker's call from the previous session: every content item should express a vibe RANGE (e.g., a label like NAAFI is "vibe 4-8", a specific peak-time event is still a point at 8-8). Currently `items.vibe` is a single smallint; needs to become `vibe_min` + `vibe_max`.

Card displays should render the range as a **gradient band showing 3-7** (or whatever), not a single midpoint color. See `project_vibe_range_arc` memory for the full technical scope (migration shape, files to touch, render decisions).

### B. Chunk 4 — Ops layer (~2 hr) — beta-open gate

Ship before opening beta to 50 people.
- **pg_cron jobs**: HP rollup (every 5 min, batches `hp_events` → `items.hp` deltas — see [[Backend Plan]] § HP write path), foro 30-day delete sweep (hard-deletes thread + replies + storage objects 30 days after `bumped_at`), orphan storage prune (deletes uploads with no referencing row).
- **`/api/health`**: returns `{ db: ok, storage: ok, auth: ok }`. Fast (~50ms). Vercel cron + uptime monitor wired to it.
- **Sentry**: project setup, error boundaries, user context attachment.
- **Upstash rate limits**: comment posts (10/min/user), foro thread creates (3/hour/user), image uploads (20/hour/user). Auth path doesn't need it (Supabase Auth has its own).
- **Restore drill**: snapshot the prod DB, restore into a branch project, run a smoke script, document the steps in `wiki/Runbook.md`.

### C. Edit-in-place for partners (~30-60 min)

V1 of the //PARTNERS tab is create-only. If an admin mistypes a partner_kind or wants to flip marketplace_enabled later, they currently have to fix it in Supabase Studio. Add edit + delete affordances to existing-partners chips. PATCH `/api/admin/partners/[id]` mirroring the user-editor pattern.

### D. Chunk 5 — Scraper Phase 3 (~1-2 hr)

GH Actions cron MWF (`0 12 * * 1,3,5` UTC = 06:00 CDMX). Idempotent `upsert_scraped_events()` RPC with field-level allowlist (scraper can update RA-source-of-truth fields, but **cannot touch `vibe_min`/`vibe_max`, `editorial`, `pinned`, `elevated`, `hp`** — editor-owned columns are off-limits). No notification surface needed — success is self-evident from new events in `/admin` review queue + agenda; check Actions tab if expected events don't show. Admin review queue surface in `/admin` for newly-ingested events that need human elevation.

### E. Smaller items

- **`Mi Partner` composer** — marketplace_listings jsonb still on session. Migrate to a `partner-listings` flow (probably: per-partner-row PATCH on `items` for the embedded jsonb, or a separate `marketplace_listings` table).
- **Reduced motion respect** — pending-publish glitch + CRT scanline + chip pulse run regardless of `prefers-reduced-motion`. WCAG-relevant.
- **Skill-tree for ranks** — post-beta only; tier within branches (detonador 1→2→3, etc.). See `project_skill_tree_ranks` memory.
- **Decide on `PermisosSection.tsx`** in the dashboard — overlapping with /admin?tab=users. Likely deletable now.
- **`lib/mockData.ts` cleanup deferred** — Iker uses it for testing how content behaves in dev.

### F. Mobile pass

Desktop locked, mobile still untested. Includes [[EventosRail]] (180px cards, drag-to-scroll) + agenda archive treatment + foro catalog grid + dashboard composer + all overlays + new admin tabs.

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
