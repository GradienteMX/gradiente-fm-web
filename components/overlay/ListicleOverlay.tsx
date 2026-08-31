'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArticleBlock, ContentItem } from '@/lib/types'
import { getRelatedByVibe } from '@/lib/itemsCache'
import { fmtDateFull } from '@/lib/utils'
import { getGenreById, getTagNames } from '@/lib/genres'
import { ContentCard } from '@/components/cards/ContentCard'
import { BodyBlocks } from './ArticuloOverlay'
import { SmartImage } from '@/components/SmartImage'
import { GenreChipButton } from '@/components/genre/GenreChipButton'
import { PollSection } from '@/components/poll/PollSection'
import { VibeFader } from '@/components/VibeFader'
import { OverlayLinks } from './OverlayLinks'
import { OverlayEntities } from './OverlayEntities'
import {
  categoryColorOnLight,
  typeCode,
  typeDisplayLabel,
} from '@/lib/dashboard/palette'

interface ListicleOverlayProps {
  item: ContentItem
}

// Listicle layout — list-structured longform (e.g. "Top 10 tracks of X") on
// the fase-C paper sheet. Shares BodyBlocks with ArticuloOverlay, which
// handles the `track` block kind (ink faceplate rows). Keeps its OWN anatomy:
// rank index left rail (not a TOC), ENTRADAS/ORDEN derivation, DISPATCH firma.
export function ListicleOverlay({ item }: ListicleOverlayProps) {
  const color = categoryColorOnLight(item.type)
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
    <div ref={rootRef} className="relative bg-paper text-ink">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="px-5 pt-10 md:px-12 md:pt-14">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {/* Type register — swatch + code + label (hue never alone). */}
          <span className="inline-flex items-center gap-1.5 border border-ink bg-paper-raised px-2 py-1 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
            <span
              aria-hidden
              className="h-[9px] w-[9px] shrink-0"
              style={{ backgroundColor: color }}
            />
            {typeCode(item.type)} · {typeDisplayLabel(item.type)}
          </span>
          {item.editorial && (
            <span
              className="bg-sys-red-paper px-1.5 py-1 font-mono text-[10px] leading-none text-paper-raised"
              title="Selección editorial"
            >
              ★
            </span>
          )}
          {trackBlocks.length > 0 && (
            <span className="ml-auto font-mono text-d11 font-bold tracking-widest text-ink">
              {String(trackBlocks.length).padStart(2, '0')} ENTRADAS ·{' '}
              {rankDirection === 'countdown'
                ? 'COUNTDOWN'
                : rankDirection === 'ascending'
                  ? 'ASCENDENTE'
                  : 'SIN RANGO'}
            </span>
          )}
        </div>

        <h1 className="mb-6 max-w-[22ch] font-syne text-d28 font-black tracking-[-0.01em] text-ink [text-wrap:balance] md:text-display">
          {item.title}
        </h1>

        {(item.subtitle || item.excerpt) && (
          <p className="mb-8 max-w-[62ch] font-grotesk text-d18 leading-relaxed text-ink-soft md:text-xl">
            {item.subtitle || item.excerpt}
          </p>
        )}

        <dl className="flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-ink py-4">
          {item.author && (
            <div className="flex items-baseline gap-3">
              <dt className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                POR
              </dt>
              <dd className="font-grotesk text-d15 font-bold text-ink">
                {item.author}
              </dd>
            </div>
          )}
          {item.publishedAt && (
            <div className="flex items-baseline gap-3">
              <dt className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                FECHA
              </dt>
              <dd className="font-grotesk text-d13 text-ink-soft">
                {fmtDateFull(item.publishedAt)}
              </dd>
            </div>
          )}
          {/* Vibe fader on its faceplate seat — instrument doctrine, same
              band as the dashboard ReproductorWidget's mini fader. */}
          <div className="flex w-full min-w-0 items-center gap-3 border border-ink bg-panel px-3 py-2 sm:ml-auto sm:w-auto">
            <span className="shrink-0 font-mono text-d11 font-bold tracking-widest text-panel-text">
              VIBE
            </span>
            <VibeFader item={item} />
          </div>
        </dl>
      </header>

      {/* ── Hero — ink-framed plate, category underline ─────────────── */}
      {item.imageUrl && (
        <figure className="mt-8 px-5 md:mt-10 md:px-12">
          <div
            className="relative overflow-hidden border border-ink bg-panel"
            style={{ aspectRatio: '16 / 9' }}
          >
            <SmartImage
              src={item.imageUrl}
              alt={item.title}
              sizes="(max-width: 768px) 100vw, 720px"
              className="object-cover object-top"
            />
          </div>
          <div
            aria-hidden
            className="h-[3px] w-full"
            style={{ backgroundColor: color }}
          />
          {item.heroCaption && (
            <figcaption className="mt-2 font-mono text-d11 tracking-widest text-ink-faint">
              {item.heroCaption}
            </figcaption>
          )}
        </figure>
      )}

      {/* ── Reading area ───────────────────────────────────────────── */}
      <div className="grid gap-6 px-5 py-10 md:grid-cols-12 md:gap-10 md:px-12 md:py-14">
        {/* Left rail — rank index + scroll progress */}
        <aside className="hidden md:col-span-2 md:block">
          <div className="sticky top-4 flex flex-col gap-3">
            <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
              LISTA
            </span>
            {trackBlocks.length > 0 ? (
              <ol className="flex flex-col gap-1.5">
                {trackBlocks.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-baseline gap-2 font-mono text-d11 leading-snug"
                  >
                    <span className="shrink-0 font-bold tabular-nums text-ink">
                      {t.rank !== undefined ? String(t.rank).padStart(2, '0') : '—'}
                    </span>
                    <span className="truncate text-ink-soft">
                      {t.artist} · {t.title}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                SIN ENTRADAS
              </p>
            )}

            <div className="mt-4 border-t border-ink pt-3">
              <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                PROGRESO
              </span>
              <div className="mt-1 font-mono text-d11 tabular-nums text-ink">
                {String(scrollPct).padStart(2, '0')}%
              </div>
              <div className="mt-1 font-mono text-[10px] tracking-[0.2em]" aria-hidden>
                <span className="text-ink">{'█'.repeat(filled)}</span>
                <span className="text-ink-faint">
                  {'·'.repeat(scrollBlocks - filled)}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main column */}
        <article className="min-w-0 md:col-span-7">
          <BodyBlocks blocks={blocks} color={color} item={item} />

          {/* End-of-list marker — double ink rule + FIN */}
          <div className="mt-14">
            <div aria-hidden>
              <div className="h-px w-full bg-ink" />
              <div className="mt-[3px] h-px w-full bg-ink" />
            </div>
            <p className="mt-3 text-center font-mono text-d11 font-bold tracking-[0.35em] text-ink">
              FIN
            </p>
          </div>
        </article>

        {/* Right rail */}
        <aside className="md:col-span-3 md:sticky md:top-4 md:self-start">
          <div className="flex flex-col gap-4">
            {item.author && (
              <RailBlock label="FIRMA">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-ink font-syne text-sm font-black text-paper-raised">
                    {initials(item.author)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-grotesk text-d13 font-bold text-ink">
                      {item.author}
                    </p>
                    <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                      DISPATCH · RANKED
                    </p>
                  </div>
                </div>
              </RailBlock>
            )}

            <RailBlock label="META">
              <div className="flex flex-col gap-3">
                <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 font-mono text-d11">
                  <dt className="uppercase tracking-widest text-ink-faint">
                    TIPO
                  </dt>
                  <dd className="flex items-center gap-1.5 font-bold uppercase tracking-widest text-ink">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    {typeCode(item.type)} · {typeDisplayLabel(item.type)}
                  </dd>
                  {trackBlocks.length > 0 && (
                    <>
                      <dt className="uppercase tracking-widest text-ink-faint">
                        ENTRADAS
                      </dt>
                      <dd className="tabular-nums text-ink-soft">
                        {trackBlocks.length}
                      </dd>
                    </>
                  )}
                  <dt className="uppercase tracking-widest text-ink-faint">
                    ORDEN
                  </dt>
                  <dd className="text-ink-soft">
                    {rankDirection === 'countdown'
                      ? 'Countdown'
                      : rankDirection === 'ascending'
                        ? 'Ascendente'
                        : 'Sin rango'}
                  </dd>
                </dl>
                <OverlayEntities entities={item.entities} color={color} />
                <OverlayLinks links={item.links} color={color} />
              </div>
            </RailBlock>

            {(genres.length > 0 || tags.length > 0) && (
              <RailBlock label="ETIQUETAS">
                <ul className="flex flex-wrap items-center gap-1.5">
                  {genres.map(({ id, name }) => (
                    <li key={id}>
                      <GenreChipButton
                        genreId={id}
                        ground="paper"
                        className="inline-flex px-1.5 py-0.5 font-mono text-d11"
                      >
                        {name}
                      </GenreChipButton>
                    </li>
                  ))}
                  {tags.map((t) => (
                    <li
                      key={t}
                      className="px-1.5 py-0.5 font-mono text-d11 text-ink-soft"
                    >
                      #{t}
                    </li>
                  ))}
                </ul>
              </RailBlock>
            )}
          </div>
        </aside>
      </div>

      {/* Poll — when the listicle has an attached poll, render it after the
          ranked body and before related lists. Choices auto-derive from the
          listicle's `track` blocks; see [[polls]] resolvePollChoices. */}
      {item.poll && (
        <section className="border-t border-ink px-5 py-8 md:px-12">
          <PollSection item={item} className="max-w-2xl" />
        </section>
      )}

      {/* Related */}
      {related.length > 0 && (
        <section className="border-t border-ink px-5 py-10 md:px-12">
          <div className="mb-5 flex items-center gap-3">
            <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink">
              SIGUIENTES LISTAS
            </span>
            <div className="h-px flex-1 bg-ink" />
            <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
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

      {/* Sticky footer — SCROLL progress strip on paper */}
      <div className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-ink bg-paper px-4 py-2 md:px-6">
        <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
          SCROLL
        </span>
        <span className="font-mono text-d11 tabular-nums text-ink">
          {String(scrollPct).padStart(2, '0')}%
        </span>
        <span
          className="ml-1 font-mono text-[10px] tracking-[0.3em] text-ink"
          aria-hidden
        >
          {'█'.repeat(filled)}
          <span className="text-ink-faint">
            {'·'.repeat(scrollBlocks - filled)}
          </span>
        </span>
      </div>
    </div>
  )
}

// ── Rail block — raised-paper plate with a hairline header ──────────────────
function RailBlock({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-ink bg-paper-raised">
      <header className="border-b border-ink px-3 py-1.5">
        <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink">
          {label}
        </span>
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
  // Match any run of newlines so an Enter-once paragraph break still produces
  // a paragraph. Mirrors splitParagraphs in ArticuloOverlay.
  const paras = raw.split(/\n+/).map((p) => p.trim()).filter(Boolean)
  if (paras.length === 0) {
    return [
      {
        kind: 'p',
        text: 'LISTA SIN CUERPO · CONTENIDO PENDIENTE DE INGESTA',
      },
    ]
  }
  return [
    { kind: 'lede', text: paras[0] },
    ...paras.slice(1).map<ArticleBlock>((p) => ({ kind: 'p', text: p })),
  ]
}

// REAL items from the client cache, ranked by vibe closeness exclusively and
// tie-broken by grid neighborhood (next item directly below in the mosaic).
// Replaced the old MOCK_ITEMS source.
function getRelated(item: ContentItem): ContentItem[] {
  return getRelatedByVibe(item, {
    types: ['listicle', 'articulo', 'editorial', 'review', 'mix'],
    limit: 3,
  })
}
