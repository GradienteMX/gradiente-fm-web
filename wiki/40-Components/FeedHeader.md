---
type: component
status: current
tags: [home, header, filter, contained-surface]
updated: 2026-04-25
---

# FeedHeader

> The status strip above the home grid. Adapts in real time to whether a category filter is active. The visual signal that "the subsystem is doing something" when the user filters.

## Source

[components/FeedHeader.tsx](../../components/FeedHeader.tsx) · slotted in [Home](../../app/page.tsx)

## States

**No filter** (default):
```
TODO LO QUE VIENE
76 ENTRADAS · PROMINENCIA ORGÁNICA · SEÑAL + FRESCURA
```

**Filter active** (e.g. user clicked `//MIX` in [[CategoryRail]]):
```
● //SUBSISTEMA · FILTRADO · MIX        ← in the category color, with a pulsing dot
FOCO ACTIVO · [×] LIMPIAR FILTRO       ← the bracket text is a button, second clear affordance
```

The pulsing dot is the same green-pulse pattern used elsewhere in the EVA chrome but tinted to the category color, so each filter has its own visual signature.

## Why a dedicated client component

The home page itself is server-rendered ([Home](../../app/page.tsx)). The filter state lives in client-side [[VibeContext]]. Extracting the header strip into a small client component lets the rest of the home page stay server-rendered while this single piece reacts to filter changes.

## Cleanup affordance

The `[×] LIMPIAR FILTRO` button is the second clear affordance — first one is the `×` in the [[CategoryRail]] header. Both call `setCategoryFilter(null)`. Two paths because the rail is desktop-only (`lg+`); on smaller screens this header button might end up being the only way to clear, depending on how the mobile rail eventually lands.

## Links

- [[Home]] · [[CategoryRail]] · [[ContentGrid]] · [[VibeContext]]
- [[Contained Single Surface]]
