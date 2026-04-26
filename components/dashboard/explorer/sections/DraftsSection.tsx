'use client'

import { useMemo } from 'react'
import type { DraftItem } from '@/lib/drafts'
import { DraggableFileGrid } from './DraggableFileGrid'

interface Props {
  items: DraftItem[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpen: (item: DraftItem) => void
  /** When defined, filters items to a single state. */
  stateFilter?: 'draft' | 'published'
  /** Storage namespace for free-form positions — keeps drafts vs. publicados separate. */
  namespace?: string
}

export function DraftsSection({
  items,
  selectedId,
  onSelect,
  onOpen,
  stateFilter,
  namespace = 'drafts',
}: Props) {
  const filtered = useMemo(() => {
    if (!stateFilter) return items
    return items.filter((i) => i._draftState === stateFilter)
  }, [items, stateFilter])

  return (
    <DraggableFileGrid
      namespace={namespace}
      items={filtered}
      selectedId={selectedId}
      onSelect={onSelect}
      onOpen={onOpen}
    />
  )
}
