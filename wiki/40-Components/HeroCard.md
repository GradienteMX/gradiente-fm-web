---
type: component
status: current
tags: [component, hero, portada]
updated: 2026-04-22
---

# HeroCard

> Split portada card: large image left, multi-paragraph body right. Only one renders per home view.

## Source

[components/HeroCard.tsx](../../components/HeroCard.tsx)

Exports: `HeroCard` + `getPinnedHero(items)` helper.

## Client component? No

Pure server render.

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

## `getPinnedHero` logic

See [[Pinned Hero]]. Prefers `pinned: true` items; falls back to most-recent `editorial: true`; restricted to text types (no events, mixes, partners).

## Links

- [[Pinned Hero]]
- [[Home]]
- [[Editorial Flag]]
- [[Typography]]
