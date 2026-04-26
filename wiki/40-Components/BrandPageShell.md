---
type: component
status: current
tags: [brand, identity, layout]
updated: 2026-04-25
---

# BrandPageShell

> Shared chrome + helper exports for the static identity surfaces (`/about`, `/manifesto`, `/equipo`). Built so the team can fill in finished copy later without touching layout code.

## Source

[components/brand/BrandPageShell.tsx](../../components/brand/BrandPageShell.tsx)

## Exports

- `<BrandPageShell subsystem title lead?>` — page wrapper. Renders an orange `//SUBSISTEMA · {subsystem}` header chip with pulsing dot, font-syne display title, optional dek, and a single `max-w-3xl` reading column for `children`.
- `<BrandSection index title>` — section heading inside the reading column. `§NN TITLE` idiom borrowed from [[ArticuloOverlay]] so long-form pages share visual language.
- `<Redactar note?>` — red `[REDACTAR · note]` placeholder chip with a pulsing dot. Marks unwritten copy clearly enough that finished copy can't be shipped without removing it. Use inline within paragraphs or as a standalone block.

## Where it's used

- [[About]] — `/about` route — what Gradiente is + vibe filter explainer + partner ecosystem
- [[Manifesto]] — `/manifesto` route — editorial declaration scaffolded around `wiki/90-Decisions/` principles
- [[Equipo]] — `/equipo` route — collaborator list with GH handles + per-person bio placeholders

## Why a shell, not three independent pages

Brand pages share so much chrome (subsystem label, title typography, single reading column) that copy-pasting it three times would be churn. The shell isolates layout decisions in one file — when the team replaces placeholder copy with the real thing, they touch only the route files, not the chrome.

The three pages are intentionally simple — no [[ContentGrid]], no rail, no overlay system. Just a column of prose with section breaks.

## Footer entry points

[layout](../../app/layout.tsx) wires footer links to all three routes (`/ABOUT · /MANIFIESTO · /EQUIPO`) in the SUBSISTEMA chrome strip. Footer becomes flex-wrap on mobile so the link row stacks under the SUBSISTEMA chip without crushing the lat/lon block.

## Links

- [[ArticuloOverlay]] — borrowed `§NN` section idiom
- [[About]] · [[Manifesto]] · [[Equipo]] — consumers
- [[Guides Not Gatekeepers]] · [[No Algorithm]] — manifesto scaffolding
