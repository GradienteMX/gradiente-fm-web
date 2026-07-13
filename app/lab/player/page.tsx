'use client'

import { useAudioPlayer } from '@/components/audio/AudioPlayerProvider'
import type { PlayableRef } from '@/components/audio/sources'

// ── /lab/player — dev-only test bench for the GLOBAL player ────────────────
//
// Drives the real AudioPlayerProvider (the same code path production uses:
// loadAndPlay → platform bridge → hidden iframe) with one hardcoded track per
// platform, so cross-platform playback/seek/switching can be verified without
// auth. Reachable anonymously ONLY in dev (middleware's isDevLab gate).

const TRACKS: PlayableRef[] = [
  {
    id: 'lab-sc',
    slug: '',
    title: 'SC — what you do to me',
    author: 'itsgettingtiresometoo',
    mixUrl: 'https://soundcloud.com/itsgettingtiresometoo/what-you-do-to-me',
  },
  {
    id: 'lab-mc',
    slug: '',
    title: 'MC — Chaotic Trip (Set 1 for Gradiente)',
    author: 'backYardboy',
    mixUrl:
      'https://www.mixcloud.com/backYardboy/chaotic-trip-set-1-for-gradiente/',
  },
  {
    id: 'lab-yt',
    slug: '',
    title: 'YT — lofi test',
    author: 'YouTube',
    mixUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
  },
]

export default function PlayerLabPage() {
  const audio = useAudioPlayer()

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4 py-8 font-mono">
      <h1 className="text-[12px] tracking-widest text-sys-orange">
        // LAB · GLOBAL PLAYER BENCH
      </h1>

      <div className="flex flex-col gap-2">
        {TRACKS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => void audio.loadAndPlay(t)}
            className="border border-border px-3 py-2 text-left text-[11px] text-primary transition-colors hover:border-sys-orange"
            data-lab-track={t.id}
          >
            ▶ {t.title}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 text-[11px]">
        <button
          type="button"
          onClick={() => audio.toggle()}
          className="border border-sys-orange px-3 py-1.5 text-sys-orange"
          data-lab-toggle
        >
          TOGGLE
        </button>
        <button
          type="button"
          onClick={() => audio.seek(60)}
          className="border border-border px-3 py-1.5 text-secondary"
          data-lab-seek60
        >
          SEEK → 1:00
        </button>
      </div>

      {/* Live state readout — polled by the test driver. */}
      <pre
        data-lab-state
        className="border border-dashed border-border p-3 text-[10px] leading-relaxed text-secondary"
      >
        {JSON.stringify(
          {
            platform: audio.activePlatform,
            ready: audio.widgetReady,
            playing: audio.isPlaying,
            t: Math.round(audio.currentTime),
            dur: Math.round(audio.duration),
            item: audio.currentItem?.title ?? null,
          },
          null,
          2,
        )}
      </pre>
    </div>
  )
}
