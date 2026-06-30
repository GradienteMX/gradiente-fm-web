'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EmbedWidget } from './types'
import { extractSpotifyUri } from '@/components/embed/platforms'

// Spotify IFrame API bridge. NOTE the platform's hard limitation: the embed
// controller only plays a ~30-second PREVIEW unless the listener is signed into
// Spotify Premium in this browser, in which case it plays the full track. We
// can't change that — it's enforced Spotify-side. The bridge still implements
// the full EmbedWidget contract so the player chrome behaves identically; what
// plays is just whatever Spotify allows for the current listener.
//
// Spotify's createController needs an initial URI to bind, so the provider
// seeds one (spInitialUri) the first time a Spotify mix is primed; later tracks
// switch via controller.loadUri().

const SCRIPT_URL = 'https://open.spotify.com/embed/iframe-api/v1'

interface SpotifyController {
  play: () => void
  pause: () => void
  togglePlay: () => void
  resume: () => void
  seek: (seconds: number) => void
  loadUri: (uri: string) => void
  destroy: () => void
  addListener: (event: string, cb: (e: { data: SpotifyPlaybackData }) => void) => void
}

interface SpotifyPlaybackData {
  isPaused?: boolean
  isBuffering?: boolean
  position?: number // ms
  duration?: number // ms
}

interface SpotifyIFrameAPI {
  createController: (
    el: HTMLElement,
    opts: { uri: string; width?: string | number; height?: string | number },
    cb: (controller: SpotifyController) => void,
  ) => void
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void
    __spotifyIframeApi?: SpotifyIFrameAPI
  }
}

let apiPromise: Promise<SpotifyIFrameAPI> | null = null

function loadSpotifyAPI(): Promise<SpotifyIFrameAPI> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('no window'))
  }
  if (window.__spotifyIframeApi) return Promise.resolve(window.__spotifyIframeApi)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    // Spotify calls this global once with the API handle.
    const prev = window.onSpotifyIframeApiReady
    window.onSpotifyIframeApiReady = (api) => {
      prev?.(api)
      window.__spotifyIframeApi = api
      resolve(api)
    }
    if (!document.querySelector(`script[src="${SCRIPT_URL}"]`)) {
      const s = document.createElement('script')
      s.src = SCRIPT_URL
      s.async = true
      document.head.appendChild(s)
    }
  })
  return apiPromise
}

export function useSpotifyWidget(
  hostRef: React.RefObject<HTMLDivElement>,
  enabled: boolean,
  initialUri: string | null,
): EmbedWidget {
  const controllerRef = useRef<SpotifyController | null>(null)
  // A URI chosen before the controller existed — drained once it's created.
  const pendingRef = useRef<string | null>(null)
  // Spotify ignores a play() fired in the same tick as loadUri() (the embed
  // reloads async). So after a load we ARM play and drain it on the first
  // `playback_update` the reloaded track emits — with a short timer as a
  // belt-and-suspenders in case that event doesn't fire.
  const pendingPlayRef = useRef(false)
  const playTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [ready, setReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const armPlay = useCallback(() => {
    pendingPlayRef.current = true
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current)
    playTimeoutRef.current = setTimeout(() => {
      if (pendingPlayRef.current && controllerRef.current) {
        controllerRef.current.play()
        pendingPlayRef.current = false
      }
    }, 350)
  }, [])

  useEffect(() => {
    if (!enabled || !initialUri) return
    const host = hostRef.current
    if (!host || controllerRef.current) return
    let cancelled = false

    loadSpotifyAPI()
      .then((api) => {
        if (cancelled || controllerRef.current) return
        api.createController(
          host,
          { uri: initialUri, width: '100%', height: '80' },
          (controller) => {
            if (cancelled) {
              controller.destroy?.()
              return
            }
            controllerRef.current = controller
            setReady(true)
            controller.addListener('playback_update', (e) => {
              if (cancelled) return
              // Drain an armed play() now that the reloaded track is live.
              if (pendingPlayRef.current) {
                controller.play()
                pendingPlayRef.current = false
              }
              const d = e.data
              if (typeof d.isPaused === 'boolean') setIsPlaying(!d.isPaused)
              if (typeof d.position === 'number') setCurrentTime(d.position / 1000)
              if (d.duration) setDuration(d.duration / 1000)
            })
            if (pendingRef.current) {
              controller.loadUri(pendingRef.current)
              armPlay()
              pendingRef.current = null
            }
          },
        )
      })
      .catch(() => {
        /* script failed — feature degrades to not-ready */
      })

    return () => {
      cancelled = true
    }
  }, [enabled, hostRef, initialUri, armPlay])

  // Clear the play-fallback timer on unmount.
  useEffect(
    () => () => {
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current)
    },
    [],
  )

  const load = useCallback(
    (url: string) => {
      const uri = extractSpotifyUri(url)
      if (!uri) return
      setCurrentTime(0)
      setDuration(0)
      const c = controllerRef.current
      if (c) {
        c.loadUri(uri)
        armPlay()
      } else {
        pendingRef.current = uri
      }
    },
    [armPlay],
  )

  const play = useCallback(() => controllerRef.current?.play(), [])
  const pause = useCallback(() => controllerRef.current?.pause(), [])
  const toggle = useCallback(() => controllerRef.current?.togglePlay(), [])
  const seek = useCallback((sec: number) => controllerRef.current?.seek(sec), [])

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
