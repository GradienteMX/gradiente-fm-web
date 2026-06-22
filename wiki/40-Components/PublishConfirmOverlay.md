# PublishConfirmOverlay

> `components/publish/PublishConfirmOverlay.tsx` — globally-mounted confirmation modal for publishing a draft.

## What it does

Opens when `usePublishConfirm.confirmingId` is set — triggered from:
- Dashboard form's `▶ PUBLICAR` button
- Draft overlay's `▶ PUBLICAR AHORA` action

On **confirm**:
1. Closes the modal immediately (so the modal dismisses via its own state, not via the draft being pulled out from under the render)
2. Drops the draft from the local drafts cache optimistically (`removeDraftLocal`)
3. Awaits `publishItem(payload)` to POST to the API
4. On success: clears the per-type composer's sessionStorage autosave (`gradiente:dashboard:<type>-draft`), then navigates to `/?fresh=<id>` so the user sees their card surface in the feed

On **cancel**: clears modal state only — the draft stays in storage.

## State model

Backed by `usePublishConfirm` (context in `components/publish/usePublishConfirm.tsx`). `confirmingId` is the draft item's ID; `closeConfirm` clears it.

## UX details

- Body scroll locked while open
- ESC closes
- Auto-focuses the cancel button on open (safer default)
- z-index 70 — above overlays (z-50) and [[PromptOverlay]]

## Related

- [[Publish Confirmation Flow]] — the three-state model (draft / pending / published)
- [[Dashboard Forms]] — where `▶ PUBLICAR` is triggered
- [[drafts]] — `publishItem`, `getItemById`
