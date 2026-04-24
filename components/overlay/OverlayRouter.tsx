'use client'

import { useEffect, useState } from 'react'
import type { ContentItem } from '@/lib/types'
import { getItemBySlug } from '@/lib/mockData'
import { useOverlay } from './useOverlay'
import { OverlayShell } from './OverlayShell'
import { EventoOverlay } from './EventoOverlay'
import { GenericOverlay } from './GenericOverlay'
import { ReaderOverlay } from './ReaderOverlay'
import { ArticuloOverlay } from './ArticuloOverlay'

export function OverlayRouter() {
  const { openSlug } = useOverlay()

  // `mounted` holds the item currently displayed (may differ from openSlug
  // while the previous overlay is playing its exit animation).
  const [mounted, setMounted] = useState<ContentItem | null>(null)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const next = openSlug ? getItemBySlug(openSlug) : null

    if (next && !mounted) {
      // Opening fresh.
      setMounted(next)
      setExiting(false)
      return
    }

    if (next && mounted && next.slug !== mounted.slug) {
      // Switching to a different item — play exit, then swap.
      setExiting(true)
      return
    }

    if (!next && mounted && !exiting) {
      // Closing.
      setExiting(true)
    }
  }, [openSlug, mounted, exiting])

  if (!mounted) return null

  return (
    <OverlayShell
      key={mounted.slug}
      item={mounted}
      exiting={exiting}
      onExited={() => {
        const next = openSlug ? getItemBySlug(openSlug) : null
        if (next && next.slug !== mounted.slug) {
          // Swap in the new item after old one finished exiting.
          setMounted(next)
          setExiting(false)
        } else {
          setMounted(null)
          setExiting(false)
        }
      }}
    >
      {renderByType(mounted)}
    </OverlayShell>
  )
}

function renderByType(item: ContentItem) {
  switch (item.type) {
    case 'evento':
      return <EventoOverlay item={item} />
    case 'articulo':
      return <ArticuloOverlay item={item} />
    case 'editorial':
    case 'review':
    case 'opinion':
    case 'noticia':
      return <ReaderOverlay item={item} />
    default:
      return <GenericOverlay item={item} />
  }
}
