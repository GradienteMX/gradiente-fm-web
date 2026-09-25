'use client'

/**
 * The hidden players. SoundCloud is mounted for the whole session (booted on
 * a placeholder so its API is bound before the first click); YouTube and
 * Spotify mount only once primed. All of them are parked offscreen — rendered,
 * non-zero-sized, transparent — so video sources play their audio only.
 * `visibility: hidden` would mute some players, so it's never used here.
 */

import { useRef } from 'react'
import { usePlayer } from '@/lib/store/player'
import { SC_PLACEHOLDER, scEmbedSrc, useSoundCloudBridge } from '@/lib/audio/soundcloud'
import { useYouTubeBridge } from '@/lib/audio/youtube'
import { useSpotifyBridge } from '@/lib/audio/spotify'
import styles from './Consola.module.css'

const SC_SRC = scEmbedSrc(SC_PLACEHOLDER)

export function Puentes() {
  const sc = useRef<HTMLIFrameElement>(null)
  const yt = useRef<HTMLDivElement>(null)
  const sp = useRef<HTMLDivElement>(null)
  const ytOn = usePlayer((s) => Boolean(s.primed.youtube))
  const spSeed = usePlayer((s) => s.primed.spotify ?? null)
  useSoundCloudBridge(sc)
  useYouTubeBridge(yt, ytOn)
  useSpotifyBridge(sp, spSeed)
  return (
    <div className={styles.puentes} aria-hidden="true">
      <iframe ref={sc} src={SC_SRC} title="Audio · SoundCloud" allow="autoplay; encrypted-media" tabIndex={-1} />
      <div ref={yt} className={styles.host} />
      <div ref={sp} className={styles.host} />
    </div>
  )
}
