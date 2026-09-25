'use client'

/**
 * CONSOLA — the persistent deck. The field listens to it.
 *
 * Mounted once by the Shell and never torn down, so audio survives every
 * navigation and every reading. Three layers:
 *   · Puentes — the hidden SoundCloud / YouTube / Spotify players (always
 *     mounted, even on routes where the deck hides)
 *   · the listening loop — feeds `setFieldAudio` while something sounds:
 *     real bands when the tab is shared, a BPM-derived pulse otherwise
 *   · the visible deck — Cápsula (collapsed) or Sala (expanded), portaled to
 *     <body> so it can sit above a reading (z 61) instead of under its
 *     backdrop, where it would be dimmed and unreachable.
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { useHydrated } from '@/lib/useMedia'
import { usePlayer } from '@/lib/store/player'
import { useUI } from '@/lib/store/ui'
import { Puentes } from './Puentes'
import { Capsula } from './Capsula'
import { Sala } from './Sala'
import { useCola, useReducedMotion, useSenalLoop, useTempo, useVigia } from './hooks'

/** Routes that bring their own full-screen chrome: the deck steps aside (audio keeps going). */
const HIDDEN = ['/welcome', '/espera']

export function Consola() {
  const pathname = usePathname() ?? '/'
  const hidden = HIDDEN.some((p) => pathname.startsWith(p))
  const mounted = useHydrated()
  const track = usePlayer((s) => s.track)
  const expanded = usePlayer((s) => s.expanded)
  const lectura = useUI((s) => s.lectura)
  const reduced = useReducedMotion()
  const bpm = useTempo(track)

  useCola()
  useVigia()
  useSenalLoop(bpm, reduced)

  useEffect(() => {
    // Development only: lets headless checks drive deck states (audio can't play there).
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __gradientePlayer?: typeof usePlayer }).__gradientePlayer = usePlayer
  }, [])

  // The sala never outlives a navigation or a reading opening over it.
  useEffect(() => {
    usePlayer.getState().setExpanded(false)
  }, [pathname])
  useEffect(() => {
    if (lectura) usePlayer.getState().setExpanded(false)
  }, [lectura])

  if (!mounted) return null
  return (
    <>
      <Puentes />
      {createPortal(
        <>
          <Capsula bpm={bpm} hidden={hidden} />
          {expanded && !hidden ? <Sala bpm={bpm} /> : null}
        </>,
        document.body,
      )}
    </>
  )
}
