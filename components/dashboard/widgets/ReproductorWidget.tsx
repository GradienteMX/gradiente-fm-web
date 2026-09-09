'use client'

// ── REPRODUCTOR — transport + saved-mix carousel (revision-2 point 12) ──────
//
// The saved mixes live HERE (GUARDADOS dropped its mixes lens). The list is
// now a CAROUSEL: one mix at a time — cover, title, author — with ‹ › and an
// honest n/N readout. PLAY fires audio.playQueue(queue, index) SYNCHRONOUSLY
// inside the click gesture (platform-iframe law); the queue stays the FULL
// playable facet, ContentItems verbatim. ABRIR opens the mix's overlay in
// place (the popup — same openItem recipe as every widget). Link-out rows
// (Mixcloud/Bandcamp) render ABRIR FUENTE ↗, never a play glyph.
//
// The MINI VIBE FADER (Iker point 12) is the REAL VibeFader component,
// byte-reused — drag-to-commit friction intact (vibe-check law: never soften
// the gesture) — seated on a slim black faceplate band (its grips and meter
// are calibrated for dark grounds), bound to the carousel's focused mix.
//
// TransportCore stays the ONE useAudioPlayer subscriber leaf for progress
// ticks; playback state is never duplicated here.

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CoverSelector } from '@/components/dashboard/CoverSelector'
import { DashPopup } from '@/components/dashboard/DashPopup'
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useAudioPlayer } from '@/components/audio/AudioPlayerProvider'
import { MarqueeText } from '@/components/audio/MarqueeText'
import {
  pickOpenSourceUrl,
  pickPlayableSource,
  type PlayableSource,
} from '@/components/audio/sources'
import { detectPlatform } from '@/components/embed/platforms'
import { useDashboardData } from '@/components/dashboard/DashboardDataProvider'
import type { DashboardWidgetProps } from '@/components/dashboard/grid/WidgetGrid'
import { FOCUS_RING, WidgetFrame } from '@/components/dashboard/grid/WidgetFrame'
import { setReproductorAnchor } from '@/components/dashboard/shell/MiniTransport'
import { dashWidgetDomId } from '@/components/dashboard/shell/StatusStrip'
import { SmartImage } from '@/components/SmartImage'
import { VibeFader } from '@/components/VibeFader'
import { useOpenItem } from '@/lib/dashboard/openItem'
import { typeCode } from '@/lib/dashboard/palette'
import { getSavedItemEntries } from '@/lib/itemSavesCache'
import type { ContentItem, EmbedPlatform } from '@/lib/types'

const PLATFORM_LABEL: Record<EmbedPlatform, string> = {
  soundcloud: 'SOUNDCLOUD',
  youtube: 'YOUTUBE',
  mixcloud: 'MIXCLOUD',
  spotify: 'SPOTIFY',
  bandcamp: 'BANDCAMP',
}

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const TRANSPORT_BTN = `relative flex h-8 w-8 shrink-0 items-center justify-center border border-panel-text text-panel-text before:absolute before:-inset-1.5 before:content-[''] enabled:hover:bg-paper enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 ${FOCUS_RING}`

interface MixRowModel {
  item: ContentItem
  source: PlayableSource | null
  openUrl: string | null
  openPlatform: EmbedPlatform | null
}

// ── TransportCore — THE useAudioPlayer subscriber leaf ──────────────────────

