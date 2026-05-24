'use client'

import { useMemo } from 'react'
import type { DraftItem } from '@/lib/drafts'
import { DraggableFileGrid } from './DraggableFileGrid'

interface Props {
  items: DraftItem[]
  onOpen: (item: DraftItem) => void
  /** When defined, filters items to a single state. */
  stateFilter?: 'draft' | 'published'
  /** Storage namespace for free-form positions — keeps drafts vs. publicados separate. */
  namespace?: string
  /** When provided, each tile renders a corner ⌧ delete button. */
  onDelete?: (item: DraftItem) => void
  /** When provided, published tiles get the COSECHAR seal affordance. */
  onHarvest?: (item: DraftItem) => void
}

export function DraftsSection({
  items,
  onOpen,
  stateFilter,
  namespace = 'drafts',
  onDelete,
  onHarvest,
}: Props) {
  const filtered = useMemo(() => {
    if (!stateFilter) return items
    return items.filter((i) => i._draftState === stateFilter)
  }, [items, stateFilter])

  return (
    <DraggableFileGrid
      namespace={namespace}
      items={filtered}
      onOpen={onOpen}
      onDelete={onDelete}
      onHarvest={onHarvest}
    />
  )
}
