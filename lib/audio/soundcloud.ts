'use client'

/**
 * SoundCloud bridge — the Widget API (https://w.soundcloud.com/player/api.js)
 * driving ONE hidden iframe that lives for the whole session. It boots on a
 * placeholder sound (auto_play=false, never heard) so the API is bound before
 * anyone presses play; every track after that switches with `widget.load()`
 * inside the same iframe — no remount, so the first play of the session and
 * every skip stay inside the user's gesture.
 *
 * READY fires once per widget lifetime, so duration is re-read on every PLAY.
 * FINISH is only trusted after a PLAY for the sound we loaded last (a load
 * can flush a stale FINISH from the previous sound).
 */

import { useEffect, type RefObject } from 'react'
import { usePlayer, type Transport } from '@/lib/store/player'
import { loadScript } from './scripts'

const API = 'https://w.soundcloud.com/player/api.js'

/** Booted into the hidden iframe so the widget binds at load; never plays. */
export const SC_PLACEHOLDER = 'https://soundcloud.com/itsgettingtiresometoo/goodies'

const WIDGET_PARAMS = {
  hide_related: 'true',
  show_comments: 'false',
  show_user: 'false',
  show_reposts: 'false',
  show_teaser: 'false',
  show_artwork: 'false',
  visual: 'false',
  buying: 'false',
  sharing: 'false',
  download: 'false',
}

export function scEmbedSrc(url: string): string {
  const q = new URLSearchParams({ url, auto_play: 'false', ...WIDGET_PARAMS })
  return `https://w.soundcloud.com/player/?${q.toString()}`
}

interface SCEvents {
  READY: string
  PLAY: string
  PAUSE: string
  FINISH: string
  PLAY_PROGRESS: string
  ERROR: string
}

interface SCWidget {
  bind: (event: string, fn: (data?: unknown) => void) => void
  unbind: (event: string) => void
  load: (url: string, options?: Record<string, unknown>) => void
  play: () => void
  pause: () => void
  seekTo: (ms: number) => void
  getDuration: (cb: (ms: number) => void) => void
}

declare global {
  interface Window {
    SC?: { Widget: ((iframe: HTMLIFrameElement) => SCWidget) & { Events: SCEvents } }
  }
}

const mine = () => usePlayer.getState().track?.source.platform === 'soundcloud'

export function useSoundCloudBridge(iframe: RefObject<HTMLIFrameElement | null>) {
  useEffect(() => {
    const el = iframe.current
    if (!el) return
    let cancelled = false
    let widget: SCWidget | null = null
    let off: (() => void) | null = null
    let armed = false
    let loadedAt = 0
    let lastReport = 0
    const report = (p: Parameters<ReturnType<typeof usePlayer.getState>['report']>[0]) => usePlayer.getState().report(p)

    loadScript(API)
      .then(() => {
        const SC = window.SC
        if (cancelled || !SC?.Widget) return
        const w = SC.Widget(el)
        widget = w
        const E = SC.Widget.Events

        w.bind(E.READY, () => {
          if (cancelled || off) return
          const t: Transport = {
            platform: 'soundcloud',
            load: (url, autoplay) => {
              armed = false
              loadedAt = performance.now()
              w.load(url, { auto_play: autoplay, ...WIDGET_PARAMS })
            },
            play: () => w.play(),
            pause: () => w.pause(),
            seek: (s) => w.seekTo(Math.max(0, s) * 1000),
          }
          off = usePlayer.getState().registerTransport(t)
        })
        w.bind(E.PLAY, () => {
          if (cancelled || !mine()) return
          armed = true
          report({ playing: true, loading: false })
          w.getDuration((ms) => {
            if (!cancelled && ms && mine()) report({ duration: ms / 1000 })
          })
        })
        w.bind(E.PAUSE, () => {
          if (!cancelled && mine()) report({ playing: false })
        })
        w.bind(E.FINISH, () => {
          if (cancelled || !mine() || !armed || performance.now() - loadedAt < 1500) return
          armed = false
          usePlayer.getState().ended()
        })
        w.bind(E.PLAY_PROGRESS, (data) => {
          if (cancelled || !mine()) return
          const pos = (data as { currentPosition?: number } | undefined)?.currentPosition
          const t = performance.now()
          // The deck glides between reports; four a second is plenty.
          if (typeof pos === 'number' && t - lastReport > 240) {
            lastReport = t
            report({ time: pos / 1000 })
          }
        })
        w.bind(E.ERROR, () => {
          if (!cancelled && mine()) report({ fault: 'NO DISPONIBLE', loading: false, playing: false })
        })
      })
      .catch(() => {
        if (!cancelled && mine()) report({ fault: 'SIN CONEXIÓN', loading: false, playing: false })
      })

    return () => {
      cancelled = true
      off?.()
      off = null
      const SC = window.SC
      if (widget && SC?.Widget) {
        for (const ev of Object.values(SC.Widget.Events)) {
          try {
            widget.unbind(ev)
          } catch {
            /* already gone */
          }
        }
      }
      widget = null
    }
  }, [iframe])
}
