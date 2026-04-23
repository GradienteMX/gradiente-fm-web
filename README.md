# GRADIENTE FM

Editorial + event-listing + mix platform for the Mexico City underground electronic music scene.

Rebranded from **Espectro FM** — the repo folder is still named `espectro-fm-web` for historical reasons; the UI brand is `GRADIENTE FM`.

## What it is

- Live event agenda for CDMX (FASCINOMA, Club Japan, Multiforo Alicia, Foro Indie Rocks, others)
- Radio / mix platform (ESPECTRO MIX series)
- Editorial publication covering scene culture, venue politics, sober clubbing, gentrification, and more

Content is filtered through a single axis — the **vibe spectrum** (0 glacial/ambient → 10 volcán/peak-hour). Curation is editorial-seeded; HP decay handles ranking; collective attention is the democratic mechanism.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 strict |
| Styling | Tailwind CSS 3 |
| Animation | Framer Motion 12 |
| Icons | Lucide React |
| Dates | date-fns 3 (Spanish locale) |
| Data | `lib/mockData.ts` (no backend yet) |

## Running locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint       # eslint
```

Requires Node 18+.

## Deeper documentation

The canonical knowledge base for this repo lives in [`wiki/`](./wiki/) — an Obsidian vault. Plain Markdown, so it renders on GitHub too.

Start here:
- [`wiki/index.md`](./wiki/index.md) — the map
- [`wiki/_schema.md`](./wiki/_schema.md) — how the wiki is organized
- [`wiki/90-Decisions/Guides Not Gatekeepers.md`](./wiki/90-Decisions/Guides Not Gatekeepers.md) — core editorial thesis
- [`wiki/20-Domain/HP Curation System.md`](./wiki/20-Domain/HP Curation System.md) — ranking math
- [`wiki/60-Design/NGE Aesthetic.md`](./wiki/60-Design/NGE Aesthetic.md) — visual language

## Also see

- [`CLAUDE.md`](./CLAUDE.md) — developer notes + conventions for LLM-assisted work
- [`wiki/70-Roadmap/Open Questions.md`](./wiki/70-Roadmap/Open Questions.md) — active TODOs

## Collaborators

- datavismo-cmyk — project lead, editorial direction
- hzamorate — collaborator
- ikerio — collaborator

## External anchors

- [FASCINOMA](https://fascinoma.space) — festival partner
- Club Japan — Monterrey 56, Roma Norte, CDMX — venue partner
