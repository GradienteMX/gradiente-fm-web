# AGENTS.md — Gradiente (V2)

> Developer notes for working on this codebase with Codex or any LLM assistant. (Same content as CLAUDE.md — keep them in lockstep.)
> **V2's design system and the practical how-to live in [`docs/`](./docs/)** — start at [`docs/04-KIT.md`](./docs/04-KIT.md) (how to build a surface), then [`docs/05-TRAMA.md`](./docs/05-TRAMA.md) (the printed sheet) and [`docs/06-LIBREA.md`](./docs/06-LIBREA.md) (liveries, the credencial, stickers, pins).
> The older knowledge base at [`wiki/`](./wiki/) documents the domain and the backend (still true) and the previous UI (retired).

## What this project is

Gradiente (formerly Espectro FM) is an editorial + event-listing + mix platform for the Mexico City underground electronic music scene. Content is filtered through a "vibe" spectrum 0 glacial/ambient → 10 volcán/peak-hour — *navegas por energía, no por género*. Curation is editorial-seeded + HL-decay democratic (see [`wiki/90-Decisions/Guides Not Gatekeepers.md`](./wiki/90-Decisions/Guides Not Gatekeepers.md)). Invite-only closed beta, live at gradiente.org.

The repo folder is still named `espectro-fm-web` for historical reasons. `ESPECTRO` still appears in code as a user rank (NORMIE / DETONADOR / ENIGMA / ESPECTRO) and as the Spanish word for the vibe spectrum; neither is leftover branding. HP is the code/schema term, HL (Half-Life) the user-facing name.

## Status — V2 replaces the site (branch `v2`)

V2 («TRAMA» + «LIBREA») is a ground-up redesign that replaces the previous UI entirely, on the same Supabase backend. On branch `v2`: the old UI is gone (readable via `git show main:<path>`), the production backend stays (`app/api/**`, `proxy.ts`, `lib/supabase`, `lib/data`, the shared rules), and V2's pages read and write real data through the world store (below). Migrations `0052_stickers.sql` (and later ones) are applied by hand in the SQL editor.

## Stack

