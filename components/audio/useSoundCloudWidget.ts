'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EmbedTrackMeta, EmbedWidget } from './types'

// Wraps SoundCloud's Widget JS API (https://w.soundcloud.com/player/api.js).
// Lets us drive a hidden SoundCloud iframe from our own player chrome —
// transport, progress, track metadata — without the iframe being visible.
// Returns the platform-agnostic EmbedWidget shape so other platforms
// (YouTube, Mixcloud, etc.) can drop in by implementing the same interface.

const SCRIPT_URL = 'https://w.soundcloud.com/player/api.js'

interface SCWidgetEvents {
  READY: string
  PLAY: string
  PAUSE: string
  FINISH: string
  PLAY_PROGRESS: string
  ERROR: string
}

interface SCSoundData {
  title?: string
  user?: { username?: string }
  duration?: number
  artwork_url?: string | null
  permalink_url?: string
}

interface SCWidgetInstance {
  bind: (event: string, fn: (data?: unknown) => void) => void
  unbind: (event: string) => void
  load: (
    url: string,
    options?: { auto_play?: boolean; callback?: () => void },
  ) => void
  play: () => void
  pause: () => void
  toggle: () => void
  seekTo: (ms: number) => void
  getDuration: (cb: (ms: number) => void) => void
  getPosition: (cb: (ms: number) => void) => void
  getCurrentSound: (cb: (sound: SCSoundData | null) => void) => void
}

declare global {
  interface Window {
    SC?: {
      Widget: ((iframe: HTMLIFrameElement) => SCWidgetInstance) & {
        Events: SCWidgetEvents
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null

function loadSoundCloudAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.SC?.Widget) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[src="${SCRIPT_URL}"]`,
    ) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('SC API failed')))
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('SC API failed'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

export function useSoundCloudWidget(
  iframeRef: React.RefObject<HTMLIFrameElement>,
): EmbedWidget {
  const widgetRef = useRef<SCWidgetInstance | null>(null)
  const [ready, setReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [track, setTrack] = useState<EmbedTrackMeta | null>(null)

  useEffect(() => {
    let cancelled = false
    const iframe = iframeRef.current
    if (!iframe) return

    loadSoundCloudAPI()
      .then(() => {
        if (cancelled) return
        const SC = window.SC
        if (!SC?.Widget) return
        const widget = SC.Widget(iframe)
        widgetRef.current = widget

        widget.bind(SC.Widget.Events.READY, () => {
          if (cancelled) return
          setReady(true)
          widget.getDuration((d) => !cancelled && setDuration(d / 1000))
          widget.getCurrentSound((sound) => {
            if (cancelled || !sound) return
            setTrack({
              title: sound.title ?? '',
              artist: sound.user?.username ?? '',
              artwork: sound.artwork_url ?? null,
              url: sound.permalink_url ?? null,
            })
            if (sound.duration) setDuration(sound.duration / 1000)
          })
        })
        widget.bind(SC.Widget.Events.PLAY, () => !cancelled && setIsPlaying(true))
        widget.bind(SC.Widget.Events.PAUSE, () => !cancelled && setIsPlaying(false))
        widget.bind(SC.Widget.Events.FINISH, () => !cancelled && setIsPlaying(false))
        widget.bind(SC.Widget.Events.PLAY_PROGRESS, (data?: unknown) => {
          if (cancelled) return
          const d = data as { currentPosition?: number } | undefined
          if (d?.currentPosition != null) setCurrentTime(d.currentPosition / 1000)
        })
      })
      .catch(() => {
        // Script failed — feature degrades to "not ready"; player still renders.
      })

    return () => {
      cancelled = true
      const w = widgetRef.current
      const SC = typeof window !== 'undefined' ? window.SC : undefined
      if (w && SC?.Widget) {
        try { w.unbind(SC.Widget.Events.READY) } catch { /* noop */ }
        try { w.unbind(SC.Widget.Events.PLAY) } catch { /* noop */ }
        try { w.unbind(SC.Widget.Events.PAUSE) } catch { /* noop */ }
        try { w.unbind(SC.Widget.Events.FINISH) } catch { /* noop */ }
        try { w.unbind(SC.Widget.Events.PLAY_PROGRESS) } catch { /* noop */ }
      }
      widgetRef.current = null
    }
  }, [iframeRef])

  const play = useCallback(() => widgetRef.current?.play(), [])
  const pause = useCallback(() => widgetRef.current?.pause(), [])
  const toggle = useCallback(() => widgetRef.current?.toggle(), [])
  const seek = useCallback(
    (sec: number) => widgetRef.current?.seekTo(sec * 1000),
    [],
  )
  // Switch tracks in the existing iframe — keeps the widget binding alive,
  // tab capture permission persists, no iframe remount. SC's READY event
  // will fire again with the new track's metadata; the bindings set up in
  // the effect above already update state on it.
  const load = useCallback((canonicalUrl: string) => {
    const w = widgetRef.current
    if (!w) return
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setTrack(null)
    w.load(canonicalUrl, { auto_play: true })
  }, [])

  return {
    ready,
    isPlaying,
    currentTime,
    duration,
    track,
    play,
    pause,
    toggle,
    seek,
    load,
  }
}
