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
  subscribeSavedItem,
} from './itemSavesCache'
import { recordHpEvent } from './hpEvents'

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
      else recordHpEvent(itemId, 'save')
    } catch {
      removeSavedItemIdLocal(itemId)
    }
  }
}

// ── Hooks ──────────────────────────────────────────────────────────────────

// Tracks whether `itemId` is in the user's saved set. Subscribes PER-KEY to
// the shared cache (lib/itemSavesCache) — re-renders only when THIS item's
// saved state may have changed (its own toggle or a bulk auth replace), not on
// every save/unsave elsewhere in the tree (the home grid has ~140 of these).
export function useIsItemSaved(itemId: string): boolean {
  const [saved, setSaved] = useState(() => isItemSavedSync(itemId))
  useEffect(() => {
    const refresh = () => setSaved(isItemSavedSync(itemId))
    refresh()
    return subscribeSavedItem(itemId, refresh)
  }, [itemId])
  return saved
}
