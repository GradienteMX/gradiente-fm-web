python3 -c "
content = '''# CLAUDE.md — Espectro FM Web

## What this project is

Espectro FM is an underground DJ culture website for Mexico City electronic music scene. It combines an editorial platform (reviews, opinion, news) with a live event listing, filtered through a vibe spectrum from glacial/ambient (0) to volcanic/peak-hour (10). Curation is editorial, not algorithmic.

Connected to FASCINOMA (fascinoma.space) and Club Japan (Monterrey 56, Roma Norte).

## Stack

- Framework: Next.js 14 (App Router)
- Language: TypeScript 5
- Styling: Tailwind CSS 3
- Animation: Framer Motion 12
- Icons: Lucide React
- Date handling: date-fns 3
- No backend yet — all data from lib/mockData.ts

## Folder structure

app/               # Pages (home, agenda, editorial, mixes, noticias, reviews)
components/        # Shared UI — cards/, CalendarSidebar, CategoryRail, ContentGrid, HeroCard, Navigation, PartnersRail, VibeSlider
context/           # VibeContext — global vibe filter state
lib/               # types.ts, mockData.ts, curation.ts, genres.ts, utils.ts
public/flyers/     # Event flyer images served statically

## Content types

All content is ContentItem with a type field:
- evento — event with venue, artists, ticketUrl, date/endDate
- mix — DJ mix with mixUrl, tracklist, duration
- noticia — news
- review — record or event review
- editorial — long-form editorial
- opinion — opinion column
- partner — sponsor rail only, never in main grid

## Vibe score

Every item has vibe: 0–10. 0 = glacial/ambient/dub, 10 = volcan/peak-hour/hard techno.

## Curation / HP system

Items have optional hp and hpLastUpdatedAt. HP decays over time. editorial: true gives spawn HP bonus. pinned: true locks item to hero slot. See lib/curation.ts.

## Architectural patterns

- Data flows one way: mockData.ts -> pages -> UI
- Partners are always isolated from main grid
- Only one pinned hero at a time
- Grid order is HP-driven, not publishedAt
- Spanish UI copy, English code
- Always use @/ path alias, never relative ../../ imports

## Coding conventions

- TypeScript strict — no any, no implicit types
- Tailwind only — no inline styles, no CSS modules
- PascalCase components, camelCase utils
- Named exports only from lib/ files
- Server components by default, use client only when needed
- Images in public/flyers/, referenced as /flyers/filename.jpg

## Things to avoid

- Never commit node_modules or .env files
- Never put partners in the main content grid
- Never sort home feed by publishedAt — use HP curation
- Never use git push --force without team discussion
- Every new ContentItem needs a real vibe score (not just 0)

## Running locally

npm install
npm run dev        # http://localhost:3000
npm run build
npm run lint

## Collaborators

- datavismo-cmyk — project lead, curation, editorial direction
- hzamorate — collaborator
- ikerio — collaborator
'''
open('CLAUDE.md', 'w').write(content)
print('Done!')
"