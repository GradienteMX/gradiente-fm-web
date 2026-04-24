'use client'

import { ReactNode, useEffect, useState } from 'react'
import { CRTShader } from './CRTShader'
import { CRTPostProcess } from './CRTPostProcess'

type Mode = 'A' | 'B'

// Probe for the HTML-in-Canvas API (Chromium 147+ with #canvas-draw-element).
// We use WebGL's texElementImage2D; if that's present, the full API is there.
function hasHtmlInCanvas(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl') as WebGLRenderingContext & {
      texElementImage2D?: unknown
    } | null
    return typeof gl?.texElementImage2D === 'function'
  } catch {
    return false
  }
}

function pickMode(): Mode {
  if (typeof window === 'undefined') return 'A'

  // Path B is opt-in via ?pathB=1 while the architecture (canvas wrapping
  // the entire app + paint containment + fixed positioning + scroll) is
  // still unstable in Chromium's experimental implementation. Default
  // everyone to Path A so the site ships a working CRT effect regardless
  // of whether the HTML-in-Canvas flag is enabled.
  const pathBOptIn = new URLSearchParams(window.location.search).get('pathB') === '1'
  if (!pathBOptIn) return 'A'

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'A'
  if (!window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches) return 'A'
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (typeof mem === 'number' && mem < 4) return 'A'
  if (!hasHtmlInCanvas()) return 'A'
  return 'B'
}

/**
 * CRTOverlay — wraps the whole app and decides between:
 *   Path A (decorative shader overlay) — legacy, works everywhere
 *   Path B (html-in-canvas post-process) — Chromium 147+ with flag
 *
 * IMPORTANT: place this INSIDE context providers (VibeProvider, OverlayProvider,
 * etc.). The mode switch re-parents `children`, which would remount any state
 * owned below CRTOverlay. Keep providers above.
 */
export function CRTOverlay({ children }: { children: ReactNode }) {
  // null during SSR + initial hydration — render children verbatim so the
  // hydrated tree matches what the server emitted. After mount we know the
  // capabilities and switch.
  const [mode, setMode] = useState<Mode | null>(null)

  useEffect(() => {
    setMode(pickMode())
    // Don't re-pick on resize — crossing the lg/pointer-fine boundary would
    // restructure the tree and drop local component state.
  }, [])

  if (mode === null) return <>{children}</>
  if (mode === 'B') return <CRTPostProcess>{children}</CRTPostProcess>
  return (
    <>
      {children}
      <CRTShader />
    </>
  )
}
