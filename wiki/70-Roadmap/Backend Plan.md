---
type: roadmap
status: current
tags: [roadmap, backend, supabase, auth, db, realtime, scraper, storage]
updated: 2026-05-03
---

# Backend Plan

> Consolidated plan to take Gradiente FM off `sessionStorage` + mock data onto a real backend. Beta-launch target: ~50 invited people (mods, partners, readers, insiders). Loose timeline — getting this right beats getting it fast. Decided 2026-05-02.
>
> Replaces the older [[Supabase Migration]] sketch and absorbs Phase 3 of [[Scraper Pipeline]]. [[Admin Dashboard]] is still current and complementary.

> **STATUS 2026-05-03**: Chunks 1 + 1.5 + 2 SHIPPED + half of chunk 3 in one mega-session. 11 migrations, seed (214 items + 9 users + 25 comments + 51 reactions + 8 threads + 16 replies + 1 real admin), 7 type-page swaps, full auth + bootstrap admin `@iker`, `/admin` invite generator. Comment overlay end-to-end on real DB with optimistic UX (read, post, react `!`/`?`, save `★`). See top three entries in [[log]] for the play-by-play. Next pickup: **item saves** as a 20-min warm-up, then drafts/publishing/foro/storage round out chunk 3 (~6-7 hours of focused work to fully migrate the visual prototype off sessionStorage).

## What

The visual MVP is feature-complete on the reader, editor, and user surfaces (see [[Next Session]]). Everything described as "saved" or "published" today lives in `sessionStorage` and dies when the tab closes. This plan takes that to a real backend in five independently-shippable chunks.

## Stack

| Concern | Pick | Why |
|---|---|---|
| DB · Auth · Realtime · Storage | **Supabase (Free)** | Postgres fits our heavily relational data ([[types]]); one product covers four needs; free tier comfortably hosts the beta |
| App hosting | **Vercel (Hobby)** | already implied by Next.js 14 App Router; auto br/gzip; serverless = no memory leaks (point 17) |
| Image storage | **Supabase Storage** for beta → Cloudflare R2 if egress matters | one vendor for now; R2 has no egress fees, swap is mechanical |
| Captcha | **Cloudflare Turnstile** | free, privacy-friendly, no hostile-UX |
| Error alerting | **Sentry (Free)** | point 14 |
| Log drain | **Axiom / Logtail (Free)** | point 20 |
| Transactional email | **Resend (Free)** | invite codes; future digests |
| Cron / scraper | **GitHub Actions cron** | free; Python scraper stays Python; no rewrite |
| Rate limiting | **Upstash Redis (Free)** | token bucket in front of every write endpoint (point 12) |

