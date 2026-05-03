# Next Session — start here

> Brief for picking up where the previous session ended.
> Last updated: **2026-05-03** (Backend chunk 3 fully complete + migration squash executed — saves, polls, tombstones, drafts, publishing, storage uploads, foro writes, saved-comments dashboard view, realtime layer all shipped + verified, AND 15 migrations consolidated into 4 clean files. Zero sessionStorage in user-facing surfaces. See the top two entries in [[log]] for the breakdowns.)

## How to start this session

> **Backend chunks 1 + 2 + 3 + Realtime are all live.** Reads from Supabase (project `gradiente-fm`, ref `dcqbtcpqbqrtxbshhlkd`). Real auth at the LOGIN button. Iker is admin (`@iker`). All user-facing writes go to DB + emit Realtime events; cross-tab live updates verified. Migration history is clean — 4 linear files (`0001_init`, `0002_rls`, `0003_storage`, `0004_realtime`); originals preserved locally in `supabase/migrations.bak/` (untracked).

1. Read [[index]] (orientation) and the top entry in [[log]] (chunk 3 completion summary — 8 slices listed in order).
2. Boot the preview (`.claude/launch.json` → `dev`, port 3003). Log in via the LOGIN button as `iker` + your password.
3. **`/admin`** is live for admin-role users — invite-code generator with partner dropdown.

## Pattern conventions (re-use these — codified in `project_backend_architecture` memory)

- **Server vs browser data modules** — `lib/data/*.ts` server-only (cookies-aware client); `lib/hooks/*.ts` browser-only. Don't cross-import; row mappers duplicate locally.
- **Optimistic write shape** — module-scoped cache + listener Set + sync `getXSync` + async `toggleX` that flips locally + API-confirms or rolls back. See `lib/savedCommentsCache.ts`, `lib/itemSavesCache.ts`, `lib/pollVotesCache.ts`, `lib/draftsCache.ts`, `lib/reactionsCache.ts`, `lib/itemsCache.ts` — all the same shape.
- **`authResolved` gate** — `useAuth` exposes `authResolved = ready && fetchedAuthId === sessionAuthId`. Use this NOT `ready` when deciding to redirect / open login. `ready` only means INITIAL_SESSION fired, profile fetch is separate.
- **Realtime subscriptions** — one shared channel per page, broadcast to existing per-key bus. `useThreads` mounts `foro:all` channel that calls `invalidateThreadOnly(id)` so all open threads + tile reply counts get updates from a single websocket. See [[Backend Plan]] § Realtime architecture.
- **`router.refresh()` after every mutation** — login, signup, logout, comment posts, drafts, publishes, foro all do this. Server components re-render; client components stay mounted.

## What's unblocked right now

The remaining roadmap is pre-beta polish + chunks 4 and 5. Pick whatever resonates.

### A. Chunk 4 — Ops layer (~2 hr)

Ship before opening beta.
- **pg_cron jobs**: HP rollup (every 5 min, batches `hp_events` → `items.hp` deltas — see [[Backend Plan]] § HP write path), foro 30-day delete sweep (hard-deletes thread + replies + storage objects 30 days after `bumped_at`), orphan storage prune (deletes uploads with no referencing row).
- **`/api/health`**: returns `{ db: ok, storage: ok, auth: ok }`. Fast (~50ms). Vercel cron + uptime monitor wired to it.
- **Sentry**: project setup, error boundaries, user context attachment.
- **Upstash rate limits**: comment posts (10/min/user), foro thread creates (3/hour/user), image uploads (20/hour/user). The auth path doesn't need rate limiting (Supabase Auth has its own).
- **Restore drill**: snapshot the prod DB, restore into a branch project, run a smoke script, document the steps in `wiki/Runbook.md`.

### B. `useUserRank` migration (~30 min, polish)

