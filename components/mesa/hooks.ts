'use client'

/**
 * The Mesa's three engines: session readiness, undo/redo history and the
 * debounced autosave (a `draft-save` world action — its effect POSTs
 * /api/drafts, lib/store/efectos/mesa.ts).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ContentItem, Draft, DraftState } from '@/lib/types'
import { useSessionReady } from '@/lib/store/session'
import { useWorldStore } from '@/lib/store/world'

// ── session readiness ───────────────────────────────────────────────────────

/** Always true now: the session arrives with the page. */
export { useSessionReady }

// ── history: 50 steps, typing within 750 ms groups ──────────────────────────

const LIMIT = 50
const GROUP_MS = 750

function contentKey(it: ContentItem): string {
  return JSON.stringify(it)
}

/** Structural edits (a block added, an image changed) always start a new step. */
function structureKey(it: ContentItem): string {
  return JSON.stringify([
    it.articleBody?.map((b) => b.kind),
    it.tracklist?.length,
    it.imageUrl,
    it.vibeMin,
    it.vibeMax,
    it.genres.length,
    it.tags.length,
    it.embeds?.length,
    it.poll ? it.poll.kind : null,
    it.entities?.length,
    it.franjaRefs?.length,
    it.links?.length,
    it.footnotes?.length,
  ])
}

export function useHistory(item: ContentItem, setItem: (it: ContentItem) => void) {
  const past = useRef<ContentItem[]>([])
  const future = useRef<ContentItem[]>([])
  const current = useRef(item)
  const lastChange = useRef(0)
  const replaying = useRef(false)
  const [, bump] = useState(0)

  useEffect(() => {
    if (replaying.current) {
      replaying.current = false
      current.current = item
      return
    }
    const prev = current.current
    if (prev === item || contentKey(prev) === contentKey(item)) {
      current.current = item
      return
    }
    const now = Date.now()
    if (now - lastChange.current > GROUP_MS || structureKey(prev) !== structureKey(item)) {
      past.current = [...past.current.slice(-(LIMIT - 1)), prev]
    }
    future.current = []
    lastChange.current = now
    current.current = item
    bump((n) => n + 1)
  }, [item])

  const move = useCallback(
    (dir: 'undo' | 'redo') => {
      const from = dir === 'undo' ? past : future
      const to = dir === 'undo' ? future : past
      const next = from.current.pop()
      if (!next) return false
      to.current.push(current.current)
      replaying.current = true
      lastChange.current = 0
      current.current = next
      setItem(next)
      bump((n) => n + 1)
      return true
    },
    [setItem],
  )

  return {
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    undo: useCallback(() => move('undo'), [move]),
    redo: useCallback(() => move('redo'), [move]),
  }
}

// ── autosave ────────────────────────────────────────────────────────────────

export type SaveStatus = { kind: 'nuevo' } | { kind: 'pendiente' } | { kind: 'guardado'; at: string }

const DEBOUNCE_MS = 900

interface AutosaveInput {
  base: Omit<Draft, 'item' | 'updatedAt' | 'state'>
  item: ContentItem
  /** A resumed draft already exists in the world; a fresh one waits for a change. */
  persisted: boolean
  lastSavedAt?: string
  onFirstSave?: (draftId: string) => void
}

/**
 * Every change → a debounced `draft-save` (900 ms) with `updatedAt`. Only
 * the last snapshot of a draft matters: the world drops the earlier ones
 * that never reached a backend (world.tsx, `supersedes`).
 */
export function useAutosave({ base, item, persisted, lastSavedAt, onFirstSave }: AutosaveInput) {
  const store = useWorldStore()
  const [status, setStatus] = useState<SaveStatus>(persisted && lastSavedAt ? { kind: 'guardado', at: lastSavedAt } : { kind: 'nuevo' })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)
  const saved = useRef(persisted)
  const sealed = useRef(false)
  /** The item as last written (or as loaded): only a different one is a change. */
  const baseline = useRef(item)
  const latest = useRef({ base, item, state: 'borrador' as DraftState })
  latest.current = { ...latest.current, base, item }
  const onFirst = useRef(onFirstSave)
  onFirst.current = onFirstSave

  const commit = useCallback(
    (state?: DraftState) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      if (sealed.current) return
      const { base: b, item: it } = latest.current
      const st = state ?? 'borrador'
      latest.current.state = st
      const at = new Date().toISOString()
      const draft: Draft = { ...b, item: it, state: st, updatedAt: at }
      baseline.current = it
      store.getState().dispatch({ t: 'draft-save', draft, at })
      dirty.current = false
      setStatus({ kind: 'guardado', at })
      if (!saved.current) {
        saved.current = true
        onFirst.current?.(draft.id)
      }
    },
    [store],
  )

  useEffect(() => {
    if (sealed.current || item === baseline.current) return
    dirty.current = true
    setStatus({ kind: 'pendiente' })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => commit(), DEBOUNCE_MS)
  }, [item, commit])

  /** Save now if anything is pending (close, publish, step jumps). */
  const flush = useCallback(
    (state?: DraftState) => {
      if (dirty.current || state) commit(state)
    },
    [commit],
  )

  // Closing the tab inside the debounce window: save now (the draft-save
  // effect sends it keepalive, so it survives the page going away).
  useEffect(() => {
    const onHide = () => {
      if (!dirty.current || sealed.current) return
      commit()
    }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [commit])

  /** After publishing or discarding: nothing may write this draft again. */
  const seal = useCallback(() => {
    sealed.current = true
    dirty.current = false
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  // Leaving the table never loses words.
  useEffect(
    () => () => {
      if (dirty.current) commit()
      if (timer.current) clearTimeout(timer.current)
    },
    [commit],
  )

  return { status, flush, seal, isSaved: () => saved.current }
}