**Tradeoff vs alternatives:** Convex would give tighter realtime + auto-typed RPC but locks us out of Postgres (the wiki's been planning around it for months). Firebase doesn't fit the relational shape. Supabase is the right call and matches what was already on the roadmap.

## Project setup (done 2026-05-02)

- Project name: `gradiente-fm`
- Region: **East US (North Virginia)** `us-east-1` — lowest latency to CDMX of free-tier regions
- Data API: ON
- Auto-expose new tables: **OFF** (closes the #1 cause of public-Supabase breaches — every new table requires explicit grant)
- Automatic RLS: **ON** (every new table has RLS enforced from the moment it's created)
- Personal MFA: enabled on the dashboard account

Org-wide MFA enforcement is paid-only and not necessary at this stage.

## Migration map

State that needs to leave the browser:

| Current | Becomes | Notes |
|---|---|---|
| [`lib/mockData.ts`](../../lib/mockData.ts) | `items` table + `getItems()` | server components stay async, swap import |
| [`lib/scrapedEvents.ts`](../../lib/scrapedEvents.ts) | `items` rows where `source='scraper:ra'` | scraper UPSERTs by `external_id` |
| [`lib/mockUsers.ts`](../../lib/mockUsers.ts) | `users` table joined to `auth.users` | role/isMod/isOG/partnerId/partnerAdmin live here |
| [`lib/userOverrides.ts`](../../lib/userOverrides.ts) | direct UPDATEs on `users` from `/admin` | sessionStorage hack goes away |
| [`lib/drafts.ts`](../../lib/drafts.ts) | `drafts` table keyed by `author_id` | survives across devices |
| [`lib/comments.ts`](../../lib/comments.ts) + [`mockComments.ts`](../../lib/mockComments.ts) | `comments` + `comment_reactions` | tombstone via `deletion_*` cols |
| [`lib/saves.ts`](../../lib/saves.ts) | `user_saves` | composite unique `(user_id, item_id)` |
| [`lib/polls.ts`](../../lib/polls.ts) | `polls` (1:1 to items) + `poll_votes` | derived choices stay client-side resolved |
| [`lib/foro.ts`](../../lib/foro.ts) + [`mockForo.ts`](../../lib/mockForo.ts) | `foro_threads` + `foro_replies` | `bumpedAt` indexed for catalog ordering |
| [`lib/curation.ts`](../../lib/curation.ts) lazy decay | unchanged on read | adds a write path: interaction → `hp_events` → batched into `items.hp` |
| [`lib/permissions.ts`](../../lib/permissions.ts) | unchanged client-side; **mirrored as RLS server-side** | server is authoritative, client gates UX only |

Pure functions ([`utils.ts`](../../lib/utils.ts), [`curation.ts`](../../lib/curation.ts), [`permissions.ts`](../../lib/permissions.ts), [`genres.ts`](../../lib/genres.ts)) don't change at all.

## Schema sketch

```sql
items                -- existing sketch + foreign-keyed source/external_id; indexes on (type, hp desc), (published_at desc), (external_id) unique partial where source='scraper:ra'; tsvector GIN for FTS (point 22); seed boolean default false
users                -- id (=auth.users.id), username unique, display_name, role, is_mod, is_og, partner_id, partner_admin, joined_at, profile_meta jsonb
invite_codes         -- code, intended_role, partner_id, partner_admin, created_by, used_by, used_at, expires_at
drafts               -- id, author_id, item_payload jsonb, updated_at
comments             -- id, item_id, parent_id, author_id, body, created_at, edited_at, deletion_*
comment_reactions    -- comment_id, user_id, kind ('signal'|'provocative'); unique(comment_id,user_id)
user_saves           -- user_id, item_id, saved_at; unique(user_id,item_id)
polls                -- id, item_id (1:1), kind, prompt, choices jsonb, multi_choice, closes_at, created_at
poll_votes           -- poll_id, user_id, choice_ids text[], voted_at; unique(poll_id,user_id)
foro_threads         -- id, author_id, subject, body, image_url, genres text[], created_at, bumped_at, deletion_*, archived
foro_replies         -- id, thread_id, author_id, body, image_url, created_at, quoted_reply_ids text[], deletion_*
hp_events            -- item_id, kind ('view'|'click'|'save'|'comment'), weight, created_at
audit_log            -- id, actor_id, action, target_type, target_id, payload jsonb, created_at  (DB-trigger insert, can't be skipped)
```

Every FK gets an index in the migration file (point 11). Schema migrations live in `supabase/migrations/*.sql`, applied via `supabase db push` in deploy step — never on app boot (point 9).

## RLS conventions

Three rules with no exceptions:

1. **RLS ON for every table.** Always. Auto-RLS in project settings enforces it.
2. **`service_role` key never leaves the server.** Frontend uses `anon` key only — RLS does the gating.
3. **Test policies before trusting them** via Supabase Studio's "impersonate user" SQL session.

Policies are named after the action they describe so future search is trivial: `items_public_read`, `items_guide_write`, `comments_author_edit_within_window`, `drafts_author_only`, etc.

Sketch:
- `items` — public SELECT where `published=true AND seed=false` (or admin/guide); INSERT/UPDATE only by guide/admin/insider-on-own
- `comments`, `foro_*` — public SELECT; INSERT for any auth'd user; UPDATE/DELETE only by author within 15 min OR mod/admin
- `drafts` — `auth.uid() = author_id`, no admin override
- `invite_codes` — admin-only SELECT; signup uses `SECURITY DEFINER` trigger

## Auth

### Signup (one-time per user)

1. Email + invite code → magic link to verify email
2. User sets username + password
3. Postgres trigger reads invite code's `intended_role` + `partner_id`, applies to new `users` row, marks code used

### Login (every visit after)

- Username + password — existing [[LoginOverlay]] UX preserved
- Supabase Auth keys on email; client calls public RPC `lookup_email_by_username(username)` first, then standard email+password auth
- "Forgot password" → magic link reset (replaces traditional reset flow)

The `admin/admin` sessionStorage shortcut in [[useAuth]] gets ripped out in chunk 2.

### Bootstrap admin

1. Iker signs up with the first invite code
2. In Supabase Studio, manually set `users.role = 'admin'` for that row (one click)
3. From then on, all roles flow through `/admin` invite-code generation
4. **No template/seeded users** in the DB. The current [`mockUsers.ts`](../../lib/mockUsers.ts) roster is just a reference list of who to send first invites to.

## Beta gate (invite codes)

- `invite_codes` table holds pre-generated codes carrying `intended_role`, `partner_id`, `partner_admin`, `expires_at`
- Pre-generate ~80 codes (50 + buffer for slip)
- Single-use; redemption is atomic (INSERT user + UPDATE code in one RPC, point 15)
- Codes can be assigned a partner team membership at creation — partners get codes that auto-grant `partnerId` + `partnerAdmin` flags

## User content lifecycle

### Image upload — limits + auto-compression

Auto-compression is mandatory; the user never thinks about it. `browser-image-compression` runs in a Web Worker (no UI blocking), takes any input, returns a target-sized Blob.

| Surface | Raw cap | Compressed to | Max dim | GIFs |
|---|---|---|---|---|
| Foro OP / reply image | 3 MB | ~400 KB | 1200×1200 | allowed; 4 MB raw cap; no recompress (breaks animation); 800×800 dim |
| Marketplace listing | 4 MB | ~700 KB | 1600×1600 | not needed |
| Editorial / mix / event flyer | 6 MB | ~1.2 MB | 2000×2000 | not allowed |
| Article body inline | 4 MB | ~700 KB | 1600×1600 | staff-author only |

Server-side fallback: Supabase Storage trigger rejects any object > the per-bucket cap. MIME validated by byte-sniff, not extension. Uploads go via presigned URL — never through the app server (point 3).

### Edit / delete windows

| Type | Edit window | Soft-delete | Hard-delete |
|---|---|---|---|
| Comment | 15 min for author, always for mod/admin | always (tombstone preserves thread shape) | pg_cron sweep, 60d after tombstone |
| Foro thread | 15 min author, always mod/admin | always (tombstone) | with parent / per retention rule below |
| Foro reply | 15 min author, always mod/admin | always | with parent thread |
| Marketplace listing | always for partner team / mod / admin | hard delete (no value in tombstones) | immediate |
| Editorial draft | always for author, no one else | n/a | author-initiated |
| Published item | guide/admin always; insider on own only | unpublish = `published=false` | admin-only, audit-logged |

### Foro retention

- Catalog: 30 most-recently-bumped active threads visible (current cap preserved)
- Off-cap threads remain URL-accessible until deletion
- **Hard delete: thread + replies + R2 images destroyed 30 days after `bumpedAt`** regardless of catalog position
- pg_cron daily sweep handles deletion + R2 orphan cleanup

Active threads can live forever (every reply bumps `bumpedAt`); abandoned threads are gone in a month. Storage stays bounded with zero ops effort.

### Mock data migration strategy

Add `seed boolean default false` column on `items`, `comments`, `foro_threads`, `users`. Seed all current mock data with `seed=true`. Two RLS policies per table:
- Public: `where seed = false`
- Admin / guide: all rows

Site looks empty to public users; admins still see the full mock catalog for testing every overlay variant. When real content arrives: `delete from items where seed=true` (and equivalents) — one transaction, gone.

## Realtime architecture

| Surface | Channel | Update trigger |
|---|---|---|
| Comments column inside overlay | `comments:item_id=X` | INSERT/UPDATE/DELETE on `comments` |
| Foro thread view | `foro:thread_id=X` | INSERTs on `foro_replies` + UPDATEs on parent `foro_threads.bumped_at` |
| Foro catalog | `foro:catalog` | INSERT/UPDATE on `foro_threads` (drives bump-order without polling) |
| Home feed | **deferred** — server-component re-render via revalidation | see countdown below |

Supabase Realtime is managed (point 24); Vercel never holds a socket.

### Home feed update countdown

Replace the static `// SUBSISTEMA · FILTRADO` chip in [[FeedHeader]] with a live 5-minute countdown:

```
// SISTEMA · ACTUALIZACIÓN EN 04:23 · CURVA HP
```

When the count hits 0:
1. Brief CRT scanline sweep across the grid (first ship of [[CRT Scanline Sweep]])
2. `router.refresh()` re-fetches server components → grid re-renders with new HP order
3. Counter resets to 05:00

**Alignment:** HP rollup pg_cron every 5 min + Next.js `export const revalidate = 300` on `/` + countdown all snapped to the same 5-min boundary. The displayed count stays honest — when it says 04:23, the feed really is unchanged for the next 4:23.

### HP write path

- `hp_events` append-only table records raw signals (view / click / save / comment) with weights
- pg_cron job every 5 min batches recent events into `items.hp` deltas
- Read-side decay math from [`curation.ts`](../../lib/curation.ts) is unchanged (lazy `currentHp(item, now)`)

## RA scraper schedule (Phase 3)

- **Cron**: `0 12 * * 1,3,5` UTC = 06:00 CDMX **Mon / Wed / Fri**
- Workflow: GH Actions → existing `Webscraper/ra_to_gradiente.py` → POST batch UPSERT to Supabase RPC `upsert_scraped_events(events jsonb)` keyed by `external_id`
- No active notification — success is self-evident (new events appear in `/admin` review queue + agenda); check the Actions tab if expected events haven't shown up
- Soft-fail: scraper crash auto-opens a GitHub issue (point 19); site keeps serving last-good event set

### Field-level UPSERT rules

The RPC enforces a hardcoded column allowlist — the scraper literally cannot write to editor-owned fields.

| Field group | On insert (new) | On re-scrape match |
|---|---|---|
| `external_id`, `source` | scraper writes | unchanged |
| `title`, `subtitle`, `excerpt`, `venue`, `artists`, `date`, `endDate`, `ticketUrl`, `price`, `imageUrl` | scraper writes | scraper overwrites (RA is source of truth) |
| `vibe` | default 5 | **never touched** (editor-owned) |
| `editorial`, `pinned`, `elevated` | default false | **never touched** (editor-owned) |
| `hp`, `hpLastUpdatedAt` | default spawn HP | **never touched** (curation-owned) |
| `genres`, `tags` | scraper guesses from RA tags | **merged**: scraper additions kept, editor additions never removed |

Stale RA events (no longer on RA) get a `ra_last_seen_at` timestamp; never auto-deleted (RA might unpublish briefly). Editors can sweep manually.

## Captcha rollout

Cloudflare Turnstile, **enabled progressively** so beta users aren't punished for being known:

- **Phase 0 (beta launch)**: signup only
- **Phase 1 (after first abuse signal)**: first foro post + first marketplace listing per account
- **Phase 2 (if it gets bad)**: comment composer when account / IP exceeds N posts/hr

Token-bucket rate limiting (Upstash) sits in front of every write endpoint regardless of Turnstile phase.

## Future feature hooks

The plan deliberately leaves space for known future arcs:

- **Achievement system / event-attendance trophies** (see [[Open Questions]] "Attendance verification" + the personal-memory perks roadmap). Backend primitives needed when the time comes:
  ```sql
  event_attendances    -- user_id, item_id, verified_by_user_id, verified_at, source
  badges               -- id, item_id, image_url, kind, minted_at
  user_badges          -- user_id, badge_id, awarded_at
  ```
  Plus `users.profile_meta jsonb` (already in the schema) so the hover-mini-profile can grow new fields without migrations. Verification gesture (QR scan / NFC tap / partner-issued one-time code) stays out of scope here — backend just needs to accept the verified-attendance record once the gesture exists.

## Budget

| Phase | Components | Monthly |
|---|---|---|
| **Beta (~50 users)** | Supabase Free + Vercel Hobby + Storage <10 GB + Resend Free + Turnstile Free + Sentry Free + Axiom Free + GH Actions Free | **~$0** + domain ~$1/mo amortized |
| **Soft launch (~500 users)** | same tiers — comfortably below limits | **~$1/mo** |
| **Real launch (2-5K MAU)** | Supabase Pro $25 + Vercel Pro $20 + Resend $20 + R2 ~$2 | **~$70/mo** |
| **Scale (20K+ MAU)** | + Supabase compute add-ons + read replica (~$50) + Sentry team ($26) | **~$200-300/mo** |

Free tier holds far longer than 50 people — Supabase free is 50K MAU. The cliff is at 2-5K active users when compute becomes the bottleneck.

## 25-launch-blockers checklist

| # | Issue | Where addressed |
|---|---|---|
| 1 | No load testing | k6 against staging before opening beta — chunk 6 |
| 2 | Session in memory | Supabase JWT in HttpOnly cookie. Stateless |
| 3 | Uploads to app server | Presigned URLs to Supabase Storage / R2. Never touch Vercel |
| 4 | Sync emails | Resend via edge function, off the request path. Magic links sent async by Supabase |
| 5 | No queue | pg_cron + edge functions for batch jobs (HP rollup, prune, scraper notification). Inngest free tier later if needed |
| 6 | Hardcoded secrets | Vercel encrypted env; `.env.local` in `.gitignore`; GH Actions `::add-mask::` |
| 7 | No read replica | Beta doesn't need it. Decision point at ~2K MAU |
| 8 | No CDN | Vercel Edge for app; R2 / Supabase CDN for images |
| 9 | Migrations on app start | `supabase db push` in deploy step. NEVER on app boot |
| 10 | Untested backups | Supabase auto-backup; **drill a restore into a scratch project before beta** |
| 11 | Unindexed FKs | Every FK gets an index in the migration. `pg_stat_statements` lint after launch |
| 12 | No rate limiting | Upstash token bucket on every write route + RLS deny patterns |
| 13 | No compression | Next.js auto br/gzip. R2 serves WebP |
| 14 | No error alerting | Sentry for app-side errors; GitHub Actions failure email for scraper |
| 15 | No transactions | Multi-step writes go through Supabase RPCs (publish, partner team add, invite redeem) |
| 16 | No health check | `/api/health` does `select 1` against DB; returns 503 if unreachable |
| 17 | Memory leaks | Vercel serverless = no long-lived processes |
| 18 | No graceful shutdown | Same — serverless |
| 19 | Third-party fallback | Scraper failure ≠ site failure (last-good cached). Embed iframe failure shows "open in source" link |
| 20 | Logs to disk | Axiom log drain from Vercel. Supabase logs in dashboard |
| 21 | No circuit breaker | Scraper has 30s timeout, 3 retries with backoff, then GH issue. App doesn't call external APIs in request path |
| 22 | Unparameterized search | Postgres FTS with tsvector GIN index on `items` (title + excerpt + body_preview) |
| 23 | No outbound timeouts | All external `fetch` wrapped with `AbortController` + 10s default |
| 24 | Stateful WebSockets | Supabase Realtime is managed. Vercel never holds a socket |
| 25 | No runbook | `wiki/Runbook.md` covering DB down, scraper failed, abuse spike, restore-from-backup. Written before beta opens |

## Phasing

Five independently-shippable chunks plus the beta-open milestone. Loose timeline applies — no compression.

| # | Chunk | Effort | What ships |
|---|---|---|---|
| 1 | **Foundation** | ~3-4 days | Schema + RLS + migrations; mock data seeded with `seed=true`; server components read from Supabase. Site looks identical, all data from DB. |
| 2 | **Auth + admin** | ~3 days | Supabase Auth (magic-link signup + username/password login + reset-via-link); invite codes; minimal `/admin` (review queue + role/flag editor + invite generator). [[useAuth]] sessionStorage hack removed. |
| 3 | **User writes** | ~4 days | Comments / saves / polls / foro all writing through Supabase with RLS. Realtime channels wired. Image uploads with client compression. Soft-delete + tombstones. |
| 4 | **Ops layer** | ~2 days | pg_cron jobs (HP rollup, foro hard-delete, orphan storage prune, audit log). Sentry + Axiom + `/api/health` + rate limits. Restore drill. Runbook. |
| 5 | **Scraper productionization** | ~1-2 days | GH Actions cron MWF; idempotent UPSERT RPC; fallback issue-creation on failure. |
| 6 | **Beta open** | — | Generate 80 invite codes; k6 load test; send to first 50 |

~2.5-3 weeks of focused work, longer interleaved.

## Open questions

- **Storage choice timing** — start on Supabase Storage and migrate to R2 later, or start on R2? Decided: Supabase Storage for beta, R2 if egress matters.
- **HP rollup interval** — 5 min picked to align with the countdown UX. Could be tighter (1 min, more compute) or looser (15 min, sparser interactions). Re-evaluate after first week of beta data.
- **Foro 30-day deletion** — feels right but might be too aggressive once active threads accumulate value. Watchpoint after beta.
- **Image upload caps** — current draft per surface; revisit if a real partner needs higher-res product shots.
- **Whether to surface the SYSTEM UPDATE countdown beyond `/` home feed** — could also live on `/agenda`, `/foro` catalog, etc. Hold for now; ship on home only.

## Links

- [[Supabase Migration]] — older, narrower draft this plan replaces
- [[Admin Dashboard]] — admin UI shape, still current and complementary
- [[Scraper Pipeline]] — Phases 1+2 already shipped; Phase 3 absorbed here
- [[types]] — data shape that informs the schema
- [[curation]] — HP math (preserved on read; written via pg_cron rollup)
- [[permissions]] — client-side gating, mirrored as RLS server-side
- [[useAuth]] — gets removed in chunk 2
- [[FeedHeader]] — gets the SYSTEM UPDATE countdown in chunk 4
- [[CRT Scanline Sweep]] — first ship at countdown-zero
- [[Open Questions]] — "Attendance verification" stays open; achievement primitives ready when verification gesture exists
