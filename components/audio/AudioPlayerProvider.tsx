'use client'

import {
  createContext,
  useCallback,
  useContext,
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

  // Methods.
  loadAndPlay: (item: ContentItem) => Promise<void>
  toggle: () => void
  pause: () => void
  seek: (sec: number) => void
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
      loadAndPlay,
      toggle,
      pause,
      seek,
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
      loadAndPlay,
      toggle,
      pause,
      seek,
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
