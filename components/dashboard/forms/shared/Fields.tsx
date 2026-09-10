'use client'

// Shared draft persistence and compatibility exports for compose consumers.
// Field components live in components/dashboard/compose/kit.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ContentItem } from '@/lib/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

export { slugify, patchDraftContent } from '@/lib/draftContent'
import { readingMinutes } from '@/lib/draftContent'

// ── Submit footer ───────────────────────────────────────────────────────────

export type CommitFlash = 'draft' | 'published' | 'saving' | 'error' | null

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

// Account autosave and local recovery share a stable identity. Saving never
// publishes: only the explicit confirmation writes to items.
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth/useAuth'
import { DraftSaveQueue } from '@/lib/draftSaveQueue'
import { saveDraftItem, upsertItem, newItemId as makeId, getItemById } from '@/lib/drafts'
import type { DraftItem, PublishMode } from '@/lib/drafts'
import { subscribeDrafts } from '@/lib/draftsCache'
import { getPublishedItemSync, subscribePublishedItems } from '@/lib/publishedItemsCache'

export type DraftSyncState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'
interface Recovery<T> { draft: T; id: string; savedAt: number | null; pending: boolean }

export function useDraftWorkbench<T extends ContentItem>({
  draftKey, emptyFn, draft, setDraft, editItemId = null,
}: {
  draftKey: string; emptyFn: () => T; draft: T; setDraft: (draft: T) => void; editItemId?: string | null
}) {
  const { currentUser } = useAuth()
  const search = useSearchParams()
  const sessionId = search?.get('draft') ?? 'recovery'
  const account = currentUser?.id ?? 'anonymous'
  const storageKey = `gradiente:compose:${account}:${draftKey}:${editItemId ?? sessionId}`
  const [committedId, setCommittedId] = useState<string | null>(editItemId)
  const idRef = useRef<string | null>(editItemId)
  const [hydrated, setHydrated] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [syncState, setSyncState] = useState<DraftSyncState>('idle')
  const [localCopy, setLocalCopy] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const queue = useRef<DraftSaveQueue<T> | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const savedAtRef = useRef<number | null>(null)
  const publishingRef = useRef(false)
  const [recovered, setRecovered] = useState(false)

  const persist = useCallback((value: T, pending: boolean) => {
    try {
      const record: Recovery<T> = { draft: value, id: idRef.current ?? value.id, savedAt: savedAtRef.current, pending }
      sessionStorage.setItem(storageKey, JSON.stringify(record))
      setLocalCopy(true)
    } catch { setLocalCopy(false) }
  }, [storageKey])

  useEffect(() => {
    publishingRef.current = false
    setHydrated(false)
    setLoadError(false)
    let cancelled = false
    let done = false
    let recovery: Recovery<T> | null = null
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Recovery<T>
        if (parsed.draft?.type === draft.type && typeof parsed.id === 'string') recovery = parsed
      }
    } catch { /* A corrupt recovery cannot replace the account version. */ }

    const apply = (existing?: DraftItem) => {
      if (cancelled || done) return
      done = true
      const { _draftState, _createdAt, _updatedAt, ...content } = existing ?? {} as DraftItem
      const base = existing ? { ...emptyFn(), ...content } as T : emptyFn()
      // Only unsynced recovery supersedes an account copy. Acknowledged local
      // copies must not overwrite changes made on another device.
      const useRecovery = recovery && (!existing || recovery.pending) ? recovery : null
      const value = useRecovery ? useRecovery.draft : base
      idRef.current = existing?.id ?? recovery?.id ?? makeId(draft.type)
      setCommittedId(idRef.current)
      setIsPublished(_draftState === 'published' || Boolean(existing && getPublishedItemSync(existing.id)))
      setRecovered(Boolean(useRecovery && useRecovery.pending))
      savedAtRef.current = useRecovery ? useRecovery.savedAt : null
      setLastSavedAt(savedAtRef.current)
      setDraft(value)
      draftRef.current = value
      const initial = useRecovery && useRecovery.pending ? base : value
      const writer = new DraftSaveQueue(initial, async (snapshot) => {
        if (cancelled || publishingRef.current) return false
        setSyncState('saving')
        const ok = await saveDraftItem({ ...snapshot, id: idRef.current!, publishedAt: snapshot.publishedAt, readTime: readingMinutes(snapshot) })
        if (cancelled) return false
        if (!ok) { setSyncState('error'); return false }
        savedAtRef.current = Date.now()
        setLastSavedAt(savedAtRef.current)
        const unchanged = draftRef.current === snapshot
        persist(draftRef.current, !unchanged)
        setSyncState(unchanged ? 'saved' : 'pending')
        return true
      })
      writer.update(value)
      queue.current = writer
      setSyncState(writer.pending ? 'pending' : savedAtRef.current ? 'saved' : 'idle')
      setHydrated(true)
    }

    if (!editItemId) apply()
    const attempt = () => {
      if (!editItemId) return
      const existing = getItemById(editItemId)
      if (existing && existing.type === draft.type) apply(existing)
    }
    attempt()
    const unsubD = subscribeDrafts(attempt)
    const unsubP = subscribePublishedItems(attempt)
    const timeout = setTimeout(() => {
      if (!done && !cancelled) setLoadError(true)
    }, 12000)
    return () => {
      cancelled = true
      queue.current?.stop()
      clearTimeout(timeout)
      unsubD(); unsubP()
    }
    // Form factories and setters are per-render; only the session identity
    // should hydrate. The compose root is keyed by type + edit/new identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, editItemId])

  useEffect(() => {
    // Hydration may replace the draft earlier in this effect pass when the
    // account arrives. Never enqueue the previous session's render.
    if (!hydrated || draft !== draftRef.current || !queue.current || publishingRef.current) return
    queue.current.update(draft)
    const pending = queue.current.pending
    persist(draft, pending)
    if (!pending) return
    setSyncState('pending')
    // Lab/anonymous edits remain local, never silently claim an account save.
    if (!currentUser) return
    const timer = setTimeout(() => { void queue.current?.flush() }, 900)
    return () => clearTimeout(timer)
  }, [draft, hydrated, currentUser, persist])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!queue.current?.pending) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])

  const saveDraft = async (): Promise<boolean> => {
    if (!hydrated || !queue.current) return false
    // Explicitly saving a pristine draft is allowed too.
    if (!queue.current.pending && syncState === 'idle') {
      const snapshot = { ...draftRef.current }
      draftRef.current = snapshot
      setDraft(snapshot)
      queue.current.update(snapshot)
    } else queue.current.update(draftRef.current)
    return queue.current.flush()
  }
  const requestPublish = (): string => {
    // The layout flushes account saving before opening confirmation. Pause
    // autosave for its lifetime to prevent recreating the removed draft.
    publishingRef.current = true
    const id = idRef.current ?? makeId(draft.type)
    idRef.current = id
    upsertItem({ ...draftRef.current, id, readTime: readingMinutes(draftRef.current) }, 'draft', { localOnly: true })
    return id
  }
  const resumeSaving = () => { publishingRef.current = false }
  const releaseRecovery = () => {
    try { sessionStorage.removeItem(storageKey) } catch { /* Account copy remains. */ }
  }
  const reset = () => {
    const existing = editItemId ? getItemById(editItemId) : null
    if (existing) {
      const { _draftState, _createdAt, _updatedAt, ...content } = existing
      setDraft({ ...emptyFn(), ...content } as T)
    } else setDraft(emptyFn())
  }
  const flash: CommitFlash = syncState === 'saving' ? 'saving' : syncState === 'error' ? 'error' : syncState === 'saved' ? 'draft' : null
  const publishMode: PublishMode = editItemId ? 'edit' : 'create'
  return { committedId, hydrated, loadError, canSave: hydrated && syncState !== 'saving', lastSavedAt,
    syncState, localCopy, recovered, hasChanges: queue.current?.pending ?? false, flash, isPublished,
    publishMode, saveDraft, requestPublish, resumeSaving, releaseRecovery, reset }
}
