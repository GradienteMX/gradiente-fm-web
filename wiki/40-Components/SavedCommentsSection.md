---
type: component
status: current
tags: [comments, dashboard, guardados]
updated: 2026-04-26
---

# SavedCommentsSection

> Dashboard surface at `Guardados/Comentarios`. Two-level draggable file explorer for the user's saved comments.

## Source

[components/dashboard/explorer/sections/SavedCommentsSection.tsx](../../components/dashboard/explorer/sections/SavedCommentsSection.tsx)

## Routing

Reachable via `?section=guardados-comentarios`. Sidebar entry sits inside the `Guardados` folder alongside the per-content-type stubs in [[ExplorerSidebar]] — but is NOT a stub. Wired into the dispatch switch in [`app/dashboard/page.tsx`](../../app/dashboard/page.tsx).

## Structure

**Folder grid (default).** One folder per publication where the user has saved comments. Each folder renders the article thumbnail (`item.imageUrl`), `//{TYPE}` chip in the article's category color, title, and a comment-count badge. Backed by [[DraggableCanvas]] under namespace `saved-comments:folders`. Single-click drills in.

**File grid (drilled in).** One tile per saved comment within the chosen folder. Each tile shows author chip, role badge, time ago, and one-line body preview (clamped). Single-click expands inline to reveal full body + `ABRIR EN OVERLAY ›` (deep-links via `?item=…&comment=…`) + `★ QUITAR`. Backed by [[DraggableCanvas]] under namespace `saved-comments:files:<articleId>` so each article's drag layout is independent.

A `← VOLVER · GUARDADOS` button + an article-context card at the top of the file view double as a breadcrumb back to the folder grid.

## Empty state

When `useSavedComments()` returns `[]`, renders a centered placeholder explaining the `★ GUARDAR` gesture in the public overlays.

## Deep-link pattern

`ABRIR EN OVERLAY ›` produces `/?item=<slug>&comment=<commentId>`. The home route's persistent [[OverlayProvider]] picks up the `?item` change via `useSearchParams` (see [[useOverlay]]); [[OverlayShell]] reads `?comment=` and:

1. Starts with `commentsOpen: true` so the user lands on the discussion column.
2. Threads `focusedCommentId` through to [[CommentList]], which scrolls the matching node into view + applies the one-shot `comment-focus-flash` class.

## Why two levels (folders + files)

User feedback on first iteration (which was a flat list of comments grouped only by an article context card): "make them work like Drafts and Publicados — folders by publication, files inside, draggable." Matches the file-explorer mental model the dashboard already uses.

## Links

- [[DraggableCanvas]] · [[Dashboard Explorer]] · [[ExplorerSidebar]]
- [[comments]] — `useSavedComments` / `toggleSavedComment`
- [[CommentList]] — receives the focused id from this section's deep-links
- [[Guardados Roadmap]] (memory) — long arc this slot is part of
