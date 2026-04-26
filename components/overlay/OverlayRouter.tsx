'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ContentItem } from '@/lib/types'
import { getItemBySlug } from '@/lib/mockData'
import { useDraftItems } from '@/lib/drafts'
import { useOverlay } from './useOverlay'
import { OverlayShell } from './OverlayShell'
import { EventoOverlay } from './EventoOverlay'
import { GenericOverlay } from './GenericOverlay'
import { ReaderOverlay } from './ReaderOverlay'
import { ArticuloOverlay } from './ArticuloOverlay'
import { MixOverlay } from './MixOverlay'
import { ListicleOverlay } from './ListicleOverlay'

export function OverlayRouter() {
  const { openSlug } = useOverlay()
  // Session-only drafts also need to be openable via the overlay.
  // Look here first; fall back to MOCK_ITEMS for real content.
  const drafts = useDraftItems()
  const resolveSlug = useCallback(
    (slug: string | null): ContentItem | null => {
      if (!slug) return null
      const draft = drafts.find((d) => d.slug === slug)
      if (draft) return draft
      return getItemBySlug(slug)
    },
    [drafts],
  )

  // `mounted` holds the item currently displayed (may differ from openSlug
  // while the previous overlay is playing its exit animation).
  const [mounted, setMounted] = useState<ContentItem | null>(null)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const next = resolveSlug(openSlug)

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

    // Same slug, but the underlying item changed (e.g. draft → published, or
    // an editor saved updates from the dashboard). Refresh the mounted ref so
    // chrome like the DRAFT strip re-renders.
    if (next && mounted && next.slug === mounted.slug && next !== mounted) {
      setMounted(next)
      return
    }

    if (!next && mounted && !exiting) {
      // Closing — slug exists but resolves to nothing (e.g. draft was deleted).
      setExiting(true)
    }
  }, [openSlug, mounted, exiting, resolveSlug])

  if (!mounted) return null

  return (
    <OverlayShell
      key={mounted.slug}
      item={mounted}
      exiting={exiting}
      onExited={() => {
        const next = resolveSlug(openSlug)
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
    case 'mix':
      return <MixOverlay item={item} />
    case 'listicle':
      return <ListicleOverlay item={item} />
    case 'editorial':
    case 'review':
    case 'opinion':
    case 'noticia':
      return <ReaderOverlay item={item} />
    default:
      return <GenericOverlay item={item} />
  }
}
