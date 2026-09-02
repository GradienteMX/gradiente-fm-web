'use client'

// ── Compose logic kit — what SURVIVED the dark forms (fase F) ───────────────
//
// This file was the shared field library of the dark per-type forms. Those
// forms, and every dark field widget in here, were deleted in fase F: the
// pliego compose tree (components/dashboard/compose/**) had already forked
// each widget into a light counterpart, and /admin migrated to those forks,
// leaving ~1,050 lines with no caller and a pile of comments elsewhere
// promising a "dark original" that nothing rendered.
//
// What is left is the part that was never about chrome:
//   · slugify           — the one slug rule (27 call sites)
//   · CommitFlash       — the save/publish flash type
//   · SaveIndicator     — the autosave readout
//   · newItemId         — re-exported from lib/drafts so composers have one door
//   · useDraftWorkbench — the draft engine: edit-keyed sessionStorage slots,
//                         wait-for-cache ?edit hydration, URL-anchored publish
//                         mode. Its three shipped data-loss fixes live here
//                         and are reused, never reimplemented.
//
// Nothing here renders chrome any more. A new field belongs in
// components/dashboard/compose/kit/, not in this file.

import { useEffect, useRef, useState } from 'react'
import type { ContentItem } from '@/lib/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

// ── Submit footer ───────────────────────────────────────────────────────────

export type CommitFlash = 'draft' | 'published' | null

// Displays a relative-time autosave indicator. Updates every 5 seconds.
export function SaveIndicator({ lastSavedAt }: { lastSavedAt: number | null }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (lastSavedAt === null) return
    const id = setInterval(() => setTick((t) => t + 1), 5000)
    return () => clearInterval(id)
  }, [lastSavedAt])

  if (lastSavedAt === null) {
    return (
      <span className="font-mono text-[10px] tracking-widest text-muted">
        ◌ AUTOSAVE INACTIVO
      </span>
    )
  }

  const ageSec = Math.max(0, Math.floor((Date.now() - lastSavedAt) / 1000))
  const label =
    ageSec < 5
      ? 'AHORA'
      : ageSec < 60
        ? `HACE ${ageSec}s`
        : ageSec < 3600
          ? `HACE ${Math.floor(ageSec / 60)}m`
          : `HACE ${Math.floor(ageSec / 3600)}h`

  return (
    <span className="font-mono text-[10px] tracking-widest text-muted">
      ◉ AUTOSAVE · {label}
    </span>
  )
}

// Re-exported so forms have a single import surface.
export { newItemId } from '@/lib/drafts'

// ── useDraftWorkbench ───────────────────────────────────────────────────────
//
// Owns autosave + commit + reset logic shared across every dashboard form.
// Each form keeps its own draft state + form-specific concerns (slug
// auto-generation, etc.); this hook handles:
//
//   - Hydrating draft + committedId + isPublished from sessionStorage on mount
//   - Persisting on every change (and stamping `lastSavedAt`)
//   - `saveDraft()` and `publish()` that upsert into the shared drafts store
//     under a stable id (generated lazily on first commit)
//   - `reset()` that wipes both the in-progress draft and any committed item
//   - A transient `flash` state for the SubmitFooter confirmation chip

import type { DraftItem, DraftState, PublishMode } from '@/lib/drafts'
import {
  upsertItem as _commitItem,
  newItemId as _newItemId,
  removeItem,
  getItemById,
} from '@/lib/drafts'
import { subscribeDrafts } from '@/lib/draftsCache'
import { subscribePublishedItems } from '@/lib/publishedItemsCache'

interface DraftWorkbenchPersisted<T extends ContentItem> {
  draft: T
  committedId: string | null
  isPublished: boolean
}

