---
type: component
status: current
tags: [dashboard, primitive, draggable]
updated: 2026-04-26
---

# DraggableCanvas

> Generic free-form file canvas. Items position themselves on a backdrop grid; users drag tiles to reposition; positions persist per-namespace in sessionStorage.

## Source

[components/dashboard/explorer/DraggableCanvas.tsx](../../components/dashboard/explorer/DraggableCanvas.tsx)

## Why a new primitive

The older [[DraggableFileGrid]] (used by [[Dashboard Drafts]] / Publicados) hard-codes `DraftItem` as its tile shape. [[SavedCommentsSection]] needs the same drag UX for two completely different tile types (article folders + comment files), so a generic was extracted instead of forcing comments into the draft shape.

`DraggableFileGrid` is intentionally left untouched — refactoring it onto this primitive is a separate, optional task.

## Props

```ts
interface DraggableCanvasProps<T> {
  namespace: string                              // sessionStorage key suffix
  items: T[]
  getId: (item: T) => string
  tileWidth: number
  tileHeight: number
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  onClickItem?: (item: T) => void                // single-click without drag
  onDoubleClickItem?: (item: T) => void
  renderTile: (ctx: { item: T; selected: boolean; dragging: boolean }) => ReactNode
  headerLabel?: string
  emptyContent?: ReactNode
}
```

## Storage

`gradiente:dashboard:positions:<namespace>` → `Record<id, { x, y }>`. Different views must use different namespaces or positions collide. Saved-comments uses `saved-comments:folders` and `saved-comments:files:<articleId>` so each article has an independent layout.

`REORGANIZAR` button in the header strip wipes the namespace and falls back to the default grid.

## Click-vs-drag

Disambiguated by a 4px movement threshold. Below threshold, pointerup is treated as a click → `onClickItem`. Above, pointerup commits the drag position → calls the canvas's `onMove`.

## Inner-control isolation

`pointerdown` checks `target.closest('button, a, input, textarea, select')` and bails. Buttons + links inside a tile (e.g. `★ QUITAR` on an expanded saved comment) keep their own click semantics without being hijacked by the drag handler.

## Default grid layout

Items without a stored position get `defaultPosition(index, columns)`. Column count tracked via `ResizeObserver` on the container, recomputed when the window resizes.

## Backdrop

Dotted radial-gradient (`rgba(255,255,255,0.04)` 14px grid) — same visual idiom as [[DraggableFileGrid]] for consistency across the dashboard.

## Links

- [[DraggableFileGrid]] — older sibling, hardcoded to `DraftItem`
- [[SavedCommentsSection]] — current consumer
- [[Dashboard Explorer]]
