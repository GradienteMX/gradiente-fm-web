---
type: component
status: current
tags: [comments, composer]
updated: 2026-04-26
---

# CommentComposer

> Login-gated dual-variant composer. Posts new top-level comments (root variant) or threaded replies (reply variant).

## Source

[components/overlay/CommentComposer.tsx](../../components/overlay/CommentComposer.tsx)

## Variants

**`root`** — pinned at the bottom of [[CommentsColumn]]. Always-expanded textarea + `▶ ENVIAR` button. Posts a top-level comment (`parentId === null`).

**`reply`** — rendered by [[CommentList]] under each non-tombstone comment. Collapsed to a `↳ RESPONDER` trigger by default; click expands the textarea inline. Posts as a child of `parentId`. After post or cancel, collapses back to the trigger.

## Logged-out path

Both variants render a single button that opens [[LoginOverlay]] via `useAuth().openLogin()` — `INICIA SESIÓN PARA COMENTAR` (root) or `INICIA SESIÓN PARA RESPONDER` (reply). Logged-out viewers can read everything; only authoring is gated.

## Logged-in form

- `COMO @username` indicator above the textarea so the user always knows which identity is posting.
- **Enter** posts. **Shift+Enter** inserts a newline. **Escape** cancels (reply variant only).
- ENVIAR is disabled while the body is empty/whitespace.

## Storage path

Posting calls `addComment` in [[comments]]. New comments get a session-prefixed id from `newCommentId()` (e.g. `cm-session-mofe5xbb-3z77iq`) so they never collide with seed ids. Persisted in the `added` slice of `gradiente:comments` sessionStorage.

## Links

- [[CommentList]] · [[CommentsColumn]] · [[comments]]
- [[useAuth]] · [[LoginOverlay]]
