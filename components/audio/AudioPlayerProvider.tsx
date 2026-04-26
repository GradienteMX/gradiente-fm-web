'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ContentItem } from '@/lib/types'
import type { EmbedTrackMeta } from './types'
import { useSoundCloudWidget } from './useSoundCloudWidget'
import { useTabAudioCapture } from './useTabAudioCapture'

// Persistent global audio surface.
//
// One iframe + widget + tab-capture instance lives at the layout root for the
// life of the page. Any overlay or HUD pulls state via `useAudioPlayer()`.
// Closing an overlay does NOT stop playback. Switching tracks across overlays
// uses SoundCloud's `widget.load(url)` so the iframe never remounts and the
// user-granted tab-capture permission keeps flowing into the analyser.

interface CurrentItem {
  id: string
  title: string
  subtitle?: string
  author?: string
  imageUrl?: string
  mixSeries?: string
  duration?: string
  scUrl: string
}

export interface AudioPlayerState {
  // Mix that's currently loaded into the player. null = nothing loaded yet.
  currentItem: CurrentItem | null
  // Live SC widget state.
  isPlaying: boolean
  currentTime: number
  duration: number
  track: EmbedTrackMeta | null
  widgetReady: boolean
  // Tab-capture state.
  matrixActive: boolean
  matrixSupported: boolean
  matrixStatus: string
  matrixErrorMessage?: string
  // Analyser feed.
  data: Uint8Array | null
  sampleRate: number

  // Methods.
  loadAndPlay: (item: ContentItem) => Promise<void>
  toggle: () => void
  pause: () => void
  seek: (sec: number) => void
  // True while item is the one loaded — lets components know to render
  // their player chrome as "live" vs idle.
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

// Placeholder track loaded at app boot so the SC widget API binds immediately.
// The iframe is hidden offscreen; this URL never plays audio (auto_play=false)
// and gets replaced via widget.load() the moment the user picks a real mix.
// We use the lo-fi mix because it's the safest small payload from a known
// reliable account.
const PLACEHOLDER_SC_URL =
  'https://soundcloud.com/itsgettingtiresometoo/goodies'

function pickSoundCloudUrl(item: ContentItem): string | null {
  const sc = item.embeds?.find((e) => e.platform === 'soundcloud')
  if (sc?.url) return sc.url
  if (item.mixUrl && /soundcloud\.com/.test(item.mixUrl)) return item.mixUrl
  return null
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const widget = useSoundCloudWidget(iframeRef)
  const tab = useTabAudioCapture()
  const [currentItem, setCurrentItem] = useState<CurrentItem | null>(null)
  // Tracks the canonical URL we've actually loaded into the widget. null = the
  // hidden placeholder is showing (no real track yet).
  const loadedScUrlRef = useRef<string | null>(null)

  const loadAndPlay = useCallback(
    async (item: ContentItem) => {
      const scUrl = pickSoundCloudUrl(item)
      if (!scUrl) return

      // Lazily request tab capture on the very first play. Must be the first
      // awaited promise in the gesture chain so getDisplayMedia recognises
      // the user-gesture context.
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

      const newItem: CurrentItem = {
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        author: item.author,
        imageUrl: item.imageUrl,
        mixSeries: item.mixSeries,
        duration: item.duration,
        scUrl,
      }

      if (loadedScUrlRef.current !== scUrl) {
        // First-ever load OR switching tracks — go through widget.load() so
        // the iframe never remounts and the widget bindings stay alive.
        widget.load(scUrl)
        loadedScUrlRef.current = scUrl
        setCurrentItem(newItem)
      } else {
        // Same track — toggle play/pause.
        widget.toggle()
      }
    },
    [tab, widget],
  )

  const isItemActive = useCallback(
    (itemId: string) => currentItem?.id === itemId,
    [currentItem],
  )

  const value = useMemo<AudioPlayerState>(
    () => ({
      currentItem,
      isPlaying: widget.isPlaying,
      currentTime: widget.currentTime,
      duration: widget.duration,
      track: widget.track,
      widgetReady: widget.ready,
      matrixActive: tab.status === 'live',
      matrixSupported: tab.isSupported,
      matrixStatus: tab.status,
      matrixErrorMessage: tab.errorMessage,
      data: tab.status === 'live' ? tab.data : null,
      sampleRate: tab.sampleRate,
      loadAndPlay,
      toggle: widget.toggle,
      pause: widget.pause,
      seek: widget.seek,
      isItemActive,
    }),
    [
      currentItem,
      widget.isPlaying,
      widget.currentTime,
      widget.duration,
      widget.track,
      widget.ready,
      widget.toggle,
      widget.pause,
      widget.seek,
      tab.status,
      tab.isSupported,
      tab.errorMessage,
      tab.sampleRate,
      tab.data,
      loadAndPlay,
      isItemActive,
    ],
  )

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      {/* Persistent hidden iframe. Mounted at app boot with a silent
          placeholder so the SC Widget API binds immediately — that's why
          isPlaying / track / progress events flow as soon as the user hits
          play. Track switching happens via widget.load() so this src never
          changes after first paint. */}
      <iframe
        ref={iframeRef}
        src={buildSoundCloudEmbedUrl(PLACEHOLDER_SC_URL, false)}
        title="audio embed"
        aria-hidden
        tabIndex={-1}
        allow="autoplay"
        className="absolute h-px w-px overflow-hidden border-0 opacity-0"
        style={{ left: '-9999px', top: 0, pointerEvents: 'none' }}
      />
    </AudioPlayerContext.Provider>
  )
}
