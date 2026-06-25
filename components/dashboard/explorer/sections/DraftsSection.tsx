'use client'

import { useMemo, useState } from 'react'
import type { ContentType } from '@/lib/types'
import { categoryColor } from '@/lib/utils'
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

const TYPE_LABEL: Partial<Record<ContentType, string>> = {
  evento: 'EVENTOS',
  mix: 'MIXES',
  noticia: 'NOTICIAS',
  review: 'REVIEWS',
  editorial: 'EDITORIALES',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULOS',
  listicle: 'LISTAS',
  partner: 'PARTNERS',
}

export function DraftsSection({
  items,
  onOpen,
  stateFilter,
  namespace = 'drafts',
  onDelete,
  onHarvest,
}: Props) {
  // Multi-select type filter — empty set means "show all". Lets the publicados
  // view (which can grow past what fits on screen) narrow to one or a few
  // content types at a time.
  const [active, setActive] = useState<Set<ContentType>>(new Set())

  const stateScoped = useMemo(() => {
    if (!stateFilter) return items
    return items.filter((i) => i._draftState === stateFilter)
  }, [items, stateFilter])

  // Types actually present (with counts) drive the chip strip — no empty chips.
  const typeCounts = useMemo(() => {
    const m = new Map<ContentType, number>()
    for (const i of stateScoped) m.set(i.type, (m.get(i.type) ?? 0) + 1)
    return m
  }, [stateScoped])

  const filtered = useMemo(() => {
    if (active.size === 0) return stateScoped
    return stateScoped.filter((i) => active.has(i.type))
  }, [stateScoped, active])

  const toggle = (t: ContentType) =>
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })

  const types = Array.from(typeCounts.keys()).sort()

  return (
    <div className="flex flex-col gap-3">
      {types.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActive(new Set())}
            className="border px-2 py-1 font-mono text-[10px] tracking-widest transition-colors"
            style={{
              borderColor: active.size === 0 ? '#F97316' : '#2a2a2a',
              color: active.size === 0 ? '#F97316' : '#888888',
            }}
          >
            TODOS · {stateScoped.length}
          </button>
          {types.map((t) => {
            const on = active.has(t)
            const color = categoryColor(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggle(t)}
                className="border px-2 py-1 font-mono text-[10px] tracking-widest transition-colors"
                style={{
                  borderColor: on ? color : '#2a2a2a',
                  color: on ? color : '#888888',
                }}
              >
                {TYPE_LABEL[t] ?? t.toUpperCase()} · {typeCounts.get(t)}
              </button>
            )
          })}
        </div>
      )}

      {/* Scrollable workspace — caps height so a large publicados set can be
          scrolled instead of overflowing the page with no way to reach the
          lower tiles. */}
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        <DraggableFileGrid
          namespace={namespace}
          items={filtered}
          onOpen={onOpen}
          onDelete={onDelete}
          onHarvest={onHarvest}
        />
      </div>
    </div>
  )
}
