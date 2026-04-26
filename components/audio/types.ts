export type AudioSourceStatus =
  | 'idle'
  | 'requesting'
  | 'loading'
  | 'live'
  | 'paused'
  | 'ended'
  | 'denied'
  | 'unsupported'
  | 'error'

export interface AudioSource {
  // Latest FFT magnitudes, length === FREQUENCY_BIN_COUNT. Null when idle.
  data: Uint8Array | null
  status: AudioSourceStatus
  errorMessage?: string
}

// ── Embed widgets ───────────────────────────────────────────────────────────
// Shared shape for SoundCloud / YouTube / Mixcloud / Spotify widget bridges.
// Each platform's hook returns this so the player chrome doesn't care about
// platform-specific quirks.

export interface EmbedTrackMeta {
  title: string
  artist: string
  artwork: string | null
  url: string | null
}

export interface EmbedWidget {
  ready: boolean
  isPlaying: boolean
  currentTime: number
  duration: number
  track: EmbedTrackMeta | null
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (sec: number) => void
  // Switch the loaded track without remounting the iframe. Implementations
  // should reset transient state (currentTime/duration/track) and re-fire
  // their READY equivalent when the new track is available.
  load: (canonicalUrl: string) => void
}

export type EmbedPlatformId = 'soundcloud' | 'youtube' | 'mixcloud' | 'spotify' | 'bandcamp'
