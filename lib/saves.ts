'use client'

// ── Saves store ─────────────────────────────────────────────────────────────
//
// `isItemSaved` / `useIsItemSaved` / `toggleSavedItem` operate on the
// module-scoped Set in lib/itemSavesCache (loaded by AuthProvider on auth
// state change). The full saved-items list for dashboard surfaces lives in
// lib/hooks/useSavedItems (fetches against `items` + `polls` joined to the
// cached id set). Writes are optimistic + API-confirmed, mirror the
// toggleSavedComment shape in lib/comments.

import { useEffect, useState } from 'react'
import {
  addSavedItemIdLocal,
  isItemSavedSync,
  removeSavedItemIdLocal,
  subscribeSavedItems,
} from './itemSavesCache'

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

// ── Hooks ──────────────────────────────────────────────────────────────────

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
