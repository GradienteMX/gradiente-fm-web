'use client'

import {
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

export function OverlayProvider({ children }: { children: ReactNode }) {
  // Local state is the source of truth — but it stays synced with the URL
  // both directions:
  //   - external URL change (back/forward, next/link, manual edit) → local state
  //   - programmatic open/close → URL via writeSlugToUrl
  // Reading useSearchParams here makes the effect re-run on Next.js client
  // routing too, which `popstate` alone misses.
  const searchParams = useSearchParams()
  const slugFromUrl = searchParams?.get(PARAM) ?? null

  const [openSlug, setOpenSlugState] = useState<string | null>(slugFromUrl)
  const [originRect, setOriginRect] = useState<OverlayOrigin | null>(null)

  // Sync external URL changes into local state. Only updates when the URL's
  // slug differs from what we already have, so programmatic opens (which
  // also write the URL) don't double-fire.
  useEffect(() => {
    setOpenSlugState((prev) => (prev === slugFromUrl ? prev : slugFromUrl))
  }, [slugFromUrl])

  const setOpenSlug = useCallback((slug: string | null) => {
    setOpenSlugState(slug)
    writeSlugToUrl(slug)
  }, [])

  const value = useMemo(
    () => ({ openSlug, setOpenSlug, originRect, setOriginRect }),
    [openSlug, setOpenSlug, originRect],
  )
  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>
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
