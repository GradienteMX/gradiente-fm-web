'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AudioPlayer3D } from '@/components/audio/AudioPlayer3D'
import { useAudioElementAnalyser } from '@/components/audio/useAudioElementAnalyser'
import { useTabAudioCapture } from '@/components/audio/useTabAudioCapture'
import { useSoundCloudWidget } from '@/components/audio/useSoundCloudWidget'

// 'embed' = transport drives the SoundCloud widget below.
// 'file'  = transport drives a local audio file picked by the user.
// LIVE MATRIX (tab capture) is a separate, independent toggle for the
// visualizer's data source.
type Mode = 'embed' | 'file'

// Curated test embeds. Order matters: first one is the default to render.
const TEST_EMBEDS: { id: string; label: string; src: string }[] = [
  {
    id: 'sc-itsgettingtiresometoo-wytudtm',
    label: 'itsgettingtiresometoo — what you do to me',
    src: 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fitsgettingtiresometoo%2Fwhat-you-do-to-me&color=%23F97316&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false',
  },
]

export default function AudioLabPage() {
  const file = useAudioElementAnalyser()
  const tab = useTabAudioCapture()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const widget = useSoundCloudWidget(iframeRef)

  const [mode, setMode] = useState<Mode>('embed')

  const data = tab.status === 'live' ? tab.data : mode === 'file' ? file.data : null
  const sampleRate = tab.status === 'live' ? tab.sampleRate : file.sampleRate

  const handleFilePick = (f: File | null) => {
    if (!f) return
    setMode('file')
    file.loadFile(f)
    // Tiny delay to let the audio element load metadata before pressing play.
    setTimeout(() => file.play(), 80)
  }

  // Play handler folds the LIVE MATRIX permission gate into the play button:
  // first time we transition into "playing", request tab capture so the
  // visualizer reacts. If the user denies, audio still plays — the visualizer
  // just stays idle. If supported but not yet granted/denied, the prompt fires
  // synchronously off this user gesture (required by getDisplayMedia).
  const handleTransportToggle = async () => {
    const willStartPlaying =
      mode === 'embed' ? !widget.isPlaying : !file.isPlaying
    const shouldRequestCapture =
      willStartPlaying &&
      tab.isSupported &&
      tab.status !== 'live' &&
      tab.status !== 'requesting' &&
      tab.status !== 'denied'
    if (shouldRequestCapture) {
      try {
        await tab.request()
      } catch {
        // capture refused — proceed to play audio without visualizer reactivity
      }
    }
    if (mode === 'embed') widget.toggle()
    else file.toggle()
  }

  // Transport — routed by mode. In embed mode we drive the SoundCloud iframe
  // via its Widget API; in file mode we drive the local <audio> element.
  const transport =
    mode === 'embed'
      ? {
          isPlaying: widget.isPlaying,
          currentTime: widget.currentTime,
          duration: widget.duration,
          seek: widget.seek,
        }
      : {
          isPlaying: file.isPlaying,
          currentTime: file.currentTime,
          duration: file.duration,
          seek: file.seek,
        }

  const playerTitle =
    mode === 'embed'
      ? widget.track?.title ?? (widget.ready ? 'EMBED' : 'CONECTANDO…')
      : file.fileName ?? 'ARCHIVO LOCAL'
  const playerSubtitle =
    mode === 'embed'
      ? widget.track?.artist ?? 'SoundCloud'
      : 'Reproductor local'
  const playerSource =
    mode === 'embed' ? 'SOUNDCLOUD · EMBED' : 'LOCAL FILE'
  const playerCover = mode === 'embed' ? widget.track?.artwork ?? undefined : undefined

  const statusLabel = useMemo(() => {
    // Visualizer status is driven by the analyser source (LIVE MATRIX or file).
    if (tab.status === 'live') return 'CAPTURA EN VIVO'
    if (tab.status === 'requesting') return 'SOLICITANDO...'
    if (tab.status === 'denied') return 'PERMISO DENEGADO'
    if (tab.status === 'unsupported') return 'NO COMPATIBLE'
    if (mode === 'file') {
      if (file.status === 'live') return 'ANALIZANDO'
      if (file.status === 'paused') return 'EN PAUSA'
      if (file.status === 'ended') return 'FIN DE PISTA'
      if (file.status === 'loading') return 'CARGANDO'
      if (file.status === 'error') return 'ERROR'
    }
    if (mode === 'embed') {
      if (transport.isPlaying) return 'EMBED · REPRODUCIENDO'
      if (widget.ready) return 'EMBED · LISTO'
      return 'EMBED · CARGANDO'
    }
    return 'EN ESPERA'
  }, [mode, tab.status, file.status, transport.isPlaying, widget.ready])

  const statusTone: 'live' | 'paused' | 'idle' | 'error' = useMemo(() => {
    if (tab.status === 'live') return 'live'
    if (
      tab.status === 'denied' ||
      tab.status === 'unsupported' ||
      tab.status === 'error'
    )
      return 'error'
    if (mode === 'file') {
      if (file.status === 'live') return 'live'
      if (file.status === 'paused') return 'paused'
      if (file.status === 'error') return 'error'
    }
    if (mode === 'embed' && transport.isPlaying) return 'live'
    return 'idle'
  }, [mode, tab.status, file.status, transport.isPlaying])

  const statusDetail =
    tab.status === 'live'
      ? 'analizador · pestaña actual'
      : mode === 'file'
        ? file.fileName
          ? `archivo · ${file.fileName}`
          : 'sin archivo cargado'
        : 'matriz inactiva — activa LIVE MATRIX para reaccionar'

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-5 py-6">
      {/* Lab header */}
      <header className="flex flex-col gap-2 border border-border bg-base/40 px-4 py-3">
        <div className="flex items-center justify-between font-mono text-[10px] tracking-widest">
          <div className="flex items-center gap-3">
            <span style={{ color: '#F97316' }}>// LAB · AUDIO ENGINE</span>
            <span className="text-muted">v0.1 · prototipo</span>
          </div>
          <span className="text-muted">EXPERIMENTAL · NO ENVIADO</span>
        </div>
        <p className="font-grotesk text-[12px] leading-relaxed text-secondary">
          El reproductor controla un embed de SoundCloud invisible (en producción).
          Pulsa <span style={{ color: '#F97316' }}>▶</span> arriba; activa{' '}
          <span style={{ color: '#F97316' }}>LIVE MATRIX</span> para que la matriz
          reaccione al espectro en tiempo real.
        </p>
      </header>

      {/* Source switcher */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-widest">
        <span className="text-muted">FUENTE</span>
        <button
          type="button"
          onClick={() => setMode('embed')}
          className="border px-3 py-1.5 transition-colors"
          style={{
            borderColor: mode === 'embed' ? '#F97316' : '#242424',
            color: mode === 'embed' ? '#F97316' : '#888888',
            backgroundColor: mode === 'embed' ? 'rgba(249,115,22,0.08)' : 'transparent',
          }}
        >
          EMBED
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="border px-3 py-1.5 transition-colors"
          style={{
            borderColor: mode === 'file' ? '#F97316' : '#242424',
            color: mode === 'file' ? '#F97316' : '#888888',
            backgroundColor: mode === 'file' ? 'rgba(249,115,22,0.08)' : 'transparent',
          }}
        >
          ARCHIVO LOCAL
        </button>
        <span className="ml-auto text-muted">
          {tab.isSupported ? 'CHROMIUM · OK' : 'CAPTURA NO SOPORTADA'}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
      />

      {/* Hidden audio element — Web Audio graph reads from it in file mode */}
      <audio ref={file.audioRef} className="hidden" />

      {/* Player */}
      <AudioPlayer3D
        data={data}
        sampleRate={sampleRate}
        title={playerTitle}
        subtitle={playerSubtitle}
        source={playerSource}
        coverUrl={playerCover}
        coverLabel="LAB"
        isPlaying={transport.isPlaying}
        currentTime={transport.currentTime}
        duration={transport.duration}
        onPlayPause={handleTransportToggle}
        onSeek={transport.seek}
        liveMatrixActive={tab.status === 'live'}
        statusLabel={statusLabel}
        statusTone={statusTone}
        statusDetail={statusDetail}
      />

      {/* Diagnostics */}
      <section className="grid grid-cols-1 gap-3 border border-border bg-base/40 px-4 py-3 font-mono text-[10px] tracking-widest md:grid-cols-3">
        <Stat label="MODO" value={mode === 'embed' ? 'EMBED (SC)' : 'FILE'} />
        <Stat label="MATRIZ" value={tab.status === 'live' ? 'LIVE' : 'INACTIVA'} tone={tab.status === 'live' ? 'live' : 'idle'} />
        <Stat label="WIDGET" value={widget.ready ? 'READY' : 'BOOT'} />
        <Stat label="SAMPLE RATE" value={`${sampleRate} Hz`} />
        <Stat label="BINS" value={data ? String(data.length) : '—'} />
        <Stat
          label="PEAK"
          value={data ? String(Math.max(...Array.from(data))) : '—'}
        />
      </section>

      {/* Help */}
      <section className="border border-border bg-base/40 p-4 font-grotesk text-[12px] leading-relaxed text-secondary">
        <h3 className="mb-2 font-mono text-[10px] tracking-widest text-primary">
          // CÓMO FUNCIONA
        </h3>
        <ol className="ml-4 list-decimal space-y-1 text-secondary">
          <li>Pulsa <span style={{ color: '#F97316' }}>▶</span> en el reproductor.</li>
          <li>
            La primera vez por sesión, el navegador pedirá permiso para
            capturar el audio de la pestaña — elige &quot;
            <strong>Esta pestaña</strong>&quot; y marca{' '}
            <strong>&quot;Compartir audio de pestaña&quot;</strong>.
          </li>
          <li>
            El audio empieza a sonar y la matriz <em>LIVE MATRIX</em> se
            enciende. Si rechazas el permiso, el audio igual suena — la matriz
            simplemente queda inactiva.
          </li>
        </ol>
        <p className="mt-3 text-muted">
          El permiso del navegador no se guarda entre sesiones — el diálogo
          aparece la primera vez que pulsas play en cada carga. Solo funciona
          en navegadores basados en Chromium (Chrome, Edge, Brave, Opera).
        </p>
      </section>

      {/* Test embed bench. In production this iframe is invisible — kept
          visible here so you can verify the widget bridge end-to-end. */}
      <EmbedBench iframeRef={iframeRef} />
    </div>
  )
}

function EmbedBench({
  iframeRef,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement>
}) {
  const active = TEST_EMBEDS[0]
  return (
    <section className="border border-border bg-base/40 p-4">
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] tracking-widest">
        <div className="flex items-center gap-2">
          <span style={{ color: '#F97316' }}>// EMBED · DEBUG VISIBLE</span>
          <span className="text-muted">— oculto en producción</span>
        </div>
        <span className="text-muted uppercase">soundcloud</span>
      </div>
      <iframe
        ref={iframeRef}
        title={active.label}
        src={active.src}
        height={166}
        width="100%"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        className="block border border-border"
      />
      <p className="mt-2 font-mono text-[10px] tracking-widest text-muted">
        TIP · controla el embed desde el reproductor de arriba
      </p>
    </section>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'live' | 'paused' | 'idle' | 'error'
}) {
  const color =
    tone === 'live'
      ? '#4ADE80'
      : tone === 'paused'
        ? '#F59E0B'
        : tone === 'error'
          ? '#E63329'
          : '#F0F0F0'
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  )
}
