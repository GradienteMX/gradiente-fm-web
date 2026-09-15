'use client'

// Saved mixes in a warm hi-fi deck with shared selection in the expanded player.
// Playback uses the real audio provider; changing the browsed cover is separate
// from playing. External-only sources link out; the slider is real playback time.

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
  selectedId,
  setSelectedId,
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
  selectedId: string | null
  setSelectedId: (id: string) => void
}) {
  const { playQueue, primePlatform, currentItem, activePlatform, isPlaying, toggle } =
    useAudioPlayer()
  const openItem = useOpenItem()

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
    [rows, clamped, setSelectedId],
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

const DECK_FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-[#f2ede1]'
const DECK_KEY = `flex min-h-11 min-w-0 items-center justify-center rounded-[2px] border border-[#776e60] bg-gradient-to-b from-[#fffdf7] to-[#ded6c7] text-ink shadow-[inset_0_1px_0_#fff,0_2px_2px_#40372b26] enabled:hover:from-white enabled:active:translate-y-px enabled:active:shadow-none disabled:cursor-not-allowed disabled:opacity-35 ${DECK_FOCUS}`
const DECK_SEEK = `block h-11 w-full min-w-0 cursor-pointer appearance-none bg-transparent disabled:cursor-default ${DECK_FOCUS}
  [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:border [&::-webkit-slider-runnable-track]:border-[#aca393] [&::-webkit-slider-runnable-track]:bg-[#c9c0b1] [&::-webkit-slider-runnable-track]:shadow-[inset_0_1px_2px_#51463930,0_1px_0_#fff]
  [&::-webkit-slider-thumb]:-mt-[9px] [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#776e60] [&::-webkit-slider-thumb]:bg-[linear-gradient(135deg,#fffdf8_0%,#bdb5a6_46%,#f9f5ec_60%,#c8bfaf_100%)] [&::-webkit-slider-thumb]:shadow-[0_2px_3px_#40372b40]
  [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border [&::-moz-range-track]:border-[#aca393] [&::-moz-range-track]:bg-[#c9c0b1]
  [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-[#776e60] [&::-moz-range-thumb]:bg-[linear-gradient(135deg,#fffdf8_0%,#bdb5a6_46%,#f9f5ec_60%,#c8bfaf_100%)] [&::-moz-range-thumb]:shadow-[0_2px_3px_#40372b40]`

function HiFiDeck({ rows, queue, onExpand, selectedId, setSelectedId, short }: { rows: MixRowModel[]; queue: ContentItem[]; onExpand: () => void; selectedId: string | null; setSelectedId: (id: string) => void; short: boolean }) {
  const audio = useAudioPlayer()
  const openItem = useOpenItem()
  const index = Math.max(0, rows.findIndex((row) => row.item.id === selectedId))
  const row = rows[index]
  const source = row?.source
  const primePlatform = audio.primePlatform
  const active = !!row && audio.currentItem?.id === row.item.id && audio.activePlatform !== null
  useEffect(() => {
    if (source) primePlatform(source.platform, source.url)
  }, [source, primePlatform])
  if (!row) return null
  const step = (direction: number) => setSelectedId(rows[(index + direction + rows.length) % rows.length].item.id)
  const play = () => {
    if (active) audio.toggle()
    else {
      const queueIndex = queue.findIndex((item) => item.id === row.item.id)
      if (queueIndex >= 0) audio.playQueue(queue, queueIndex)
    }
  }
  const platform = row.source ? PLATFORM_LABEL[row.source.platform] : row.openPlatform ? PLATFORM_LABEL[row.openPlatform] : 'MIX'
  const playing = active && audio.isPlaying
  return <section aria-label="Reproductor" className="relative flex h-full min-h-80 flex-col gap-3 rounded-[3px] border border-[#61594d] bg-[linear-gradient(135deg,#fcf9f0_0%,#f2ede1_56%,#e2dacb_100%)] p-3 text-ink shadow-[inset_0_0_0_2px_#fffaf080,0_3px_4px_#40372b26] [container-type:inline-size] md:min-h-0">
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[#776e60]">
      <h2 className="min-w-0 font-syne text-[clamp(12px,4.2cqw,18px)] font-extrabold">REPRODUCTOR</h2>
      <button type="button" onClick={onExpand} className={`min-h-11 shrink-0 font-mono text-d11 underline-offset-4 hover:underline ${DECK_FOCUS}`}>ABRIR ↗</button>
    </header>
    <div className={`grid min-h-0 flex-1 grid-cols-[42%_minmax(0,1fr)] items-center gap-3 ${short ? 'md:grid-cols-[64px_minmax(0,1fr)_156px]' : ''}`}>
      <button type="button" onClick={() => void openItem(row.item.slug)} aria-label={`Ver ${row.item.title}`} className={`relative aspect-square max-h-full w-full overflow-hidden rounded-[1px] border border-[#776e60] bg-[#e4dfd3] ${DECK_FOCUS}`}>
        {row.item.imageUrl ? <SmartImage src={row.item.imageUrl} alt="" sizes="(max-width: 767px) 42vw, 240px" className="object-contain" />
          : <span className="font-syne text-d18 font-bold">MIX</span>}
      </button>
      <div className={`flex min-h-0 min-w-0 flex-col justify-between gap-3 self-stretch py-1 ${short ? 'md:contents' : ''}`}>
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <p title={row.item.title} className={`line-clamp-2 min-w-0 flex-1 font-grotesk text-[clamp(16px,5cqw,23px)] font-bold leading-tight ${short ? 'md:line-clamp-1 md:text-d15' : ''}`}>{row.item.title}</p>
            <span aria-hidden className={`mt-1 h-3 w-3 shrink-0 rounded-full border border-[#b9563a] shadow-[inset_0_1px_1px_#fff9] ${playing ? 'bg-[#ff693f]' : 'bg-[#e4ab93]'}`} />
          </div>
          <p className="mt-2 font-mono text-d11 tracking-wide">{platform} · {index + 1}/{rows.length}</p>
          {row.item.author && <p className="mt-1 truncate font-mono text-d11 text-ink-soft">{row.item.author}</p>}
        </div>
        <div className={`grid grid-cols-[1fr_1.2fr_1fr] gap-1.5 border-t border-[#776e60] pt-3 ${short ? 'md:border-t-0 md:pt-0' : ''}`}>
          <button type="button" disabled={rows.length < 2} onClick={() => step(-1)} aria-label="Mix anterior" className={DECK_KEY}><SkipBack size={18} fill="currentColor" /></button>
          {row.source ? <button type="button" onClick={play} aria-label={playing ? 'Pausar mix' : 'Reproducir mix'}
            className={`flex min-h-12 min-w-0 items-center justify-center rounded-[2px] border border-[#a44329] bg-gradient-to-b from-[#ff8057] to-[#f25e36] text-ink shadow-[inset_0_0_0_2px_#ffb09588,0_2px_2px_#40372b40] hover:from-[#ff926f] active:translate-y-px active:shadow-none ${DECK_FOCUS}`}>
            {playing ? <Pause size={25} fill="currentColor" /> : <Play size={25} fill="currentColor" />}
          </button> : row.openUrl ? <a href={row.openUrl} target="_blank" rel="noreferrer" className={`${DECK_KEY} whitespace-nowrap px-0.5 font-mono text-[10px]`}>FUENTE ↗</a>
            : <span className="flex items-center justify-center text-center font-mono text-d11 text-ink-soft">SIN FUENTE</span>}
          <button type="button" disabled={rows.length < 2} onClick={() => step(1)} aria-label="Siguiente mix" className={DECK_KEY}><SkipForward size={18} fill="currentColor" /></button>
        </div>
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-3 font-mono text-d11 tabular-nums">
      <span>{fmtTime(active ? audio.currentTime : 0)}</span>
      <input type="range" aria-label="Posición del mix" aria-valuetext={active ? `${fmtTime(audio.currentTime)} de ${fmtTime(audio.duration)}` : 'Sin reproducción'} min={0} max={active ? audio.duration || 1 : 1} step={1} value={active ? Math.min(audio.currentTime, audio.duration || 1) : 0} disabled={!active || audio.duration <= 0} onChange={(event) => audio.seek(Number(event.target.value))} className={DECK_SEEK} />
      <span className="shrink-0">{active && audio.duration > 0 ? fmtTime(audio.duration) : row.source ? 'LISTO' : 'EXTERNO'}</span>
    </div>
    {audio.currentItem && audio.currentItem.id !== row.item.id && <button type="button" onClick={onExpand} className={`shrink-0 truncate text-left font-mono text-d11 text-ink-soft ${DECK_FOCUS}`}>EN EL REPRODUCTOR: {audio.currentItem.title} →</button>}
  </section>
}

export function ReproductorWidget({ size, compact }: DashboardWidgetProps) {
  const { saves, loaded } = useDashboardData()
  const [expanded, setExpanded] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
      {rows.length > 0 ? <>
        <HiFiDeck rows={rows} queue={queue} selectedId={selectedId} setSelectedId={setSelectedId} short={size.h < 3} onExpand={() => setExpanded(true)}/>
        {expanded && <CarouselHost rows={rows} queue={queue} selectedId={selectedId} setSelectedId={setSelectedId} showFader expanded onClose={closeExpanded}/>}
      </> :
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
              <CarouselHost rows={rows} queue={queue} selectedId={selectedId} setSelectedId={setSelectedId} showFader={size.h >= 3} expanded={expanded} onClose={closeExpanded} />
            )}
          </div>
        )}
      </WidgetFrame>
      }
    </div>
  )
}
