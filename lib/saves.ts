'use client'

// ── Frontend-only saves store ───────────────────────────────────────────────
//
// User-bookmarked content items (publications). SessionStorage-backed —
// survives reloads, dies with the tab. Same lifecycle as [[drafts]] /
// [[comments]]. Real backend keys per-user; this prototype is shared within
// the tab.
//
// Resolves saved ids across BOTH the canonical mock catalog (MOCK_ITEMS)
// and the user's session-published drafts (getItemById from drafts.ts), so
// items the user has self-published in the prototype are saveable too.
//
// When the real backend (see [[Supabase Migration]]) lands:
//   - Replace `useSavedItems` with a Supabase select joining the user's
//     bookmarks + content_items.
//   - Replace `toggleSavedItem` with an upsert RPC.
//   - Drop the listener registry in favor of Supabase Realtime.

import { useEffect, useState } from 'react'
import type { ContentItem } from './types'
import { MOCK_ITEMS } from './mockData'
import { getItemById as getDraftItemById } from './drafts'

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
  return readSession().savedIds.includes(itemId)
}

export function toggleSavedItem(itemId: string) {
  const s = readSession()
  s.savedIds = s.savedIds.includes(itemId)
    ? s.savedIds.filter((id) => id !== itemId)
    : [...s.savedIds, itemId]
  writeSession(s)
  notify()
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

export function useIsItemSaved(itemId: string): boolean {
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    const refresh = () => setSaved(isItemSaved(itemId))
    refresh()
    listeners.add(refresh)
    return () => {
      listeners.delete(refresh)
    }
  }, [itemId])
  return saved
}
