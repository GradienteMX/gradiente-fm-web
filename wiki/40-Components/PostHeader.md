---
type: component
status: current
tags: [foro, post, header]
updated: 2026-04-26
---

# PostHeader

> Identity + timestamp + post-id chrome at the top of each post (OP and replies) inside [[ThreadOverlay]].

## Source

[components/foro/PostHeader.tsx](../../components/foro/PostHeader.tsx)

## Layout

One flex-wrap row: role badge · `@username` · `[TÚ]` (when own) · timestamp · `>>postid` (right-aligned, clickable).

## Role colors

- `admin` — orange `#F97316`
- `moderator` — red `#E63329`
- `collaborator` — green `#4ADE80` (label `REDACCIÓN`)
- `user` — colored by `userCategory`:
  - `og` — violet `#A78BFA`
  - `insider` — cyan `#22D3EE`
  - `normal` — neutral grey `#9CA3AF`

`badgeFor(user)` from [[mockUsers]] resolves the label.

## TÚ marker (header)

When `currentUser.id === authorId`, an orange `[TÚ]` chip renders next to the username. This is the post-level "this is yours" indicator. The complementary inline-quote `TÚ` chip (rendered by [[ThreadOverlay]]'s BodyText when `>>id` cites the current user's post) handles the "someone is replying to me" case.

## Post id (right side)

Clickable button that fires `onIdClick`. [[ThreadOverlay]] uses this to seed [[ReplyComposer]] with `>>id` and scroll-to-composer — the imageboard "quote this post" gesture.

## Helper export

`inlineRoleLabel(authorId)` exposed for non-overlay surfaces (currently unused but kept for callers that need a tiny role label without rendering the full header).

## Links

- [[ThreadOverlay]] · [[ReplyComposer]]
- [[mockUsers]] — role + category labels and color resolution
- [[CommentList]] — analogous role-badge pattern for the comments column
