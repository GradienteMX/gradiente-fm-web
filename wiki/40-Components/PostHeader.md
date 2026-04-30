---
type: component
status: current
tags: [foro, post, header, badges, ranks]
updated: 2026-04-29
---

# PostHeader

> Identity + timestamp + post-id chrome at the top of each post (OP and replies) inside [[ThreadOverlay]]. Same badge-stack idiom as [[CommentList]]'s `AuthorBadges` so the foro and comment columns read the same.

## Source

[components/foro/PostHeader.tsx](../../components/foro/PostHeader.tsx)

## Layout

One flex-wrap row: primary chip · flag chips · `@username` · `[TÚ]` (when own) · timestamp · `>>postid` (right-aligned, clickable).

## Badge stack

Computed via `badgeFor(user, rank)` + `flagsFor(user)` from [[mockUsers]], with the rank derived live by `useUserRank(authorId)` from [[comments]].

**Primary chip:**
- staff (`admin` / `insider` / `guide` / `curator`) → role label/color (ADMIN orange, INSIDER cyan, GUÍA green, CURADOR violet)
- `user` tier → derived rank (NORMIE grey, DETONADOR red, ENIGMA violet, ESPECTRO magenta-pink)

**Sibling flag chips** (rendered after the primary):
- MOD red `#E63329` when `isMod`
- OG amber-gold `#FBBF24` when `isOG`

A user-tier mod shows their derived rank as the primary chip, with the MOD chip beside it. See [[Roles and Ranks]] for the full design.

## TÚ marker (header)

When `currentUser.id === authorId`, an orange `[TÚ]` chip renders next to the username. This is the post-level "this is yours" indicator. The complementary inline-quote `TÚ` chip (rendered by [[ThreadOverlay]]'s BodyText when `>>id` cites the current user's post) handles the "someone is replying to me" case.

## Post id (right side)

Clickable button that fires `onIdClick`. [[ThreadOverlay]] uses this to seed [[ReplyComposer]] with `>>id` and scroll-to-composer — the imageboard "quote this post" gesture.

## Links

- [[ThreadOverlay]] · [[ReplyComposer]]
- [[mockUsers]] — `badgeFor` / `flagsFor` and the label/color maps
- [[permissions]] — `getUserRank` / `useUserRank`
- [[CommentList]] — analogous badge stack for the comments column
- [[Roles and Ranks]] — the role/flag/rank design
