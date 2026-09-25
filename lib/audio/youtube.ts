'use client'

/**
 * YouTube bridge — the IFrame Player API driving a hidden, offscreen player
 * as an AUDIO-ONLY source. Lazy: nothing loads until a YouTube source is
 * primed (a reader showing one, or a play). The player is created empty; the
 * track arrives through `loadVideoById` so a play autoplays within the
 * gesture once the API is bound. YouTube has no progress event — position is
 * polled (4 Hz) while playing.
 */

import { useEffect, type RefObject } from 'react'
import { usePlayer } from '@/lib/store/player'
import { extractYouTubeId } from './sources'
import { loadScript } from './scripts'

const API = 'https://www.youtube.com/iframe_api'

interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  loadVideoById: (id: string) => void
  cueVideoById: (id: string) => void
  getCurrentTime: () => number
  getDuration: () => number
  destroy: () => void
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      width?: number
      height?: number
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: () => void
        onStateChange?: (e: { data: number }) => void
        onError?: (e: { data: number }) => void
      }
    },
  ) => YTPlayer
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number; CUED: number }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let ready: Promise<void> | null = null

function loadYouTube(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (ready) return ready
  ready = new Promise<void>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    loadScript(API).catch((e) => {
      ready = null
      reject(e)
    })
  })
  return ready
}

const mine = () => usePlayer.getState().track?.source.platform === 'youtube'

export function useYouTubeBridge(host: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const wrap = host.current
    if (!enabled || !wrap) return
    let cancelled = false
    let player: YTPlayer | null = null
    let off: (() => void) | null = null
    let poll = 0
    const report = (p: Parameters<ReturnType<typeof usePlayer.getState>['report']>[0]) => usePlayer.getState().report(p)
    const stopPoll = () => {
      window.clearInterval(poll)
      poll = 0
    }
    const startPoll = () => {
      stopPoll()
      poll = window.setInterval(() => {
        if (!player || !mine()) return
        const d = player.getDuration?.() || 0
        report(d ? { time: player.getCurrentTime?.() || 0, duration: d } : { time: player.getCurrentTime?.() || 0 })
      }, 250)
    }

    loadYouTube()
      .then(() => {
        const YT = window.YT
        if (cancelled || !YT?.Player) return
        // YT replaces its mount node with an iframe — give it a fresh child of
        // a wrapper React owns but never renders into.
        const mount = document.createElement('div')
        wrap.appendChild(mount)
        const p = new YT.Player(mount, {
          width: 320,
          height: 200,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled || off) return
              off = usePlayer.getState().registerTransport({
                platform: 'youtube',
                load: (url, autoplay) => {
                  const id = extractYouTubeId(url)
                  if (!id) return report({ fault: 'NO DISPONIBLE', loading: false, playing: false })
                  if (autoplay) p.loadVideoById(id)
                  else p.cueVideoById(id)
                },
                play: () => p.playVideo(),
                pause: () => p.pauseVideo(),
                seek: (s) => p.seekTo(Math.max(0, s), true),
              })
            },
            onStateChange: (e) => {
              if (cancelled) return
              const S = YT.PlayerState
              if (!mine()) {
                stopPoll()
                return
              }
              if (e.data === S.PLAYING) {
                const d = p.getDuration() || 0
                report(d ? { playing: true, loading: false, duration: d } : { playing: true, loading: false })
                startPoll()
              } else if (e.data === S.BUFFERING) {
                report({ loading: true })
              } else if (e.data === S.PAUSED) {
                stopPoll()
                report({ playing: false, loading: false })
              } else if (e.data === S.ENDED) {
                stopPoll()
                report({ playing: false })
                usePlayer.getState().ended()
              }
            },
            onError: () => {
              if (!cancelled && mine()) report({ fault: 'NO DISPONIBLE', loading: false, playing: false })
            },
          },
        })
        player = p
      })
      .catch(() => {
        if (!cancelled && mine()) report({ fault: 'SIN CONEXIÓN', loading: false, playing: false })
      })

    return () => {
      cancelled = true
      stopPoll()
      off?.()
      off = null
      try {
        player?.destroy()
      } catch {
        /* already gone */
      }
      player = null
      wrap.replaceChildren()
    }
  }, [host, enabled])
}
