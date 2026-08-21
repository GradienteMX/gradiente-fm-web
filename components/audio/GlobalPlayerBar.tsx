'use client'

import { usePathname } from 'next/navigation'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useAudioPlayer } from './AudioPlayerProvider'
import { MarqueeText } from './NowPlayingHud'
import { useOverlay } from '@/components/overlay/useOverlay'

// ── Global player bar — NTS-style strip docked under the top nav ───────────
//
// Persistent, slim (h-10) transport surface: prev / play / next, the current
// track's title·artist (marquee when it overflows), a click-to-seek progress
// band, and timecodes. Always rendered so the sticky chrome heights stay
// constant — Navigation is sticky top-0 (56px tall), this bar sticky top-[56px]
// (40px tall), and VibeSlider sticky below both at top-[96px]. State comes
// straight from AudioPlayerProvider; this is only another view over the same
// global transport the rail HUD mirrors.

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function GlobalPlayerBar() {
  const audio = useAudioPlayer()
  const overlay = useOverlay()
  const pathname = usePathname()
  const item = audio.currentItem
  const has = !!item

  // Home keeps ONLY the left rail player (NowPlayingHud) — the top bar is for
  // the other pages (agenda / foro / marketplace / empieza aquí) where
  // there's no rail. /dashboard has its own transport (REPRODUCTOR widget +
  // MiniTransport — one-transport rule; belt-and-braces with ChromeFrame's
  // null-list). Hooks run before this early return so hook order stays
  // stable across routes; hiding the bar never touches the global provider,
  // so playback continues uninterrupted across navigations.
  if (pathname === '/' || pathname === '/dashboard' || pathname === '/lab/dashboard')
    return null

  const progress =
    audio.duration > 0 ? Math.min(1, audio.currentTime / audio.duration) : 0
  const stateColor = audio.isPlaying ? '#4ADE80' : '#E63329'

  // Play semantics mirror the rail HUD: pause when sounding; toggle when a
  // bridge owns the track; for a merely-CUED track (metadata only, no bridge)
  // synthesize a PlayableRef from the provider's own platform+sourceUrl and
  // load it — first play works from the bar without visiting an overlay.
  const handlePlay = () => {
    if (!item) return
    if (audio.isPlaying) {
      audio.pause()
    } else if (audio.activePlatform) {
      audio.toggle()
    } else {
      void audio.loadAndPlay({
        id: item.id,
        slug: item.slug,
        title: item.title,
        subtitle: item.subtitle,
        author: item.author,
        imageUrl: item.imageUrl,
        mixSeries: item.mixSeries,
        duration: item.duration,
        embeds: [{ platform: item.platform, url: item.sourceUrl }],
      })
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audio.duration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const t = (e.clientX - rect.left) / rect.width
    audio.seek(Math.max(0, Math.min(1, t)) * audio.duration)
  }

  const openCurrent = () => {
    if (item?.slug) overlay.open(item.slug)
  }

  return (
    <div className="sticky top-[56px] z-50 border-b border-border bg-base">
      <div className="mx-auto flex h-10 max-w-screen-2xl items-center gap-3 px-4 md:px-8">
        {/* Transport */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => audio.prev()}
            disabled={!audio.hasPrev}
            aria-label="Anterior"
            className="flex h-7 w-7 items-center justify-center text-secondary transition-colors hover:text-sys-orange disabled:cursor-not-allowed disabled:opacity-30"
          >
            <SkipBack size={12} />
          </button>
          <button
            type="button"
            onClick={handlePlay}
            disabled={!has}
            aria-label={audio.isPlaying ? 'Pausar' : 'Reproducir'}
            className="flex h-7 w-7 items-center justify-center border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: '#F97316', color: '#F97316' }}
          >
            {audio.isPlaying ? (
              <Pause size={12} fill="currentColor" />
            ) : (
              <Play size={12} fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            onClick={() => audio.next()}
            disabled={!audio.hasNext}
            aria-label="Siguiente"
            className="flex h-7 w-7 items-center justify-center text-secondary transition-colors hover:text-sys-orange disabled:cursor-not-allowed disabled:opacity-30"
          >
            <SkipForward size={12} />
          </button>
        </div>

        {/* State dot */}
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: has ? stateColor : '#3a3a3a' }}
          aria-hidden
        />

        {/* Title · artist — opens the track's overlay */}
        <button
          type="button"
          onClick={openCurrent}
          disabled={!has || !item?.slug}
          className="min-w-0 flex-1 text-left disabled:cursor-default md:max-w-[40%]"
          aria-label={has ? 'Abrir overlay del mix' : undefined}
        >
          <MarqueeText
            text={
              has
                ? [item!.title, item!.author].filter(Boolean).join(' — ')
                : 'SIN PISTA · pulsa play en un mix'
            }
            className="font-mono text-[11px] tracking-wider text-primary"
          />
        </button>

        {/* Seek band — desktop only; phones keep the bar minimal */}
        <div
          className="relative hidden h-2 flex-1 cursor-pointer bg-border md:block"
          onClick={handleSeek}
          role="slider"
          aria-label="Posición de reproducción"
          aria-valuemin={0}
          aria-valuemax={audio.duration}
          aria-valuenow={audio.currentTime}
        >
          <div
            className="absolute left-0 top-0 h-full"
            style={{ width: `${progress * 100}%`, backgroundColor: '#F97316' }}
          />
          <div
            className="absolute top-1/2"
            style={{
              left: `${progress * 100}%`,
              width: 4,
              height: 10,
              backgroundColor: '#F97316',
              transform: 'translate(-50%, -50%)',
            }}
            aria-hidden
          />
        </div>

        {/* Timecodes */}
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-secondary">
          {fmtTime(audio.currentTime)}
          <span className="text-muted"> / </span>
          {fmtTime(audio.duration)}
        </span>
      </div>
    </div>
  )
}
