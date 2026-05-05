# Next Session — start here

> Brief for picking up where the previous session ended.
> Last updated: **2026-05-05** (Partners + admin arc complete — 9 commits. /admin?tab=users has a real-DB-backed two-pane editor with LECTOR/CURATOR/GUIDE/INSIDER/ADMIN/MOD chips + RECIENTES section. /admin?tab=partners has clickable existing-partner chips → edit + hard-delete with type-to-confirm gate. /marketplace + home rail read partners from real DB. /dashboard "Mi partner" section is real-DB-backed for profile + team management; listings CRUD is read-only pending the listings persistence design. Mock seed users dropped. PermisosSection retired. `dealer` partner_kind added. VibeSlider hidden on /admin + /dashboard. See top entry in [[log]]. Production live on https://gradiente.org.)

## How to start this session

> **Site is live at https://gradiente.org** (Vercel auto-deploys on push to `main`). Reads from Supabase project `gradiente-fm` (ref `dcqbtcpqbqrtxbshhlkd`). Real auth at the LOGIN button. Iker is admin (`@iker`). Migration history: 9 linear files (`0001_init` → `0009_partner_kind_dealer`); originals from the pre-squash era preserved locally in `supabase/migrations.bak/` (untracked).

1. Read [[index]] (orientation) and the top entry in [[log]] (the partners + admin arc).
2. Boot the preview (`.claude/launch.json` → `dev`, port 3003). Log in via the LOGIN button as `iker` + your password. **Session doesn't persist across dev-server restarts (Windows quirk)** — log in fresh each session.
3. **Vibe-band visual smoke test (worth 30s)** — set one item's `vibe_min`/`vibe_max` to a real range via Studio (e.g. `update items set vibe_min=3, vibe_max=7 where slug='…'`), reload home, and confirm the card top-strip + the overlay's 11-bar gauge render the gradient band. All existing rows backfilled with `min === max` so the gradient code path is currently exercised only by hypothesis.
4. **`/admin`** is live for admin-role users — three tabs: //INVITACIONES (invite-code generator), //USUARIOS (two-pane panel editor with RECIENTES + LECTOR/CURATOR/GUIDE/INSIDER/ADMIN/MOD chips), //PARTNERS (onboarding composer; vibe field is a two-thumb range; create-only — edit/delete pending).

## Pattern conventions (re-use these — codified in `project_backend_architecture` memory)

- **Server vs browser data modules** — `lib/data/*.ts` server-only (cookies-aware client); `lib/hooks/*.ts` browser-only. Don't cross-import; row mappers duplicate locally.
- **Optimistic write shape** — module-scoped cache + listener Set + sync `getXSync` + async `toggleX` that flips locally + API-confirms or rolls back. See `lib/savedCommentsCache`, `lib/itemSavesCache`, `lib/pollVotesCache`, `lib/draftsCache`, `lib/reactionsCache`, `lib/itemsCache`, `lib/publishedItemsCache`, `lib/userRanksCache` — all the same shape.
- **`authResolved` gate** — `useAuth` exposes `authResolved = ready && fetchedAuthId === sessionAuthId`. Use this NOT `ready` when deciding to redirect / open login.
- **Realtime subscriptions** — one shared channel per page, broadcast to existing per-key bus. `useThreads` mounts `foro:all` channel that calls `invalidateThreadOnly(id)`. See [[Backend Plan]] § Realtime architecture.
- **`router.refresh()` after every mutation** — login, signup, logout, comment posts, drafts, publishes, foro, admin role/partner edits all do this. Server components re-render; client components stay mounted.
- **Tabbed admin pattern** — `/admin?tab=…` with conditional server prefetch per tab so each load is bounded. Use this if adding more admin surfaces (review queue, etc.).

## What's unblocked right now

### A. Listings persistence — natural follow-up to partners arc (~2-3 hr)

Closed out the dashboard partner self-service work in commit 9 BUT left listings CRUD read-only behind a yellow banner. To unblock partner team marketplace activity:

- Decide schema: jsonb-on-items (current shape) vs separate `marketplace_listings` table. Tradeoffs:
  - jsonb keeps reads cheap (one items row gives you the whole catalog) but listing-level edits require rewriting the whole array on every change, ownership gating is awkward, and there's no FK from images-in-storage back to a single listing row.
  - separate table makes listing-level CRUD natural + RLS-friendly + each listing can have its own image FK, at the cost of an extra join on the marketplace catalog read path.
- Image cleanup: same JSONB traversal problem we deferred for orphan storage prune. If we go separate-table, this gets simpler.
- Ownership gating on edits: any team member can edit, OR only partner-admin? Mirrors the canManagePartner / canManagePartnerTeam split.

Until this lands, partner teams can VIEW listings but not edit them. The N.A.A.F.I. seed data is still there to demo what it looks like.

### B. PartnerApprovalsSection — last sessionStorage holdout (~30min)

`components/dashboard/explorer/sections/PartnerApprovalsSection.tsx` still uses `useResolvedPartners` (sessionStorage). Same root-cause problem as PermisosSection / MiPartnerSection. Should get the same DB-backed treatment — server-fetch partners, render approval toggle that PATCHes /api/admin/partners/[id] (admin-only). Probably small (~30min).

After this lands, `lib/partnerOverrides.ts` write-side becomes dead code (only the read-side hooks remain — and even those probably collapse since no one will use them). Could delete the file in a follow-up cleanup commit.

### B. Chunk 5 — Scraper Phase 3 (~1-2 hr)

GH Actions cron MWF (`0 12 * * 1,3,5` UTC = 06:00 CDMX). Idempotent `upsert_scraped_events()` RPC with field-level allowlist (scraper can update RA-source-of-truth fields, but **cannot touch `vibe_min`/`vibe_max`, `editorial`, `pinned`, `elevated`, `hp`** — editor-owned columns are off-limits). No notification surface needed — success is self-evident from new events in `/admin` review queue + agenda; check Actions tab if expected events don't show. Admin review queue surface in `/admin` for newly-ingested events that need human elevation.

### C. HP writer side — deferred (was Chunk 4 last item)

Migration 0008 shipped `apply_hp_rollup()` running every 5 min, but nothing currently inserts into `hp_events` — the rollup is sitting idle. Deferred per `project_hp_writer_deferred` memory until there's real user traffic to feed it. Don't pitch unless beta is actively generating signals.

### D. Smaller items

- **`Mi Partner` composer** — marketplace_listings jsonb still on session. Migrate to a `partner-listings` flow (probably: per-partner-row PATCH on `items` for the embedded jsonb, or a separate `marketplace_listings` table). Will likely fold into the partner self-service slice (A's third bullet) since they touch the same surface.
- **Reduced motion respect** — pending-publish glitch + CRT scanline + chip pulse run regardless of `prefers-reduced-motion`. WCAG-relevant.
- **Skill-tree for ranks** — post-beta only; tier within branches (detonador 1→2→3, etc.). See `project_skill_tree_ranks` memory.
- **`lib/mockData.ts` cleanup deferred** — Iker uses it for testing how content behaves in dev.
- **Genre/vibe coupling on composer** — left as independent inputs (option 2 from end of last session). When desire arises, add the two suggestion buttons (`←` narrow range to fit selected genres, `→` suggest genres for this range) + yellow inconsistency chip. ~30 min slice; not committed to.
- **Hand-author a wide-band item to demo gradient** — all 216 existing rows backfilled with `vibe_min === vibe_max`, so the gradient code path renders only as solid color today. Smallest visual demo: pick a label/venue partner and widen its range in Studio.

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
