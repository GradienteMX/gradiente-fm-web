'use client'

import { useEffect } from 'react'
import { Pause, Play } from 'lucide-react'
import type { ContentItem, MixEmbed } from '@/lib/types'
import { useAudioPlayer } from '@/components/audio/AudioPlayerProvider'
import { pickPlayableSource } from '@/components/audio/sources'
import {
  MIXCLOUD_UNSUPPORTED_NOTE,
  PLATFORM_LABELS,
  detectPlatform,
} from '@/components/embed/platforms'

// ── OverlaySources ─────────────────────────────────────────────────────────
//
// The listen panel for NON-mix items (review / editorial / opinión / noticia).
// Those types can carry `embeds` — the composer has always offered the field —
// but only MixOverlay and ArticuloOverlay ever rendered them, so a media link
// added to a review landed in the DB and appeared nowhere. This is the missing
// surface.
//
// Playback goes through the global AudioPlayerProvider, exactly like
// MixOverlay: one persistent hidden iframe for the whole app, transport shown
// in the docked player bar. We deliberately do NOT mount a second visible
// iframe here — two players on a page fight each other for audio.
//
// Sources that can't be driven in-app (Bandcamp: no control API; Mixcloud:
// link-out only, see PLAYABLE_PLATFORMS) render as link-out rows instead of a
// dead player.
//
// Fase C («EL PLIEGO»): paper rows — the play control is a bordered ink
// button (fill-inversion hover, live status line stays real), platform
// link-outs read «ABRIR EN X ↗». loadAndPlay stays SYNCHRONOUS inside the
// click gesture (platform-iframe law) and primePlatform still runs on mount.

interface Props {
  item: ContentItem
  // Legacy vibe accent from pre-paper callers — intentionally ignored on
  // paper (hue is never the signal; the row chrome is ink).
  accent?: string
}

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2'

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function OverlaySources({ item }: Props) {
  const audio = useAudioPlayer()

  // Every source the item carries, structured embeds first, with the legacy
  // single `mixUrl` folded in when it isn't already represented.
  const embeds = item.embeds ?? []
  const sources: MixEmbed[] = [...embeds]
  if (item.mixUrl && !embeds.some((e) => e.url === item.mixUrl)) {
    const p = detectPlatform(item.mixUrl)
    if (p) sources.push({ platform: p, url: item.mixUrl })
  }

  const playable = pickPlayableSource(item)
  const isActive = audio.activePlatform != null && audio.currentItem?.id === item.id
  const isPlaying = isActive && audio.isPlaying

  // Bind the platform's hidden player up front so the first play click
  // autoplays inside the user gesture instead of dying on a cold API.
  useEffect(() => {
    if (playable) audio.primePlatform(playable.platform, playable.url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playable?.platform, playable?.url])

  if (sources.length === 0) return null

  // Live status line — every string here reflects a REAL provider state
  // (transport time, widget boot, idle prompt). Nothing decorative.
  const status = (() => {
    if (!playable) return 'solo enlace externo'
    if (isPlaying) return `${fmtTime(audio.currentTime)} · reproduciendo`
    if (isActive && !audio.widgetReady) return 'cargando…'
    if (isActive) return `${fmtTime(audio.currentTime)} · en pausa`
    return `pulsa play · ${PLATFORM_LABELS[playable.platform].toLowerCase()}`
  })()

  return (
    <div className="flex flex-col gap-2.5">
      {playable && (
        <button
          type="button"
          onClick={() => void audio.loadAndPlay(item)}
          className={`flex min-h-11 items-center gap-3 border border-ink px-3 py-2 text-left text-ink transition-colors hover:bg-ink hover:text-paper-raised ${FOCUS}`}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center border border-current"
            aria-hidden
          >
            {isPlaying ? (
              <Pause size={13} fill="currentColor" />
            ) : (
              <Play size={13} fill="currentColor" />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-mono text-d11 font-bold tracking-widest">
              {isPlaying ? 'PAUSAR' : 'REPRODUCIR'}
            </span>
            {/* Opacity, not a fixed color, so the fill inversion flips it too. */}
            <span className="truncate font-mono text-[10px] opacity-70">
              {status}
            </span>
          </span>
        </button>
      )}

      <ul className="flex flex-col gap-1.5">
        {sources.map((e) => (
          <li key={`${e.platform}-${e.url}`}>
            <a
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex min-h-11 items-center justify-between gap-2 border border-ink px-3 font-mono text-d11 tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper-raised ${FOCUS}`}
            >
              <span className="truncate">
                ABRIR EN {PLATFORM_LABELS[e.platform]}
              </span>
              <span aria-hidden className="shrink-0">
                ↗
              </span>
            </a>
          </li>
        ))}
      </ul>

      {!playable && sources.some((e) => e.platform === 'mixcloud') && (
        <p className="font-mono text-[10px] leading-relaxed text-ink-faint">
          {MIXCLOUD_UNSUPPORTED_NOTE}
        </p>
      )}
    </div>
  )
}
