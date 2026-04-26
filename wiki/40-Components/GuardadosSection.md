---
type: component
status: current
tags: [saves, dashboard, guardados]
updated: 2026-04-26
---

# GuardadosSection

> Dashboard surface for the `Guardados/*` sidebar slots — a draggable canvas of saved publications, optionally filtered by content type.

## Source

[components/dashboard/explorer/sections/GuardadosSection.tsx](../../components/dashboard/explorer/sections/GuardadosSection.tsx)

## Routing

One mount per `?section=guardados-{feed,agenda,noticias,reviews,mixes,editoriales,articulos}` route. Dispatched from [`app/dashboard/page.tsx`](../../app/dashboard/page.tsx) with the right filter array per slot.

## Filter shape

```ts
filter: ContentType[] | null    // null = union view ("Feed")
filterKey: string                // namespace for DraggableCanvas positions
```

Filter is an **array** rather than a single type so editorially-related content types can share a slot:

| Slot | Filter | Notes |
|---|---|---|
| `feed` | `null` | Union of all saves |
| `agenda` | `['evento']` | |
| `noticias` | `['noticia']` | |
| `reviews` | `['review']` | |
| `mixes` | `['mix']` | |
| `editoriales` | `['editorial', 'opinion']` | Both read editorially |
| `articulos` | `['articulo', 'listicle']` | Listicles are structured articles |

`partner` is excluded by design (see [[Partners Isolation]]) — partners are never saveable.

## Render

Uses [[DraggableCanvas]] under namespace `saves:<filterKey>`, so each filter view has its own drag layout. Each tile shows:

- Article thumbnail (`item.imageUrl`)
- `//{TYPE}` chip in `categoryColor(type)`
- Title (line-clamped to 2)
- Inline `★ QUITAR` button on the thumbnail's top-right corner (e.stopPropagation so it doesn't fire the tile's open-overlay click)

Single-click on the tile body navigates via `router.push('/?item=<slug>')` — the persistent [[OverlayProvider]] picks up the URL change via `useSearchParams` (see [[useOverlay]]) and mounts the overlay over the dashboard.

## Empty state

Shown when the filter resolves to zero items. Different copy per filter (`eventos`, `noticias`, `editoriales y opiniones`, etc.) — keeps the prompt specific to what's empty rather than generic "vacía".

## Links

- [[saves]] · [[DraggableCanvas]] · [[ExplorerSidebar]] · [[Dashboard Explorer]]
- [[SaveItemButton]] · [[SavedBadge]] — the gestures that fill this surface
- [[SavedCommentsSection]] — sibling Guardados slot with two-level folder→file structure
- [[Partners Isolation]] — why `partner` isn't here
