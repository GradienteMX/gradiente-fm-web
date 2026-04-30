---
type: component
status: current
tags: [foro, overlay, thread, imageboard, moderation]
updated: 2026-04-29
---

# ThreadOverlay

> Modal showing one thread: OP at top, replies flat (no nesting), reply composer pinned at the bottom of the scroll. Imageboard layout — image floated left of body, `>>id` quote-tokens as clickable buttons.

## Source

[components/foro/ThreadOverlay.tsx](../../components/foro/ThreadOverlay.tsx)

## Why a foro-specific overlay (not [[OverlayShell]])

The shared [[OverlayShell]] is shaped around a `ContentItem` with type chrome, comments column, save button, share button. Threads aren't `ContentItem`s and shouldn't have those affordances. A foro-specific shell keeps the chrome focused: id + reply count + close.

## Body parsing

`BodyText` splits the body on `/(>>[a-z0-9-]+)/gi`. Tokens become orange `<button>` chips that call `focusPost(id)` (scroll-into-view + 1.6s pulse on the target post via `data-postid` lookup). Plain text segments render as `<span>`.

## Backlinks

A reverse-quote map `inboundIndex: Map<postId, replyId[]>` is built once per replies-change via `useMemo` by inverting each reply's `quotedReplyIds`. Renders as a small `respondieron: >>id1 >>id2 …` line under each post header — only when the post has inbound replies (no empty line for unanswered posts).

## TÚ marker on quote-tokens

`authorByPostId: Map<postId, authorId>` and `isQuoteToMe(id)` helper. When a `>>id` token's target is authored by the current user, the BodyText renders an orange `TÚ` chip next to it. Surfaces "someone is replying to me" without forcing the reader to scan the thread for the cited post. PostHeader already handles the "this post is mine" indicator on the post itself; this extends the affordance to inline citations.

## Quote-back composer flow

Clicking a post-id button in the header (`>>fp-001-02`) calls `quotePost(id)`:

- Adds id to `pendingQuote` state.
- Bumps `composerKey` state to remount [[ReplyComposer]] so its `useState(initial)` re-runs with the new `initialQuotedIds` prop.
- Scrolls the composer into view after 50ms.

After the composer posts, `pendingQuote` clears and `composerKey` bumps again so the next session starts fresh.

## Image float

Imageboard convention: OP and replies that have `imageUrl` get the image floated left of the body via `float-left mb-2 mr-3 max-w-[200px] sm:max-w-[260px]`. The body wraps. A `<div className="clear-both" />` after the body prevents float bleed into the next post.

## ESC + body-scroll lock

ESC closes the overlay. `document.body.style.overflow = 'hidden'` while open; restored on unmount.

## Moderation tools

`canModerate(currentUser)` (mod flag or admin role) flips the `isMod` boolean threaded through the article components. When true, each post (OP and every reply) renders a small red `BORRAR HILO` / `BORRAR` button (Trash2 icon) in the top-right of its header strip. Click → `window.prompt('Razón…')` → `tombstoneThread` / `tombstoneReply` from [[foro]].

**Tombstone rendering.** `Tombstone` component (mirror of the [[CommentList]] tombstone) replaces the post body with a `//HILO·ELIMINADO·POR·MODERACIÓN` or `//RESPUESTA·ELIMINADO·POR·MODERACIÓN` block + `@mod · RAZÓN: …`. The article container, `PostHeader`, and `Backlinks` continue to render normally so quote-IDs and `>>id` navigation still work (and so a moderator's pruning is visible in context, not erased). When the viewer is a mod, a small orange `RESTAURAR` chip (RotateCcw icon) sits inline with the tombstone heading; click → `clearTombstone(postId)` from [[foro]] → catalog re-includes the thread, body restores.

**Composer closure.** When the thread itself is tombstoned, the `ReplyComposer` is replaced with a `//HILO·CERRADO·POR·MODERACIÓN — no se aceptan respuestas nuevas.` notice. Tombstoned threads are also dropped from the catalog by [[foro]]'s `getMergedThreads`, but `?thread=<id>` still resolves so the reason is reachable.

**Prompt UI.** The reason is collected via [[PromptOverlay]]'s `input` mode (NGE-styled, eva-box chrome). Replaced the earlier `window.prompt()` stand-in.

## Links

- [[Foro]] · [[ForoCatalog]] · [[PostHeader]] · [[ReplyComposer]]
- [[foro]] — `useThread` / `useReplies` / `tombstoneThread` / `tombstoneReply`
- [[permissions]] — `canModerate` (the mod-tool gate)
- [[Roles and Ranks]] — the role/flag model `canModerate` consumes
- [[useAuth]] — current user resolution for the `TÚ` marker
- [[Contained Single Surface]] — applies within the foro destination
