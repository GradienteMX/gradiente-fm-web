'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ContentItem } from '@/lib/types'
import { getItemBySlug } from '@/lib/mockData'
import { useDraftItems } from '@/lib/drafts'
import { getItemBySlugSync } from '@/lib/itemsCache'
import { recordHpEvent } from '@/lib/hpEvents'
import { useOverlay } from './useOverlay'
import { OverlayShell } from './OverlayShell'
import { EventoOverlay } from './EventoOverlay'
import { GenericOverlay } from './GenericOverlay'
import { ReaderOverlay } from './ReaderOverlay'
import { ArticuloOverlay } from './ArticuloOverlay'
import { MixOverlay } from './MixOverlay'
import { ListicleOverlay } from './ListicleOverlay'
import { FranjaOverlay } from './FranjaOverlay'

export function OverlayRouter() {
  const { openSlug, consumeInspectOpen } = useOverlay()
  // Session-only drafts also need to be openable via the overlay.
  // Look here first; fall back to MOCK_ITEMS for real content.
  const drafts = useDraftItems()
  const resolveSlug = useCallback(
    (slug: string | null): ContentItem | null => {
      if (!slug) return null
      const draft = drafts.find((d) => d.slug === slug)
      if (draft) return draft
      // Real DB items pushed into the cache by ContentGrid on every page.
      // Covers both seeded and freshly-published items.
      const live = getItemBySlugSync(slug)
      if (live) return live
      // Last-resort: legacy mock catalog (only matters until mockData is
      // fully purged).
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
      // Opening fresh. Fire an 'open' engagement event — distinct from
      // 'click' (card-driven) because URL deep-links land here without a
      // card click. Weighted higher than click since "viewed the overlay"
      // beats "clicked through to it".
      //
      // Unless this open arrived from /admin's CONTENIDO tab with ?inspect=1,
      // in which case it grants nothing: measuring a piece must not move it.
      // See the INSPECT_PARAM note in useOverlay.tsx for why.
      if (!consumeInspectOpen(next.slug)) recordHpEvent(next.id, 'open')
      setMounted(next)
      setExiting(false)
      return
    }

    if (next && mounted && next.slug !== mounted.slug) {
      // Switching to a different item — play exit, then swap. The 'open'
      // event for `next` fires in onExited (where it actually mounts).
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
  }, [openSlug, mounted, exiting, resolveSlug, consumeInspectOpen])

  if (!mounted) return null

  const handleExited = () => {
    const next = resolveSlug(openSlug)
    if (next && next.slug !== mounted.slug) {
      // Swap in the new item after the old one finished exiting. Same
      // inspection guard as the fresh-open path above — an admin switching
      // items inside the overlay must not grant HL either.
      if (!consumeInspectOpen(next.slug)) recordHpEvent(next.id, 'open')
      setMounted(next)
      setExiting(false)
    } else {
      setMounted(null)
      setExiting(false)
    }
  }

  // Franjas render as a standalone full-screen dossier (own chrome + wide
  // layout), NOT wrapped in OverlayShell's 1024px single panel. See the
  // project_franja_page_revamp design note.
  if (mounted.type === 'franja') {
    return (
      <FranjaOverlay
        key={mounted.slug}
        item={mounted}
        exiting={exiting}
        onExited={handleExited}
      />
    )
  }

  return (
    <OverlayShell
      key={mounted.slug}
      item={mounted}
      exiting={exiting}
      onExited={handleExited}
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
