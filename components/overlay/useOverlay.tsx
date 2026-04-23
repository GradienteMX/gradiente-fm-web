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

function readSlugFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(PARAM)
}

function writeSlugToUrl(slug: string | null) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (slug) url.searchParams.set(PARAM, slug)
  else url.searchParams.delete(PARAM)
  window.history.replaceState(window.history.state, '', url.toString())
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [openSlug, setOpenSlugState] = useState<string | null>(null)
  const [originRect, setOriginRect] = useState<OverlayOrigin | null>(null)

  // Hydrate state from URL on mount + respond to back/forward navigation.
  useEffect(() => {
    setOpenSlugState(readSlugFromUrl())
    const handler = () => setOpenSlugState(readSlugFromUrl())
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

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
