---
type: component
status: current
tags: [comments, threading, ranks, badges]
updated: 2026-04-29
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

## Author badges (`AuthorBadges`)

A primary chip plus optional sibling flag chips, all rendered next to the username. Computed from `badgeFor(user, rank)` + `flagsFor(user)` in [[mockUsers]].

**Primary chip** — branches on `user.role`:

- staff (`admin` / `insider` / `guide` / `curator`) → role label & color
- `user` tier → derived rank label & color via `useUserRank(authorId)` from [[comments]]: `NORMIE` / `DETONADOR` / `ENIGMA` / `ESPECTRO`

**Sibling chips** — render in addition to the primary:

- `MOD` (sys-red `#E63329`) when `isMod`
- `OG` (amber-gold `#FBBF24`) when `isOG`

Both flags are orthogonal to role — a user-tier mod still shows their derived rank as the primary chip, with the MOD red chip alongside. See [[Roles and Ranks]] for the full design.

## TÚ indicator

When `node.authorId === currentUser.id`, the article gets:

- Orange-tinted left rail (2px solid `#F97316`)
- Subtle `rgba(249,115,22,0.04)` background tint
- `[TÚ]` chip alongside the role badge

Reads as "this is yours" without screaming at the reader.

## Reactions

Two ASCII glyphs — `[?]` provocative, `[!]` signal. The `[+]`/`[−]` palette was dropped (see [[Roles and Ranks]] for the design rationale). Both buttons always render regardless of count so users can pick a side; clicking when logged out opens [[LoginOverlay]] via `useAuth().openLogin()`. Active state highlights the user's own reaction in orange.

A user holds at most one reaction per comment — clicking the *other* kind replaces, clicking the *same* kind clears. Enforced by `toggleReaction` in [[comments]].

## Delete affordances + tombstone

Each comment renders a small red `BORRAR` chip in the meta strip when the viewer can delete it:

- **Author self-delete** — visible on your own comments. Click → [[PromptOverlay]] `confirm` (no reason needed) → `tombstoneComment(commentId, currentUser.id, '')`. Tombstone renders as `//ELIMINADO·POR·AUTOR` with no reason line.
- **Mod-delete** — visible to anyone with `canModerate(currentUser)` from [[permissions]]. Click → `PromptOverlay` `input` with placeholder `spam · acoso · off-topic · …` → `tombstoneComment(commentId, modId, reason)`. Tombstone renders as `//ELIMINADO·POR·MODERACIÓN @mod · RAZÓN: …`.

Both flows route through the same `Tombstone` component which branches on `deletion.moderatorId === comment.authorId`. Replies under a tombstoned comment are preserved (Reddit-style) — the tombstone replaces the body only.

**Revert.** When the viewer is a mod or the original actor, an orange `RESTAURAR` chip (RotateCcw icon) sits inline with the tombstone heading. Click → `clearCommentDeletion(commentId)` from [[comments]] → body restores. Authors get the affordance on their own self-deletes so an accidental click is recoverable; mods get it on any tombstone.

## Focus pulse

When `focusedCommentId` matches a node's id (deep-link from [[SavedCommentsSection]]'s `ABRIR EN OVERLAY`), the article:

- Gets the `comment-focus-flash` class — a one-shot 2.4s cyan outline pulse defined in `globals.css`. No `fill-mode` so the outline fully reverts.
- Calls `scrollIntoView({ behavior: 'smooth', block: 'center' })` after a 600ms delay so the column finishes its slide-in first.

## Reply composer

Each comment renders a `<CommentComposer variant="reply" parentId={node.id} />` below its body — collapsed to a `↳ RESPONDER` trigger by default.

## Links

- [[CommentsColumn]] · [[CommentComposer]] · [[comments]] · [[mockComments]]
- [[mockUsers]] — `badgeFor` / `flagsFor` and the label/color maps
- [[permissions]] — `getUserRank` / `useUserRank` / `canModerate` / `canDeleteOwnComment`
- [[PromptOverlay]] — the NGE prompt the delete flow consumes
- [[Roles and Ranks]] · [[No Algorithm]] · [[Guides Not Gatekeepers]]
