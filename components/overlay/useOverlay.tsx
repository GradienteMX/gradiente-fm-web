'use client'

import {
  Suspense,
  createContext,
  useCallback,
  useRef,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'next/navigation'
import { createInspectArm } from '@/lib/overlay/inspectArm'

const PARAM = 'item'

// ── Inspection opens ────────────────────────────────────────────────────────
//
// `?inspect=1` alongside `?item=` opens the overlay WITHOUT emitting the 'open'
// engagement event. It exists for one caller: the VER EN PÚBLICO link in
// /admin's CONTENIDO tab.
//
// The problem it solves is measurement, not privilege. 'open' is worth 1.5 base
// HL against items that sit between 12 and 70, so a single inspection moves a
// piece 2-12% — and an admin inspects precisely the items they are already
// investigating, so the error is CORRELATED with the thing being measured. An
// instrument that inflates whatever you point it at is worse than no instrument.
//
// Two deliberate non-decisions:
//   · It is NOT gated on role. A forged ?inspect=1 only suppresses the forger's
//     own contribution — it cannot inflate anything, and granting no HL is
//     already the default for logged-out readers. A server round-trip to check
//     a role would buy nothing.
//   · It does NOT suppress an admin's ordinary browsing. Reading the feed like
//     anyone else is real signal and stays counted. Only the panel's own link
//     carries the flag.
//
// One-shot by construction: the param is stripped from the URL the moment it is
// read, so a refresh, a back/forward, or onward navigation inside the overlay
// all behave normally. A lingering flag would silently mute engagement for the
// rest of the session, which is the failure mode worth designing out.
const INSPECT_PARAM = 'inspect'

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
  /**
   * True only when THIS item's open arrived with `?inspect=1`. Always clears
   * the flag, whatever the answer. OverlayRouter calls it to decide whether to
   * emit 'open'.
   */
  consumeInspectOpen: (itemSlug: string) => boolean
}

const OverlayContext = createContext<OverlayContextValue | null>(null)

function writeSlugToUrl(slug: string | null) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (slug) url.searchParams.set(PARAM, slug)
  else url.searchParams.delete(PARAM)
  window.history.replaceState(window.history.state, '', url.toString())
}

/** Strip `?inspect=1` in place — it is consumed on the open it arrived with. */
function clearInspectFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has(INSPECT_PARAM)) return
  url.searchParams.delete(INSPECT_PARAM)
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
  onSlug: (slug: string | null, inspect: boolean) => void
}) {
  const searchParams = useSearchParams()
  const slug = searchParams?.get(PARAM) ?? null
  const inspect = searchParams?.get(INSPECT_PARAM) === '1'
  useEffect(() => {
    onSlug(slug, inspect)
  }, [slug, inspect, onSlug])
  return null
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  // Local state is the source of truth — UrlSlugSync mirrors external URL
  // changes (back/forward, next/link, manual edit) into it; setOpenSlug
  // mirrors programmatic open/close back into the URL.
  const [openSlug, setOpenSlugState] = useState<string | null>(null)
  const [originRect, setOriginRect] = useState<OverlayOrigin | null>(null)

  // The one-shot arming lives in lib/overlay/inspectArm.ts — a pure factory,
  // so the subtle part (a stale arm must never mute a DIFFERENT item) is unit
  // tested instead of only reasoned about. A ref, not state: consuming must not
  // schedule a render, or OverlayRouter's open effect would re-run after the
  // clear and emit the very event this suppresses.
  const inspectRef = useRef(createInspectArm())

  const syncFromUrl = useCallback((slug: string | null, inspect: boolean) => {
    if (slug && inspect) {
      inspectRef.current.arm(slug)
      // Strip immediately. The flag belongs to THIS open; leaving it in the URL
      // would re-arm on every back/forward and look like lost engagement.
      clearInspectFromUrl()
    } else if (slug !== inspectRef.current.peek()) {
      inspectRef.current.disarm()
    }
    setOpenSlugState((prev) => (prev === slug ? prev : slug))
  }, [])

  const setOpenSlug = useCallback((slug: string | null) => {
    // A programmatic open (card click, close) is always a real one.
    inspectRef.current.disarm()
    setOpenSlugState(slug)
    writeSlugToUrl(slug)
  }, [])

  const consumeInspectOpen = useCallback(
    (itemSlug: string) => inspectRef.current.consume(itemSlug),
    [],
  )

  const value = useMemo(
    () => ({ openSlug, setOpenSlug, originRect, setOriginRect, consumeInspectOpen }),
    [openSlug, setOpenSlug, originRect, consumeInspectOpen],
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

  return {
    openSlug: ctx.openSlug,
    open,
    close,
    originRect: ctx.originRect,
    consumeInspectOpen: ctx.consumeInspectOpen,
  }
}
