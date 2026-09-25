'use client'

/**
 * Spotify bridge — the embed iFrame API. Lazy, like YouTube. Its controller
 * binds to an initial `spotify:` URI (the first one primed); later tracks
 * switch with `loadUri()`. Spotify ignores a play() sent in the same tick as
 * a load (the embed reloads asynchronously), so a load ARMS play and the arm
 * is drained on the first `playback_update` of the reloaded track, with a
 * short timer as a fallback.
 *
 * Platform limit, stated honestly: without Spotify Premium signed in on this
 * browser the embed only plays a ~30 s preview. We report it (`preview`).
 */

import { useEffect, type RefObject } from 'react'
import { usePlayer } from '@/lib/store/player'
import { extractSpotifyUri } from './sources'
import { loadScript } from './scripts'

const API = 'https://open.spotify.com/embed/iframe-api/v1'

interface PlaybackData {
  isPaused?: boolean
  isBuffering?: boolean
  position?: number
  duration?: number
}

interface SpotifyController {
  play: () => void
  pause: () => void
  resume: () => void
  seek: (seconds: number) => void
  loadUri: (uri: string) => void
  destroy: () => void
  addListener: (event: string, cb: (e: { data: PlaybackData }) => void) => void
}

interface SpotifyAPI {
  createController: (el: HTMLElement, opts: { uri: string; width?: string | number; height?: string | number }, cb: (c: SpotifyController) => void) => void
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyAPI) => void
    __gradienteSpotify?: SpotifyAPI
  }
}

let ready: Promise<SpotifyAPI> | null = null

function loadSpotify(): Promise<SpotifyAPI> {
  if (window.__gradienteSpotify) return Promise.resolve(window.__gradienteSpotify)
  if (ready) return ready
  ready = new Promise<SpotifyAPI>((resolve, reject) => {
    const prev = window.onSpotifyIframeApiReady
    window.onSpotifyIframeApiReady = (api) => {
      prev?.(api)
      window.__gradienteSpotify = api
      resolve(api)
    }
    loadScript(API).catch((e) => {
      ready = null
      reject(e)
    })
  })
  return ready
}

const mine = () => usePlayer.getState().track?.source.platform === 'spotify'

export function useSpotifyBridge(host: RefObject<HTMLDivElement | null>, seedUrl: string | null) {
  useEffect(() => {
    const wrap = host.current
    const seed = seedUrl ? extractSpotifyUri(seedUrl) : null
    if (!wrap || !seed) return
    let cancelled = false
    let controller: SpotifyController | null = null
    let off: (() => void) | null = null
    let armed = false
    let armTimer = 0
    let endedFired = false
    const report = (p: Parameters<ReturnType<typeof usePlayer.getState>['report']>[0]) => usePlayer.getState().report(p)
    const arm = () => {
      armed = true
      window.clearTimeout(armTimer)
      armTimer = window.setTimeout(() => {
        if (armed && controller) {
          armed = false
          controller.play()
        }
      }, 900)
    }

    loadSpotify()
      .then((api) => {
        if (cancelled) return
        const mount = document.createElement('div')
        wrap.appendChild(mount)
        api.createController(mount, { uri: seed, width: '100%', height: '80' }, (c) => {
          if (cancelled) {
            c.destroy()
            return
          }
          controller = c
          c.addListener('playback_update', (e) => {
            if (cancelled) return
            if (armed) {
              armed = false
              c.play()
            }
            if (!mine()) return
            const d = e.data ?? {}
            const patch: Parameters<typeof report>[0] = {}
            if (typeof d.isPaused === 'boolean') {
              patch.playing = !d.isPaused
              if (!d.isPaused) patch.loading = Boolean(d.isBuffering)
            }
            if (typeof d.position === 'number') patch.time = d.position / 1000
            if (d.duration) {
              patch.duration = d.duration / 1000
              patch.preview = d.duration <= 31_000
            }
            report(patch)
            // No ended event: paused with the playhead at the end, once per track.
            if (d.isPaused && d.duration && typeof d.position === 'number' && d.position >= d.duration - 1200) {
              if (!endedFired) {
                endedFired = true
                usePlayer.getState().ended()
              }
            } else if (d.isPaused === false) {
              endedFired = false
            }
          })
          off = usePlayer.getState().registerTransport({
            platform: 'spotify',
            load: (url, autoplay) => {
              const uri = extractSpotifyUri(url)
              if (!uri) return report({ fault: 'NO DISPONIBLE', loading: false, playing: false })
              endedFired = false
              c.loadUri(uri)
              if (autoplay) arm()
            },
            play: () => c.resume(),
            pause: () => c.pause(),
            seek: (s) => c.seek(Math.max(0, s)),
          })
        })
      })
      .catch(() => {
        if (!cancelled && mine()) report({ fault: 'SIN CONEXIÓN', loading: false, playing: false })
      })

    return () => {
      cancelled = true
      window.clearTimeout(armTimer)
      off?.()
      off = null
      try {
        controller?.destroy()
      } catch {
        /* already gone */
      }
      controller = null
      wrap.replaceChildren()
    }
  }, [host, seedUrl])
}
