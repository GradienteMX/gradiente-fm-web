---
type: component
status: current
tags: [comments, overlay]
updated: 2026-05-21
---

# CommentsColumn

> Right rail mounted inside the split-screen [[OverlayShell]]. Chrome + scrollable body + bottom composer for the discussion attached to one `ContentItem`.

## Source

[components/overlay/CommentsColumn.tsx](../../components/overlay/CommentsColumn.tsx)

## What

Renders the discussion surface for a single article. Three vertical strips inside a flex column:

1. **Header** — `//COMENTARIOS` label + `discusión·{slug}` subtitle on `lg+` + `OCULTAR ›` close button (mirrors [[OverlayShell]] header rhythm).
2. **Status strip** — comment count + `ORDEN · ACTIVIDAD` label.
3. **Body** — scrollable [[CommentList]].
4. **Footer** — pinned root [[CommentComposer]].

Comment data comes from the shared `useOverlayShell()` context exposed by [[OverlayShell]], not from a direct `useComments(item.id)` call. The shell calls `useComments` once at its level so the rail button + metadata row + footer can all show a live count before the column is mounted; this column reads the same `comments` / `usersById` / `loading` out of context. Refactor reason: two simultaneous `useComments` calls for the same item subscribe to the same Supabase realtime channel (`comments:${itemId}`) and the second crashes — context is the dedupe. See [[OverlayShell]] § "Comments rail button + `useOverlayShell()` context".

## Props

```ts
{
  item: ContentItem
  onClose: () => void
  focusedCommentId?: string | null  // forwarded to CommentList
}
```

## Focus deep-link

When [[OverlayShell]] reads `?comment=<id>` from the URL, it passes the id through here to [[CommentList]]. The matching comment scrolls into view + flashes once. Non-permanent — see `comment-focus-flash` keyframe in `globals.css`.

## Login state

The composer footer is rendered regardless of auth state. [[CommentComposer]] handles its own logged-out branch (a stub that opens [[LoginOverlay]]).

## Links

- [[OverlayShell]] · [[CommentList]] · [[CommentComposer]] · [[comments]]
- [[Overlay System]] — split-screen layout
