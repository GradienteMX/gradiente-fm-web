---
type: component
status: current
tags: [comments, threading]
updated: 2026-04-26
---

# CommentList

> Threaded comment renderer. Builds a tree from the flat `Comment[]`, sorts top-level + nested by activity → engagement → chronological, and renders each node with role badges, ASCII reactions, and inline reply composer.

## Source

[components/overlay/CommentList.tsx](../../components/overlay/CommentList.tsx)

## Sort

Recursive — applied to every level of the tree, not just roots:

1. **Activity** — `descendantCount` (full subtree size). Deeper conversations float up.
2. **Engagement** — total reactions, all kinds counted equally. No kind subtracts (see [[No Algorithm]]: controversy is signal).
3. **Chronological** — newest first as the final tiebreaker.

## Depth cap

`MAX_VISUAL_DEPTH = 4`. Beyond that, the rest of the subtree collapses behind a `↳ VER N RESPUESTAS MÁS EN ESTE HILO` button. Keeps the column readable on narrow widths.

## Role badges

Color-coded chip next to the username:

- `ADMIN` — orange `#F97316`
- `MOD` — red `#E63329`
- `REDACCIÓN` (collaborator) — green `#4ADE80`
- `OG` / `INSIDER` / `LECTOR` (user-tier categories) — purple / blue / neutral

Renders `userCategory` for `role: 'user'` instead of the bare `LECTOR` label — more informative.

## TÚ indicator

When `node.authorId === currentUser.id`, the article gets:

- Orange-tinted left rail (2px solid `#F97316`)
- Subtle `rgba(249,115,22,0.04)` background tint
- `[TÚ]` chip alongside the role badge

Reads as "this is yours" without screaming at the reader.

## Reactions

ASCII palette only — never emoji. Order: `[+]` resonates · `[−]` disagree · `[?]` provocative · `[!]` signal. All four buttons render regardless of count so users can add reactions; clicking when logged out opens [[LoginOverlay]] via `useAuth().openLogin()`. Active state highlights the user's own reactions in orange.

## Tombstone

Comments with `deletion` set render a moderator-deletion stub `//ELIMINADO·POR·MODERACIÓN` showing the moderator's username and reason. Replies are preserved as children — Reddit-style.

## Focus pulse

When `focusedCommentId` matches a node's id (deep-link from [[SavedCommentsSection]]'s `ABRIR EN OVERLAY`), the article:

- Gets the `comment-focus-flash` class — a one-shot 2.4s cyan outline pulse defined in `globals.css`. No `fill-mode` so the outline fully reverts.
- Calls `scrollIntoView({ behavior: 'smooth', block: 'center' })` after a 600ms delay so the column finishes its slide-in first.

## Reply composer

Each comment renders a `<CommentComposer variant="reply" parentId={node.id} />` below its body — collapsed to a `↳ RESPONDER` trigger by default.

## Links

- [[CommentsColumn]] · [[CommentComposer]] · [[comments]] · [[mockComments]]
- [[mockUsers]] — role + category label maps
- [[No Algorithm]] · [[Guides Not Gatekeepers]]
