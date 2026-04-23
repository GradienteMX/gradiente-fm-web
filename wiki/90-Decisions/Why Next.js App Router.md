---
type: decision
status: current
tags: [decision, stack, nextjs]
updated: 2026-04-22
---

# Decision — Why Next.js App Router

> Next.js 14 with the App Router (not the Pages Router, not a different framework).

## Decision

Adopt Next.js 14 App Router as the primary framework. Server components by default, client components where needed.

## Context

- Site launched in the 2024 timeframe when App Router had stabilized.
- Content is mostly static / near-static (mock data, hand-curated).
- Eventual backend via [[Supabase Migration]] fits `async` server component patterns cleanly.
- Deploy target is likely Vercel (frictionless for Next).

## Alternatives considered

1. **Next.js Pages Router.** Mature but older paradigm. App Router gets the new APIs (streaming, server actions, nested layouts).
2. **Remix.** Solid option with good data patterns. Rejected because the team was more familiar with Next.
3. **Astro.** Great for mostly-static content sites. Rejected because the client-interactive parts ([[VibeSlider]], [[ContentGrid]] with Framer Motion layout) want React's component model.
4. **SvelteKit.** Beautiful. Rejected because no one on the team has Svelte experience, and the NGE aesthetic does not translate to "we need the performance budget."
5. **Plain Vite + React SPA.** Loses SSR, loses SEO, loses easy server data. No.

## Consequences

- **Pro:** file-based routing maps 1:1 to site sections — see [[App Router Patterns]].
- **Pro:** server components keep the client JS bundle small.
- **Pro:** `metadata` API gives clean per-page title/OG without a library.
- **Pro:** `next/font` handles the three-font load elegantly ([[Typography]]).
- **Pro:** when [[Supabase Migration]] happens, async server components are the natural data boundary.
- **Con:** App Router has been historically unstable — we're pinned to a specific minor (`14.2.21`) that has a known security advisory. See [[Open Questions]].
- **Con:** the 'use client' directive contagion is a subtle trap — wrapping a client parent around a server child silently loses the server context.
- **Con:** Next.js image optimization is not used (we use plain `<img>` for Framer Motion compatibility) so we're paying framework cost without one of its biggest wins.

## Links

- [[Stack]]
- [[App Router Patterns]]
- [[Folder Structure]]
- [[Supabase Migration]]
