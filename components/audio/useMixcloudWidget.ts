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
  // Whether Mixcloud currently owns playback (activePlatform === 'mixcloud').
  // Ref-read at drain time so a feed that was pending while the widget booted
  // only AUTOPLAYS if the user is still on this platform — otherwise it loads
  // silently. Without this, a slow Mixcloud that readies AFTER the user gave up
  // and played something else would autoplay on top of it (two sources at once,
  // uncontrollable), which read as "Mixcloud breaks the whole player".
  isActive: boolean,
  onEnded?: () => void,
): EmbedWidget {
  const widgetRef = useRef<MCWidget | null>(null)
  // Ref-held so the ended binding (set up once) sees the latest handler.
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive
  // A feed chosen before the widget finished booting — drained on ready.
  const pendingRef = useRef<string | null>(null)
  // The cloudcast currently loaded in the iframe. Seeded at bind time from the
  // iframe's own src (the provider bakes the initial feed into it). Mixcloud's
  // widget.load() silently NO-OPS — startPlaying included — when handed the key
  // it already has, so "load the same track" must become play() instead. This
  // was the dead first click: priming baked feed X into the iframe, the user's
  // play then load()ed feed X → ignored → nothing ever sounded.
  const loadedFeedRef = useRef<string | null>(null)

  const [ready, setReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Verified live (2026-07-12): two Mixcloud widget quirks force this shape.
  //   1. widget.play() RESOLVES but never starts a player that has never
  //      played — only togglePlay() actually kicks it off.
  //   2. Right after `ready` resolves the internal player still silently DROPS
  //      transport commands for a while — the same togglePlay that's ignored
  //      at ready-time works seconds later.
  // So "make it sound" = togglePlay now + spaced retries, each guarded by the
  // live isPlaying state (ref-held) so a retry can never PAUSE an already-
  // sounding player; all pending retries are cleared the moment the play
  // event confirms audio, and a retry only fires while Mixcloud still owns
  // playback (isActiveRef) so it can't unpause over another platform.
  const isPlayingRef = useRef(false)
  isPlayingRef.current = isPlaying
  const kickTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const clearKicks = useCallback(() => {
    kickTimersRef.current.forEach(clearTimeout)
    kickTimersRef.current = []
  }, [])
  // `immediate: false` (used right after a widget.load of a NEW feed) skips
  // the instant toggle: if the load's own startPlaying works, an immediate
  // toggle racing ahead of its play event would PAUSE it. The delayed retries
  // are safe either way — by then the play event has landed if autoplay worked.
  const startPlayback = useCallback(
    (immediate = true) => {
      clearKicks()
      const tryStart = () => {
        const w = widgetRef.current
        if (!w) return
        if (!isPlayingRef.current && isActiveRef.current) w.togglePlay()
      }
      if (immediate) tryStart()
      for (const delay of [1500, 3500, 7000]) {
        kickTimersRef.current.push(setTimeout(tryStart, delay))
      }
    },
    [clearKicks],
  )
  useEffect(() => clearKicks, [clearKicks])

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
          widget.events.play.on(() => {
            if (cancelled) return
            // Audio confirmed — any pending autoplay retries are done.
            clearKicks()
            setIsPlaying(true)
          })
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
          // What the iframe booted with — load() must know it to avoid the
          // same-key no-op described above.
          loadedFeedRef.current = extractMixcloudFeed(iframe.src)
          if (pendingRef.current) {
            const feed = pendingRef.current
            pendingRef.current = null
            // Autoplay ONLY if Mixcloud still owns playback — otherwise leave
            // it loaded/silent so it can't overlap whatever the user switched
            // to while this was booting.
            if (feed === loadedFeedRef.current) {
              if (isActiveRef.current) startPlayback()
            } else {
              loadedFeedRef.current = feed
              widget.load(feed, isActiveRef.current)
              // load()'s startPlaying flag is as droppable as play() right
              // after ready — back it with delayed guarded retries only.
              if (isActiveRef.current) startPlayback(false)
            }
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
  }, [enabled, iframeRef, startPlayback, clearKicks])

  const load = useCallback(
    (url: string) => {
      const feed = extractMixcloudFeed(url)
      if (!feed) return
      setCurrentTime(0)
      setDuration(0)
      const w = widgetRef.current
      if (w && ready) {
        // Same cloudcast that's already in the iframe → load() would no-op
        // (see loadedFeedRef above); the user asked to hear it, so start it.
        if (feed === loadedFeedRef.current) startPlayback()
        else {
          loadedFeedRef.current = feed
          w.load(feed, true)
          // Back load()'s droppable startPlaying flag with delayed retries.
          startPlayback(false)
        }
      } else {
        pendingRef.current = feed
      }
    },
    [ready, startPlayback],
  )

  const play = useCallback(() => startPlayback(), [startPlayback])
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
