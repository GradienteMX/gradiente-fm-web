'use client'

import { forwardRef, useImperativeHandle, useState } from 'react'
import type { ContentItem } from '@/lib/types'

export interface AtlasInspectionHandle {
  show: (item: ContentItem) => void
  hide: () => void
}

const LABELS: Record<string, string> = {
  evento: 'EVENTO', mix: 'MIX', noticia: 'NOTICIA', review: 'RESEÑA',
  editorial: 'EDITORIAL', opinion: 'OPINIÓN', articulo: 'ARTÍCULO', listicle: 'LISTA',
}

/** Keep hover state and paint in a stable HTML layer, outside the terrain.
 * Retain the caption while hidden so hover never mounts an SVG foreignObject,
 * reads cell geometry, or reconciles the map and its patterns. */
export const AtlasInspection = forwardRef<AtlasInspectionHandle>(function AtlasInspection(_, ref) {
  const [{ item, visible }, setInspection] = useState<{
    item: ContentItem | null
    visible: boolean
  }>({ item: null, visible: false })

  useImperativeHandle(ref, () => ({
    show(item) { setInspection({ item, visible: true }) },
    hide() { setInspection(previous => previous.visible ? { ...previous, visible: false } : previous) },
  }), [])

  return (
    <div
      aria-hidden
      className={`mapa-inspection pointer-events-none absolute bottom-20 left-[232px] z-20 h-32 w-[272px] border border-ink bg-paper-raised p-3 text-ink shadow-lift [contain:strict] will-change-[transform,opacity] [.mapa-dragging_&]:opacity-0 [.mapa-zooming_&]:opacity-0 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <p className="mb-1 font-mono text-[9px] uppercase tracking-widest">
        {item && LABELS[item.type]}
        {item?.source === 'archive:wayback' ? ' · ARCHIVO' : ''}
      </p>
      <p className="line-clamp-3 font-grotesk text-[15px] font-bold leading-tight">
        {item?.title}
      </p>
      <p className="mt-2 font-mono text-[10px] font-bold">CLIC O ENTER · ABRIR ↗</p>
    </div>
  )
})
