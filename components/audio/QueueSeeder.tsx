'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { ContentItem } from '@/lib/types'
import { useAudioPlayer } from './AudioPlayerProvider'
import { pickPlayableSource } from './sources'

// Invisible feed → player bridge. Carries the two responsibilities the retired
// NowPlayingHud held besides its visible chrome: registering the ambient
// skip-queue from the current feed, and cueing one mix into the idle player on
// load so the transport is never empty. Renders nothing — the visible
// transport now lives in the bottom GlobalPlayerBar. Mounted from CategoryRail
// so it receives the feed exactly the way the HUD did.

// How many playable mixes the skip-queue holds — the highest-HL ones from the
// feed. Metadata only (no audio preloaded), so this is just a sanity bound.
const QUEUE_LIMIT = 12

export function QueueSeeder({ items }: { items: ContentItem[] }) {
  const audio = useAudioPlayer()

  // Register the skip-queue: mixes in the current feed with a playable source,
  // most-alive (highest HL) first, capped. Re-registers when the feed changes;
  // the provider recomputes our position against the live track.
  const { setQueue } = audio
  const queue = useMemo(
    () =>
      items
        .filter((i) => i.type === 'mix' && !!pickPlayableSource(i))
        .sort((a, b) => (b.hp ?? 0) - (a.hp ?? 0))
        .slice(0, QUEUE_LIMIT),
    [items],
  )
  useEffect(() => {
    setQueue(queue)
  }, [queue, setQueue])

  // Cue a random mix into the idle player on load, so it is never empty —
  // shown ready/paused (browsers block autoplay-with-sound until a gesture).
  // The first play click starts it AND requests the visualizer permission.
  const { cue } = audio
  const cuedOnceRef = useRef(false)
  const currentId = audio.currentItem?.id
  useEffect(() => {
    if (cuedOnceRef.current) return
    if (currentId) {
      cuedOnceRef.current = true // already playing/cued — leave it
      return
    }
    if (queue.length === 0) return // wait for the feed
    cuedOnceRef.current = true
    cue(queue[Math.floor(Math.random() * queue.length)])
  }, [queue, currentId, cue])

  return null
}
