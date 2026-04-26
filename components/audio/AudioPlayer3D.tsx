"use client";

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
} from "lucide-react";
import { Reproductor3D } from "./Reproductor3D";

export interface AudioPlayer3DProps {
  // Visualization input.
  data: Uint8Array | null;
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

  // Status strip — "ANALIZANDO", "EN PAUSA", "FUENTE EN VIVO", etc.
  statusLabel: string;
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

const TONE_COLOR: Record<
  NonNullable<AudioPlayer3DProps["statusTone"]>,
  string
> = {
  live: "#4ADE80",
  paused: "#F59E0B",
  idle: "#666666",
  error: "#E63329",
};

export function AudioPlayer3D({
  data,
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
  statusLabel,
  statusTone = "idle",
  statusDetail,
}: AudioPlayer3DProps) {
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const toneColor = TONE_COLOR[statusTone];

  return (
    <article
      className="relative flex flex-col bg-base font-mono text-primary"
      style={{ border: "1px solid #F97316" }}
    >
      {/* ── Top header strip ────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <div className="flex items-center gap-3 text-[11px] tracking-widest">
          <span style={{ color: "#F97316" }}>01</span>
          <span>AUDIO EMBED // REPRODUCTOR</span>
        </div>
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ backgroundColor: toneColor }}
          aria-hidden
        />
      </header>

      {/* ── Cover + metadata + LIVE MATRIX ──────────────────────────────── */}
      <div className="flex items-start gap-4 px-5 pt-4">
        <div
          className="relative h-[120px] w-[120px] shrink-0 overflow-hidden border border-border bg-elevated"
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
          {coverLabel && coverUrl && (
            <span
              className="absolute left-1.5 top-1.5 text-[9px] tracking-widest"
              style={{ color: "#F97316" }}
            >
              {coverLabel}
            </span>
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
          <div className="mt-2 flex items-center gap-3">
            <span className="text-[11px] tabular-nums text-secondary">
              {fmtTime(currentTime)}
            </span>
            <ProgressBar
              progress={progress}
              duration={duration}
              onSeek={onSeek}
            />
            <span className="text-[11px] tabular-nums text-secondary">
              {fmtTime(duration)}
            </span>
          </div>
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

      {/* ── 3D matrix viewport ──────────────────────────────────────────── */}
      <div className="relative mx-5 mt-4 h-[320px] overflow-hidden">
        <Reproductor3D
          data={data}
          sampleRate={sampleRate}
          className="absolute inset-0"
        />

        {/* MATRIX MODE legend, top-left */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1.5 text-[10px] tracking-widest">
          <span style={{ color: "#F97316" }}>MATRIX MODE</span>
          <LegendRow color="#0EA5E9" label="LOW" />
          <LegendRow color="#D946EF" label="MID" />
          <LegendRow color="#F97316" label="HIGH" />
        </div>

        {/* dB-ish vertical scale, right */}
        <div className="pointer-events-none absolute right-2 top-1 flex h-full flex-col justify-between py-1 text-[10px] tracking-widest text-muted">
          <span>-20k</span>
          <span>1k</span>
          <span>-20</span>
        </div>

        {/* frequency scale, bottom */}
        <div className="pointer-events-none absolute inset-x-2 bottom-1 flex justify-between text-[10px] tracking-widest text-muted">
          <span>20Hz</span>
          <span>250Hz</span>
          <span>2kHz</span>
          <span>20kHz</span>
        </div>
      </div>

      {/* ── Transport row ───────────────────────────────────────────────── */}
      <div className="mt-4 flex items-center justify-center gap-5 px-5 pb-3">
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
          className="flex h-11 w-11 items-center justify-center border transition-colors"
          style={{ borderColor: "#F97316", color: "#F97316" }}
        >
          {isPlaying ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" />
          )}
        </button>
        <TransportBtn aria="Siguiente" disabled>
          <SkipForward size={16} />
        </TransportBtn>
        <TransportBtn aria="Repetir" disabled>
          <Repeat size={14} />
        </TransportBtn>
        <div className="ml-3 flex items-end gap-[2px]">
          {[3, 5, 7, 9, 11].map((h, i) => (
            <div
              key={i}
              className="w-[3px]"
              style={{
                height: `${h + 2}px`,
                backgroundColor: i < 3 ? "#F97316" : "#3a3a3a",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Bottom status strip ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-border/60 px-5 py-2.5 text-[10px] tracking-widest text-muted">
        <span>
          <span style={{ color: toneColor }}>{statusLabel}</span>
          {statusDetail && <span className="ml-2">· {statusDetail}</span>}
        </span>
        {sourceUrl && (
          <button
            type="button"
            onClick={onOpenSource}
            className="tracking-widest"
            style={{ color: "#F97316" }}
          >
            [ABRIR FUENTE]
          </button>
        )}
      </div>
    </article>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="block h-2 w-2"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="text-secondary">{label}</span>
    </div>
  );
}

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

function ProgressBar({
  progress,
  duration,
  onSeek,
}: {
  progress: number;
  duration: number;
  onSeek?: (seconds: number) => void;
}) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, t)) * duration);
  };
  return (
    <div
      className="relative h-1 flex-1 cursor-pointer bg-border"
      onClick={handleClick}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={progress * duration}
    >
      <div
        className="absolute left-0 top-0 h-full"
        style={{ width: `${progress * 100}%`, backgroundColor: "#F97316" }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2"
        style={{
          left: `${progress * 100}%`,
          width: 6,
          height: 8,
          backgroundColor: "#F97316",
          transform: "translate(-50%, -50%)",
        }}
        aria-hidden
      />
    </div>
  );
}
