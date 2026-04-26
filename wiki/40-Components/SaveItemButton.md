---
type: component
status: current
tags: [saves, overlay]
updated: 2026-04-26
---

# SaveItemButton

> `★ GUARDAR / ★ GUARDADO` chip in the overlay header. Toggles whether the current `ContentItem` is in the user's saves.

## Source

[components/overlay/SaveItemButton.tsx](../../components/overlay/SaveItemButton.tsx)

## Placement

Lives in [[OverlayShell]]'s top-right header cluster, immediately before [[ShareButton]]:

```
[//TYPE | slug]      [SaveItemButton][ShareButton][ONLINE][CERRAR]
```

Single placement is intentional — every clickable card opens an overlay, so the gesture is reachable everywhere without per-card chrome.

## Behavior

- `useIsItemSaved(item.id)` from [[saves]] drives the active state.
- Click fires `toggleSavedItem(item.id)` from [[saves]].
- Logged-out users get `openLogin()` from [[useAuth]] instead — same login gate as the comment-level [[CommentList]] save button.
- Hidden under the `sm` breakpoint (mobile uses the close button + ESC; the chip would crowd the header).

## Visual

| State | Border | Color | Background |
|---|---|---|---|
| Unsaved | `#242424` (border) | `#888888` (muted) | `rgba(0,0,0,0.4)` |
| Saved | `#F97316` (orange) | `#F97316` (orange) | `rgba(249,115,22,0.08)` |

`☆ GUARDAR` collapses to `★ GUARDADO` when active. Same pattern as the comment-level save chip in [[CommentList]] (`SaveButton`).

## Links

- [[OverlayShell]] · [[ShareButton]] · [[saves]] · [[SavedBadge]]
- [[useAuth]] · [[LoginOverlay]]
