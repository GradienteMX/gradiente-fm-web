'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import type { ContentItem, EmbedPlatform } from '@/lib/types'
import type { EmbedTrackMeta, EmbedWidget } from './types'
import { useSoundCloudWidget } from './useSoundCloudWidget'
import { useYouTubeWidget } from './useYouTubeWidget'
import { useMixcloudWidget } from './useMixcloudWidget'
import { useSpotifyWidget } from './useSpotifyWidget'
import { useTabAudioCapture } from './useTabAudioCapture'
import { pickPlayableSource } from './sources'
import { extractMixcloudFeed, extractSpotifyUri } from '@/components/embed/platforms'

// Persistent global audio surface — now MULTI-PLATFORM.
//
// One hidden player per controllable platform lives at the layout root for the
// life of the page. Any overlay or HUD pulls state via `useAudioPlayer()`.
// Closing an overlay does NOT stop playback. The player picks the right bridge
// for whatever source a mix carries (SoundCloud / YouTube / Mixcloud / Spotify)
// and routes transport to it; the others stay paused.
//
// AUDIO-ONLY: every platform's iframe is parked offscreen, so video-bearing
// sources (YouTube) play their audio into the tab without ever showing video.
// The particle visualizer is platform-agnostic — it reads tab-captured audio
// (useTabAudioCapture), so it reacts to whichever source is currently sounding.
//
// LAZY: SoundCloud mounts at boot (the common case, proven path). YouTube /
// Mixcloud / Spotify mount + bind their APIs only once "primed" — i.e. once a
// mix using that platform is actually viewed — so an idle home page pays no
// third-party cost. MixOverlay primes the relevant platform on mount, ahead of
// the user's play click, so first play autoplays within the gesture.

interface CurrentItem {
  id: string
  slug: string
  title: string
  subtitle?: string
  author?: string
  imageUrl?: string
  mixSeries?: string
  duration?: string
  platform: EmbedPlatform
  sourceUrl: string
}

export interface AudioPlayerState {
  // Mix that's currently loaded into the player. null = nothing loaded yet.
  currentItem: CurrentItem | null
  // Which platform bridge currently owns playback.
  activePlatform: EmbedPlatform | null
  // Live transport state (mirrors the active platform's widget).
  isPlaying: boolean
  currentTime: number
  duration: number
  track: EmbedTrackMeta | null
  widgetReady: boolean
  // Tab-capture state (platform-agnostic — feeds the particle visualizer).
  matrixActive: boolean
  matrixSupported: boolean
  matrixStatus: string
  matrixErrorMessage?: string
  // Analyser feed. STABLE ref (identity never changes) — the FFT is written in
  // place each frame, so consuming it never re-renders this context. Read
  // dataRef.current inside a render loop; null when capture isn't live.
  dataRef: RefObject<Uint8Array | null>
  sampleRate: number

  // Skip-queue: an ordered list of playable items the prev/next transport walks.
  // Registered by NowPlayingHud from the current feed (mixes with a playable
  // source). Metadata only — no audio is preloaded; the neighbour's track loads
  // on demand when you skip to it.
  hasNext: boolean
  hasPrev: boolean

  // Methods.
  loadAndPlay: (item: ContentItem) => Promise<void>
  toggle: () => void
  pause: () => void
  seek: (sec: number) => void
  // Skip to the next / previous item in the queue (no-op at the ends).
  next: () => void
  prev: () => void
  // Register the skip-queue (idempotent on identical lists).
  setQueue: (items: ContentItem[]) => void
  // Seed an IDLE player with a ready-to-play track (metadata only — no audio
  // loads/plays and no capture prompt until the user hits play). Used to show a
  // random mix in the HUD on page load. No-op if something's already loaded.
  cue: (item: ContentItem) => void
  // Mount + bind a platform's player ahead of time (called by MixOverlay on
  // mount). Idempotent. `sourceUrl` seeds the iframe for platforms that need a
  // feed/uri to bind (Mixcloud, Spotify).
  primePlatform: (platform: EmbedPlatform, sourceUrl?: string) => void
  // True while item is the one loaded — lets components render their player
  // chrome as "live" vs idle.
  isItemActive: (itemId: string) => boolean
}

const AudioPlayerContext = createContext<AudioPlayerState | null>(null)

export function useAudioPlayer(): AudioPlayerState {
  const ctx = useContext(AudioPlayerContext)
  if (!ctx)
    throw new Error('useAudioPlayer must be used inside <AudioPlayerProvider>')
  return ctx
}

