'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ExternalLink,
  Pause,
  Play,
  Rewind,
  FastForward,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react'
import type { ContentItem, EmbedPlatform } from '@/lib/types'
import { MOCK_ITEMS } from '@/lib/mockData'
import {
  fmtDateFull,
  vibeToColor,
  vibeToLabel,
} from '@/lib/utils'
import { getGenreById, getTagNames } from '@/lib/genres'
import { PLATFORM_LABELS, PLATFORM_ORDER } from '@/components/embed/platforms'
import { ContentCard } from '@/components/cards/ContentCard'
import { GenreChipButton } from '@/components/genre/GenreChipButton'

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

function fmtDurationMmSs(duration?: string): string {
  // Overlay player total — "1:04:12" stays as-is; "48:30" stays as-is.
  return duration ?? '—:—'
}

function seededWaveform(seed: string, bars: number): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  const out: number[] = []
  let s = h || 1
  for (let i = 0; i < bars; i++) {
    s = (s * 1664525 + 1013904223) | 0
    const n = ((s >>> 0) % 1000) / 1000
    out.push(0.2 + n * 0.8)
  }
  return out
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

  const embeds = item.embeds ?? []
  const available = new Set<EmbedPlatform>(embeds.map((e) => e.platform))
  const visibleTabs =
    embeds.length > 0
      ? PLATFORM_ORDER.filter((p) => available.has(p))
      : (['soundcloud'] as EmbedPlatform[])

  const [active, setActive] = useState<EmbedPlatform>(
    visibleTabs[0] ?? 'soundcloud',
  )
  const activeEmbed = embeds.find((e) => e.platform === active)
  const activeUrl = activeEmbed?.url ?? item.mixUrl

  const waveform = useMemo(() => seededWaveform(item.slug, 64), [item.slug])
  // Decorative "played" progress — stable per mix, purely visual (no audio yet).
  const progress = useMemo(() => {
    let h = 0
    for (let i = 0; i < item.slug.length; i++) h = (h * 31 + item.slug.charCodeAt(i)) | 0
    return 0.2 + (((h >>> 0) % 600) / 1000) // 0.2 → 0.8
  }, [item.slug])

  const openSource = () => {
    if (!activeUrl || activeUrl === '#') return
    window.open(activeUrl, '_blank', 'noopener,noreferrer')
  }

  // Keyboard: O → open active source (P reserved for future audio wiring).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'o' || e.key === 'O') {
        openSource()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUrl])

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
        {/* 01 AUDIO EMBED // REPRODUCTOR */}
        <Panel index="01" title="AUDIO EMBED // REPRODUCTOR">
          {/* Source tabs */}
          <div className="flex flex-wrap gap-1.5">
            {visibleTabs.map((p) => {
              const isActive = p === active
              const isAvailable = embeds.length === 0 || available.has(p)
              return (
                <button
                  key={p}
                  disabled={!isAvailable}
                  onClick={() => setActive(p)}
                  className="border px-3 py-1.5 font-mono text-[10px] tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                  style={{
                    borderColor: isActive ? '#F97316' : '#242424',
                    backgroundColor: isActive ? 'rgba(249,115,22,0.12)' : 'transparent',
                    color: isActive ? '#F97316' : '#888888',
                  }}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              )
            })}
          </div>

          {/* Cover + title/waveform */}
          <div className="mt-3 flex gap-3">
            <div
              className="relative h-[120px] w-[120px] shrink-0 overflow-hidden border border-border bg-elevated"
              aria-hidden
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-mono text-[10px] text-muted">
                  SIN ARTE
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="min-w-0">
                <p className="truncate font-syne text-sm font-black text-primary">
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="truncate font-grotesk text-[11px] text-secondary">
                    {item.subtitle}
                  </p>
                )}
                {item.author && (
                  <p
                    className="truncate font-mono text-[11px]"
                    style={{ color: '#F97316' }}
                  >
                    {item.author}
                  </p>
                )}
              </div>

              {/* Decorative waveform */}
              <div className="mt-1 flex h-8 items-end gap-[2px]">
                {waveform.map((h, i) => {
                  const played = i / waveform.length < progress
                  return (
                    <div
                      key={i}
                      className="flex-1"
                      style={{
                        height: `${Math.round(h * 100)}%`,
                        backgroundColor: played ? '#F97316' : '#3a3a3a',
                      }}
                    />
                  )
                })}
              </div>

              {/* Timestamps + progress */}
              <div className="flex items-center justify-between font-mono text-[11px] text-secondary">
                <span>00:00</span>
                <span>{fmtDurationMmSs(item.duration)}</span>
              </div>
              <div className="relative h-0.5 w-full bg-border">
                <div
                  className="absolute left-0 top-0 h-full"
                  style={{
                    width: `${Math.round(progress * 100)}%`,
                    backgroundColor: '#F97316',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Transport row (visual only — audio delegated to future session) */}
          <div className="mt-3 flex items-center justify-center gap-4 border-t border-border pt-3">
            <TransportBtn aria={`Anterior`} disabled>
              <SkipBack size={14} />
            </TransportBtn>
            <TransportBtn aria={`Retroceder 10s`} disabled>
              <Rewind size={14} />
            </TransportBtn>
            <button
              onClick={openSource}
              aria-label="Reproducir en fuente"
              className="flex h-9 w-9 items-center justify-center border transition-colors"
              style={{ borderColor: '#F97316', color: '#F97316' }}
            >
              <Play size={16} fill="currentColor" />
            </button>
            <TransportBtn aria={`Avanzar 10s`} disabled>
              <FastForward size={14} />
            </TransportBtn>
            <TransportBtn aria={`Siguiente`} disabled>
              <SkipForward size={14} />
            </TransportBtn>
            <div className="ml-2 flex items-center gap-1.5 text-muted">
              <Volume2 size={13} />
              <div className="flex items-end gap-[2px]">
                {[3, 5, 7, 9, 11, 13].map((h, i) => (
                  <div
                    key={i}
                    className="w-[3px]"
                    style={{
                      height: `${h}px`,
                      backgroundColor: i < 4 ? '#F97316' : '#3a3a3a',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Bottom source strip */}
          <div className="mt-3 flex items-center justify-between border-t border-border pt-2 font-mono text-[10px] text-muted">
            <span>
              Embed {activeUrl && activeUrl !== '#' ? 'activo' : 'pendiente'} · fuente
              configurable
            </span>
            <button
              onClick={openSource}
              disabled={!activeUrl || activeUrl === '#'}
              className="tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{ color: '#F97316' }}
            >
              [ABRIR FUENTE]
            </button>
          </div>
        </Panel>

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

function TransportBtn({
  children,
  aria,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  aria: string
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      className="flex h-7 w-7 items-center justify-center border border-border text-muted transition-colors hover:border-white/40 hover:text-primary disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted"
    >
      {children}
    </button>
  )
}
