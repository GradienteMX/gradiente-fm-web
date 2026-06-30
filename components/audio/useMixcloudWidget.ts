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
): EmbedWidget {
  const widgetRef = useRef<MCWidget | null>(null)
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

    loadMixcloudAPI()
      .then(() => {
        if (cancelled || !window.Mixcloud) return
        const widget = window.Mixcloud.PlayerWidget(iframe)
        widgetRef.current = widget
        widget.ready
          .then(() => {
            if (cancelled) return
            setReady(true)
            widget.events.play.on(() => !cancelled && setIsPlaying(true))
            widget.events.pause.on(() => !cancelled && setIsPlaying(false))
            widget.events.ended.on(() => !cancelled && setIsPlaying(false))
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
            /* widget never became ready — stays "not ready", player still renders */
          })
      })
      .catch(() => {
        /* script failed — feature degrades to not-ready */
      })

    return () => {
      cancelled = true
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
