'use client'

/**
 * PLAYER — the Consola's state. One persistent deck for the whole app;
 * audio survives navigation and closing readings. Platform bridges (SC /
 * YouTube / Spotify) register a `Transport`; everything else talks to this
 * store. Bandcamp and Mixcloud are link-out only (no control API).
 *
 * `play()` must be called inside the user's gesture: it drives the bridge
 * synchronously (a postMessage), before anything awaits. A lazy bridge that
 * isn't mounted yet is *primed* and drains the pending load when it's ready.
 *
 * Queues: `queue` is what prev/next walk. A reader may set one (a list's
 * tracks: `play(track, queue)`); playing anything outside it hands prev/next
 * back to `ambient` — the field's queue, seeded by the Consola with the
 * playable mixes of the whole world ordered by current HL.
 */

import { create } from 'zustand'
import type { ContentItem, EmbedPlatform, MixEmbed } from '@/lib/types'
import { isHttp, isPlayableEmbed } from '@/lib/audio/sources'

export interface Track {
  /** The piece this audio belongs to (mix, or a listicle track's parent). */
  itemId: string
  slug: string
  title: string
  artist?: string
  imageUrl?: string
  energy: number
  source: MixEmbed
  /** For listicle tracks: which entry. */
  entry?: number
}

export interface Transport {
  platform: EmbedPlatform
  load: (url: string, autoplay: boolean) => void
  play: () => void
  pause: () => void
  seek: (seconds: number) => void
}

export type CaptureState = 'idle' | 'requesting' | 'live' | 'denied' | 'unsupported'

/** Same slot in a queue: the same piece and, for lists, the same entry. */
export function sameSlot(a: Pick<Track, 'itemId' | 'entry'>, b: Pick<Track, 'itemId' | 'entry'>): boolean {
  return a.itemId === b.itemId && a.entry === b.entry
}

interface PlayerState {
  track: Track | null
  queue: Track[]
  playing: boolean
  loading: boolean
  time: number
  duration: number
  capture: CaptureState
  expanded: boolean
  transports: Partial<Record<EmbedPlatform, Transport>>
  /** performance.now() of the last `time` report — lets the UI glide between reports. */
  timeAt: number
  /** An honest failure word from a bridge ("NO DISPONIBLE", "SIN RESPUESTA"…). Cleared by the next play. */
  fault: string | null
  /** The platform only granted a short preview (Spotify without Premium). */
  preview: boolean
  /** A load is waiting for its (lazy) bridge to become ready. */
  pending: boolean
  /** The field's queue: playable mixes by current HL (seeded by the Consola). */
  ambient: Track[]
  /** Lazy bridges that should be mounted, with the url that seeds them. */
  primed: Partial<Record<EmbedPlatform, string>>
  /** Why capture is denied/unsupported, in words. */
  captureNote: string | null
  registerTransport: (t: Transport) => () => void
  /** Play a track now (must be called inside the user's gesture). */
  play: (t: Track, queue?: Track[]) => void
  toggle: () => void
  pause: () => void
  seek: (s: number) => void
  next: () => void
  prev: () => void
  setExpanded: (v: boolean) => void
  /** Bridges report progress through these. */
  report: (p: Partial<Pick<PlayerState, 'playing' | 'loading' | 'time' | 'duration' | 'fault' | 'preview'>>) => void
  setCapture: (c: CaptureState) => void
  /** Mount a lazy bridge ahead of the click (a reader showing a YouTube/Spotify source). */
  prime: (platform: EmbedPlatform, url: string) => void
  setAmbient: (q: Track[]) => void
  /** A bridge finished the current track: advance, or rest at the end. */
  ended: () => void
  setCaptureNote: (note: string | null) => void
}

export const PLAYABLE: EmbedPlatform[] = ['soundcloud', 'youtube', 'spotify']

/** The first source a bridge can actually drive (identifier extractable). */
export function playableSource(item: Pick<ContentItem, 'embeds' | 'mixUrl'>): MixEmbed | null {
  const list = item.embeds ?? []
  for (const p of PLAYABLE) {
    const e = list.find((x) => x.platform === p && isPlayableEmbed(x))
    if (e) return e
  }
  if (item.mixUrl) {
    if (/soundcloud\.com/.test(item.mixUrl) && isPlayableEmbed({ platform: 'soundcloud', url: item.mixUrl })) return { platform: 'soundcloud', url: item.mixUrl }
    if (/youtu\.?be/.test(item.mixUrl) && isPlayableEmbed({ platform: 'youtube', url: item.mixUrl })) return { platform: 'youtube', url: item.mixUrl }
  }
  return null
}

