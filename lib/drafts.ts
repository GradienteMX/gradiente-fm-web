'use client'

// ── Drafts / published store (transitional) ─────────────────────────────────
//
// MIGRATION STATE (2026-05-03):
//   - `_draftState === 'draft'` → `public.drafts` table.
//     `upsertItem(item, 'draft')` POSTs /api/drafts; the user's drafts are
//     loaded into `lib/draftsCache.ts` by AuthProvider on auth-state change.
//   - `_draftState === 'published'` → `public.items` table via POST
//     /api/items (upsert by id). The route handler also deletes the matching
//     draft row server-side, so a publish atomically promotes the row out
//     of `drafts` into `items`. The session-published list below stays as
//     an unused safety net — never written to on the new path.
//
// LIMITATION: the items table has no `author_id` column today, so "my
// published items" can't be filtered to the editor. The dashboard's drafts
// list shows DB drafts only after this slice. Listing published items per
// editor needs a follow-up migration adding `items.created_by`.
//
// `getItemById(id)` consults both stores: the DB-drafts cache first, then
// the session-published list. `removeItem(id)` likewise checks both — the
// caller doesn't know (or care) which store the id lives in.
//
// All getter shapes (`getAllItems`, `getItemById`, `useDraftItems`) stay
// synchronous so existing call sites don't change. Async writes
// (`upsertItem`, `removeItem`) are fire-and-forget for compatibility with
// the prior void return; the cache flips optimistically.

import { useEffect, useState } from 'react'
import type { ContentItem } from './types'
import {
  getAllDraftsSync,
  getDraftSync,
  removeDraftLocal,
  setDraftLocal,
  subscribeDrafts,
} from './draftsCache'
import { getPublishedItemSync } from './publishedItemsCache'

const STORAGE_KEY = 'gradiente:dashboard:items'

export type DraftState = 'draft' | 'published'

// Frontend-only metadata layered on top of the canonical ContentItem shape.
// The leading underscore signals these never round-trip to a backend AS-IS;
// `_draftState` is implicit (DB rows in `drafts` are always 'draft', the
// session list is always 'published').
export interface DraftItem extends ContentItem {
  _draftState: DraftState
  _createdAt: string
  _updatedAt: string
}

// ── Session-published storage (legacy path, deprecated) ────────────────────
//
// Held over from the prototype until the publishing slice routes through
// /api/items. Anything written here gets merged with DB-drafts at read
// time so the dashboard / home-feed views stay coherent during the cutover.

function readSessionPublished(): DraftItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (i): i is DraftItem =>
        i &&
        typeof i.id === 'string' &&
        i._draftState === 'published',
    )
  } catch {
    return []
  }
}

function writeSessionPublished(items: DraftItem[]) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {}
  notifySessionPublished()
}

const sessionListeners = new Set<() => void>()
function notifySessionPublished() {
  sessionListeners.forEach((fn) => fn())
}

// ── Public read API ────────────────────────────────────────────────────────

export function getAllItems(): DraftItem[] {
  return [...getAllDraftsSync(), ...readSessionPublished()]
}

export function getItemById(id: string): DraftItem | null {
  const fromCache = getDraftSync(id)
  if (fromCache) return fromCache
  // Published items the user authored (loaded by useMyPublishedItems).
  // Synthesize the DraftItem shape so the composer's hydration path
  // (useDraftWorkbench) treats it like a published draft and binds
  // `committedId` to the existing item id.
  const fromPublished = getPublishedItemSync(id)
  if (fromPublished) {
    const ts = fromPublished.publishedAt ?? new Date().toISOString()
    return {
      ...fromPublished,
      _draftState: 'published',
      _createdAt: ts,
      _updatedAt: ts,
    }
  }
  return readSessionPublished().find((i) => i.id === id) ?? null
}

// ── Public write API ───────────────────────────────────────────────────────

