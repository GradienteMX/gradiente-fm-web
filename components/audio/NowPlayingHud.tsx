'use client'

import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { Reproductor3D } from './Reproductor3D'
import { useAudioPlayer } from './AudioPlayerProvider'

// Persistent NOW PLAYING block for the home rail. Reflects the global audio
// state — currently loaded mix, transport, and live spectrum visualization.
// This is the only transport surface visible when no overlay is open, so the
// play button here is what the user uses to pause whatever's playing.

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function NowPlayingHud() {
  const audio = useAudioPlayer()
  const has = !!audio.currentItem
  const progress =
    audio.duration > 0 ? Math.min(1, audio.currentTime / audio.duration) : 0
  const headerColor = audio.matrixActive
    ? '#4ADE80'
    : 'rgba(255, 102, 0, 0.7)'

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audio.duration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const t = (e.clientX - rect.left) / rect.width
    audio.seek(Math.max(0, Math.min(1, t)) * audio.duration)
  }

  return (
    <section className="flex flex-col gap-2 border border-border/60 bg-black/40 p-2.5">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <span
          className="font-mono text-[8px] tracking-widest"
          style={{ color: headerColor }}
        >
          NOW PLAYING
        </span>
        <span
          className="h-1 w-1 animate-pulse rounded-full"
          style={{
            backgroundColor: audio.isPlaying ? '#4ADE80' : '#3a3a3a',
          }}
          aria-hidden
        />
      </div>

      {/* ── Track info ──────────────────────────────────────────── */}
      <div className="min-w-0">
        <p className="truncate font-syne text-[12px] font-bold uppercase leading-tight text-primary">
          {has ? audio.currentItem!.title : 'SIN PISTA'}
        </p>
        <p className="truncate font-mono text-[9px] tracking-widest text-muted">
          {has
            ? [audio.currentItem!.author, audio.currentItem!.mixSeries]
                .filter(Boolean)
                .join(' · ')
            : 'pulsa play en un mix'}
        </p>
      </div>

      {/* ── Time + progress ─────────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[8px] tabular-nums text-secondary">
          {fmtTime(audio.currentTime)}
        </span>
        <div
          className="relative h-0.5 flex-1 cursor-pointer bg-border"
          onClick={handleSeek}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={audio.duration}
          aria-valuenow={audio.currentTime}
        >
          <div
            className="absolute left-0 top-0 h-full"
            style={{
              width: `${progress * 100}%`,
              backgroundColor: '#F97316',
            }}
          />
          <div
            className="absolute top-1/2"
            style={{
              left: `${progress * 100}%`,
              width: 4,
              height: 6,
              backgroundColor: '#F97316',
              transform: 'translate(-50%, -50%)',
            }}
            aria-hidden
          />
        </div>
        <span className="font-mono text-[8px] tabular-nums text-secondary">
          {fmtTime(audio.duration)}
        </span>
      </div>

      {/* ── Transport ───────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5">
        <button
          type="button"
          disabled
          aria-label="Anterior"
          className="flex h-5 w-5 items-center justify-center text-muted disabled:cursor-not-allowed disabled:opacity-30"
        >
          <SkipBack size={10} />
        </button>
        <button
          type="button"
          onClick={() => audio.toggle()}
          disabled={!has}
          aria-label={audio.isPlaying ? 'Pausar' : 'Reproducir'}
          className="flex h-6 w-6 items-center justify-center border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: '#F97316', color: '#F97316' }}
        >
          {audio.isPlaying ? (
            <Pause size={10} fill="currentColor" />
          ) : (
            <Play size={10} fill="currentColor" />
          )}
        </button>
        <button
          type="button"
          disabled
          aria-label="Siguiente"
          className="flex h-5 w-5 items-center justify-center text-muted disabled:cursor-not-allowed disabled:opacity-30"
        >
          <SkipForward size={10} />
        </button>
      </div>

      {/* ── Matrix label row ────────────────────────────────────── */}
      <div className="mt-0.5 flex items-center justify-between">
        <span
          className="font-mono text-[8px] tracking-widest"
          style={{ color: headerColor }}
        >
          MATRIX
        </span>
        <span className="font-mono text-[7px] tracking-widest text-muted">
          {audio.matrixActive ? '● LIVE' : '○ IDLE'}
        </span>
      </div>

      {/* ── 3D matrix viewport — portrait orientation for the narrow rail.
           Camera is rolled 90° so frequency reads top-to-bottom (HIGH at the
           top, LOW at the bottom). Non-interactive — drag-rotation in a
           sidebar-sized viewport doesn't earn its keep. ── */}
      <div className="relative h-[260px] overflow-hidden border border-border/40">
        <Reproductor3D
          data={audio.matrixActive ? audio.data : null}
          sampleRate={audio.sampleRate}
          orientation="portrait"
          interactive={false}
          className="absolute inset-0"
        />
        {/* Frequency scale, vertical along the LEFT edge — HIGH up top, LOW
            at the bottom, matching the rolled camera. */}
        <div className="pointer-events-none absolute bottom-1 left-1 top-1 flex flex-col justify-between font-mono text-[7px] tracking-widest text-muted">
          <span>20K</span>
          <span>2K</span>
          <span>250</span>
          <span>20</span>
        </div>
        {/* L / M / H legend, vertical along the RIGHT edge — H up top to
            match the gradient direction in portrait mode. */}
        <div className="pointer-events-none absolute right-1 top-1 flex flex-col gap-0.5">
          <LegendDot color="#F97316" label="H" />
          <LegendDot color="#D946EF" label="M" />
          <LegendDot color="#0EA5E9" label="L" />
        </div>
      </div>
    </section>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="block h-1 w-1"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="font-mono text-[7px] tracking-widest text-secondary">
        {label}
      </span>
    </div>
  )
}
