'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArticleBlock, ContentItem } from '@/lib/types'
import { MOCK_ITEMS } from '@/lib/mockData'
import {
  categoryColor,
  fmtDateFull,
  vibeToColor,
  vibeToLabel,
} from '@/lib/utils'
import { getGenreById, getTagNames } from '@/lib/genres'
import { Calendar, User } from 'lucide-react'
import { ContentCard } from '@/components/cards/ContentCard'
import { BodyBlocks } from './ArticuloOverlay'
import { GenreChipButton } from '@/components/genre/GenreChipButton'

interface ListicleOverlayProps {
  item: ContentItem
}

// Listicle layout — list-structured longform (e.g. "Top 10 tracks of X").
// Shares BodyBlocks with ArticuloOverlay, which handles the `track` block kind.
export function ListicleOverlay({ item }: ListicleOverlayProps) {
  const color = categoryColor('listicle')
  const vibeColor = vibeToColor(item.vibe)
  const genres = item.genres.map((id) => ({
    id,
    name: getGenreById(id)?.name ?? id,
  }))
  const tags = getTagNames(item.tags)

  const rootRef = useRef<HTMLDivElement>(null)
  const [scrollPct, setScrollPct] = useState(0)

  const blocks = useMemo(() => buildBlocks(item), [item])
  const trackBlocks = useMemo(
    () => blocks.filter((b) => b.kind === 'track') as Extract<ArticleBlock, { kind: 'track' }>[],
    [blocks],
  )
  const rankDirection = useMemo<'countdown' | 'ascending' | 'unranked'>(() => {
    const ranks = trackBlocks.map((b) => b.rank).filter((r): r is number => r !== undefined)
    if (ranks.length < 2) return 'unranked'
    return ranks[0] > ranks[ranks.length - 1] ? 'countdown' : 'ascending'
  }, [trackBlocks])

  useEffect(() => {
    const el = rootRef.current?.closest('.overflow-y-auto') as HTMLElement | null
    if (!el) return
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight
      const pct = max > 0 ? Math.round((el.scrollTop / max) * 100) : 0
      setScrollPct(Math.max(0, Math.min(100, pct)))
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const scrollBlocks = 14
  const filled = Math.round((scrollPct / 100) * scrollBlocks)

  const related = useMemo(() => getRelated(item), [item])

  return (
    <div ref={rootRef} className="relative">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="px-5 pt-10 md:px-12 md:pt-14">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] tracking-widest"
            style={{
              borderColor: `${color}66`,
              color,
              backgroundColor: `${color}10`,
            }}
          >
            {item.editorial && <span>★</span>}
            //LISTA
          </span>
          <span className="font-mono text-[10px] tracking-widest text-muted">
            GRADIENTE·FM // DISPATCH·RANKED
          </span>
          {trackBlocks.length > 0 && (
            <span
              className="ml-auto font-mono text-[10px] tracking-widest"
              style={{ color }}
            >
              {String(trackBlocks.length).padStart(2, '0')} ENTRADAS ·{' '}
              {rankDirection === 'countdown'
                ? 'COUNTDOWN'
                : rankDirection === 'ascending'
                  ? 'ASCENDENTE'
                  : 'SIN·RANGO'}
            </span>
          )}
        </div>

        <h1
          className="mb-6 max-w-[22ch] font-syne text-4xl font-black leading-[1.02] text-primary md:text-6xl"
          style={{ letterSpacing: '-0.01em' }}
        >
          {item.title}
        </h1>

        {(item.subtitle || item.excerpt) && (
          <p
            className="mb-8 max-w-[62ch] font-grotesk text-lg leading-relaxed md:text-xl"
            style={{ color: vibeColor }}
          >
            {item.subtitle || item.excerpt}
          </p>
        )}

        <dl className="flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-border py-4">
          {item.author && (
            <div className="flex items-center gap-3">
              <User size={11} className="text-muted" />
              <dt className="sys-label">POR</dt>
              <dd className="font-grotesk text-sm text-primary">{item.author}</dd>
            </div>
          )}
          {item.publishedAt && (
            <div className="flex items-center gap-3">
              <Calendar size={11} className="text-muted" />
              <dt className="sys-label">FECHA</dt>
              <dd className="font-grotesk text-sm text-secondary">
                {fmtDateFull(item.publishedAt)}
              </dd>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div
              className="h-2 w-8"
              style={{ backgroundColor: vibeColor }}
              aria-hidden
            />
            <span
              className="font-mono text-[11px] tracking-widest"
              style={{ color: vibeColor }}
            >
              VIBE {item.vibe} · {vibeToLabel(item.vibe)}
            </span>
          </div>
        </dl>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      {item.imageUrl && (
        <figure className="mt-8 px-5 md:mt-10 md:px-12">
          <div
            className="relative overflow-hidden border border-border bg-elevated"
            style={{ aspectRatio: '16 / 9' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.title}
              className="h-full w-full object-cover"
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: color }}
            />
          </div>
          {item.heroCaption && (
            <figcaption className="mt-2 font-mono text-[10px] tracking-widest text-muted">
              IMG·01 // <span className="text-secondary">{item.heroCaption}</span>
            </figcaption>
          )}
        </figure>
      )}

      {/* ── Reading area ───────────────────────────────────────────── */}
      <div className="grid gap-6 px-5 py-10 md:grid-cols-12 md:gap-10 md:px-12 md:py-14">
        {/* Left rail — list progress / mini index */}
        <aside className="hidden md:col-span-2 md:block">
          <div className="sticky top-4 flex flex-col gap-3">
            <span className="sys-label text-muted">LISTA</span>
            {trackBlocks.length > 0 ? (
              <ol className="flex flex-col gap-1.5">
                {trackBlocks.map((t, i) => (
                  <li
                    key={i}
                    className="group flex items-baseline gap-2 font-mono text-[10px] leading-snug"
                  >
                    <span
                      className="shrink-0 tabular-nums text-muted"
                      style={{ color }}
                    >
                      {t.rank !== undefined ? String(t.rank).padStart(2, '0') : '—'}
                    </span>
                    <span className="truncate text-secondary">
                      {t.artist} · {t.title}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="font-mono text-[10px] text-muted">[SIN ENTRADAS]</p>
            )}

            <div className="mt-4 border-t border-border pt-3">
              <span className="sys-label text-muted">PROGRESO</span>
              <div className="mt-1 font-mono text-[10px] tabular-nums text-primary">
                {String(scrollPct).padStart(2, '0')}%
              </div>
              <div className="mt-1 font-mono text-[10px] tracking-[0.2em]" aria-hidden>
                <span style={{ color }}>{'█'.repeat(filled)}</span>
                <span className="text-muted">
                  {'·'.repeat(scrollBlocks - filled)}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <article className="min-w-0 md:col-span-7">
          <BodyBlocks blocks={blocks} color={color} vibeColor={vibeColor} />

          <div className="mt-14 flex flex-col items-start gap-3 border-t border-border pt-6">
            <div
              className="h-1 w-16"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(-45deg, var(--color-muted) 0 6px, transparent 6px 12px)',
                opacity: 0.6,
              }}
              aria-hidden
            />
            <p className="font-mono text-[11px] tracking-widest text-muted">
              FIN·DE·LA·LISTA //{' '}
              <span style={{ color }}>GRADIENTE·FM·#{item.id}</span>
            </p>
          </div>
        </article>

        {/* Right rail */}
        <aside className="md:col-span-3 md:sticky md:top-4 md:self-start">
          <div className="flex flex-col gap-4">
            {item.author && (
              <RailBlock index="01" label="FIRMA">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-elevated font-syne text-sm font-black"
                    style={{ color }}
                  >
                    {initials(item.author)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-grotesk text-sm text-primary">
                      {item.author}
                    </p>
                    <p className="font-mono text-[10px] text-muted">
                      DISPATCH · RANKED
                    </p>
                  </div>
                </div>
              </RailBlock>
            )}

            <RailBlock index="02" label="META">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-mono text-xs">
                <dt className="text-muted">TIPO</dt>
                <dd style={{ color }}>: //LISTA</dd>
                <dt className="text-muted">ENTRADAS</dt>
                <dd className="text-secondary">
                  : {trackBlocks.length}
                </dd>
                <dt className="text-muted">ORDEN</dt>
                <dd className="text-secondary">
                  :{' '}
                  {rankDirection === 'countdown'
                    ? 'Countdown'
                    : rankDirection === 'ascending'
                      ? 'Ascendente'
                      : 'Sin rango'}
                </dd>
                <dt className="text-muted">SEÑAL</dt>
                <dd className="flex items-center gap-1.5">
                  <span>:</span>
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sys-green" />
                  <span className="text-sys-green">ACTIVA</span>
                </dd>
              </dl>
            </RailBlock>

            {(genres.length > 0 || tags.length > 0) && (
              <RailBlock index="03" label="ETIQUETAS">
                <ul className="flex flex-col gap-1.5 font-mono text-xs">
                  {genres.map(({ id, name }) => (
                    <li key={id} className="flex items-center gap-2">
                      <span className="text-muted">#</span>
                      <GenreChipButton
                        genreId={id}
                        className=""
                        style={{ color: vibeColor }}
                      >
                        {name}
                      </GenreChipButton>
                    </li>
                  ))}
                  {tags.map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <span className="text-muted">#</span>
                      <span className="text-secondary">{t}</span>
                    </li>
                  ))}
                </ul>
              </RailBlock>
            )}
          </div>
        </aside>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="border-t border-border bg-surface/40 px-5 py-10 md:px-12">
          <div className="mb-5 flex items-center gap-3">
            <span
              className="font-mono text-[11px] tracking-widest"
              style={{ color }}
            >
              //SIGUIENTES·LISTAS
            </span>
            <div className="h-px flex-1 bg-border" />
            <span className="sys-label text-muted">
              {related.length} · CURADO
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <div key={r.id} className="h-[260px]">
                <ContentCard item={r} size="sm" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t border-border bg-base/95 px-4 py-2 backdrop-blur-sm md:px-6">
        <div className="flex items-center gap-3">
          <span className="sys-label text-muted">SCROLL</span>
          <span className="font-mono text-[11px] tabular-nums text-primary">
            {String(scrollPct).padStart(2, '0')}%
          </span>
          <span
            className="ml-1 font-mono tracking-[0.3em]"
            aria-hidden
            style={{ color, fontSize: 10 }}
          >
            {'█'.repeat(filled)}
            <span className="text-muted">
              {'·'.repeat(scrollBlocks - filled)}
            </span>
          </span>
        </div>
        <div className="hidden items-center gap-4 font-mono text-[10px] tracking-widest sm:flex">
          <span className="text-sys-green">· MODO LECTURA · LISTA</span>
        </div>
      </div>
    </div>
  )
}

// ── Rail block ──────────────────────────────────────────────────────────────
function RailBlock({
  index,
  label,
  children,
}: {
  index: string
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="sys-label text-muted">{index}</span>
          <span className="sys-label text-primary">{label}</span>
        </div>
        <span className="h-1.5 w-1.5 rounded-full bg-sys-green" aria-hidden />
      </header>
      <div className="p-3">{children}</div>
    </section>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function buildBlocks(item: ContentItem): ArticleBlock[] {
  if (item.articleBody && item.articleBody.length > 0) return item.articleBody
  const raw = item.bodyPreview ?? item.excerpt ?? ''
  const paras = raw.split('\n\n').map((p) => p.trim()).filter(Boolean)
  if (paras.length === 0) {
    return [
      {
        kind: 'p',
        text: '[LISTA SIN CUERPO · CONTENIDO PENDIENTE DE INGESTA]',
      },
    ]
  }
  return [
    { kind: 'lede', text: paras[0] },
    ...paras.slice(1).map<ArticleBlock>((p) => ({ kind: 'p', text: p })),
  ]
}

function getRelated(item: ContentItem): ContentItem[] {
  const picks: ContentItem[] = []
  const seen = new Set<string>([item.id])

  // 1) Other listicles first
  for (const c of MOCK_ITEMS) {
    if (picks.length >= 3) break
    if (seen.has(c.id)) continue
    if (c.type === 'listicle') {
      picks.push(c)
      seen.add(c.id)
    }
  }

  // 2) Articulos / editorials sharing at least one genre
  if (picks.length < 3) {
    const genreSet = new Set(item.genres)
    const family: ContentItem['type'][] = ['articulo', 'editorial', 'review']
    for (const c of MOCK_ITEMS) {
      if (picks.length >= 3) break
      if (seen.has(c.id)) continue
      if (!family.includes(c.type)) continue
      if (c.genres.some((g) => genreSet.has(g))) {
        picks.push(c)
        seen.add(c.id)
      }
    }
  }

  return picks
}
