'use client'

import { useEffect, useMemo } from 'react'
import type { ContentItem } from '@/lib/types'
import { MOCK_ITEMS } from '@/lib/mockData'
import {
  fmtDateFull,
  vibeToColor,
  vibeToLabel,
  isEditableTarget,
} from '@/lib/utils'
import { getGenreById, getTagNames } from '@/lib/genres'
import { ContentCard } from '@/components/cards/ContentCard'
import { GenreChipButton } from '@/components/genre/GenreChipButton'
import { PollSection } from '@/components/poll/PollSection'
import { AudioPlayer3D } from '@/components/audio/AudioPlayer3D'
import { useAudioPlayer } from '@/components/audio/AudioPlayerProvider'

// Pick the best canonical SoundCloud URL for an item: prefer an explicit
// SC embed entry, fall back to the mixUrl when it points to soundcloud.
function pickSoundCloudUrl(item: ContentItem): string | null {
  const sc = item.embeds?.find((e) => e.platform === 'soundcloud')
  if (sc?.url) return sc.url
  if (item.mixUrl && /soundcloud\.com/.test(item.mixUrl)) return item.mixUrl
  return null
}

interface Props {
  item: ContentItem
}

function fmtDurationHm(duration?: string): string {
  if (!duration) return '—'
  const parts = duration.split(':').map(Number)
  if (parts.length === 3) {
    const [h, m] = parts
    return `${h} h ${String(m).padStart(2, '0')} min`
  }
  if (parts.length === 2) {
    const [m] = parts
    return `${m} min`
  }
  return duration
}

const STATUS_LABEL: Record<NonNullable<ContentItem['mixStatus']>, string> = {
  disponible: 'Disponible',
  exclusivo: 'Exclusivo',
  archivo: 'Archivo',
  proximamente: 'Próximamente',
}