Currently every user shows as 'normie' in PostHeader / CommentList badges because the rank is computed from `getAllCommentsMerged()` (mock + session). Two options:
- **SQL view**: `create view user_rank_signals as select user_id, count(*) filter (where kind = 'signal') as signal_count, count(*) filter (where kind = 'provocative') as prov_count from comment_reactions group by user_id;` — then a hook fetches by user_id.
- **Batched server fetch**: a `lib/data/userRanks.ts` `getRanksForUserIds(ids)` returning `Map<userId, UserRank>`. Hook subscribes per visible-author set.

Pick the cleaner one. The rendering side (badgeFor + UserRank type in lib/types.ts) is unchanged.

### C. Chunk 5 — Scraper Phase 3 (~1-2 hr)

GH Actions cron MWF (`0 12 * * 1,3,5` UTC = 06:00 CDMX). Idempotent `upsert_scraped_events()` RPC with field-level allowlist (scraper can update RA-source-of-truth fields, but **cannot touch `vibe`, `editorial`, `pinned`, `elevated`, `hp`** — editor-owned columns are off-limits). Discord notification on success/failure. Admin review queue surface in `/admin` for newly-ingested events that need human elevation.

### D. Smaller items

- **`Mi Partner` composer** — marketplace_listings jsonb still on session. Migrate to a `partner-listings` flow (probably: per-partner-row PATCH on `items` for the embedded jsonb, or a separate `marketplace_listings` table).
- **`lib/mockData.ts` cleanup** — still imported as fallback in `OverlayRouter`. Now redundant (itemsCache covers it). Delete the import + the `MOCK_ITEMS` reference; verify nothing else depends on it.
- **Add-partner UI in `/admin`** — composer that creates `items where type='partner'`. Pairs with the partner dropdown in invite codes.
- **Role / flag editor in `/admin`** — list users, edit role / is_mod / is_og / partner_id without going through Supabase Studio.
- **Espectro → Gradiente rename** — copy/seed/byline cleanup. `ESPECTRO MIX ###`, `Redacción Espectro`, some slugs.
- **Reduced motion respect** — pending-publish glitch + CRT scanline + chip pulse run regardless of `prefers-reduced-motion`. WCAG-relevant.

### E. Mobile pass

Desktop locked, mobile still untested. Includes [[EventosRail]] (180px cards, drag-to-scroll) + agenda archive treatment + foro catalog grid + dashboard composer + all overlays.

## Where we are

**Backend Plan chunks 1 + 2 + 3 complete.** The visual prototype that started this arc is now load-bearingly real:

| Subsystem | DB tables | API |
|---|---|---|
| Items / type pages / overlays | items + polls join | reads only |
| Comments (post / react / save / tombstone) | comments + saved_comments + comment_reactions | `/api/comments/*`, `/api/saves/comments/*` |
| Item saves (★) | user_saves | `/api/saves/items/*` |
| Polls (vote) | polls + poll_votes | `/api/polls/[id]/vote` |
| Drafts CRUD + autosave | drafts | `/api/drafts/*` |
| Publishing + edit-republish | items (`created_by`) | `/api/items` (upsert) |
| Image uploads | uploads bucket | client → Supabase Storage |
| Foro threads + replies + bump trigger + tombstones | foro_threads + foro_replies | `/api/foro/*` |
| Saved-comments dashboard | (cache-derived) | (none) |
| Live updates across tabs | (publication) | Realtime channels |

## Don't forget

- **Append to [[log]] as you go.** Top entry covers chunk 3; future slices append above it.
- **Update [[Open Questions]]** when an item closes.
- **Update [[index]]** when a new note is added.
- Don't introduce engagement metrics, don't sort home feed by `publishedAt`, don't put partners in the main grid.
- For the rail: `scrollLeft` rounds to integers — any rAF loop that nudges sub-pixel deltas needs a fractional accumulator (see `EventosRail.tsx:142`).

## Open questions inherited

- See [[Open Questions]] for the full list.
- Tailwind `base` color collision still unfixed (patched locally in [[MixOverlay]]).
- Past-event treatment on home if editor `elevated: true`'s a past event — currently stays full-color on home, dimmed only in agenda.