- Framework: Next.js 16 (App Router, Turbopack) — `proxy.ts` is what used to be `middleware.ts`
- Language: TypeScript 5.9 strict · React 19 (React Compiler lint rules on)
- Styling: **CSS Modules** + design tokens in `app/globals.css` (no Tailwind)
- Motion and GL: GSAP 3 (all plugins), three.js — ONE WebGL context: the stage behind the DOM (`components/stage`, GL islands: map, credencial, pins, La Puerta's field) and the printing-gesture canvas above it (`components/trama`)
- State: zustand + immer (`lib/store/*`) · dates: date-fns 4
- Backend: Supabase (Postgres + RLS + Auth + Storage + Realtime), deployed on Vercel

## Folder structure

```
app/               Routes: / (campo), agenda, mixes, lecturas, listas, foro, mapa, mercado, f/[slug], e/[slug], u/[username], taller (the member's desk), central (admin), welcome (La Puerta), espera + app/api/** (the backend)
components/        V2 surfaces, one folder per area (pieza, lectura, campo, credencial, stickers, insignias, puerta, acceso, central, taller, mesa…); kit/ = shared primitives
lib/store/         The world: world-core.ts (pure reducers + initWorld), world.tsx (provider, dispatch), snapshot.ts (shapes), effects.ts + efectos/ (backend calls per action)
lib/data/          Server-only reads: world.ts (public snapshot + private overlay), items/users/comments/foro…, stickers.ts
lib/               Shared rules with the backend: types, genres, curation, trophies, permissions, identity, waitlist, hp/, contentReadiness; V2 modules: librea, vibe, logic/, stickers/, mapa/
docs/              V2 design system (01-CONCEPTO … 06-LIBREA)
supabase/          Migrations (hand-applied; see "Things to avoid")
scripts/           Service-role scripts (seeds, imports, stickersBeta)
tests/             tsx --test suites
wiki/              Domain + backend knowledge base
```

## Data flow

Supabase → `lib/data/world.ts`: the **public snapshot** (everything every signed-in member may see, identical for all — No-Algorithm) read with the service role inside `unstable_cache` (tag `'world'`), plus a **private overlay** (the viewer's own rows, cookie client, RLS) → the root layout hands both to `WorldProvider` → `initWorld` → surfaces read with `useWorld(selector)`. Anonymous visitors get an empty world (they only reach `/welcome` and `/espera`).

Writes: `dispatch(action)` applies the reducer optimistically, then runs the effect registered for that action type in `lib/store/efectos/*` (one fetch to an `app/api` route). A failure undoes the action and tells the person (`EffectError` carries the route's message). A route that changes the public snapshot calls `revalidateTag('world', { expire: 0 })` (Next 16 needs the second argument). HL/HP, trophies, crowd bands and presence are computed server-side; the client only shows optimistic deltas.

## Content types

All content is `ContentItem` with a `type` field: `evento`, `mix`, `noticia`, `review`, `editorial`, `opinion`, `articulo`, `listicle`, `franja` (a band on the dial — never in the main mosaic). See [`lib/types.ts`](./lib/types.ts). The foro runs its own `ForoThread` / `ForoReply` model (no HL, never in the mosaic).

## Vibe score and HL

Every item carries a vibe band `vibeMin`–`vibeMax` (0–10). The author sets it; with 5+ crowd vibe checks their median band becomes the effective one (`effectiveBand` in `lib/vibe.ts`). Items decay by type-specific half-lives (`lib/curation.ts`); card size and position are the only visible ranking signals. The portada is every pinned non-franja piece (`lib/logic/feed.ts`).

## Coding conventions

- TypeScript strict — no `any` (the few untyped Supabase clients for tables newer than `database.types.ts` say why)
- CSS Modules; inline `style` only for values computed at runtime (energy colours, liveries, sizes)
- Follow `docs/04-KIT.md`: tokens, energy typography, kit components, liveries, printing gestures, GL islands, motion, voice
- Spanish UI copy, English code · `@/` imports · named exports from `lib/`
- React Compiler lint rules: no setState in effects (derive, or `useSyncExternalStore` — `lib/useMedia.ts`), no impure calls in render
- Prettier: `.prettierrc.json` (single quotes, no semicolons, width 160)

## Things to avoid

- Never run `supabase db push`. Production `schema_migrations` records only `0001`–`0016`; everything later was applied by hand in the Supabase SQL editor. Apply new SQL there.
- `.env.local` points at the **production** database (service-role key included). Local development reads real data; never test writes casually — use a dedicated QA account. `GRADIENTE_DEV_OPEN=1` in `.env.development.local` (development only) lets pages render the public world without signing in.
- Never run `next build` while `next dev` serves the same checkout (both write `.next/`).
- Never put franjas in the main mosaic; never sort the feed by `publishedAt`; don't personalize the feed per user ([`wiki/90-Decisions/No Algorithm.md`](./wiki/90-Decisions/No Algorithm.md)).
- No visible engagement metrics (likes, plays, trending) — size and position are the only signals; `/central` (admin) is the one place raw HL numbers appear.
- Every new `ContentItem` needs a deliberately set vibe band.
- Never commit `node_modules` or `.env*` files; never `git push --force` without team discussion.

## Running locally

```
npm install
npm run dev          # the port comes from the preview config / PORT
npm run typecheck
npm run lint
npm test             # tsx --test tests/**/*.test.ts
npm run build        # stop `npm run dev` first
npx tsx scripts/stickersBeta.ts   # the closed beta's sticker kits (dry run; see the file)
```

## Collaborators

- datavismo-cmyk — project lead, curation, editorial direction
- hzamorate — collaborator
- ikerio — collaborator
