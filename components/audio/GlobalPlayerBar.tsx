'use client'

import nextDynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import { useAudioPlayer } from './AudioPlayerProvider'
import { MarqueeText } from './MarqueeText'
import { useOverlay } from '@/components/overlay/useOverlay'
import {
  claimExpandedVisualizer,
  isExpandedVisualizerActive,
  subscribeVisualizerSlot,
} from '@/lib/visualizerSlot'

// ── Global player bar — the unified bottom faceplate (PLIEGO fase A) ────────
//
// ONE persistent transport surface for the whole public site, docked to the
// viewport bottom: prev / play / next, playing dot, marquee title (opens the
// track's overlay), click-to-seek band, timecodes, MATRIZ bezel toggle and a
// MINIMIZAR collapse. Replaces both the old top strip AND the home rail's
// NowPlayingHud. State comes straight from AudioPlayerProvider — this is only
// a view; queue semantics and auto-advance live in the provider.
//
// Renders nothing when no track is loaded/cued, and on /dashboard +
// /lab/dashboard where MiniTransport owns the bottom edge (one-transport
// rule). An in-flow spacer twin keeps page content clear of the fixed bar.

// Code-split the GPU visualizer (three.js + GPUComputationRenderer +
// EffectComposer + UnrealBloomPass, ~186 kB): loads only when the MATRIZ bezel
// actually mounts the field, never in the first-load chain. ssr:false — it's a
// WebGL canvas. Same import the retired NowPlayingHud used.
const ParticleField3D = nextDynamic(
  () => import('./ParticleField3D').then((m) => m.ParticleField3D),
  { ssr: false },
)

// Focus ring for controls ON the ink faceplate — the panel-text counterpart of
// the on-paper outline-ink ring (same pair MiniTransport uses).
const PANEL_FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'

