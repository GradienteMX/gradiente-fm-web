'use client'

import { useEffect, useRef } from 'react'
import { SmartImage } from '@/components/SmartImage'
import { FOCUS_RING } from '@/components/dashboard/grid/WidgetFrame'
import type { ContentItem } from '@/lib/types'

/** Selection browses a collection; it never opens a piece or starts audio. */
export function CoverSelector({ items, selectedId, playingId, onSelect, gallery = false, label }: {
  items: readonly ContentItem[]
  selectedId: string
  playingId?: string | null
  onSelect: (id: string) => void
  gallery?: boolean
  label: string
}) {
  const selectedRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    // Scroll only the strip, never the surrounding dashboard.
    const button = selectedRef.current
    const strip = button?.parentElement
    if (!button || !strip || gallery) return
    const left = button.offsetLeft - strip.offsetLeft
    if (left < strip.scrollLeft) strip.scrollLeft = left
    else if (left + button.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = left + button.offsetWidth - strip.clientWidth
    }
  }, [selectedId, gallery])

  return (
    <div role="group" aria-label={label} className={gallery
      ? 'grid grid-cols-2 gap-3'
      : 'relative flex min-w-0 flex-1 gap-2 overflow-x-auto p-1'}>
      {items.map((item) => (
        <button
          key={item.id}
          ref={item.id === selectedId ? selectedRef : undefined}
          type="button"
          aria-label={`Seleccionar ${item.title}${item.id === playingId ? ' — sonando' : ''}`}
          aria-pressed={item.id === selectedId}
          title={item.title}
          onClick={() => onSelect(item.id)}
          data-cue="tick"
          className={`relative shrink-0 border border-ink bg-panel ${gallery ? 'aspect-square w-full' : 'h-12 w-12'} ${item.id === selectedId ? 'outline outline-2 outline-offset-2 outline-ink' : 'opacity-75 hover:opacity-100'} ${FOCUS_RING}`}
        >
          {item.imageUrl ? <SmartImage src={item.imageUrl} alt="" sizes={gallery ? '160px' : '48px'} className="object-contain" />
            : <span className="font-mono text-d11 uppercase text-panel-text">{item.type}</span>}
          {item.id === playingId && <span className="absolute bottom-1 left-1 border border-ink bg-acid px-1 font-mono text-d11 font-bold text-ink">SONANDO</span>}
        </button>
      ))}
    </div>
  )
}
