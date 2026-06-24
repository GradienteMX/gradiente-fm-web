'use client'

import nextDynamic from 'next/dynamic'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useAudioPlayer } from './AudioPlayerProvider'
import { useExpandedVisualizerActive } from '@/lib/visualizerSlot'

// Code-split the GPU visualizer: three.js + GPUComputationRenderer +
// EffectComposer + UnrealBloomPass (~186 kB) now load only when a track is
// actually playing (the `has` gate below) instead of riding in the home
// first-load chain via a static import. ssr:false — it's a WebGL canvas. The
// runtime mount gate is unchanged, so home idle still holds exactly 2 contexts.
const ParticleField3D = nextDynamic(
  () => import('./ParticleField3D').then((m) => m.ParticleField3D),
  { ssr: false },
)

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
  // While an expanded player (open MixOverlay / lab) holds the visualizer slot,
  // drop this HUD's WebGL field so the page never runs two particle contexts.
  const expandedActive = useExpandedVisualizerActive()
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

      {/* ── GPU particle field — portrait orientation for the narrow rail
           (smaller particle budget, tighter framing). Non-interactive — drag-
           rotation in a sidebar-sized viewport doesn't earn its keep; the
           field slow-orbits itself.

           CONTEXT HYGIENE: ParticleField3D opens ONE WebGL context (same as the
           old Reproductor3D it replaces — net context count unchanged). Home
           idle already runs CRTShader + VibeFluid, and Safari caps contexts per
           page, so the field mounts ONLY when a track is loaded (audio.currentItem
           != null → `has`). When it unmounts, the effect cleanup cancels its RAF
           and disposes the GPUComputationRenderer / composer / bloom / geometries
           / materials / renderer and removes its canvas — freeing the context.
           When the rail is idle we render an honest non-canvas placeholder, so
           home idle holds 2 contexts, not 3. ── */}
      <div className="relative h-[260px] overflow-hidden border border-border/40">
        {has && !expandedActive ? (
          <>
            <ParticleField3D
              dataRef={audio.dataRef}
              sampleRate={audio.sampleRate}
              orientation="portrait"
              interactive={false}
              className="absolute inset-0"
            />
            {/* Color-position legend along the RIGHT edge — hot up top, glacial
                at the bottom, matching the thermal ramp the field samples. */}
            <div className="pointer-events-none absolute right-1 top-1 flex flex-col gap-0.5">
              <LegendDot color="#FC6C0F" label="H" />
              <LegendDot color="#948E85" label="M" />
              <LegendDot color="#087487" label="L" />
            </div>
          </>
        ) : (
          <MatrixIdlePlaceholder mode={has && expandedActive ? 'yielded' : 'idle'} />
        )}
      </div>
    </section>
  )
}

// Calm, honest "no signal" state for the matrix viewport when no track is
// loaded. NOT a fake readout: it carries no spectrum and no RNG decoration —
// it states plainly that the visualizer is offline because nothing is playing.
// Pure CSS/DOM, zero WebGL context, no motion (so reduced-motion needs no
// special-casing). Colors come only from the glacial end of the thermal ramp
// (slot 0 #087487) plus the house idle grey #666666 — the dimmest, coolest
// registers, matching "signal dying into static".
function MatrixIdlePlaceholder({ mode = 'idle' }: { mode?: 'idle' | 'yielded' }) {
  // 'idle'    — nothing loaded: honest "no signal".
  // 'yielded' — a track is playing but the expanded overlay holds the WebGL
  //             slot, so this HUD copy is intentionally offline. Truthful (not
  //             "sin señal"): the matrix is live in the overlay.
  const yielded = mode === 'yielded'
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2"
      role="img"
      aria-label={yielded ? 'Matriz activa en el overlay' : 'Matriz inactiva — sin señal'}
    >
      {/* Dim baseline scanline: a single flat trace at the glacial floor of the
          ramp, the visual rest-state of the waterfall when there's no audio. */}
      <div
        className="h-px w-3/5"
        style={{ backgroundColor: '#087487', opacity: 0.35 }}
        aria-hidden
      />
      <span
        className="font-mono text-[9px] tracking-[0.3em]"
        style={{ color: yielded ? '#948E85' : '#666666' }}
      >
        {yielded ? 'MATRIZ·EN·OVERLAY' : 'SIN·SEÑAL'}
      </span>
      <span
        className="font-mono text-[7px] tracking-widest"
        style={{ color: '#666666', opacity: 0.7 }}
      >
        {yielded ? 'VISUALIZADOR EN PANTALLA' : 'MATRIZ EN ESPERA'}
      </span>
    </div>
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