// Transport buttons: ≥44px hit, 1px panel-text border, hover = fill inversion,
// disabled = honest 30% (hasPrev/hasNext) with the inversion suppressed.
const TRANSPORT_BTN = `flex h-11 w-11 shrink-0 items-center justify-center border border-panel-text text-panel-text hover:bg-panel-text hover:text-panel disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-panel-text ${PANEL_FOCUS_RING}`

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

  const [minimized, setMinimized] = useState(false)
  const [matrixOpen, setMatrixOpen] = useState(false)

  // MiniTransport + the REPRODUCTOR widget own the dashboard bottom edge.
  const onDashboard =
    pathname.startsWith('/dashboard') || pathname.startsWith('/lab/dashboard')

  // The particle field (a WebGL context) may mount only once a track is
  // actually loaded into a bridge — NOT for a merely-cued track — so idle
  // pages keep their context budget.
  const fieldActive = audio.activePlatform != null
  const wantField =
    matrixOpen && !minimized && fieldActive && item != null && !onDashboard

  // ── Visualizer slot: claim while our field is up, yield to the overlay ──
  // The bezel claims the shared expanded-visualizer slot for the lifetime of
  // its mounted field (MixOverlay slot law: never two particle contexts). The
  // slot is a bare counter with no "who" — so to detect ANOTHER claimant
  // (MixOverlay's AudioPlayer3D) while we hold a claim, each notification
  // briefly releases our claim, samples the slot, and re-claims only when it
  // is free. `probing` guards the notify re-entrancy our own release/claim
  // causes. When someone else holds it we render MATRIZ EN OVERLAY instead of
  // a second field.
  const [yielded, setYielded] = useState(false)
  useEffect(() => {
    if (!wantField) {
      setYielded(false)
      return
    }
    let release: (() => void) | null = null
    let probing = false
    const evaluate = () => {
      if (probing) return
      probing = true
      if (release) {
        release()
        release = null
      }
      const others = isExpandedVisualizerActive()
      if (!others) release = claimExpandedVisualizer()
      setYielded(others)
      probing = false
    }
    evaluate()
    const unsubscribe = subscribeVisualizerSlot(evaluate)
    return () => {
      unsubscribe()
      if (release) release()
    }
  }, [wantField])

  // Hooks all ran — hiding the bar never touches the global provider, so
  // playback continues uninterrupted across navigations.
  if (!item || onDashboard) return null

  const progress =
    audio.duration > 0 ? Math.min(1, audio.currentTime / audio.duration) : 0
  const trackLine = [item.title, item.author].filter(Boolean).join(' — ')

  // Play semantics (AUDIO LAW — transport calls stay SYNCHRONOUS inside the
  // click gesture, never after an await): pause when sounding; toggle when a
  // bridge owns the track; for a merely-CUED track (metadata only, no bridge)
  // synthesize a PlayableRef from the provider's own platform+sourceUrl and
  // load it — first play works from the bar without visiting an overlay.
  const handlePlay = () => {
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

  // Click-to-seek. getBoundingClientRect is correct here (clientX and the rect
  // live in the same visual space; the bar sits outside every overlay, so the
  // in-overlay offsetWidth rule doesn't apply).
  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audio.duration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const t = (e.clientX - rect.left) / rect.width
    audio.seek(Math.max(0, Math.min(1, t)) * audio.duration)
  }

  const handleSeekKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (audio.duration <= 0) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      audio.seek(Math.max(0, audio.currentTime - 10))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      audio.seek(Math.min(audio.duration, audio.currentTime + 10))
    }
  }

  const openCurrent = () => {
    // Synthetic refs (inline prose links) may carry no slug — guard it.
    if (item.slug) overlay.open(item.slug)
  }

  return (
    <>
      {/* In-flow spacer twin — page content never hides behind the fixed bar.
          Height comes from --gr-player-h (globals.css chrome-height block) so
          the sticky arithmetic lives in ONE place; the minimized 28px strip is
          this component's own state, not shared chrome arithmetic. */}
      <div
        aria-hidden
        className={minimized ? 'h-7' : 'h-[var(--gr-player-h)]'}
      />

      {/* ── MATRIZ bezel window ─────────────────────────────────────────── */}
      {matrixOpen && !minimized && (
        <div
          role="region"
          aria-label="Ventana de la matriz"
          className="fixed bottom-[calc(var(--gr-player-h)+8px)] right-8 z-[46] h-56 w-80 border border-ink bg-panel"
        >
          {fieldActive && !yielded ? (
            <div className="relative h-full w-full overflow-hidden">
              <ParticleField3D
                dataRef={audio.dataRef}
                sampleRate={audio.sampleRate}
                orientation="landscape"
                interactive={false}
                className="absolute inset-0"
              />
            </div>
          ) : (
            <MatrixIdle mode={fieldActive && yielded ? 'yielded' : 'idle'} />
          )}
        </div>
      )}

      {/* ── The faceplate bar ───────────────────────────────────────────── */}
      <div
        role="region"
        aria-label="Reproductor global"
        className={`fixed inset-x-0 bottom-0 z-[45] flex items-center gap-3 border-t border-ink bg-panel px-4 text-panel-text ${
          minimized ? 'h-7' : 'h-[var(--gr-player-h)]'
        }`}
      >
        {minimized ? (
          <>
            <PlayingDot playing={audio.isPlaying} />
            <button
              type="button"
              onClick={openCurrent}
              disabled={!item.slug}
              aria-label="Abrir overlay de la pista"
              className={`min-w-0 flex-1 text-left disabled:cursor-default ${PANEL_FOCUS_RING}`}
            >
              <MarqueeText
                text={trackLine}
                className="font-mono text-d11 text-panel-text"
              />
            </button>
            <button
              type="button"
              onClick={() => setMinimized(false)}
              aria-label="Expandir reproductor"
              className={`flex h-full w-11 shrink-0 items-center justify-center text-panel-text hover:bg-panel-text hover:text-panel ${PANEL_FOCUS_RING}`}
            >
              <ChevronUp size={14} />
            </button>
          </>
        ) : (
          <>
            {/* Transport */}
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => audio.prev()}
                disabled={!audio.hasPrev}
                aria-label="Anterior"
                className={TRANSPORT_BTN}
              >
                <SkipBack size={14} />
              </button>
              <button
                type="button"
                onClick={handlePlay}
                aria-label={audio.isPlaying ? 'Pausar' : 'Reproducir'}
                className={TRANSPORT_BTN}
              >
                {audio.isPlaying ? (
                  <Pause size={16} fill="currentColor" />
                ) : (
                  <Play size={16} fill="currentColor" />
                )}
              </button>
              <button
                type="button"
                onClick={() => audio.next()}
                disabled={!audio.hasNext}
                aria-label="Siguiente"
                className={TRANSPORT_BTN}
              >
                <SkipForward size={14} />
              </button>
            </div>

            <PlayingDot playing={audio.isPlaying} />

            {/* Title — artist; opens the track's overlay */}
            <button
              type="button"
              onClick={openCurrent}
              disabled={!item.slug}
              aria-label="Abrir overlay de la pista"
              className={`min-w-0 flex-1 text-left disabled:cursor-default md:max-w-[40%] ${PANEL_FOCUS_RING}`}
            >
              <MarqueeText
                text={trackLine}
                className="font-mono text-d13 text-panel-text"
              />
            </button>

            {/* Seek band — faceplate ruler texture + acid progress + caret.
                Keyboard: ←/→ seek ±10s. Hidden below md with its timecodes;
                phones keep the bar minimal. */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Posición de reproducción"
              aria-valuemin={0}
              aria-valuemax={Math.round(audio.duration)}
              aria-valuenow={Math.round(audio.currentTime)}
              onClick={handleSeekClick}
              onKeyDown={handleSeekKey}
              className={`relative hidden h-6 flex-1 cursor-pointer md:block ${PANEL_FOCUS_RING}`}
            >
              <div
                aria-hidden
                className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(237,235,227,0.7)_0,rgba(237,235,227,0.7)_1px,transparent_1px,transparent_6px)]"
              />
              <div
                aria-hidden
                className="absolute left-0 top-0 h-full bg-acid"
                style={{ width: `${progress * 100}%` }}
              />
              <div
                aria-hidden
                className="absolute -top-1 h-8 w-[2px] bg-acid"
                style={{ left: `calc(${progress * 100}% - 1px)` }}
              />
            </div>

            {/* Timecodes */}
            <span className="hidden shrink-0 font-mono text-d13 tabular-nums text-panel-text md:inline">
              {fmtTime(audio.currentTime)}
              <span className="opacity-50"> / </span>
              {fmtTime(audio.duration)}
            </span>

            {/* MATRIZ bezel toggle — only where tab capture can feed it */}
            {audio.matrixSupported && (
              <button
                type="button"
                onClick={() => setMatrixOpen((v) => !v)}
                aria-pressed={matrixOpen}
                aria-label={
                  matrixOpen
                    ? 'Cerrar ventana de la matriz'
                    : 'Abrir ventana de la matriz'
                }
                className={`flex h-full shrink-0 items-center ${PANEL_FOCUS_RING}`}
              >
                <span
                  className={`border border-panel-text px-2 py-1 font-mono text-d13 uppercase tracking-widest ${
                    matrixOpen
                      ? 'bg-panel-text text-panel'
                      : 'text-panel-text hover:bg-panel-text hover:text-panel'
                  }`}
                >
                  MATRIZ
                </span>
              </button>
            )}

            {/* MINIMIZAR */}
            <button
              type="button"
              onClick={() => setMinimized(true)}
              aria-label="Minimizar reproductor"
              className={`flex h-11 w-11 shrink-0 items-center justify-center text-panel-text hover:bg-panel-text hover:text-panel ${PANEL_FOCUS_RING}`}
            >
              <ChevronDown size={16} />
            </button>
          </>
        )}
      </div>
    </>
  )
}

