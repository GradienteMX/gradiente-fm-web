# CLAUDE.md — Gradiente FM Web

> Developer notes for working on this codebase with Claude Code or any LLM assistant.
> The deeper knowledge base lives at [`wiki/`](./wiki/) — start at [`wiki/index.md`](./wiki/index.md).

## What this project is

Gradiente FM (formerly Espectro FM — rename in progress) is an editorial + event-listing + mix platform for the Mexico City underground electronic music scene. Content is filtered through a "vibe" spectrum 0 glacial/ambient → 10 volcán/peak-hour. Curation is editorial-seeded + HP-decay democratic (see [`wiki/90-Decisions/Guides Not Gatekeepers.md`](./wiki/90-Decisions/Guides Not Gatekeepers.md)).

Connected to FASCINOMA (fascinoma.space) and Club Japan (Monterrey 56, Roma Norte).

The repo folder is still named `espectro-fm-web` for historical reasons; the UI brand is `GRADIENTE FM`.

## Stack

- Framework: Next.js 14 (App Router)
- Language: TypeScript 5 strict
- Styling: Tailwind CSS 3
- Animation: Framer Motion 12
- Icons: Lucide React
- Date handling: date-fns 3 + `date-fns/locale/es`
- No backend yet — all data from [`lib/mockData.ts`](./lib/mockData.ts). See [`wiki/70-Roadmap/Supabase Migration.md`](./wiki/70-Roadmap/Supabase Migration.md).

## Folder structure

```
app/               Pages (home, agenda, editorial, mixes, noticias, reviews, opinion, articulos, foro, dashboard)
components/        Shared UI — Navigation, VibeSlider, ContentGrid, HeroCard, etc.
components/cards/  ContentCard (mosaic) + orphan linear cards
context/           VibeContext — global client-side filter state
lib/               types.ts, mockData.ts, curation.ts, genres.ts, utils.ts
public/flyers/     Event flyer images served at /flyers/
wiki/              Knowledge base — read [`wiki/index.md`](./wiki/index.md) first
```

## Content types

All content is `ContentItem` with a `type` field:
- `evento` — event with venue, artists, ticketUrl, date/endDate
- `mix` — DJ mix with mixUrl, tracklist, duration
- `noticia` — short news
- `review` — record or event review
- `editorial` — long-form editorial
- `opinion` — opinion column
- `articulo` — deep-dive longform feature (substack-style, structured body + footnotes)
- `partner` — sponsor rail only, never in main grid

See [`lib/types.ts`](./lib/types.ts) and [`wiki/20-Domain/Content Types.md`](./wiki/20-Domain/Content Types.md).

The `/foro` route runs an isolated subsystem with its own `ForoThread` / `ForoReply` types — not `ContentItem`s, no HP/curation, never enter the main grid. See [`wiki/30-Pages/Foro.md`](./wiki/30-Pages/Foro.md).

## Vibe score

Every item has `vibe: 0-10`. 0 = glacial/ambient/dub, 10 = volcán/peak-hour/hard techno. Curator-assigned, subjective-editorial. See [`wiki/20-Domain/Vibe Spectrum.md`](./wiki/20-Domain/Vibe Spectrum.md).

## HP curation system

Items decay over time via type-specific half-lives. `editorial: true` raises spawn HP (50 vs 20 default). `pinned: true` locks an item to the single hero slot. Card size (sm/md/lg) and grid position are the only visible ranking signals. See [`lib/curation.ts`](./lib/curation.ts) and [`wiki/20-Domain/HP Curation System.md`](./wiki/20-Domain/HP Curation System.md).

## Architectural patterns

- One-way data flow: `mockData.ts` → filters → curation → pages → UI
- Partners always isolated from the main grid (separate rail, chronological order, no vibe filter)
- Only one pinned hero at a time
- Home feed ordered by HP prominence, never by `publishedAt`
- Spanish UI copy, English code
- Always use `@/` path alias, never `../../` relative imports

## Coding conventions

- TypeScript strict — no `any`, no implicit types
- Tailwind only — no inline styles unless doing EVA orange chrome, no CSS modules
- PascalCase components, camelCase utils
- Named exports only from `lib/` files
- Server components by default; `'use client'` only when truly needed
- Images in `public/flyers/`, referenced as `/flyers/filename.jpg`

## Things to avoid

- Never commit `node_modules` or `.env` files
- Never put partners in the main content grid
- Never sort home feed by `publishedAt` — use HP curation
- Never use `git push --force` without team discussion
- Every new `ContentItem` needs a real vibe score (not just 0)
- Don't personalize the feed per user (see [`wiki/90-Decisions/No Algorithm.md`](./wiki/90-Decisions/No Algorithm.md))
- Don't introduce visible engagement metrics (likes, play counts, trending badges) — see [`wiki/90-Decisions/Size and Position as Only Signals.md`](./wiki/90-Decisions/Size and Position as Only Signals.md)

## Running locally

```
npm install
npm run dev        # http://localhost:3000
npm run build
npm run lint
```

## Collaborators

- datavismo-cmyk — project lead, curation, editorial direction
- hzamorate — collaborator
- ikerio — collaborator
