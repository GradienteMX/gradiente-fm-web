'use client'

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'next/navigation'

const PARAM = 'item'

export interface OverlayOrigin {
  x: number
  y: number
  width: number
  height: number
}

interface OverlayContextValue {
  openSlug: string | null
  setOpenSlug: (slug: string | null) => void
  originRect: OverlayOrigin | null
  setOriginRect: (rect: OverlayOrigin | null) => void
}

const OverlayContext = createContext<OverlayContextValue | null>(null)

function writeSlugToUrl(slug: string | null) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (slug) url.searchParams.set(PARAM, slug)
  else url.searchParams.delete(PARAM)
  window.history.replaceState(window.history.state, '', url.toString())
}

// useSearchParams forces client-side rendering wherever it's called, and
// during static export Next.js requires it to be wrapped in a Suspense
// boundary. Isolating the hook in a small sibling lets us add that Suspense
// inside OverlayProvider without forcing the whole layout below it to
// bail out of static prerender.
function UrlSlugSync({
  onSlug,
}: {
  onSlug: (slug: string | null) => void
}) {
  const searchParams = useSearchParams()
  const slug = searchParams?.get(PARAM) ?? null
  useEffect(() => {
    onSlug(slug)
  }, [slug, onSlug])
  return null
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  // Local state is the source of truth — UrlSlugSync mirrors external URL
  // changes (back/forward, next/link, manual edit) into it; setOpenSlug
  // mirrors programmatic open/close back into the URL.
  const [openSlug, setOpenSlugState] = useState<string | null>(null)
  const [originRect, setOriginRect] = useState<OverlayOrigin | null>(null)

  const syncFromUrl = useCallback((slug: string | null) => {
    setOpenSlugState((prev) => (prev === slug ? prev : slug))
  }, [])

  const setOpenSlug = useCallback((slug: string | null) => {
    setOpenSlugState(slug)
    writeSlugToUrl(slug)
  }, [])

  const value = useMemo(
    () => ({ openSlug, setOpenSlug, originRect, setOriginRect }),
    [openSlug, setOpenSlug, originRect],
  )
  return (
    <OverlayContext.Provider value={value}>
      <Suspense fallback={null}>
        <UrlSlugSync onSlug={syncFromUrl} />
      </Suspense>
      {children}
    </OverlayContext.Provider>
  )
}

export function useOverlay() {
  const ctx = useContext(OverlayContext)
  if (!ctx) throw new Error('useOverlay must be used inside <OverlayProvider>')

  const open = useCallback(
    (slug: string, rect?: OverlayOrigin) => {
      ctx.setOriginRect(rect ?? null)
      ctx.setOpenSlug(slug)
    },
    [ctx],
  )

  const close = useCallback(() => {
    ctx.setOpenSlug(null)
    ctx.setOriginRect(null)
  }, [ctx])

  return { openSlug: ctx.openSlug, open, close, originRect: ctx.originRect }
}
