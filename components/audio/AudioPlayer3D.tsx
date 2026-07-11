"use client";

import nextDynamic from "next/dynamic";
import { useEffect, type RefObject } from "react";
import { claimExpandedVisualizer } from "@/lib/visualizerSlot";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
} from "lucide-react";

// Code-split the GPU visualizer (three.js + addons, ~186 kB): load it only when
// this player actually renders inside an open MixOverlay, never via a static
// import. ssr:false — WebGL canvas.
const ParticleField3D = nextDynamic(
  () => import("./ParticleField3D").then((m) => m.ParticleField3D),
  { ssr: false },
);

export interface AudioPlayer3DProps {
  // Visualization input. `data` is the /lab audio-element path; `dataRef` is
  // the live tab-capture path (stable ref, read in the field's render loop so
  // the provider context doesn't churn). dataRef takes precedence.
  data?: Uint8Array | null;
  dataRef?: RefObject<Uint8Array | null>;
  sampleRate: number;

  // Display metadata.
  title: string;
  subtitle?: string;
  source?: string;
  coverUrl?: string;
  coverLabel?: string;

  // Playback (file/local-audio mode).
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek?: (seconds: number) => void;

  // LIVE MATRIX status indicator. Passive — capture is now requested
  // implicitly by the play button. Shows green when tab capture is feeding
  // the visualizer, dim grey otherwise.
  liveMatrixActive: boolean;

  // Optional source-link button.
  onOpenSource?: () => void;
  sourceUrl?: string;

  // Status strip — "ANALIZANDO", "EN PAUSA", "FUENTE EN VIVO", etc. Retained on
  // the props contract for callers, but the chrome that rendered it was stripped
  // from the overlay player (kept minimal: cover, title, visualizer, transport).
  statusLabel?: string;
  statusTone?: "live" | "paused" | "idle" | "error";
  statusDetail?: string;
}

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function AudioPlayer3D({
  data,
  dataRef,
  sampleRate,
  title,
  subtitle,
  source,
  coverUrl,
  coverLabel,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  liveMatrixActive,
  onOpenSource,
  sourceUrl,
}: AudioPlayer3DProps) {
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  // Hold the shared visualizer slot while this expanded player is mounted, so
  // the persistent NowPlayingHud drops its own WebGL field — one particle
  // context at a time (never 4 on home). See lib/visualizerSlot.
  useEffect(() => claimExpandedVisualizer(), []);

  return (
    <article
      className="relative flex flex-col bg-base font-mono text-primary"
      style={{ border: "1px solid #F97316" }}
    >
      {/* ── Cover + metadata + LIVE MATRIX ──────────────────────────────── */}
      {/* Stacks vertically on phones — the fixed 120px cover + metadata + LIVE
          MATRIX badge in one row was the MixOverlay horizontal-overflow source. */}
      <div className="flex flex-col gap-4 px-5 pt-5 sm:flex-row sm:items-start">
        <div
          className="relative h-20 w-20 shrink-0 overflow-hidden border border-border bg-elevated sm:h-[120px] sm:w-[120px]"
          aria-hidden
        >
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[10px] text-muted">
              {coverLabel && (
                <span style={{ color: "#F97316" }}>{coverLabel}</span>
              )}
              <span>SIN ARTE</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-syne text-xl font-black uppercase leading-tight text-primary">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[12px] uppercase tracking-widest text-secondary">
              {subtitle}
            </p>
          )}
          {source && (
            <p className="text-[11px] uppercase tracking-widest text-muted">
              {source}
            </p>
          )}
        </div>

        <div
          className="flex shrink-0 items-center gap-2 border px-3 py-1.5 text-[10px] tracking-widest"
          style={{
            borderColor: liveMatrixActive ? "#4ADE80" : "#2a2a2a",
            color: liveMatrixActive ? "#4ADE80" : "#666666",
            backgroundColor: liveMatrixActive
              ? "rgba(74,222,128,0.08)"
              : "transparent",
          }}
          title={
            liveMatrixActive
              ? "Captura de pestaña activa"
              : "La matriz se activa al pulsar reproducir"
          }
          aria-label={
            liveMatrixActive ? "Live matrix activa" : "Live matrix inactiva"
          }
        >
          LIVE MATRIX
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: liveMatrixActive ? "#4ADE80" : "#3a3a3a",
            }}
            aria-hidden
          />
        </div>
      </div>

      {/* ── GPU particle field — the star of the overlay. Generous height so
           the field reads as the marquee analyzer, not a thumbnail. ─────── */}
      <div className="relative mx-5 mt-4 h-[260px] overflow-hidden sm:h-[440px]">
        <ParticleField3D
          data={data}
          dataRef={dataRef}
          sampleRate={sampleRate}
          orientation="landscape"
          interactive
          className="absolute inset-0"
        />
      </div>

      {/* ── Seek bar — large hit target, sits right above the transport so the
           time position reads as part of the controls, not a separate strip. */}
      <div className="mt-4 px-5">
        <SeekBar
          currentTime={currentTime}
          duration={duration}
          progress={progress}
          onSeek={onSeek}
        />
      </div>

      {/* ── Transport row ───────────────────────────────────────────────── */}
      <div className="mt-2 flex items-center justify-center gap-5 px-5 pb-4">
        <TransportBtn aria="Aleatorio" disabled>
          <Shuffle size={14} style={{ color: "#F97316" }} />
        </TransportBtn>
        <TransportBtn aria="Anterior" disabled>
          <SkipBack size={16} />
        </TransportBtn>
        <button
          type="button"
          onClick={onPlayPause}
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          className="flex h-12 w-12 items-center justify-center border transition-colors"
          style={{ borderColor: "#F97316", color: "#F97316" }}
        >
          {isPlaying ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" />
          )}
        </button>
        <TransportBtn aria="Siguiente" disabled>
          <SkipForward size={16} />
        </TransportBtn>
        <TransportBtn aria="Repetir" disabled>
          <Repeat size={14} />
        </TransportBtn>
      </div>

      {/* ── Source link — the one functional affordance kept from the old
           status strip. Hidden entirely when there's no external source. ── */}
      {sourceUrl && (
        <div className="flex items-center justify-end border-t border-border/60 px-5 py-2.5">
          <button
            type="button"
            onClick={onOpenSource}
            className="text-[10px] tracking-widest"
            style={{ color: "#F97316" }}
          >
            [ABRIR FUENTE]
          </button>
        </div>
      )}
    </article>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function TransportBtn({
  children,
  aria,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  aria: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      className="flex h-8 w-8 items-center justify-center text-secondary transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-secondary"
    >
      {children}
    </button>
  );
}

