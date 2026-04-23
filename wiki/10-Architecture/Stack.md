---
type: architecture
status: current
tags: [stack, nextjs, typescript, tailwind]
updated: 2026-04-22
---

# Stack

> Next.js 14 App Router + TypeScript 5 strict + Tailwind 3 + Framer Motion 12. No backend yet.

## What

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14.2.21** (App Router) | Server-first by default; file-based routing; easy Vercel deploy. |
| Language | **TypeScript 5** strict | Strict mode catches the whole class of `undefined` bugs before they ship. No `any`. |
| Styling | **Tailwind 3** | Co-located styles, design tokens in `tailwind.config.ts`, zero CSS-in-JS runtime cost. |
| Animation | **Framer Motion 12** | Shared-layout animations on the [[ContentGrid]] mosaic. |
| Icons | **Lucide React** | One icon set, tree-shakes well, consistent stroke weight. |
| Dates | **date-fns 3** + `date-fns/locale/es` | Spanish locale formatting without moment.js bloat. |
| Data | **`lib/mockData.ts`** | No backend yet — everything is static seed data. See [[mockData]] and [[Supabase Migration]]. |

## Why

- **App Router** over Pages Router: this was a 2024 new-build; server components + nested layouts are worth the newer APIs.
- **Mock data file** over a real DB: the site is a design-forward prototype; content model is still in flux. Swapping in a backend is a deferred decision — see [[Supabase Migration]].
- **Tailwind** over CSS modules/styled-components: design is token-heavy (see [[Color System]]) and utility classes make one-off NGE touches fast to prototype.

## How

Path alias `@/*` → repo root (see [tsconfig.json](../../tsconfig.json)). Always import with `@/lib/foo`, never `../../lib/foo`.

Fonts loaded via `next/font/google` in [app/layout.tsx:2](../../app/layout.tsx) — Syne / Space Grotesk / Space Mono, mapped to CSS variables. See [[Typography]].

Images loaded from `/public/flyers/` as plain `<img>` tags (not `<Image>`) — most cards use raw `<img>` for layout-animation compatibility with Framer Motion. Remote hosts `images.unsplash.com` and `picsum.photos` are whitelisted in [next.config.mjs](../../next.config.mjs).

## Known issues

- **Next.js 14.2.21 has an active security advisory** — [upgrade recommended](https://nextjs.org/blog/security-update-2025-12-11). See [[Open Questions]].
- `react` and `react-dom` are pinned to `^18` while Next 14 officially supports React 18. If we bump Next, confirm React compatibility first.

## Links

- [[Data Flow]]
- [[App Router Patterns]]
- [[Folder Structure]]
- [[Supabase Migration]]
