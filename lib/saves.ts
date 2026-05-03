'use client'

// ── Saves store (transitional) ──────────────────────────────────────────────
//
// MIGRATION STATE (2026-05-03):
//   - `isItemSaved` / `useIsItemSaved` / `toggleSavedItem` → moved to API +
//     module-scoped cache (lib/itemSavesCache.ts). Symmetric with
//     lib/comments.ts toggleSavedComment.
//   - `useSavedItems` / `getSavedItems` / `clearSavedItems` → STILL on
//     sessionStorage. Dashboard view migrations (`Guardados/*`) follow in a
//     later slice and will swap them to a Supabase select joining
//     user_saves + items. Until then these read an empty array because no
//     writer populates the session anymore.
//
// When the dashboard slice lands:
//   - Drop the SessionState block + the listener registry below.
//   - Re-implement `useSavedItems` against `lib/data/items.ts` filtered by
//     the cached ids.

import { useEffect, useState } from 'react'
import type { ContentItem } from './types'
import { MOCK_ITEMS } from './mockData'
import { getItemById as getDraftItemById } from './drafts'
import {
  addSavedItemIdLocal,
  isItemSavedSync,
  removeSavedItemIdLocal,
  subscribeSavedItems,
} from './itemSavesCache'

const STORAGE_KEY = 'gradiente:saves'

interface SessionState {
  savedIds: string[]
}

function emptyState(): SessionState {
  return { savedIds: [] }
}

function readSession(): SessionState {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    return {
      savedIds: Array.isArray(parsed?.savedIds) ? parsed.savedIds : [],
    }
  } catch {
    return emptyState()
  }
}

function writeSession(s: SessionState) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {}
}

const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((fn) => fn())
}

// Resolve a saved id to a ContentItem — tries MOCK_ITEMS first, falls back
// to the user's session-published drafts. Returns null if the id no longer
// resolves (e.g. user deleted the draft after saving it).
function resolveItem(id: string): ContentItem | null {
  const mock = MOCK_ITEMS.find((i) => i.id === id)
  if (mock) return mock
  const draft = getDraftItemById(id)
  if (draft) return draft
  return null
}

// ── Public API ─────────────────────────────────────────────────────────────

export function isItemSaved(itemId: string): boolean {
  return isItemSavedSync(itemId)
}

// Optimistic: update the local cache first so the UI flips instantly, then
// call the API. Rollback on failure. Mirrors toggleSavedComment.
export async function toggleSavedItem(itemId: string) {
  const wasSaved = isItemSavedSync(itemId)
  if (wasSaved) {
    removeSavedItemIdLocal(itemId)
    try {
      const res = await fetch(`/api/saves/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) addSavedItemIdLocal(itemId)  // rollback
    } catch {
      addSavedItemIdLocal(itemId)
    }
  } else {
    addSavedItemIdLocal(itemId)
    try {
      const res = await fetch(`/api/saves/items/${itemId}`, { method: 'POST' })
      if (!res.ok) removeSavedItemIdLocal(itemId)  // rollback
    } catch {
      removeSavedItemIdLocal(itemId)
    }
  }
}

export function clearSavedItems() {
  writeSession(emptyState())
  notify()
}

// Returns saved items in save-order (most-recent saves last in storage).
// Items whose ids no longer resolve are silently dropped — keeps the UI
// from showing ghost rows when the user deletes a draft they had saved.
export function getSavedItems(): ContentItem[] {
  const s = readSession()
  const out: ContentItem[] = []
  for (const id of s.savedIds) {
    const item = resolveItem(id)
    if (item) out.push(item)
  }
  return out
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useSavedItems(): ContentItem[] {
  const [items, setItems] = useState<ContentItem[]>([])
  useEffect(() => {
    const refresh = () => setItems(getSavedItems())
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [])
  return items
}

// Tracks whether `itemId` is in the user's saved set. Subscribes to the
// shared cache (lib/itemSavesCache) — re-renders when any save/unsave
// fires, including those triggered elsewhere in the tree.
export function useIsItemSaved(itemId: string): boolean {
  const [saved, setSaved] = useState(() => isItemSavedSync(itemId))
  useEffect(() => {
    const refresh = () => setSaved(isItemSavedSync(itemId))
    refresh()
    return subscribeSavedItems(refresh)
  }, [itemId])
  return saved
}