function buildSoundCloudEmbedUrl(canonicalUrl: string, autoPlay: boolean): string {
  const params = new URLSearchParams({
    url: canonicalUrl,
    color: '#F97316',
    auto_play: autoPlay ? 'true' : 'false',
    hide_related: 'true',
    show_comments: 'false',
    show_user: 'true',
    show_reposts: 'false',
    show_teaser: 'false',
    visual: 'false',
  })
  return `https://w.soundcloud.com/player/?${params.toString()}`
}

function buildMixcloudEmbedUrl(feed: string): string {
  const params = new URLSearchParams({
    feed,
    hide_cover: '1',
    mini: '1',
    autoplay: '0',
    light: '0',
  })
  return `https://www.mixcloud.com/widget/iframe/?${params.toString()}`
}

// Placeholder track loaded at app boot so the SC widget API binds immediately.
// The iframe is hidden offscreen; this URL never plays audio (auto_play=false)
// and gets replaced via widget.load() the moment the user picks a real mix.
const PLACEHOLDER_SC_URL =
  'https://soundcloud.com/itsgettingtiresometoo/goodies'

// Offscreen, audio-only: visible:hidden would mute some players, so we keep the
// iframes rendered + non-zero-sized but parked far offscreen at opacity 0.
const OFFSCREEN_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: -9999,
  top: 0,
  width: 320,
  height: 180,
  opacity: 0,
  pointerEvents: 'none',
  border: 0,
  overflow: 'hidden',
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  // One host element per controllable platform.
  const scIframeRef = useRef<HTMLIFrameElement>(null)
  const ytHostRef = useRef<HTMLDivElement>(null)
  const mcIframeRef = useRef<HTMLIFrameElement>(null)
  const spHostRef = useRef<HTMLDivElement>(null)

  // SoundCloud is always mounted (proven path). The rest mount once primed.
  const [primed, setPrimed] = useState<Set<EmbedPlatform>>(
    () => new Set<EmbedPlatform>(['soundcloud']),
  )
  // Mixcloud / Spotify need a feed/uri baked into the iframe to bind to.
  const [mcInitialFeed, setMcInitialFeed] = useState<string | null>(null)
  const [spInitialUri, setSpInitialUri] = useState<string | null>(null)

  const sc = useSoundCloudWidget(scIframeRef)
  const yt = useYouTubeWidget(ytHostRef, primed.has('youtube'))
  const mc = useMixcloudWidget(mcIframeRef, primed.has('mixcloud'))
  const sp = useSpotifyWidget(spHostRef, primed.has('spotify'), spInitialUri)

  const tab = useTabAudioCapture()

  const [currentItem, setCurrentItem] = useState<CurrentItem | null>(null)
  const [activePlatform, setActivePlatform] = useState<EmbedPlatform | null>(null)
  // The track currently loaded into a bridge — used to distinguish "toggle the
  // same track" from "switch to a new one".
  const loadedRef = useRef<{ platform: EmbedPlatform; url: string } | null>(null)

  // Skip-queue. `queueIndex` is the position of the current track within it (or
  // -1 when the current track isn't in the queue / nothing's playing). Held in
  // both state (for hasNext/hasPrev reactivity) and refs (so next/prev stay
  // identity-stable).
  const [queue, setQueueState] = useState<ContentItem[]>([])
  const [queueIndex, setQueueIndex] = useState(-1)
  const queueRef = useRef(queue)
  queueRef.current = queue
  const queueIndexRef = useRef(queueIndex)
  queueIndexRef.current = queueIndex
  const currentItemRef = useRef(currentItem)
  currentItemRef.current = currentItem

  // Bridge lookup. Recreated each render (the bridge objects carry live state),
  // so transport methods read it through a ref to stay identity-stable.
  const widgets: Record<EmbedPlatform, EmbedWidget | null> = {
    soundcloud: sc,
    youtube: yt,
    mixcloud: mc,
    spotify: sp,
    bandcamp: null,
  }
  const widgetsRef = useRef(widgets)
  widgetsRef.current = widgets
  const activePlatformRef = useRef(activePlatform)
  activePlatformRef.current = activePlatform

  const primePlatform = useCallback(
    (platform: EmbedPlatform, sourceUrl?: string) => {
      if (platform === 'bandcamp') return // never controllable
      setPrimed((prev) =>
        prev.has(platform) ? prev : new Set(prev).add(platform),
      )
      if (platform === 'mixcloud' && sourceUrl) {
        const feed = extractMixcloudFeed(sourceUrl)
        if (feed) setMcInitialFeed((f) => f ?? feed)
      }
      if (platform === 'spotify' && sourceUrl) {
        // Spotify's controller binds to a `spotify:` URI, not a web URL.
        const uri = extractSpotifyUri(sourceUrl)
        if (uri) setSpInitialUri((u) => u ?? uri)
      }
    },
    [],
  )

  const loadAndPlay = useCallback(
    async (item: ContentItem) => {
      const source = pickPlayableSource(item)
      if (!source) return
      const widget = widgetsRef.current[source.platform]
      if (!widget) return

      // Make sure the platform's player is mounted/bound (no-op if MixOverlay
      // already primed it on mount).
      primePlatform(source.platform, source.url)

      const newItem: CurrentItem = {
        id: item.id,
        slug: item.slug,
        title: item.title,
        subtitle: item.subtitle,
        author: item.author,
        imageUrl: item.imageUrl,
        mixSeries: item.mixSeries,
        duration: item.duration,
        platform: source.platform,
        sourceUrl: source.url,
      }

      const already = loadedRef.current
      const sameTrack =
        already?.platform === source.platform && already?.url === source.url

      // Drive transport FIRST, synchronously within the click gesture, so the
      // play autoplays under the user gesture for every platform. These are
      // synchronous postMessage calls — they don't consume the transient
      // activation that getDisplayMedia needs below.
      if (sameTrack) {
        // Same track — toggle play/pause.
        widget.toggle()
      } else {
        // Switching track or platform — pause whatever else is sounding so two
        // sources never overlap.
        const prevPlatform = activePlatformRef.current
        if (prevPlatform && prevPlatform !== source.platform) {
          widgetsRef.current[prevPlatform]?.pause()
        }
        widget.load(source.url)
        loadedRef.current = { platform: source.platform, url: source.url }
        setActivePlatform(source.platform)
        setCurrentItem(newItem)
        // queueIndex is derived from (queue, currentItem) in an effect below —
        // no need to set it here.
      }

      // THEN lazily request tab capture on the very first play. getDisplayMedia
      // must not be preceded by an *awaited* promise (only the synchronous
      // transport calls above), or it loses the user-gesture context.
      if (
        tab.isSupported &&
        tab.status !== 'live' &&
        tab.status !== 'requesting' &&
        tab.status !== 'denied'
      ) {
        try {
          await tab.request()
        } catch {
          // Refused — keep going so audio still plays without the visualizer.
        }
      }
    },
    [tab, primePlatform],
  )
  // Stable handle so next/prev don't churn identity when loadAndPlay does.
  const loadAndPlayRef = useRef(loadAndPlay)
  loadAndPlayRef.current = loadAndPlay

  // Transport routes to whatever platform currently owns playback. Read via
  // refs so these stay identity-stable across transport ticks.
  const toggle = useCallback(() => {
    const p = activePlatformRef.current
    if (p) widgetsRef.current[p]?.toggle()
  }, [])
  const pause = useCallback(() => {
    const p = activePlatformRef.current
    if (p) widgetsRef.current[p]?.pause()
  }, [])
  const seek = useCallback((sec: number) => {
    const p = activePlatformRef.current
    if (p) widgetsRef.current[p]?.seek(sec)
  }, [])

  // Register the skip-queue. The position within it (queueIndex) is derived
  // from committed state in the effect below, so this just stores the list.
  const setQueue = useCallback((items: ContentItem[]) => {
    setQueueState(items)
  }, [])

  // Single source of truth for queueIndex: recompute from the COMMITTED queue +
  // currentItem whenever either changes. This makes the cued-on-load track
  // resolve to its real position regardless of the order the HUD's setQueue and
  // cue effects fire in (both run in one commit reading not-yet-updated refs).
  useEffect(() => {
    const id = currentItem?.id
    setQueueIndex(id ? queue.findIndex((i) => i.id === id) : -1)
  }, [queue, currentItem])

  // Seed the idle player with a ready-to-play track. Metadata ONLY: no bridge
  // load, no playback, no tab-capture prompt, and deliberately no priming —
  // those all wait for the user's play gesture (autoplay-with-sound is blocked
  // on load anyway). Priming here would mount a YouTube/Mixcloud/Spotify iframe
  // + script on idle home for a randomly-cued non-SC track; SoundCloud (the
  // common case) is already bound at boot, so first play is instant regardless.
  const cue = useCallback((item: ContentItem) => {
    if (currentItemRef.current) return // never interrupt active playback
    const source = pickPlayableSource(item)
    if (!source) return
    setCurrentItem({
      id: item.id,
      slug: item.slug,
      title: item.title,
      subtitle: item.subtitle,
      author: item.author,
      imageUrl: item.imageUrl,
      mixSeries: item.mixSeries,
      duration: item.duration,
      platform: source.platform,
      sourceUrl: source.url,
    })
    // queueIndex is derived from (queue, currentItem) in the effect above.
  }, [])

  // Skip transport. From outside the queue (index −1) "next" enters at the top.
  const next = useCallback(() => {
    const q = queueRef.current
    const idx = queueIndexRef.current
    const target = idx < 0 ? q[0] : q[idx + 1]
    if (target) void loadAndPlayRef.current(target)
  }, [])
  const prev = useCallback(() => {
    const q = queueRef.current
    const idx = queueIndexRef.current
    const target = idx > 0 ? q[idx - 1] : null
    if (target) void loadAndPlayRef.current(target)
  }, [])

  const isItemActive = useCallback(
    (itemId: string) => currentItem?.id === itemId,
    [currentItem],
  )

  // Derive the exposed transport state from the active platform's bridge.
  const active = activePlatform ? widgets[activePlatform] : null
  const isPlaying = active?.isPlaying ?? false
  const currentTime = active?.currentTime ?? 0
  const duration = active?.duration ?? 0
  const track = active?.track ?? null
  const widgetReady = active?.ready ?? false

  // Skip is only meaningful once a track is loaded. From outside the queue
  // (index −1, e.g. a track played from an overlay not in the feed) "next"
  // enters at the top, so it's available whenever the queue is non-empty.
  const hasNext =
    currentItem != null &&
    (queueIndex < 0 ? queue.length > 0 : queueIndex < queue.length - 1)
  const hasPrev = currentItem != null && queueIndex > 0

  const value = useMemo<AudioPlayerState>(
    () => ({
      currentItem,
      activePlatform,
      isPlaying,
      currentTime,
      duration,
      track,
      widgetReady,
      matrixActive: tab.status === 'live',
      matrixSupported: tab.isSupported,
      matrixStatus: tab.status,
      matrixErrorMessage: tab.errorMessage,
      dataRef: tab.dataRef,
      sampleRate: tab.sampleRate,
      hasNext,
      hasPrev,
      loadAndPlay,
      toggle,
      pause,
      seek,
      next,
      prev,
      setQueue,
      cue,
      primePlatform,
      isItemActive,
    }),
    [
      currentItem,
      activePlatform,
      isPlaying,
      currentTime,
      duration,
      track,
      widgetReady,
      tab.status,
      tab.isSupported,
      tab.errorMessage,
      tab.sampleRate,
      tab.dataRef,
      hasNext,
      hasPrev,
      loadAndPlay,
      toggle,
      pause,
      seek,
      next,
      prev,
      setQueue,
      cue,
      primePlatform,
      isItemActive,
    ],
  )

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      {/* Persistent hidden players. Each is parked offscreen so video-bearing
          sources play audio only. Track switching happens via each bridge's
          load() so these elements never remount after first paint. */}
      <iframe
        ref={scIframeRef}
        src={buildSoundCloudEmbedUrl(PLACEHOLDER_SC_URL, false)}
        title="audio embed · soundcloud"
        aria-hidden
        tabIndex={-1}
        allow="autoplay"
        style={OFFSCREEN_STYLE}
      />

      {/* YouTube — YT.Player replaces the inner div with its own iframe, so we
          keep it inside a wrapper React owns and never re-render the inner node. */}
      {primed.has('youtube') && (
        <div aria-hidden style={OFFSCREEN_STYLE}>
          <div ref={ytHostRef} />
        </div>
      )}

      {/* Mixcloud — real iframe we own; PlayerWidget binds to it in place. Needs
          a feed baked into the src to bind. */}
      {primed.has('mixcloud') && mcInitialFeed && (
        <iframe
          ref={mcIframeRef}
          src={buildMixcloudEmbedUrl(mcInitialFeed)}
          title="audio embed · mixcloud"
          aria-hidden
          tabIndex={-1}
          allow="autoplay"
          style={OFFSCREEN_STYLE}
        />
      )}

      {/* Spotify — createController replaces the inner div with its iframe. */}
      {primed.has('spotify') && spInitialUri && (
        <div aria-hidden style={OFFSCREEN_STYLE}>
          <div ref={spHostRef} />
        </div>
      )}
    </AudioPlayerContext.Provider>
  )
}
