'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useOverlay } from '@/components/overlay/useOverlay'
import { useOpenItem } from '@/lib/dashboard/openItem'
import { getItemBySlugSync } from '@/lib/itemsCache'

// ── DashOverlayHost — overlays in place, zero ejections (FINAL_SPEC §3.11) ──
//
// The overlay stack itself (OverlayRouter + OverlayShell) is mounted globally
// in app/layout.tsx OUTSIDE ChromeFrame, so it already renders above the
// dashboard shell. What it cannot do is resolve a COLD deep link: on a direct
// /dashboard?item=<slug> load, lib/itemsCache is empty, the URL-synced
// openSlug resolves to nothing, and the overlay silently fails to open.
//
// This host closes that gap once per mount: if `?item=` is present and the
// cache is cold, it clears the stale open state and re-opens through
// lib/dashboard/openItem (fetch-by-slug → recordItems → open), carrying
// `?comment=` along so ACTIVIDAD deep links land with the comments column
// addressed. Warm-cache opens (widget clicks via useOpenItem) never pass
// through here. An unresolvable slug (deleted/unpublished) renders an honest
// dismissible notice instead of a dead click.

export function DashOverlayHost() {
  const search = useSearchParams()
  const { close } = useOverlay()
  const openItem = useOpenItem()
  const [missing, setMissing] = useState(false)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    const slug = search?.get('item') ?? null
    if (!slug) return
    // Warm cache → OverlayRouter resolves it on its own; do nothing.
    if (getItemBySlugSync(slug)) return
    const commentId = search?.get('comment') ?? undefined
    // The stale cold open state must actually change for OverlayRouter to
    // re-resolve — close() flips openSlug to null, openItem() re-opens it
    // once the item is recorded in the cache.
    close()
    void openItem(slug, { commentId }).then((ok) => {
      if (!ok) setMissing(true)
    })
  }, [search, close, openItem])

  if (!missing) return null

  // Fixed so the notice is visible wherever the user is in the scroll —
  // z-50 sits above the grid, below the compose sheet (60) and the site
  // overlay stack (§7.6).
  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(90vw,36rem)] -translate-x-1/2">
      <div className="flex items-center justify-between gap-4 border border-ink bg-paper-raised px-4 py-3">
        <p className="font-mono text-d13 text-ink">
          CONTENIDO NO DISPONIBLE — el enlace apunta a algo despublicado o
          borrado.
        </p>
        <button
          type="button"
          onClick={() => setMissing(false)}
          className="shrink-0 border border-ink px-2 py-1 font-mono text-d13 tracking-widest text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          CERRAR
        </button>
      </div>
    </div>
  )
}