function SeekBar({
  currentTime,
  duration,
  progress,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  progress: number;
  onSeek?: (seconds: number) => void;
}) {
  // Click (or drag-release) anywhere on the track to jump there. The wrapper
  // carries generous vertical padding so the clickable area is ~20px tall even
  // though the visible track is thin — the old 4px bar was near-impossible to
  // hit, which read as "seeking doesn't work".
  const seekFromEvent = (clientX: number, el: HTMLDivElement) => {
    if (!onSeek || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const t = (clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, t)) * duration);
  };
  return (
    <div className="flex items-center gap-3">
      <span className="w-[42px] shrink-0 text-[11px] tabular-nums text-secondary">
        {fmtTime(currentTime)}
      </span>
      <div
        className="group relative flex-1 cursor-pointer py-2.5"
        onClick={(e) => seekFromEvent(e.clientX, e.currentTarget)}
        role="slider"
        aria-label="Posición de la pista"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(progress * duration)}
      >
        <div className="relative h-2 w-full bg-border">
          <div
            className="absolute left-0 top-0 h-full"
            style={{ width: `${progress * 100}%`, backgroundColor: "#F97316" }}
          />
          <div
            className="absolute top-1/2 h-4 w-[6px] -translate-x-1/2 -translate-y-1/2 transition-transform group-hover:scale-y-125"
            style={{ left: `${progress * 100}%`, backgroundColor: "#F97316" }}
            aria-hidden
          />
        </div>
      </div>
      <span className="w-[42px] shrink-0 text-right text-[11px] tabular-nums text-secondary">
        {fmtTime(duration)}
      </span>
    </div>
  );
}
