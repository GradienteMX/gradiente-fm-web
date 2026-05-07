---
type: architecture
status: current
tags: [folders, conventions]
updated: 2026-04-22
---

# Folder Structure

> Flat-by-concern. Each top-level folder owns exactly one role.

## Layout

```
espectro-fm-web/
├── app/              Next.js App Router pages (one folder per route)
│   ├── layout.tsx    Root layout: fonts, Navigation, VibeSlider, footer
│   ├── globals.css   Base CSS + custom NGE utility classes
│   ├── page.tsx      Home
│   ├── agenda/       /agenda
│   ├── editorial/    /editorial
│   ├── mixes/        /mixes
│   ├── noticias/     /noticias
│   └── reviews/      /reviews
│
├── components/       Shared UI. PascalCase filenames.
│   ├── Navigation.tsx
│   ├── VibeSlider.tsx
│   ├── CategoryRail.tsx
│   ├── ContentGrid.tsx     (mosaic, used)
│   ├── ContentFeed.tsx     (linear, unused — see [[Dual Feed Systems]])
│   ├── HeroCard.tsx
│   ├── PartnersRail.tsx
│   └── cards/
│       ├── ContentCard.tsx    (sm/md/lg tiered card, used)
│       ├── EventCard.tsx      (unused)
│       ├── MixCard.tsx        (unused)
│       └── ArticleCard.tsx    (unused)
│
├── context/
│   └── VibeContext.tsx  client-side global filter state
│
├── lib/              pure TS, no JSX. Named exports only.
│   ├── types.ts
│   ├── mockData.ts
│   ├── curation.ts
│   ├── genres.ts
│   └── utils.ts
│
├── public/
│   └── flyers/       event/mix/review cover images (/flyers/*.jpg)
│
├── wiki/             ← this vault. Does not ship to prod.
│
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json     paths: { "@/*": ["./*"] }
├── package.json
└── .gitignore
```

## Conventions

- **One concern per folder.** Don't put utilities in `components/`, don't put UI in `lib/`.
- **PascalCase components, camelCase utils.** Matches export names.
- **Named exports only from `lib/`** — easier refactors than default exports.
- **Server components by default** — only mark `'use client'` when the file needs `useState`, `useEffect`, `useRef`, event handlers, or context. See [[App Router Patterns]].
- **`@/` path alias everywhere.** Never `../../lib/foo`. See [tsconfig.json](../../tsconfig.json).

## What's absent (intentional)

- No `pages/` — we use App Router exclusively.
- No `api/` — no backend yet. See [[Supabase Migration]].
- No `hooks/` folder — hooks colocated in the component or context that uses them. Only `useVibe` exists so far, and it lives in [[VibeContext]].
- No `styles/` — Tailwind + [`app/globals.css`](../../app/globals.css) is all.
- No tests — the project hasn't set up a test runner. See [[Open Questions]].

## Links

- [[Stack]]
- [[App Router Patterns]]
- [[Data Flow]]