function TransportCore({ compact = false }: { compact?: boolean }) {
  const audio = useAudioPlayer()
  const item = audio.currentItem

  if (!item) return null

  const cued = audio.activePlatform === null

  const handlePlay = () => {
    if (cued) {
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
    } else {
      audio.toggle()
    }
  }

  const progress =
    audio.duration > 0 ? Math.min(1, audio.currentTime / audio.duration) : 0

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
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

  const stateLabel = cued ? 'EN CUE' : audio.isPlaying ? 'SONANDO' : 'EN PAUSA'

  if (compact) {
    return (
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-ink/25 pb-1">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-mono text-[9px] leading-3 tracking-widest text-ink-soft">
            <span aria-hidden className={`h-1.5 w-1.5 border border-ink ${audio.isPlaying ? 'bg-acid' : 'bg-ink/25'}`} />
            {stateLabel} · {PLATFORM_LABEL[item.platform]}
          </p>
          <MarqueeText text={item.title} className="text-d13 leading-4 text-ink" />
        </div>
        <button type="button" onClick={handlePlay} aria-label={!cued && audio.isPlaying ? 'Pausar reproducción actual' : 'Reanudar reproducción actual'} className={`flex h-8 w-8 shrink-0 items-center justify-center border border-ink hover:bg-ink hover:text-paper ${FOCUS_RING}`}>
          {!cued && audio.isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
        </button>
      </div>
    )
  }

  return (
    <div className={`shrink-0 border border-ink bg-panel text-panel-text ${compact ? 'p-2' : 'p-3'}`}>
      <div className="flex items-center gap-3">
        {!compact && item.imageUrl && <div className="relative h-10 w-10 shrink-0 border border-panel-text"><SmartImage src={item.imageUrl} alt="" sizes="40px" className="object-contain" /></div>}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-d11 tracking-widest"><span className="text-acid">{stateLabel}</span> · {PLATFORM_LABEL[item.platform]}</p>
          <MarqueeText text={item.title} className="text-d13 font-medium text-panel-text" />
        </div>
        <div className="flex shrink-0 gap-1">
          {!compact && <button type="button" onClick={() => audio.prev()} disabled={!audio.hasPrev} aria-label="Pista anterior" className={TRANSPORT_BTN}><SkipBack size={12} /></button>}
          <button type="button" onClick={handlePlay} aria-label={!cued && audio.isPlaying ? 'Pausar reproducción actual' : 'Reanudar reproducción actual'} className={TRANSPORT_BTN}>
            {!cued && audio.isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
          </button>
          {!compact && <button type="button" onClick={() => audio.next()} disabled={!audio.hasNext} aria-label="Siguiente pista" className={TRANSPORT_BTN}><SkipForward size={12} /></button>}
        </div>
      </div>
      {!compact && !cued && audio.duration > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div role="slider" aria-label="Posición de reproducción" aria-valuemin={0} aria-valuemax={Math.round(audio.duration)} aria-valuenow={Math.round(audio.currentTime)} tabIndex={0} onClick={handleSeek} onKeyDown={handleSeekKey} className={`flex h-6 flex-1 cursor-pointer items-center ${FOCUS_RING}`}>
            <progress aria-hidden max={1} value={progress} className="pointer-events-none h-1 w-full accent-acid" />
          </div>
          <span className="font-mono text-d11 tabular-nums">{fmtTime(audio.currentTime)} / {fmtTime(audio.duration)}</span>
        </div>
      )}
    </div>
  )
}

// ── The carousel card (memo — transport ticks stop at the host) ─────────────

const MixCard = memo(function MixCard({
  row,
  active,
  playing,
  onPlay,
  onOpen,
  expanded = false,
  dense = false,
}: {
  dense?: boolean
  expanded?: boolean
  row: MixRowModel
  active: boolean
  playing: boolean
  onPlay: () => void
  onOpen: () => void
}) {
  const { item, source, openUrl, openPlatform } = row
  const meta = [item.author, item.duration].filter(Boolean).join(' · ')
  return (
    <div className={expanded ? "flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start" : "flex min-w-0 items-center gap-3"}>
      {/* Cover — click opens the content popup (overlay in place). */}
      <button
        type="button"
        onClick={onOpen}
        data-cue="tick"
        aria-label={`Abrir ${item.title}`}
        className={`relative ${expanded ? 'aspect-square w-40 lg:w-44' : dense ? 'h-12 w-12' : 'h-16 w-16'} shrink-0 overflow-hidden border border-ink bg-panel ${FOCUS_RING}`}
      >
        {item.imageUrl ? (
          <SmartImage src={item.imageUrl} alt="" sizes={expanded ? "176px" : dense ? "48px" : "64px"} className="object-contain" />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-mono text-d11 uppercase tracking-widest text-panel-text">
            {typeCode(item.type)}
          </span>
        )}
      </button>

      <div className={expanded ? "min-w-0 flex-1" : "grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-2"}>
        <div className="min-w-0">
        <button
          type="button"
          onClick={onOpen}
          data-cue="tick"
          className={`block w-full text-left ${expanded ? 'font-syne text-d28 font-bold leading-tight' : 'truncate text-d15 font-medium'} text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
        >
          {item.title}
        </button>
        <span className="block truncate font-mono text-d13 text-ink-soft">
          {source
            ? [PLATFORM_LABEL[source.platform], meta].filter(Boolean).join(' · ')
            : openUrl
              ? [openPlatform ? PLATFORM_LABEL[openPlatform] : 'FUENTE EXTERNA', item.author]
                  .filter(Boolean)
                  .join(' · ')
              : 'SIN FUENTE'}
        </span>
        {active && expanded && (
          <span className="flex items-center gap-1.5 font-mono text-d11 tracking-widest text-ink">
            <span aria-hidden className="h-2 w-2 rounded-full border border-ink bg-acid" />
            {playing ? 'REPRODUCIENDO' : 'EN PAUSA'}
          </span>
        )}
      {expanded && <p className="mt-3 text-d13 leading-relaxed text-ink-soft">Seleccionar una portada no cambia lo que suena.</p>}
      </div>
      {/* The one playback affordance for this mix. */}
      {source ? (
        <button
          type="button"
          onClick={onPlay}
          data-cue="tick"
          aria-label={active && playing ? `Pausar ${item.title}` : `Reproducir ${item.title}`}
          className={`relative flex ${expanded ? 'mt-4 min-h-11 gap-2 px-3' : 'h-11 w-11'} shrink-0 items-center justify-center border border-ink before:absolute before:-inset-1 before:content-[''] ${
            active ? 'bg-ink text-paper' : expanded ? 'bg-acid text-ink hover:bg-ink hover:text-paper' : 'bg-paper text-ink hover:bg-ink hover:text-paper'
          } ${FOCUS_RING}`}
        >
          {active && playing ? (
            <Pause size={14} fill="currentColor" />
          ) : (
            <Play size={14} fill="currentColor" />
          )}
          {expanded && <span className="font-mono text-d11 font-bold">{active && playing ? 'PAUSAR ESTA MEZCLA' : 'REPRODUCIR ESTA MEZCLA'}</span>}
        </button>
      ) : openUrl ? (
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-cue="tick"
          className={`flex min-h-11 shrink-0 items-center whitespace-nowrap font-mono text-d11 uppercase tracking-widest text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
        >
          ABRIR FUENTE ↗
        </a>
      ) : null}
      </div>
    </div>
  )
})

