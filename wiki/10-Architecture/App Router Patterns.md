---
type: architecture
status: current
tags: [nextjs, app-router, server-components, client-components]
updated: 2026-04-22
---

# App Router Patterns

> Server-by-default. Client islands for interactivity. One root layout wraps everything.

## The layout tree

```
app/layout.tsx                     ← root
├── <html lang="es">
├── fonts loaded via next/font
├── <VibeProvider> (context)
│   ├── <Navigation />             'use client' — sticky header
│   ├── <VibeSlider />             'use client' — sticky filter
│   ├── <main>{children}</main>
│   └── <footer>
└── page.tsx / category/page.tsx   ← per-route content
```

Every page renders inside this shell. See [app/layout.tsx](../../app/layout.tsx).

## Server vs client

**Server components (default, no directive):**
- All `app/*/page.tsx` files
- [[HeroCard]]
- [[CategoryRail]]
- [[ContentCard]] (and its subtypes)

**Client components (`'use client'`):**
- [[Navigation]] — needs `usePathname`, `useState`, clock interval
- [[VibeSlider]] — pointer events, refs, state
- [[CalendarSidebar]] — interactive date picking
- [[ContentGrid]] — reads context, Framer Motion layout
- [[ContentFeed]] — reads context (not currently wired to any page)
- [[PartnersRail]] — uses `useMemo` (could be server, marked client defensively)
- [[VibeContext]] — the Provider itself

**Rule:** mark `'use client'` only when you genuinely need browser-only APIs. Don't propagate `'use client'` upward — wrap an interactive child inside a server parent instead.

## Route pattern

Each page file in `app/*/page.tsx` does three things:

1. Export `metadata` (Next.js picks this up for `<title>`).
2. Filter [`MOCK_ITEMS`](../../lib/mockData.ts) server-side for this page's scope.
3. Compose the same 2–3 layout primitives ([[ContentGrid]], [[CalendarSidebar]], section header).

Example — [app/agenda/page.tsx](../../app/agenda/page.tsx):

```tsx
export const metadata: Metadata = { title: 'Agenda' }

export default function AgendaPage() {
  const items = filterForCategory(MOCK_ITEMS, 'evento')
  const eventDates = getEventDates(MOCK_ITEMS)
  return (
    <>
      <CalendarSidebar eventDates={eventDates} />
      {/* header ... */}
      <ContentGrid items={items} mode="category" emptyLabel="..." />
    </>
  )
}
```

All 5 category pages follow this shape. [[Home]] is the only page with more assembly (hero + category rail + partners rail).

## Metadata

Root [app/layout.tsx:29](../../app/layout.tsx) sets `title.template: '%s · GRADIENTE FM'`. Per-page `metadata.title` fills the `%s`. So `/agenda` becomes `Agenda · GRADIENTE FM`.

The default (home) title is `GRADIENTE FM`.

## Links

- [[Stack]]
- [[Data Flow]]
- [[Folder Structure]]