// Insert if new, update if id matches existing. The signature stays sync-void
// for back-compat with the prototype's call sites — under the hood, draft
// writes are fire-and-forget API calls; published writes are still session.
export function upsertItem(item: ContentItem, state: DraftState): DraftItem {
  const now = new Date().toISOString()
  if (state === 'draft') {
    const existing = getDraftSync(item.id)
    const next: DraftItem = {
      ...(existing ?? {}),
      ...item,
      _draftState: 'draft',
      _createdAt: existing?._createdAt ?? now,
      _updatedAt: now,
    }
    setDraftLocal(next)
    void postDraft(item)
    return next
  }
  // published → real publish via POST /api/items. The route handler upserts
  // into items, upserts the poll row if present, and deletes the matching
  // draft row server-side. Locally we drop the cached draft so the dashboard
  // drafts list updates immediately; the actual published item appears on
  // the home feed after the next server-component refresh (the caller —
  // PublishConfirmOverlay — does a router.refresh() to trigger it).
  const next: DraftItem = {
    ...item,
    _draftState: 'published',
    _createdAt: now,
    _updatedAt: now,
  }
  removeDraftLocal(item.id)  // optimistic — drafts list updates
  void publishItem(item)
  return next
}

export function removeItem(id: string): void {
  // DB draft path
  if (getDraftSync(id)) {
    removeDraftLocal(id)
    void deleteDraft(id)
    return
  }
  // Session-published path
  const all = readSessionPublished().filter((i) => i.id !== id)
  writeSessionPublished(all)
}

// `clearAll` wipes only the session-published store. The DB drafts persist;
// callers who need to wipe DB drafts iterate `removeItem` over the cache.
export function clearAll(): void {
  writeSessionPublished([])
}

// Generate a stable item id for first commit. Editors keep this id in their
// form state so subsequent saves UPDATE the same row instead of duplicating.
export function newItemId(type: string): string {
  return `local-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Internals: API plumbing ────────────────────────────────────────────────

async function postDraft(item: ContentItem): Promise<void> {
  try {
    const res = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ item }),
    })
    if (!res.ok) {
      // Optimistic cache already shows the write — leave it. Surface the
      // error in the console so we notice, but don't roll back: the user
      // probably retried because they saw their input land. Re-saves
      // re-attempt the upsert.
      console.error('[drafts] save failed:', await safeReadError(res))
    }
  } catch (e) {
    console.error('[drafts] save network error:', e)
  }
}

// Exposed so callers (PublishConfirmOverlay) can await the publish before
// triggering router.refresh() — otherwise the home-feed re-render races the
// API write and the just-published item might not appear until the next
// navigation.
export async function publishItem(item: ContentItem): Promise<{ ok: boolean }> {
  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ item }),
    })
    if (!res.ok) {
      console.error('[publish] failed:', await safeReadError(res))
      return { ok: false }
    }
    return { ok: true }
  } catch (e) {
    console.error('[publish] network error:', e)
    return { ok: false }
  }
}

async function deleteDraft(itemId: string): Promise<void> {
  try {
    const res = await fetch(`/api/drafts/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      console.error('[drafts] delete failed:', await safeReadError(res))
    }
  } catch (e) {
    console.error('[drafts] delete network error:', e)
  }
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body?.error ?? `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

// ── React hook ─────────────────────────────────────────────────────────────

export function useDraftItems(): DraftItem[] {
  // Start with [] on both server and first client render — read after mount
  // so SSR output matches initial CSR output (no hydration drift).
  const [items, setItems] = useState<DraftItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const refresh = () => setItems(getAllItems())
    refresh()
    setHydrated(true)
    // Re-render on either store changing.
    const unsubDrafts = subscribeDrafts(refresh)
    sessionListeners.add(refresh)
    return () => {
      unsubDrafts()
      sessionListeners.delete(refresh)
    }
  }, [])

  return hydrated ? items : []
}
