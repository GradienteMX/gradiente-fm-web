# GRADIENTE

Infrastructure and memory for the underground music and sound-art scene in Mexico City: the nights, the mixes, the writing and the franjas (labels, venues, collectives) — navigated by **energy, not genre**.

Rebranded from **Espectro FM** — the repo folder is still named `espectro-fm-web` for historical reasons.

## What it is

- **Agenda** — the scene's nights, one by one (FASCINOMA, Club Japan, Multiforo Alicia, and more)
- **Mixes** — sessions recorded in the scene, with a persistent player
- **Lecturas** — reviews, editorials, opinion, long-form articles, lists, news
- **Franjas** — the scene's labels, venues and collectives, each with its page and store
- **Foro**, **Mapa** (the territory by affinity), **Mercado**
- **La Puerta** — invite-only entry; every member carries a **credencial**: a card in a collector's case, printed on their role's colour, with stickers pressed on and trophies as enamel pins

Everything is filtered through one axis — the **vibe spectrum** (0 glacial → 10 volcán). Curation is editorial-seeded; HL (half-life) decay handles prominence; collective attention is the democratic mechanism. No per-user feed, no visible engagement metrics.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) · React 19 |
| Language | TypeScript 5.9 strict |
| Styling | CSS Modules + design tokens («TRAMA» / «LIBREA») |
| Motion & GL | GSAP 3 · three.js (one WebGL context) |
| State | zustand + immer (the world store) |
| Backend | Supabase (Postgres + RLS + Auth + Storage + Realtime) on Vercel |

## Running locally

```bash
npm install
npm run dev          # needs .env.local (Supabase URL, anon key, service-role key)
npm run typecheck
npm run lint
npm test
npm run build        # stop the dev server first
```

`.env.local` points at the production database — read [`CLAUDE.md`](./CLAUDE.md) before testing anything that writes.

## Documentation

- [`docs/`](./docs/) — V2's design system: concept, direction, parity, **the kit** (how to build a surface), TRAMA (the printed sheet), LIBREA (liveries, the credencial, stickers, pins)
- [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md) — developer notes and conventions for LLM-assisted work
- [`wiki/`](./wiki/) — Obsidian vault: the domain, the backend, decisions, and the log. Start at [`wiki/index.md`](./wiki/index.md)

## Collaborators

- datavismo-cmyk — project lead, editorial direction
- hzamorate — collaborator
- ikerio — collaborator

## External anchors

- [FASCINOMA](https://fascinoma.space) — festival partner
- Club Japan — Monterrey 56, Roma Norte, CDMX — venue partner