// Acid playing dot — solid while sounding, outlined while paused. Acid on the
// black panel is a sanctioned use.
function PlayingDot({ playing }: { playing: boolean }) {
  return (
    <span
      aria-hidden
      className={`h-2 w-2 shrink-0 rounded-full ${
        playing ? 'bg-acid' : 'border border-acid'
      }`}
    />
  )
}

// Honest idle states for the bezel viewport — no fake readouts, no motion
// (reduced-motion parity is free). 'idle' = nothing loaded into a bridge yet;
// 'yielded' = a track is live but the expanded overlay holds the WebGL slot,
// so this copy is intentionally offline (truthful: the matrix IS running, in
// the overlay). Equivalent of the retired NowPlayingHud's MatrixIdlePlaceholder
// re-spoken in the pliego register.
function MatrixIdle({ mode }: { mode: 'idle' | 'yielded' }) {
  const yielded = mode === 'yielded'
  return (
    <div
      role="img"
      aria-label={
        yielded ? 'Matriz activa en el overlay' : 'Matriz inactiva — sin señal'
      }
      className="flex h-full w-full flex-col items-center justify-center gap-2"
    >
      <div aria-hidden className="h-px w-3/5 bg-panel-text/30" />
      <span className="font-mono text-d11 uppercase tracking-widest text-panel-text">
        {yielded ? 'MATRIZ EN OVERLAY' : 'SIN SEÑAL'}
      </span>
      <span className="font-mono text-d11 uppercase tracking-widest text-panel-text/50">
        {yielded ? 'VISUALIZADOR EN PANTALLA' : 'MATRIZ EN ESPERA'}
      </span>
    </div>
  )
}
