'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EmbedTrackMeta, EmbedWidget } from './types'
import { extractYouTubeId } from '@/components/embed/platforms'

// YouTube IFrame Player API bridge. Drives a hidden YouTube player as an
// AUDIO-ONLY source: the provider parks the iframe offscreen, so the video
// never shows but its audio plays into the tab — which the particle visualizer
// captures the same way it captures any other source. Implements the shared
// EmbedWidget contract so the global player treats YouTube exactly like
// SoundCloud (transport + progress + track metadata).
//
// `enabled` gates the whole thing: until the platform is primed (a YouTube mix
// has been viewed), the API script never loads and no player is created — so
// home/idle pays zero YouTube cost.

const SCRIPT_URL = 'https://www.youtube.com/iframe_api'

// Minimal types — the IFrame API ships no TypeScript definitions.
interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  loadVideoById: (videoId: string) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  getVideoData: () => { title?: string; author?: string; video_id?: string }
  destroy: () => void
}

interface YTNamespace {
  Player: new (
    el: HTMLElement | string,
    opts: {
      videoId?: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (e: { target: YTPlayer }) => void
        onStateChange?: (e: { data: number; target: YTPlayer }) => void
      }
    },
  ) => YTPlayer
  PlayerState: {
    PLAYING: number
    PAUSED: number
    ENDED: number
    BUFFERING: number
    CUED: number
  }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<void> | null = null

function loadYouTubeAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.YT?.Player) return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    // The API calls this global exactly ONCE when ready. Chain any prior
    // handler so multiple consumers (or a future second bridge) all resolve.
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
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

export function useYouTubeWidget(
  hostRef: React.RefObject<HTMLDivElement>,
  enabled: boolean,
): EmbedWidget {
  const playerRef = useRef<YTPlayer | null>(null)
  // A video id chosen before the player finished booting — drained on ready.
  const pendingRef = useRef<string | null>(null)
  const pollIdRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [ready, setReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [track, setTrack] = useState<EmbedTrackMeta | null>(null)

  // YouTube has no progress event — poll position while playing.
  const stopPolling = useCallback(() => {
    if (pollIdRef.current) {
      clearInterval(pollIdRef.current)
      pollIdRef.current = null
    }
  }, [])
  const startPolling = useCallback(() => {
    stopPolling()
    pollIdRef.current = setInterval(() => {
      const p = playerRef.current
      if (p) setCurrentTime(p.getCurrentTime() || 0)
    }, 250)
  }, [stopPolling])

  const syncTrack = useCallback((p: YTPlayer) => {
    const vd = p.getVideoData?.()
    if (vd?.title) {
      setTrack({
        title: vd.title,
        artist: vd.author ?? '',
        artwork: null,
        url: vd.video_id ? `https://www.youtube.com/watch?v=${vd.video_id}` : null,
      })
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const host = hostRef.current
    if (!host || playerRef.current) return
    let cancelled = false

    loadYouTubeAPI().then(() => {
      if (cancelled || !window.YT?.Player || playerRef.current) return
      const player = new window.YT.Player(host, {
        // Created empty — the real track arrives via load()/loadVideoById so a
        // first play autoplays within the user's click gesture.
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (cancelled) return
            setReady(true)
            if (pendingRef.current) {
              player.loadVideoById(pendingRef.current) // autoplays
              pendingRef.current = null
            }
          },
          onStateChange: (e) => {
            if (cancelled || !window.YT) return
            const S = window.YT.PlayerState
            if (e.data === S.PLAYING) {
              setIsPlaying(true)
              setDuration(player.getDuration() || 0)
              syncTrack(player)
              startPolling()
            } else if (e.data === S.PAUSED || e.data === S.ENDED) {
              setIsPlaying(false)
              stopPolling()
              if (e.data === S.ENDED) setCurrentTime(0)
            }
          },
        },
      })
      playerRef.current = player
    })

    return () => {
      cancelled = true
    }
  }, [enabled, hostRef, startPolling, stopPolling, syncTrack])

  // Tear down the poll loop on unmount (the provider lives for the page's life,
  // so the player itself is intentionally not destroyed mid-session).
  useEffect(() => stopPolling, [stopPolling])

  const load = useCallback((url: string) => {
    const id = extractYouTubeId(url)
    if (!id) return
    setCurrentTime(0)
    setDuration(0)
    setTrack(null)
    const p = playerRef.current
    if (p && ready) {
      p.loadVideoById(id) // autoplays
    } else {
      pendingRef.current = id // drained in onReady
    }
  }, [ready])

  const play = useCallback(() => playerRef.current?.playVideo(), [])
  const pause = useCallback(() => playerRef.current?.pauseVideo(), [])
  const toggle = useCallback(() => {
    const p = playerRef.current
    if (!p || !window.YT) return
    if (p.getPlayerState() === window.YT.PlayerState.PLAYING) p.pauseVideo()
    else p.playVideo()
  }, [])
  const seek = useCallback((sec: number) => {
    playerRef.current?.seekTo(sec, true)
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