export function openSourceUrl(item: Pick<ContentItem, 'embeds' | 'mixUrl'>): string | null {
  const e = item.embeds?.find((x) => isHttp(x.url))
  if (e) return e.url
  return isHttp(item.mixUrl) ? item.mixUrl : null
}

export const PLATFORM_LABEL: Record<EmbedPlatform, string> = {
  soundcloud: 'SoundCloud',
  youtube: 'YouTube',
  spotify: 'Spotify',
  bandcamp: 'Bandcamp',
  mixcloud: 'Mixcloud',
}

const LAZY: EmbedPlatform[] = ['youtube', 'spotify']
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0)

export const usePlayer = create<PlayerState>((set, get) => ({
  track: null,
  queue: [],
  playing: false,
  loading: false,
  time: 0,
  duration: 0,
  capture: 'idle',
  expanded: false,
  transports: {},
  timeAt: 0,
  fault: null,
  preview: false,
  pending: false,
  ambient: [],
  primed: {},
  captureNote: null,
  registerTransport: (t) => {
    set((s) => ({ transports: { ...s.transports, [t.platform]: t } }))
    // Drain a load that arrived before this bridge was ready.
    const s = get()
    if (s.pending && s.track && s.track.source.platform === t.platform) {
      set({ pending: false })
      t.load(s.track.source.url, true)
    }
    return () =>
      set((s) => {
        const next = { ...s.transports }
        if (next[t.platform] === t) delete next[t.platform]
        return { transports: next }
      })
  },
  play: (t, queue) => {
    const s = get()
    const platform = t.source.platform
    const tr = s.transports[platform]
    // Pause every other platform so two sources never sound together.
    for (const [p, other] of Object.entries(s.transports)) if (p !== platform) other?.pause()
    // Outside the active collection → the field's queue takes prev/next back.
    let q = queue ?? s.queue
    if (!queue && !q.some((x) => sameSlot(x, t))) q = s.ambient.length ? s.ambient : q
    const primed = LAZY.includes(platform) && !s.primed[platform] ? { ...s.primed, [platform]: t.source.url } : s.primed
    set({ track: t, queue: q, loading: true, playing: false, time: 0, timeAt: now(), duration: 0, fault: null, preview: false, pending: !tr, primed })
    tr?.load(t.source.url, true)
  },
  toggle: () => {
    const s = get()
    if (!s.track) return
    if (s.fault) return s.play(s.track)
    const tr = s.transports[s.track.source.platform]
    if (!tr) return
    if (s.playing) tr.pause()
    else tr.play()
  },
  pause: () => {
    const s = get()
    if (s.track) s.transports[s.track.source.platform]?.pause()
  },
  seek: (sec) => {
    const s = get()
    const t = Math.max(0, s.duration ? Math.min(sec, s.duration - 0.5) : sec)
    if (s.track) s.transports[s.track.source.platform]?.seek(t)
    set({ time: t, timeAt: now() })
  },
  next: () => {
    const s = get()
    if (!s.track || !s.queue.length) return
    const i = s.queue.findIndex((q) => sameSlot(q, s.track!))
    const n = s.queue[i + 1]
    if (n) s.play(n)
  },
  prev: () => {
    const s = get()
    if (!s.track || !s.queue.length) return
    const i = s.queue.findIndex((q) => sameSlot(q, s.track!))
    const p = s.queue[i - 1]
    if (p) s.play(p)
  },
  setExpanded: (expanded) => set({ expanded }),
  report: (p) => set(p.time !== undefined ? { ...p, timeAt: now() } : p),
  setCapture: (capture) => set({ capture }),
  prime: (platform, url) => {
    if (!LAZY.includes(platform) || get().primed[platform]) return
    set((s) => ({ primed: { ...s.primed, [platform]: url } }))
  },
  setAmbient: (q) => {
    const s = get()
    const same = s.ambient.length === q.length && s.ambient.every((t, i) => sameSlot(t, q[i]) && t.source.url === q[i].source.url)
    if (same) return
    set({ ambient: q, queue: s.queue.length === 0 || s.queue === s.ambient ? q : s.queue })
  },
  ended: () => {
    const s = get()
    if (!s.track) return
    const i = s.queue.findIndex((q) => sameSlot(q, s.track!))
    const n = s.queue[i + 1]
    if (n && !sameSlot(n, s.track)) s.play(n)
    else set({ playing: false, loading: false, time: s.duration || s.time, timeAt: now() })
  },
  setCaptureNote: (captureNote) => set({ captureNote }),
}))
