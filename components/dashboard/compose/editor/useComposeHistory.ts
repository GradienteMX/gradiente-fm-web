'use client'
import { useEffect, useRef, useState } from 'react'
import type { ContentItem } from '@/lib/types'

export function useComposeHistory(draft: ContentItem, setDraft: (item: ContentItem) => void, ready: boolean) {
  const past = useRef<ContentItem[]>([])
  const future = useRef<ContentItem[]>([])
  const current = useRef(draft)
  const initialized = useRef(false)
  const lastChange = useRef(0)
  const replay = useRef(false)
  const [, refresh] = useState(0)
  useEffect(() => {
    if (!ready) { initialized.current = false; return }
    if (!initialized.current) {
      current.current = draft; past.current = []; future.current = []; initialized.current = true; return
    }
    if (replay.current) { replay.current = false; current.current = draft; return }
    const contentKey = (item: ContentItem) => { const { publishedAt, id, ...content } = item; return JSON.stringify(content) }
    if (contentKey(current.current) === contentKey(draft)) { current.current = draft; return }
    const structure = (item: ContentItem) => JSON.stringify([item.articleBody?.map((b) => b.kind), item.tracklist?.length, item.imageUrl])
    if (Date.now() - lastChange.current > 750 || structure(current.current) !== structure(draft)) {
      past.current = [...past.current.slice(-49), current.current]
    }
    future.current = []
    lastChange.current = Date.now()
    current.current = draft
    refresh((n) => n + 1)
  }, [draft, ready])
  const move = (direction: 'undo' | 'redo') => {
    const source = direction === 'undo' ? past : future
    const destination = direction === 'undo' ? future : past
    const next = source.current.pop()
    if (!next) return
    destination.current.push(current.current)
    replay.current = true
    lastChange.current = 0
    current.current = next
    setDraft(next)
    refresh((n) => n + 1)
  }
  return { canUndo: past.current.length > 0, canRedo: future.current.length > 0, undo: () => move('undo'), redo: () => move('redo') }
}