export function MixOverlay({ item }: Props) {
  const vibeColor = vibeToColor(item.vibe)
  const genres = item.genres.map((id) => ({
    id,
    name: getGenreById(id)?.name ?? id,
  }))
  const tags = getTagNames(item.tags)

  // Audio is owned by the global AudioPlayerProvider — one persistent iframe
  // + widget + tab-capture for the entire app. This overlay is only a *view*:
  // we tell the global player to load this mix when the user hits play, then
  // mirror its state back into our chrome.
  const audio = useAudioPlayer()
  const scCanonicalUrl = pickSoundCloudUrl(item)
  const isActive = audio.currentItem?.id === item.id

  // When this is the active mix, mirror live transport. Otherwise show the
  // idle 00:00 state — pressing play will load this mix into the global player.
  const isPlaying = isActive && audio.isPlaying
  const currentTime = isActive ? audio.currentTime : 0
  const duration = isActive ? audio.duration : 0

  const openSource = () => {
    if (!scCanonicalUrl) return
    window.open(scCanonicalUrl, '_blank', 'noopener,noreferrer')
  }

  // Play handler defers everything to the global player. First call ever
  // requests tab capture; subsequent calls just switch tracks (no popup) or
  // toggle play/pause if we're already the active mix.
  const handleTransportToggle = () => {
    void audio.loadAndPlay(item)
  }
  const handleSeek = (sec: number) => {
    if (isActive) audio.seek(sec)
  }

  // Status strip — leans on the global matrix state plus this overlay's
  // local active/idle distinction.
  const statusLabel = (() => {
    if (audio.matrixActive) return 'CAPTURA EN VIVO'
    if (audio.matrixStatus === 'requesting') return 'SOLICITANDO PERMISO'
    if (audio.matrixStatus === 'denied') return 'PERMISO DENEGADO'
    if (audio.matrixStatus === 'unsupported') return 'NO COMPATIBLE'
    if (isPlaying) return 'REPRODUCIENDO'
    if (isActive && audio.widgetReady) return 'EN ESPERA'
    return 'PULSA PLAY'
  })()
  const statusTone: 'live' | 'paused' | 'idle' | 'error' =
    audio.matrixActive
      ? 'live'
      : audio.matrixStatus === 'denied' ||
          audio.matrixStatus === 'unsupported' ||
          audio.matrixStatus === 'error'
        ? 'error'
        : isPlaying
          ? 'live'
          : 'idle'
  const statusDetail =
    audio.matrixActive
      ? 'analizador · pestaña actual'
      : audio.matrixErrorMessage ||
        (scCanonicalUrl
          ? isActive
            ? 'pulsa play para reanudar'
            : 'pulsa play para cargar este mix'
          : 'fuente pendiente')

  // Hotkeys: O → open source. P → play/pause (or load). Skip when focus
  // is inside an editable element — MixOverlay also renders inside the
  // dashboard's LivePreview while the editor types in the composer.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      if (e.key === 'o' || e.key === 'O') openSource()
      if (e.key === 'p' || e.key === 'P') handleTransportToggle()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scCanonicalUrl, item.id])

  return (
    <article className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ── LEFT: editorial column ──────────────────────────── */}
      <div className="flex flex-col gap-5 p-5 md:p-7">
        {/* Type tag */}
        <span
          className="inline-flex w-fit items-center gap-2 border px-2.5 py-1 font-mono text-[11px] tracking-widest"
          style={{ borderColor: '#F97316', color: '#F97316' }}
        >
          <span aria-hidden>★</span>
          MIX
        </span>

        {/* Title */}
        <header className="flex flex-col gap-2">
          <h1 className="font-syne text-3xl font-black leading-[1.02] text-white md:text-[44px]">
            {item.title}
          </h1>
          {item.subtitle && (
            <p className="font-syne text-2xl font-black leading-[1.05] text-white md:text-[34px]">
              {item.subtitle}
            </p>
          )}
        </header>

        {item.excerpt && (
          <p className="font-grotesk text-sm leading-relaxed text-secondary md:text-[15px]">
            {item.excerpt}
          </p>
        )}

        {/* Meta row */}
        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 border-y border-border py-4 font-mono text-xs sm:grid-cols-3">
          {item.author && (
            <div className="flex items-center gap-2">
              <span className="sys-label">ARTISTA</span>
              <span className="text-primary">{item.author}</span>
            </div>
          )}
          {item.publishedAt && (
            <div className="flex items-center gap-2">
              <span className="sys-label">PUBLICADO</span>
              <span className="text-secondary">
                {fmtDateFull(item.publishedAt)}
              </span>
            </div>
          )}
          {item.duration && (
            <div className="flex items-center gap-2">
              <span className="sys-label">DURACIÓN</span>
              <span className="text-primary">{fmtDurationHm(item.duration)}</span>
            </div>
          )}
          <div className="col-span-full flex items-center gap-3">
            <span className="sys-label">VIBE</span>
            <div className="flex items-end gap-[3px]">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2"
                  style={{
                    height: `${6 + i * 1.3}px`,
                    backgroundColor: i < item.vibe ? vibeColor : '#242424',
                  }}
                />
              ))}
            </div>
            <span
              className="font-mono text-xs tracking-widest"
              style={{ color: vibeColor }}
            >
              {item.vibe} · {vibeToLabel(item.vibe)}
            </span>
          </div>
        </dl>

        {/* Body */}
        {item.bodyPreview && (
          <div className="flex flex-col gap-4 font-grotesk text-sm leading-relaxed text-primary md:text-[15px]">
            {item.bodyPreview.split('\n').map((p, i) =>
              p.trim() ? (
                <p key={i}>{p}</p>
              ) : null,
            )}
          </div>
        )}

        {/* Genres at bottom */}
        {genres.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {genres.map(({ id, name }) => (
              <GenreChipButton
                key={id}
                genreId={id}
                className="border px-2.5 py-1 font-mono text-[10px] tracking-widest uppercase"
                style={{ borderColor: '#F97316', color: '#F97316' }}
              >
                {name}
              </GenreChipButton>
            ))}
          </div>
        )}
      </div>

      {/* ── RIGHT: system column (3 panels) ─────────────────── */}
      <div className="flex flex-col gap-4 border-t border-border p-4 md:border-l md:border-t-0 md:p-5">
        {/* 01 AUDIO EMBED // REPRODUCTOR — view-only. Transport drives the
            global AudioPlayerProvider (hidden iframe lives at layout root),
            so closing this overlay does NOT stop playback. The matrix
            visualizer reads the same tab-capture stream as the persistent
            HUD in the sidebar. */}
        {scCanonicalUrl ? (
          <AudioPlayer3D
            data={audio.data}
            sampleRate={audio.sampleRate}
            title={item.title}
            subtitle={item.subtitle}
            source={item.author}
            coverUrl={item.imageUrl}
            coverLabel={item.mixSeries}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            onPlayPause={handleTransportToggle}
            onSeek={handleSeek}
            liveMatrixActive={audio.matrixActive}
            onOpenSource={openSource}
            sourceUrl={scCanonicalUrl}
            statusLabel={statusLabel}
            statusTone={statusTone}
            statusDetail={statusDetail}
          />
        ) : (
          <Panel index="01" title="AUDIO EMBED // REPRODUCTOR">
            <p className="font-mono text-[11px] text-muted">
              Sin fuente de SoundCloud configurada para este mix.
            </p>
          </Panel>
        )}

        {/* 02 CONTEXTO */}
        <Panel index="02" title="CONTEXTO">
          <dl className="grid grid-cols-[max-content_auto_1fr] gap-x-3 gap-y-1.5 font-mono text-xs">
            {item.mixSeries && (
              <ContextRow label="SERIE" value={item.mixSeries} />
            )}
            {item.recordedIn && (
              <ContextRow label="GRABADO EN" value={item.recordedIn} />
            )}
            {item.mixFormat && (
              <ContextRow label="FORMATO" value={item.mixFormat} />
            )}
            {item.bpmRange && (
              <ContextRow label="BPM" value={item.bpmRange} />
            )}
            {item.musicalKey && (
              <ContextRow label="KEY" value={item.musicalKey} />
            )}
            {item.mixStatus && (
              <ContextRow
                label="ESTATUS"
                value={STATUS_LABEL[item.mixStatus]}
                valueColor="#4ADE80"
              />
            )}
            {!item.mixSeries &&
              !item.recordedIn &&
              !item.mixFormat &&
              !item.bpmRange &&
              !item.musicalKey &&
              !item.mixStatus && (
                <div className="col-span-3 font-mono text-[11px] text-muted">
                  Sin metadata de contexto.
                </div>
              )}
          </dl>
        </Panel>

        {/* 03 TRACKLIST / ETIQUETAS */}
        <Panel index="03" title="TRACKLIST / ETIQUETAS">
          {item.tracklist && item.tracklist.length > 0 ? (
            <div className="flex flex-col gap-1.5 font-mono text-[11px]">
              <div className="grid grid-cols-[28px_1fr_1.4fr_48px] gap-2 border-b border-border pb-1 text-[10px] tracking-widest text-muted">
                <span>#</span>
                <span>ARTISTA</span>
                <span>TEMA</span>
                <span className="text-right">BPM</span>
              </div>
              {item.tracklist.map((t, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[28px_1fr_1.4fr_48px] gap-2 text-secondary"
                >
                  <span className="text-muted">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate text-primary">{t.artist}</span>
                  <span className="truncate">{t.title}</span>
                  <span className="text-right text-muted">
                    {t.bpm ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-mono text-[11px] text-muted">
              Tracklist no publicado.
            </p>
          )}

          {tags.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <span className="sys-label mb-2 block">ETIQUETAS</span>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-secondary"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* Poll — when the mix has an attached poll, render between the
            tracklist panel and the hotkeys footer. Choices auto-derive
            from the mix's tracklist. */}
        {item.poll && <PollSection item={item} />}

        {/* Hotkeys hint footer */}
        <div className="flex items-center justify-between border-t border-border pt-2 font-mono text-[10px] tracking-widest text-muted">
          <span>MODO ESCUCHA <span style={{ color: '#F97316' }}>ACTIVO</span></span>
          <span className="flex gap-3">
            <span>
              <span style={{ color: '#F97316' }}>O</span> ABRIR FUENTE
            </span>
            <span>
              <span style={{ color: '#F97316' }}>ESC</span> CERRAR
            </span>
          </span>
        </div>

        {/* Related mixes — curated by genre overlap, fallback to recent */}
        <RelatedMixes item={item} />
      </div>
    </article>
  )
}

// ── Related mixes ───────────────────────────────────────────────────────────
// Picks up to 3 other mixes: prefer genre overlap with the current item,
// then fall back to most-recent mixes. Non-algorithmic; pure curation
// fallback so the overlay always closes with "what's adjacent in our shelf".
function RelatedMixes({ item }: Props) {
  const related = useMemo(() => {
    const seen = new Set<string>([item.id])
    const genreSet = new Set(item.genres)
    const picks: ContentItem[] = []
    // 1) Other mixes sharing at least one genre
    for (const c of MOCK_ITEMS) {
      if (picks.length >= 3) break
      if (seen.has(c.id)) continue
      if (c.type !== 'mix') continue
      if (c.genres.some((g) => genreSet.has(g))) {
        picks.push(c)
        seen.add(c.id)
      }
    }
    // 2) Backfill with any other mixes (most recent first)
    if (picks.length < 3) {
      const recent = MOCK_ITEMS.filter((c) => c.type === 'mix' && !seen.has(c.id))
      for (const c of recent) {
        if (picks.length >= 3) break
        picks.push(c)
        seen.add(c.id)
      }
    }
    return picks
  }, [item])

  if (related.length === 0) return null

  return (
    <section className="mt-2 border border-border bg-base/40 p-3">
      <header className="mb-3 flex items-center justify-between border-b border-dashed border-border pb-2">
        <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-widest">
          <span style={{ color: '#F97316' }}>04</span>
          <span className="text-primary">SIGUIENTES MIXES</span>
        </div>
        <span className="font-mono text-[9px] tracking-widest text-muted">
          {related.length} · CURADO
        </span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {related.map((r) => (
          <div key={r.id} className="h-[220px]">
            <ContentCard item={r} size="sm" />
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Panel({
  index,
  title,
  children,
}: {
  index: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      className="relative border bg-base/40 p-3"
      style={{ borderColor: '#F97316' }}
    >
      <header className="mb-3 flex items-center justify-between border-b border-dashed border-border pb-2">
        <div className="flex items-center gap-2.5 font-mono text-[11px] tracking-widest">
          <span style={{ color: '#F97316' }}>{index}</span>
          <span className="text-primary">{title}</span>
        </div>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-green" aria-hidden />
      </header>
      {children}
    </section>
  )
}

function ContextRow({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <>
      <dt className="sys-label">{label}</dt>
      <dd className="text-muted">:</dd>
      <dd
        className="text-primary"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </dd>
    </>
  )
}