// ── Empty + compact states ──────────────────────────────────────────────────

function EmptyMixes() {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-2">
      <p className="font-mono text-d13 text-ink-soft">
        SIN MIXES GUARDADOS — guarda un mix para escucharlo aquí.
      </p>
      <Link
        href="/"
        className={`inline-flex min-h-11 items-center font-mono text-d13 uppercase tracking-widest text-ink underline-offset-4 hover:underline ${FOCUS_RING}`}
      >
        DESCUBRIR MIXES ↗
      </Link>
    </div>
  )
}

function CompactContent() {
  const audio = useAudioPlayer()
  const item = audio.currentItem

  if (item && audio.activePlatform !== null) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => audio.toggle()}
          aria-label={audio.isPlaying ? 'Pausar' : 'Reproducir'}
          className={`relative flex h-6 w-6 shrink-0 items-center justify-center border border-ink text-ink before:absolute before:-inset-2.5 before:content-[''] ${FOCUS_RING}`}
        >
          {audio.isPlaying ? (
            <Pause size={11} fill="currentColor" />
          ) : (
            <Play size={11} fill="currentColor" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <MarqueeText
            text={[item.title, item.author].filter(Boolean).join(' — ')}
            className="font-mono text-d13 text-ink"
          />
        </div>
      </div>
    )
  }

  return (
    <p className="min-w-0 font-mono text-d13 text-ink-soft">
      SIN MIXES —{' '}
      <Link
        href="/"
        className="text-ink underline underline-offset-4 hover:no-underline"
      >
        guarda uno
      </Link>{' '}
      y suena aquí.
    </p>
  )
}

