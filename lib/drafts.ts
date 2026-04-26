'use client'

// ── Frontend-only drafts/published store ────────────────────────────────────
//
// Visual-prototype scaffolding for the dashboard publish workflow. Lives in
// sessionStorage — survives page reloads, dies when the browser tab closes.
// Nobody else sees these items; they're scoped to the editor's session.
//
// When the real backend (see [[Supabase Migration]]) lands:
//   - Replace getAllItems() with a Supabase select
//   - Replace upsertItem() with insert/update RPC calls
//   - Replace removeItem() with a delete RPC
//   - Drop the listeners pattern in favor of Supabase Realtime
// Every consumer keeps using the same hook signature, no UI rework.

import type { ContentItem } from './types'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'gradiente:dashboard:items'

export type DraftState = 'draft' | 'published'

// Frontend-only metadata layered on top of the canonical ContentItem shape.
// The leading underscore signals these never round-trip to a backend.
export interface DraftItem extends ContentItem {
  _draftState: DraftState
  _createdAt: string
  _updatedAt: string
}

// ── Storage primitives (safe on SSR) ────────────────────────────────────────

function readAll(): DraftItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (i): i is DraftItem =>
        i && typeof i.id === 'string' && (i._draftState === 'draft' || i._draftState === 'published'),
    )
  } catch {
    return []
  }
}

function writeAll(items: DraftItem[]) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {}
  notify()
}

// ── Subscription pump ───────────────────────────────────────────────────────
//
// sessionStorage doesn't fire `storage` events in the same tab, so we maintain
// a small in-memory listener set and notify on every mutation. Hooks subscribe
// in their own useEffect.

const listeners = new Set<() => void>()
function notify() {
  for (const fn of listeners) fn()
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getAllItems(): DraftItem[] {
  return readAll()
}

export function getItemById(id: string): DraftItem | null {
  return readAll().find((i) => i.id === id) ?? null
}

// Insert if new, update if id matches existing. Returns the resulting item.
export function upsertItem(
  item: ContentItem,
  state: DraftState,
): DraftItem {
  const all = readAll()
  const now = new Date().toISOString()
  const existingIdx = all.findIndex((i) => i.id === item.id)
  let next: DraftItem
  if (existingIdx >= 0) {
    next = {
      ...all[existingIdx],
      ...item,
      _draftState: state,
      _updatedAt: now,
    }
    all[existingIdx] = next
  } else {
    next = {
      ...item,
      _draftState: state,
      _createdAt: now,
      _updatedAt: now,
    }
    all.unshift(next) // newest first
  }
  // Cap to 50 to avoid sessionStorage bloat in the prototype.
  if (all.length > 50) all.length = 50
  writeAll(all)
  return next
}

export function removeItem(id: string): void {
  const all = readAll().filter((i) => i.id !== id)
  writeAll(all)
}

export function clearAll(): void {
  writeAll([])
}

// Generate a stable item id for first commit. Editors keep this id in their
// form state so subsequent saves UPDATE the same row instead of duplicating.
export function newItemId(type: string): string {
  return `local-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ── React hook ──────────────────────────────────────────────────────────────

export function useDraftItems(): DraftItem[] {
  // Start with [] on both server and first client render — read after mount
  // so SSR output matches initial CSR output (no hydration drift).
  const [items, setItems] = useState<DraftItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setItems(readAll())
    setHydrated(true)
    const fn = () => setItems(readAll())
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])

  return hydrated ? items : []
}
