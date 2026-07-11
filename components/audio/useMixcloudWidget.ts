'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EmbedWidget } from './types'
import { extractMixcloudFeed } from '@/components/embed/platforms'

// Mixcloud Widget API bridge. Mixcloud is core to the DJ-mix world, and unlike
// Bandcamp it ships a real control API, so it drops straight into the shared
// EmbedWidget contract. The provider mounts the iframe with an initial feed
// (Mixcloud's PlayerWidget needs a feed-bearing iframe to bind to); track
// switches go through widget.load() so the iframe never remounts.
//
// Mixcloud exposes no per-track metadata getter, so `track` stays null — the
// player chrome already sources title/artist/cover from the ContentItem.

const SCRIPT_URL = 'https://widget.mixcloud.com/media/js/widgetApi.js'

// Mixcloud's PlayerWidget ready-handshake (a postMessage from the widget iframe
// that resolves `widget.ready`) is unreliable — empirically it's dropped on
// roughly half of binds, non-deterministically. A single bind therefore leaves
// the player permanently "not ready": the pending feed never drains and nothing
// ever plays. We recover by racing each bind against a timeout and, on a miss,
// reloading the iframe + rebinding until one attempt readies.
const READY_TIMEOUT_MS = 4000
const MAX_READY_ATTEMPTS = 6

interface MCWidget {
  ready: Promise<void>
  load: (cloudcastKey: string, startPlaying?: boolean) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  seek: (seconds: number) => Promise<boolean>
  events: {
    play: { on: (cb: () => void) => void }
    pause: { on: (cb: () => void) => void }
    ended: { on: (cb: () => void) => void }
    progress: { on: (cb: (position: number, duration: number) => void) => void }
  }
}

declare global {
  interface Window {
    Mixcloud?: { PlayerWidget: (iframe: HTMLIFrameElement) => MCWidget }
  }
}

let scriptPromise: Promise<void> | null = null

function loadMixcloudAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.Mixcloud?.PlayerWidget) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${SCRIPT_URL}"]`,
    ) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('MC API failed')))
      return
    }
    const s = document.createElement('script')
    s.src = SCRIPT_URL
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('MC API failed'))
    document.head.appendChild(s)
  })
  return scriptPromise
}

export function useMixcloudWidget(
  iframeRef: React.RefObject<HTMLIFrameElement>,
  enabled: boolean,
  onEnded?: () => void,
): EmbedWidget {
  const widgetRef = useRef<MCWidget | null>(null)
  // Ref-held so the ended binding (set up once) sees the latest handler.
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded
  // A feed chosen before the widget finished booting — drained on ready.
  const pendingRef = useRef<string | null>(null)

  const [ready, setReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const iframe = iframeRef.current
    if (!iframe || widgetRef.current) return
    let cancelled = false
    let readyTimer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0
    // Set just before we imperatively reload the iframe, so the iframe's own
    // load event (which also fires for its very first load) only triggers a
    // rebind for reloads WE initiate — the first bind is driven directly.
    let reloadPending = false

    const attempt = () => {
      if (cancelled || !window.Mixcloud) return
      attempts += 1
      const widget = window.Mixcloud.PlayerWidget(iframe)
      let settled = false
      widget.ready
        .then(() => {
          if (cancelled) return
          settled = true
          if (readyTimer) clearTimeout(readyTimer)
          widgetRef.current = widget
          setReady(true)
          widget.events.play.on(() => !cancelled && setIsPlaying(true))
          widget.events.pause.on(() => !cancelled && setIsPlaying(false))
          widget.events.ended.on(() => {
            if (cancelled) return
            setIsPlaying(false)
            onEndedRef.current?.()
          })
          widget.events.progress.on((position, dur) => {
            if (cancelled) return
            setCurrentTime(position || 0)
            if (dur) setDuration(dur)
          })
          if (pendingRef.current) {
            widget.load(pendingRef.current, true)
            pendingRef.current = null
          }
        })
        .catch(() => {
          /* this bind failed — the timeout below reloads + rebinds */
        })

      // If ready doesn't resolve in time, the handshake was dropped: reload the
      // iframe (its load event rebinds via onLoad) and try again, up to a cap so
      // a genuinely dead/private cloudcast doesn't reload forever.
      readyTimer = setTimeout(() => {
        if (cancelled || settled) return
        if (attempts >= MAX_READY_ATTEMPTS) return
        reloadPending = true
        // eslint-disable-next-line no-self-assign
        iframe.src = iframe.src
      }, READY_TIMEOUT_MS)
    }

    const onLoad = () => {
      if (!reloadPending) return
      reloadPending = false
      attempt()
    }
    iframe.addEventListener('load', onLoad)

    loadMixcloudAPI()
      .then(() => {
        if (!cancelled) attempt()
      })
      .catch(() => {
        /* script failed — feature degrades to not-ready */
      })

    return () => {
      cancelled = true
      if (readyTimer) clearTimeout(readyTimer)
      iframe.removeEventListener('load', onLoad)
    }
  }, [enabled, iframeRef])

  const load = useCallback(
    (url: string) => {
      const feed = extractMixcloudFeed(url)
      if (!feed) return
      setCurrentTime(0)
      setDuration(0)
      const w = widgetRef.current
      if (w && ready) w.load(feed, true)
      else pendingRef.current = feed
    },
    [ready],
  )

  const play = useCallback(() => widgetRef.current?.play(), [])
  const pause = useCallback(() => widgetRef.current?.pause(), [])
  const toggle = useCallback(() => widgetRef.current?.togglePlay(), [])
  const seek = useCallback((sec: number) => {
    void widgetRef.current?.seek(sec)
  }, [])

  return {
    ready,
    isPlaying,
    currentTime,
    duration,
    track: null,
    play,
    pause,
    toggle,
    seek,
    load,
  }
}
