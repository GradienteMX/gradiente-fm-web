---
type: component
status: current
tags: [foro, composer, reply]
updated: 2026-04-26
---

# ReplyComposer

> Pinned-bottom reply form inside [[ThreadOverlay]]. Login-gated, optional image, parses `>>id` quote-tokens from body.

## Source

[components/foro/ReplyComposer.tsx](../../components/foro/ReplyComposer.tsx)

## Why a separate composer (not [[CommentComposer]])

[[CommentComposer]] is shaped for a tree (root vs reply variants, parentId nesting, reactions). Foro replies are flat with `>>id` quote-links instead of nesting and have no reactions — the data model and the affordances diverge enough that sharing would be premature abstraction.

## Login gate

Logged-out viewers see `[+] INICIA SESIÓN PARA RESPONDER` — clicking calls `useAuth().openLogin()`.

## Quote-token parsing

`extractQuotedIds(text)` matches `/>>([a-z0-9-]+)/gi` and dedupes. Resulting ids are stored on `reply.quotedReplyIds` so [[ThreadOverlay]] can build the inbound-reply backlinks index without re-parsing every render.

## initialQuotedIds prop

[[ThreadOverlay]] feeds quote-back ids when the user clicks a post-id chip. The composer pre-fills the textarea with `>>id1 >>id2 ` (trailing space) so the user can keep typing. Implementation note: `key={composerKey}` in the parent forces remount on quote-back, which re-runs the `useState(initial)` to apply the new prop — uncontrolled inputs aren't reset by prop changes alone.

## Image attachment (optional)

`FileReader.readAsDataURL` like [[NewThreadOverlay]]. Preview shown with a small X button to clear. Replies aren't required to have an image (only OPs are).

## Keyboard

- `Enter` → submit
- `Shift+Enter` → newline
- `Escape` → clear body + clear image

## Submit flow

Builds a `ForoReply` with `newReplyId(threadId)` from [[foro]], conditionally includes `imageUrl` and `quotedReplyIds`, calls `addReply(reply)` which persists + bumps the parent thread.

## Links

- [[Foro]] · [[ThreadOverlay]] · [[NewThreadOverlay]]
- [[foro]] — `addReply` + `newReplyId`
- [[useAuth]] — login gate
- [[CommentComposer]] — sibling composer for the comment column