export function useDraftWorkbench<T extends ContentItem>({
  draftKey,
  emptyFn,
  draft,
  setDraft,
  editItemId = null,
}: {
  draftKey: string
  emptyFn: () => T
  draft: T
  setDraft: (t: T) => void
  /**
   * If set, on mount the form hydrates from this stored item instead of the
   * per-form local-draft key. Wires the edit-published-or-draft flow — the
   * form pre-populates with the item's data and binds `committedId` to its
   * id, so subsequent saves/publishes UPDATE the same row.
   */
  editItemId?: string | null
}) {
  const [committedId, setCommittedId] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [flash, setFlash] = useState<CommitFlash>(null)
  const [isPublished, setIsPublished] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Edit sessions get their OWN storage key (`…-draft:edit:<id>`), separate
  // from the new-compose slot (`…-draft`). Previously both shared one per-type
  // key, so merely opening a published item wrote its id into the slot and the
  // next NUEVO compose resumed it — silently rebinding a "new" publish onto the
  // published item (the Report A overwrite). Separate keys break that link.
  const storageKey = editItemId ? `${draftKey}:edit:${editItemId}` : draftKey

  // Hydrate — prefer the editItemId from the URL over the local slot. Re-runs
  // when editItemId changes (feed-overlay EDITAR / back-forward between edits).
  useEffect(() => {
    let cancelled = false

    const applyExisting = (existing: DraftItem) => {
      if (cancelled) return
      // Strip the frontend-only flag before slotting into form state.
      const { _draftState, ...clean } = existing
      // Double-cast through `unknown` because TS can't prove the runtime
      // narrowing matches the form's specific T (e.g. MixDraft) — at this
      // point we know the existing item's `type` matches the form.
      setDraft({ ...emptyFn(), ...(clean as unknown as T) })
      setCommittedId(existing.id)
      setIsPublished(existing._draftState === 'published')
      setLastSavedAt(Date.now())
      setHydrated(true)
    }

    if (editItemId) {
      const existing = getItemById(editItemId)
      if (existing) {
        applyExisting(existing)
        return
      }
      // The draft/published caches prime asynchronously (auth + dashboard-mount
      // fetch), so on a hard reload or deep link they may be empty right now.
      // Wait for the item to appear rather than falling through to the local
      // slot — that used to bind the WRONG id and duplicate the item on publish
      // (or mint a fresh row). Stay unhydrated (form disabled) until it lands.
      setHydrated(false)
      let done = false
      let unsubD = () => {}
      let unsubP = () => {}
      const attempt = () => {
        if (cancelled || done) return
        const found = getItemById(editItemId)
        if (found) {
          done = true
          applyExisting(found)
          unsubD()
          unsubP()
        }
      }
      unsubD = subscribeDrafts(attempt)
      unsubP = subscribePublishedItems(attempt)
      return () => {
        cancelled = true
        unsubD()
        unsubP()
      }
    }

    // New-compose: hydrate from the per-type slot. Edit sessions use a separate
    // key, so opening a published item can no longer poison this one.
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DraftWorkbenchPersisted<T>>
        if (parsed.draft) setDraft({ ...emptyFn(), ...parsed.draft })
        if (parsed.committedId) setCommittedId(parsed.committedId)
        if (parsed.isPublished) setIsPublished(parsed.isPublished)
        if (parsed.draft) setLastSavedAt(Date.now())
      }
    } catch {}
    setHydrated(true)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editItemId])

  // Autosave on every change (post-hydration only — avoids overwriting
  // freshly-loaded state with the empty-default snapshot).
  useEffect(() => {
    if (!hydrated) return
    try {
      const payload: DraftWorkbenchPersisted<T> = {
        draft,
        committedId,
        isPublished,
      }
      sessionStorage.setItem(storageKey, JSON.stringify(payload))
      setLastSavedAt(Date.now())
    } catch {}
  }, [draft, committedId, isPublished, hydrated, storageKey])

  const commit = (state: DraftState, opts?: { localOnly?: boolean }): string => {
    const id = committedId ?? _newItemId(draft.type)
    const item = { ...draft, id, publishedAt: new Date().toISOString() }
    _commitItem(item, state, opts)
    setCommittedId(id)
    setIsPublished(state === 'published')
    setFlash(state)
    setTimeout(() => setFlash(null), 2500)
    return id
  }

  const saveDraft = () => commit('draft')
  // Reserves the item as a draft and returns its id so the caller can route
  // the editor to the publish-confirmation flow (see [[Publish Confirmation Flow]]).
  // The state transition to 'published' happens only after the editor confirms
  // via [[PublishConfirmOverlay]] — never directly from the form.
  const requestPublish = (): string => {
    // localOnly: seed the drafts CACHE (so the confirm overlay can resolve the
    // item) but DON'T POST a server draft row. The publish creates the items
    // row directly, so there's no server draft to race-delete → no durable
    // "zombie" draft carrying the published id (finding #6).
    const id = commit('draft', { localOnly: true })
    // Suppress the "DRAFT GUARDADO" flash since the editor pressed PUBLICAR,
    // not SAVE — they shouldn't see a "saved" confirmation chip.
    setFlash(null)
    return id
  }

  // Create-vs-edit intent for the publish guard, derived from the ENTRY POINT
  // (?edit=<id> present ⇒ editing an existing item; absent ⇒ NUEVO). This is
  // deliberately NOT read from `committedId`/`isPublished`: those are restored
  // from the per-type sessionStorage slot, which a prior edit-open can poison
  // with a published item's id. Anchoring to the URL keeps a NUEVO compose a
  // 'create' even when its slot carries a stale id — so the server rejects the
  // overwrite and the client re-keys to a fresh id instead of clobbering the
  // original. On success the composer unmounts (nav to feed), so there is no
  // same-session re-publish that would need to flip to 'edit'.
  const publishMode: PublishMode = editItemId ? 'edit' : 'create'

  const reset = () => {
    // Editing an existing item: "reset" REVERTS to the stored version rather
    // than blanking. Blanking used to detach committedId, so a subsequent
    // publish minted a NEW id and duplicated the item (finding #23). Never
    // deletes the underlying published/draft row.
    if (editItemId) {
      const existing = getItemById(editItemId)
      if (existing) {
        const { _draftState, ...clean } = existing
        setDraft({ ...emptyFn(), ...(clean as unknown as T) })
        setCommittedId(existing.id)
        setIsPublished(existing._draftState === 'published')
        setFlash(null)
        try {
          sessionStorage.removeItem(storageKey)
        } catch {}
        return
      }
    }
    // New-compose: clear the form. If a DB draft was already saved, confirm
    // before discarding it (destructive — it holds the only copy).
    if (committedId && getItemById(committedId)) {
      const ok =
        typeof window === 'undefined' ||
        window.confirm('¿Descartar este borrador? No se puede deshacer.')
      if (!ok) return
      removeItem(committedId)
    }
    setDraft(emptyFn())
    setCommittedId(null)
    setIsPublished(false)
    setLastSavedAt(null)
    setFlash(null)
    try {
      sessionStorage.removeItem(storageKey)
    } catch {}
  }

  return {
    committedId,
    lastSavedAt,
    flash,
    isPublished,
    publishMode,
    saveDraft,
    requestPublish,
    reset,
  }
}