// ── Carousel host — subscribes for the rarely-changing transport bits ───────

function CarouselHost({
  rows,
  queue,
  showFader,
  expanded,
  onClose,
}: {
  rows: MixRowModel[]
  queue: ContentItem[]
  showFader: boolean
  expanded: boolean
  onClose: () => void
}) {
  const { playQueue, primePlatform, currentItem, activePlatform, isPlaying, toggle } =
    useAudioPlayer()
  const openItem = useOpenItem()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Platform priming on mount (the getDisplayMedia prompt must never sit
  // between click and sound).
  useEffect(() => {
    const seen = new Set<EmbedPlatform>()
    for (const item of queue) {
      const source = pickPlayableSource(item)
      if (source && !seen.has(source.platform)) {
        seen.add(source.platform)
        primePlatform(source.platform, source.url)
      }
    }
  }, [queue, primePlatform])

  const clamped = Math.max(0, rows.findIndex(({ item }) => item.id === selectedId))
  const row = rows[clamped]
  const activeId = activePlatform !== null ? currentItem?.id ?? null : null
  const active = !!row && row.source !== null && activeId === row.item.id

  const step = useCallback(
    (dir: 1 | -1) => {
      if (rows.length) setSelectedId(rows[(clamped + dir + rows.length) % rows.length].item.id)
    },
    [rows, clamped],
  )

  // Play fires playQueue SYNCHRONOUSLY inside the click gesture; an active
  // row toggles instead of re-queueing.
  const handlePlay = useCallback(() => {
    if (!row) return
    if (active) {
      toggle()
      return
    }
    const queueIndex = queue.findIndex((track) => track.id === row.item.id)
    if (queueIndex < 0) return
    playQueue(queue, queueIndex)
  }, [row, active, queue, playQueue, toggle])

  const handleOpen = useCallback(() => {
    if (row) {
      onClose()
      void openItem(row.item.slug)
    }
  }, [row, openItem, onClose])

  if (!row) return null

  const focus = (
    <div className={`flex min-h-0 flex-1 flex-col ${expanded ? 'gap-5' : 'gap-2'}`}>
      <div className={expanded ? 'grid gap-6 lg:grid-cols-[1fr_240px]' : 'shrink-0'}>
      <div className="min-w-0">
      <div className="mb-1 flex h-8 shrink-0 items-center justify-between gap-2">
        <p className="font-mono text-d11 tracking-widest text-ink-soft">TUS MEZCLAS · {clamped + 1}/{rows.length}</p>
        <div className="flex shrink-0 gap-1">
          {([-1, 1] as const).map(direction => (
            <button key={direction} type="button" onClick={() => step(direction)} disabled={rows.length < 2} aria-label={direction === -1 ? 'Mix anterior' : 'Siguiente mix'} data-cue="tick" className={`flex h-8 w-9 items-center justify-center border border-ink text-ink enabled:hover:bg-ink enabled:hover:text-paper disabled:cursor-default disabled:opacity-40 ${FOCUS_RING}`}>
              {direction === -1 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          ))}
        </div>
      </div>
      <MixCard
        expanded={expanded}
        dense={!showFader && !expanded}
        row={row}
        active={active}
        playing={isPlaying}
        onPlay={handlePlay}
        onOpen={handleOpen}
      />
      </div>
      {expanded && <div className="border-ink lg:border-l lg:pl-5"><p className="mb-3 font-mono text-d11 font-bold tracking-widest">TUS MEZCLAS</p><CoverSelector gallery label="Tus mezclas" items={rows.map(({ item }) => item)} selectedId={row.item.id} playingId={isPlaying ? activeId : null} onSelect={setSelectedId} /></div>}
      </div>

      {/* Mini vibe fader — the REAL fader on a slim faceplate band (its
          meter/grips are dark-ground calibrated). Keyed per mix so the
          armed/drag state never bleeds across carousel steps. */}
      {(showFader || expanded) && (
        <div className={`shrink-0 border border-ink bg-panel ${expanded ? 'p-5' : 'px-2 py-1'}`}>
          {expanded && <p className="mb-4 font-mono text-d11 tracking-widest text-panel-text">VIBE CHECK · {row.item.title}</p>}
          <VibeFader
            key={row.item.id}
            fullWidth={expanded}
            item={{
              id: row.item.id,
              vibeMin: row.item.vibeMin,
              vibeMax: row.item.vibeMax,
            }}
          />
        </div>
      )}
    </div>
  )
  return expanded ? <DashPopup title="REPRODUCTOR" width="xl" closeLabel="VOLVER AL PANEL ↙" footer={currentItem ? <TransportCore /> : undefined} onClose={onClose}>{focus}</DashPopup> : focus
}

// ── The widget ──────────────────────────────────────────────────────────────

export function ReproductorWidget({ size, compact }: DashboardWidgetProps) {
  const { saves, loaded } = useDashboardData()
  const [expanded, setExpanded] = useState(false)
  const closeExpanded = useCallback(() => setExpanded(false), [])

  // Saved mixes, truly most-recently-saved first.
  const mixes = useMemo(() => {
    const entries = getSavedItemEntries()
    return saves
      .filter((item) => item.type === 'mix')
      .slice()
      .sort((a, b) => (entries.get(b.id) ?? '').localeCompare(entries.get(a.id) ?? ''))
  }, [saves])

  const rows = useMemo<MixRowModel[]>(
    () =>
      mixes.map((item) => {
        const source = pickPlayableSource(item)
        const openUrl = source ? null : pickOpenSourceUrl(item)
        return {
          item,
          source,
          openUrl,
          openPlatform: openUrl ? detectPlatform(openUrl) : null,
        }
      }),
    [mixes],
  )

  // The playable queue — full facet, list order, ContentItems verbatim.
  const queue = useMemo(
    () => rows.filter((row) => row.source !== null).map((row) => row.item),
    [rows],
  )

  const anchorRef = useCallback((el: HTMLDivElement | null) => {
    setReproductorAnchor(el)
  }, [])

  return (
    <div ref={anchorRef} id={dashWidgetDomId('reproductor')} className="h-full scroll-mt-14">
      <WidgetFrame
        title="REPRODUCTOR"
        action={!compact && rows.length > 0 ? { label: 'EXPANDIR', onClick: () => setExpanded(true) } : undefined}
        count={mixes.length > 0 ? mixes.length : undefined}
        compact={compact}
        loading={!loaded.saves && mixes.length === 0}
      >
        {compact ? (
          <CompactContent />
        ) : (
          <div className="flex h-full flex-col gap-2">
            <TransportCore compact />
            {rows.length === 0 ? (
              <div className="min-h-0 flex-1">
                <EmptyMixes />
              </div>
            ) : (
              <CarouselHost rows={rows} queue={queue} showFader={size.h >= 3} expanded={expanded} onClose={closeExpanded} />
            )}
          </div>
        )}
      </WidgetFrame>
    </div>
  )
}
