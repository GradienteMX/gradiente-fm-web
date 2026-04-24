---
type: component
status: current
tags: [component, hero, portada, overlay]
updated: 2026-04-23
---

# HeroCard

> Split portada card: large image left, multi-paragraph body right. Only one renders per home view. Click anywhere — including the `// EN PORTADA` header bar — opens the overlay reader.

## Source

[components/HeroCard.tsx](../../components/HeroCard.tsx)

Exports: `HeroCard` only. The `getPinnedHero` helper was moved to [lib/utils.ts](../../lib/utils.ts) so server components can call it without importing from a `'use client'` module.

## Client component? Yes

Became a client component when click-to-open-overlay landed. The whole `<section>` is the clickable surface — header bar, image, text, CTA button all participate.

## Layout

Desktop: horizontal 45% / 55% split, fixed height 360px.
Mobile: stacked, image first, min-height 260px for each panel.

```
┌──────────────────────────────────────────────────────────┐
│ // EN PORTADA · SE ACTUALIZA SEMANALMENTE  ●PINNED        │ ← header bar
├──────────────────────┬──────────────────────────────────┤
│                      │ AUTHOR · DATE · 5 MIN LECTURA     │
│  [    IMAGE    ]     │                                    │
│  //EDITORIAL         │ Big title headline                 │
│                      │                                    │
│  vibe edge │         │ Body para 1 (heavier text)         │
│            │         │ Body para 2 (dimmer)               │
│            ╲         │ Body para 3 (hidden mobile)        │
│                      │                                    │
│                      │ [genre chips] [tag chips]          │
│                      │ [LEER COMPLETO →]                  │
└──────────────────────┴──────────────────────────────────┘
```

## Details

- **Vibe edge** — 4px vertical bar on the left of the image, in the item's vibe color
- **Type badge** top-left of image with `bg-black/75` + backdrop blur
- **NGE corner bracket** bottom-left of image in vibe color at 50% alpha
- **Type label** uppercased from a local TYPE_LABEL map (not from utils) — `EVENTO / MIX / NOTICIA / REVIEW / EDITORIAL / OPINIÓN / PARTNER`
- **Body paragraphs** split from `bodyPreview` on `\n\n`. Falls back to `[excerpt]` if `bodyPreview` is absent.
- **Paragraph styling tiers:** para 0 → `text-secondary`, para 1+ → `text-muted`, para 2+ hidden on mobile (`hidden md:block`)
- **CTA** → `LEER COMPLETO` button with lucide `ArrowRight` that translates on hover

## Interaction

The outer `<section>` is `role="button"` + `tabIndex={0}` + `onClick` + `onKeyDown`. Clicking anywhere in the hero (including the `// EN PORTADA · SE ACTUALIZA SEMANALMENTE` top strip) calls `open(item.slug, rect)` from [[useOverlay]] and opens the [[ReaderOverlay]] (since pinned hero items are always `editorial` / `review` / `opinion` / `noticia`).

The inner `LEER COMPLETO` button has no separate handler — clicks bubble up to the section. Keeping the whole card as one clickable surface avoids the "the header bar doesn't expand too" confusion from earlier versions.

## `getPinnedHero` logic

Lives in [lib/utils.ts](../../lib/utils.ts) (moved out of HeroCard.tsx when HeroCard became a client component — server pages can't call functions from `'use client'` modules).

See [[Pinned Hero]]. Prefers `pinned: true` items; falls back to most-recent `editorial: true`; restricted to text types (no events, mixes, partners).

## Links

- [[Overlay System]]
- [[ReaderOverlay]]
- [[useOverlay]]
- [[Contained Single Surface]]
- [[Pinned Hero]]
- [[Home]]
- [[Editorial Flag]]
- [[Typography]]
