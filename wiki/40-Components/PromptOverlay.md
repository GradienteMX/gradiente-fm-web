---
type: component
status: current
tags: [prompt, modal, confirm, input, moderation]
updated: 2026-04-30
---

# PromptOverlay

> NGE-styled replacement for `window.confirm()` and `window.prompt()`. One global modal mounted at the layout root; consumers call `confirm(opts)` or `input(opts)` from [[usePrompt]] and await the user's response.

## Source

- [components/prompt/usePrompt.tsx](../../components/prompt/usePrompt.tsx) — provider + Promise-based hook
- [components/prompt/PromptOverlay.tsx](../../components/prompt/PromptOverlay.tsx) — the modal that renders the active prompt

## Why

`window.prompt()` works but breaks the project's visual language — it's the host browser's UI, not the GRADIENTE FM terminal aesthetic. Every prior consumer of it (foro mod tools, comment delete, future destructive flows) wants the same chrome the rest of the app uses: eva-box panel, scanlines, sys-orange / sys-red accents, ESC + backdrop close. One overlay covers all of them.

## API

```ts
const { confirm, input } = usePrompt()

const ok = await confirm({ title, body?, confirmLabel?, cancelLabel?, destructive? })
// → boolean

const value = await input({ ...same options, placeholder?, defaultValue? })
// → string | null  (null on cancel/dismiss)
```

`destructive: true` flips the confirm button color from sys-orange to sys-red — for delete / tombstone flows where the heavier visual weight matches the action.

## Two variants

- **Confirm:** title + optional body + two buttons. Title strip reads `//CONFIRMACIÓN·REQUERIDA`. ESC and backdrop click both resolve to `false`.
- **Input:** same chrome plus a single text field. Title strip reads `//ENTRADA·REQUERIDA`. ESC / backdrop / cancel resolves to `null`. Enter inside the field confirms (resolves to the trimmed value). The input auto-selects on open so `defaultValue` text is replaced by typing.

## Idiom

Mirrors [[PublishConfirmOverlay]]:

- `eva-box eva-scanlines overlay-panel-in` panel, `bg-base`.
- Fixed-position black backdrop with blur, click-outside resolves cancel.
- `role="alertdialog"` with `aria-labelledby` / `aria-describedby` wired to the title and body ids.
- Body scroll locked while open.
- Cancel button auto-focused on confirm; the input is auto-selected on input variant.

## Current consumers

- [[ThreadOverlay]] — `BORRAR HILO` and per-reply `BORRAR` use `input` with `destructive: true`.
- [[CommentList]] — author self-delete uses `confirm` (no reason needed); mod-delete uses `input` (reason required).

## Backend migration

The provider is purely client-side state — no Supabase impact. Consumers that gain server-side actions (e.g. real moderation) pass the resolved string into the RPC instead of the local writer. API doesn't change.

## Links

- [[usePrompt]] — the hook (re-exported alongside the overlay)
- [[ThreadOverlay]] · [[CommentList]] — current consumers
- [[PublishConfirmOverlay]] — visual idiom this matches
