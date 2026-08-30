'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { ArticleBlock, ContentItem } from '@/lib/types'
import { getRelatedByVibe } from '@/lib/itemsCache'
import { fmtDateFull } from '@/lib/utils'
import { getGenreById, getTagNames } from '@/lib/genres'
import { ExternalLink, Pause, Play } from 'lucide-react'
import { ContentCard } from '@/components/cards/ContentCard'
import {
  PLATFORM_LABELS,
  detectPlatform,
  isPlayablePlatform,
} from '@/components/embed/platforms'
import { useAudioPlayer } from '@/components/audio/AudioPlayerProvider'
import {
  canExtractSource,
  pickPlayableSource,
  trackBlockToPlayable,
  type PlayableRef,
} from '@/components/audio/sources'
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

interface ArticuloOverlayProps {
  item: ContentItem
}

// ── «EL PLIEGO» fase C — shared print chrome ────────────────────────────────
// Focus grammar: 2px ink outline offset 2 on paper grounds; panel-text ring
// on ink (faceplate) grounds. Exported so ListicleOverlay reuses the same
// strings instead of drifting.
export const PAPER_FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
export const PANEL_FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text'

// Smooth scrolling is an effect — honor the reduced-motion setting at the
// moment of the gesture.
function scrollBehavior(): ScrollBehavior {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 'auto'
  }
  return 'smooth'
}

// Long-form printed feature — the fase-C paper sheet. Hero plate up top,
// two-column reading area (sticky §-numbered TOC + FIRMA/CONTEXTO rail
// flanking a generous article column), footnotes on hairlines, and curated
// "SIGUIENTES LECTURAS" that stay in-overlay.
export function ArticuloOverlay({ item }: ArticuloOverlayProps) {
  const color = categoryColorOnLight(item.type)
  const genres = item.genres.map((id) => ({
    id,
    name: getGenreById(id)?.name ?? id,
  }))
  const tags = getTagNames(item.tags)

  const rootRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLDivElement>(null)
  const [scrollPct, setScrollPct] = useState(0)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  const blocks = useMemo(() => buildBlocks(item), [item])
  const sections = useMemo(
    () =>
      blocks
        .map((b, i) =>
          b.kind === 'h2' ? { id: b.id ?? `sec-${i}`, label: b.text } : null,
        )
        .filter((x): x is { id: string; label: string } => !!x),
    [blocks],
  )
  const footnotes = item.footnotes ?? []

  // Track scroll progress on the overlay's scroll container.
  useEffect(() => {
    const el = rootRef.current?.closest('.overflow-y-auto') as HTMLElement | null
    if (!el) return
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight
      const pct = max > 0 ? Math.round((el.scrollTop / max) * 100) : 0
      setScrollPct(Math.max(0, Math.min(100, pct)))

      // Find topmost visible h2
      const headings = articleRef.current?.querySelectorAll<HTMLElement>(
        '[data-section-id]',
      )
      if (!headings || headings.length === 0) return
      const scrollTop = el.scrollTop + 120
      let current: string | null = null
      for (const h of Array.from(headings)) {
        if (h.offsetTop <= scrollTop) current = h.dataset.sectionId ?? null
        else break
      }
      setActiveSection(current)
    }
    onScroll()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const scrollBlocks = 14
  const filled = Math.round((scrollPct / 100) * scrollBlocks)

  // Curated "SIGUIENTES LECTURAS" — same-type articulos first, then other
  // editorial-family items sharing a genre. Non-algorithmic, capped at 3.
  const related = useMemo(() => getRelated(item), [item])

  const scrollToSection = (id: string) => {
    const el = articleRef.current?.querySelector<HTMLElement>(
      `[data-section-id="${id}"]`,
    )
    const scroller = rootRef.current?.closest('.overflow-y-auto') as HTMLElement | null
    if (el && scroller) {
      scroller.scrollTo({
        top: el.offsetTop - 80,
        behavior: scrollBehavior(),
      })
    }
  }

  return (
    <div ref={rootRef} className="relative bg-paper text-ink">
      {/* ── Eyebrow + title block ──────────────────────────────────────── */}
      <header className="px-5 pt-10 md:px-12 md:pt-14">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {/* Type register — swatch + 2-letter code + label. The code rides
              beside the swatch so hue is never the only signal. */}
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
        </div>

        <h1 className="mb-6 max-w-[22ch] font-syne text-d28 font-black tracking-[-0.01em] text-ink [text-wrap:balance] md:text-display">
          {item.title}
        </h1>

        {(item.subtitle || item.excerpt) && (
          <p className="mb-8 max-w-[62ch] font-grotesk text-d18 leading-relaxed text-ink-soft md:text-xl">
            {item.subtitle || item.excerpt}
          </p>
        )}

        {/* Byline strip — hairline rules top & bottom */}
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
          {item.readTime && (
            <div className="flex items-baseline gap-3">
              <dt className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                LECTURA
              </dt>
              <dd className="font-mono text-d13 text-ink-soft">
                {item.readTime} min
              </dd>
            </div>
          )}
          {/* Vibe fader on its faceplate seat — the fader's meter/grips are
              dark-ground instruments (instrument doctrine), so it sits on a
              bg-panel band like the dashboard ReproductorWidget's. */}
          <div className="flex w-full min-w-0 items-center gap-3 border border-ink bg-panel px-3 py-2 sm:ml-auto sm:w-auto">
            <span className="shrink-0 font-mono text-d11 font-bold tracking-widest text-panel-text">
              VIBE
            </span>
            <VibeFader item={item} />
          </div>
        </dl>
      </header>

      {/* ── Hero image — ink-framed plate, category underline ───────────── */}
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

      {/* ── Two-column reading area ──────────────────────────────────────── */}
      <div className="grid gap-6 px-5 py-10 md:grid-cols-12 md:gap-10 md:px-12 md:py-14">
        {/* Left rail — sticky TOC + section progress */}
        <aside className="hidden md:col-span-2 md:block">
          <div className="sticky top-4 flex flex-col gap-3">
            <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
              ÍNDICE
            </span>
            {sections.length > 0 ? (
              <ol className="flex flex-col gap-1">
                {sections.map((s, i) => {
                  const active = s.id === activeSection
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => scrollToSection(s.id)}
                        className={`flex min-h-6 w-full items-baseline gap-2 px-1 py-0.5 text-left font-mono text-d11 leading-snug transition-colors ${
                          active
                            ? 'bg-ink text-paper-raised'
                            : 'text-ink-faint hover:text-ink'
                        } ${PAPER_FOCUS_RING}`}
                      >
                        <span className="shrink-0 tabular-nums">
                          §{String(i + 1).padStart(2, '0')}
                        </span>
                        <span>{s.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                SIN SECCIONES
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

        {/* Article — main reading column */}
        <article
          ref={articleRef}
          className="min-w-0 md:col-span-7"
        >
          <BodyBlocks blocks={blocks} color={color} item={item} />

          {/* Footnotes — endnotes on hairlines */}
          {footnotes.length > 0 && (
            <section className="mt-14 border-t border-ink pt-6">
              <div className="mb-4 flex items-baseline gap-2">
                <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                  NOTAS
                </span>
                <span className="font-mono text-d11 tabular-nums text-ink">
                  · {footnotes.length}
                </span>
              </div>
              <ol className="flex flex-col gap-3">
                {footnotes.map((fn, i) => (
                  <li
                    key={fn.id}
                    id={`fn-${fn.id}`}
                    className="flex gap-3 border-b border-ink/20 pb-3 font-grotesk text-[13px] leading-relaxed text-ink-soft last:border-b-0"
                  >
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-sys-red-paper">
                      {i + 1}
                    </span>
                    <p>{fn.text}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* End-of-article marker — double ink rule + FIN */}
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

        {/* Right rail — firma / contexto / etiquetas */}
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
                  </div>
                </div>
              </RailBlock>
            )}

            <RailBlock label="CONTEXTO">
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
                  {item.readTime && (
                    <>
                      <dt className="uppercase tracking-widest text-ink-faint">
                        LECTURA
                      </dt>
                      <dd className="text-ink-soft">{item.readTime} min</dd>
                    </>
                  )}
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

      {/* Poll — freeform on articulo. Lives between body+footnotes and the
          related-reading section. */}
      {item.poll && (
        <section className="border-t border-ink px-5 py-8 md:px-12">
          <PollSection item={item} className="max-w-2xl" />
        </section>
      )}

      {/* ── Related reading — stays in overlay via OverlayRouter swap ───── */}
      {related.length > 0 && (
        <section className="border-t border-ink px-5 py-10 md:px-12">
          <div className="mb-5 flex items-center gap-3">
            <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink">
              SIGUIENTES LECTURAS
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

      {/* Sticky reader footer — SCROLL progress strip on paper */}
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

// ── Body renderer ───────────────────────────────────────────────────────────
// `item` (the parent articulo/listicle) turns the body's `track` blocks into a
// player COLLECTION: each playable track gets an in-player play button, and
// playing one queues the rest so the list auto-advances track to track.
export function BodyBlocks({
  blocks,
  color,
  item,
}: {
  blocks: ArticleBlock[]
  color: string
  item?: ContentItem
}) {
  // Playable ref per track-block index (unplayable blocks are absent), plus
  // the ordered collection the player queue walks.
  const playableByIndex = useMemo(() => {
    const m = new Map<number, PlayableRef>()
    if (!item) return m
    blocks.forEach((b, i) => {
      if (b.kind !== 'track') return
      const p = trackBlockToPlayable(item, b, i)
      if (p) m.set(i, p)
    })
    return m
  }, [blocks, item])
  const collection = useMemo(
    () => Array.from(playableByIndex.values()),
    [playableByIndex],
  )

  // §-numbering per h2 index — mirrors the TOC's §NN register so the printed
  // section heads and the rail agree.
  const sectionNumbers = useMemo(() => {
    const m = new Map<number, number>()
    let n = 0
    blocks.forEach((b, i) => {
      if (b.kind === 'h2') m.set(i, ++n)
    })
    return m
  }, [blocks])

  // Prime every platform the collection uses as soon as the reader lands on
  // the piece — so the first play click autoplays within the user's gesture
  // instead of waiting for a third-party script to boot.
  const { primePlatform } = useAudioPlayer()
  useEffect(() => {
    const seen = new Set<string>()
    for (const p of collection) {
      const src = pickPlayableSource(p)
      if (src && !seen.has(src.platform)) {
        seen.add(src.platform)
        primePlatform(src.platform, src.url)
      }
    }
  }, [collection, primePlatform])

  return (
    <div className="flex flex-col gap-5 font-grotesk text-[16px] leading-[1.78] text-ink md:text-[17px] md:leading-[1.82]">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'lede': {
            // Composers commonly receive multi-paragraph text in a single
            // block (Enter-as-paragraph-break in the textarea). Split on any
            // run of newlines so each line becomes its own <p> sibling under
            // the parent flex container — only the first piece keeps the
            // drop-cap.
            const paras = splitParagraphs(b.text)
            if (paras.length === 0) return null
            const ledeClass =
              'font-grotesk text-[19px] leading-[1.6] text-ink first-letter:float-left first-letter:mr-2 first-letter:mt-[0.15em] first-letter:font-syne first-letter:text-[64px] first-letter:font-black first-letter:leading-[0.85]'
            return (
              <Fragment key={i}>
                <p className={ledeClass}>{renderInline(paras[0])}</p>
                {paras.slice(1).map((p, j) => (
                  <p key={j}>{renderInline(p)}</p>
                ))}
              </Fragment>
            )
          }
          case 'p': {
            const paras = splitParagraphs(b.text)
            if (paras.length === 0) return null
            return (
              <Fragment key={i}>
                {paras.map((p, j) => (
                  <p key={j}>{renderInline(p)}</p>
                ))}
              </Fragment>
            )
          }
          case 'h2': {
            const id = b.id ?? `sec-${i}`
            const n = sectionNumbers.get(i) ?? 0
            return (
              <h2
                key={i}
                id={id}
                data-section-id={id}
                className="mt-6 font-syne text-2xl font-black leading-tight text-ink md:text-3xl"
              >
                <span
                  className="mr-2 font-mono text-sm tabular-nums"
                  style={{ color }}
                >
                  §{String(n).padStart(2, '0')}
                </span>
                {b.text}
              </h2>
            )
          }
          case 'h3':
            return (
              <h3
                key={i}
                className="mt-4 font-syne text-xl font-bold leading-tight text-ink"
              >
                {b.text}
              </h3>
            )
          case 'quote':
            // Pull-quote — bordered ink slab on raised paper.
            return (
              <blockquote
                key={i}
                className="my-4 border border-ink border-l-4 bg-paper-raised p-5"
              >
                <p className="font-syne text-xl font-bold leading-snug text-ink md:text-2xl">
                  &ldquo;{b.text}&rdquo;
                </p>
                {b.cite && (
                  <footer className="mt-2 font-mono text-d11 tracking-widest text-ink-faint">
                    — {b.cite}
                  </footer>
                )}
              </blockquote>
            )
          case 'blockquote':
            return (
              <blockquote
                key={i}
                className="border-l border-ink py-1 pl-4 font-grotesk text-[15px] italic text-ink-soft"
              >
                {b.text}
                {b.cite && (
                  <footer className="mt-1 font-mono text-[10px] tracking-widest text-ink-faint">
                    — {b.cite}
                  </footer>
                )}
              </blockquote>
            )
          case 'image':
            return (
              <figure key={i} className="my-2">
                <div className="overflow-hidden border border-ink bg-panel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.src}
                    alt={b.alt ?? ''}
                    className="h-full w-full object-cover"
                  />
                </div>
                {b.caption && (
                  <figcaption className="mt-1.5 font-mono text-d11 tracking-widest text-ink-faint">
                    {b.caption}
                  </figcaption>
                )}
              </figure>
            )
          case 'divider':
            return (
              <div
                key={i}
                className="my-4 flex items-center gap-3"
                aria-hidden
              >
                <div className="h-px flex-1 bg-ink" />
                <span className="font-mono text-xs leading-none tracking-[0.4em] text-ink-soft">
                  ···
                </span>
                <div className="h-px flex-1 bg-ink" />
              </div>
            )
          case 'qa':
            return (
              <div
                key={i}
                className={
                  b.isQuestion
                    ? 'mt-3 border-l-2 border-ink pl-4'
                    : 'pl-4'
                }
              >
                <p className="mb-1">
                  <span
                    className="font-syne text-[15px] font-black tracking-wide"
                    style={{ color: b.isQuestion ? color : undefined }}
                  >
                    {b.speaker}:
                  </span>
                </p>
                <p
                  className={
                    b.isQuestion ? 'font-grotesk italic text-ink-soft' : ''
                  }
                >
                  {renderInline(b.text)}
                </p>
              </div>
            )
          case 'list':
            return b.ordered ? (
              <ol key={i} className="flex list-decimal flex-col gap-1.5 pl-6">
                {b.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ol>
            ) : (
              <ul key={i} className="flex flex-col gap-1.5 pl-0">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3">
                    <span
                      className="mt-[0.45em] inline-block h-1 w-1 shrink-0 bg-ink"
                      aria-hidden
                    />
                    <span>{renderInline(it)}</span>
                  </li>
                ))}
              </ul>
            )
          case 'track':
            return (
              <TrackBlock
                key={i}
                block={b}
                playable={playableByIndex.get(i) ?? null}
                collection={collection}
              />
            )
        }
      })}
    </div>
  )
}

// ── Track block ─────────────────────────────────────────────────────────────
// Instrument doctrine: anything that plays sits on an ink faceplate. The
// rank/cover/title/transport band is a bg-panel instrument row; the printed
// commentary reads below it on raised paper.
function TrackBlock({
  block,
  playable,
  collection,
}: {
  block: Extract<ArticleBlock, { kind: 'track' }>
  playable?: PlayableRef | null
  collection?: PlayableRef[]
}) {
  const rank = block.rank
  const meta: string[] = []
  if (block.year !== undefined) meta.push(String(block.year))
  if (block.bpm !== undefined) meta.push(`${block.bpm} BPM`)

  // In-player transport: playing a track queues the WHOLE list from the
  // player's side, so it auto-advances to the next playable entry when this
  // one ends. Sources the player can't control (Bandcamp, or URLs its widget
  // can't key on) stay external link-outs below.
  const audio = useAudioPlayer()
  const source = playable ? pickPlayableSource(playable) : null
  const isActive = playable ? audio.isItemActive(playable.id) : false
  const isPlaying = isActive && audio.isPlaying
  const handlePlay = () => {
    if (!playable || !collection) return
    if (isActive) {
      audio.toggle()
      return
    }
    const idx = collection.findIndex((t) => t.id === playable.id)
    audio.playQueue(collection, idx < 0 ? 0 : idx)
  }
  const externalEmbeds = (block.embeds ?? []).filter(
    (e) =>
      !e.url ||
      !isPlayablePlatform(e.platform) ||
      !canExtractSource(e.platform, e.url),
  )

  return (
    <section className="my-3 border border-ink">
      {/* Faceplate band — rank, cover, identity, transport */}
      <div className="bg-panel p-4 text-panel-text md:p-5">
        <div className="flex gap-4">
          {/* Rank column — Syne numerals, acid on the panel (legal use) */}
          <div className="flex w-14 shrink-0 flex-col items-start gap-1 md:w-20">
            <span className="font-mono text-d11 uppercase tracking-widest text-panel-text/60">
              RANK
            </span>
            <span className="font-syne text-4xl font-black leading-none tabular-nums text-acid md:text-5xl">
              {rank !== undefined ? String(rank).padStart(2, '0') : '—'}
            </span>
          </div>

          {/* Cover */}
          {block.imageUrl ? (
            <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden border border-panel-text/25 md:h-[104px] md:w-[104px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={block.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center border border-panel-text/25 font-mono text-[10px] text-panel-text/60 md:h-[104px] md:w-[104px]">
              SIN ARTE
            </div>
          )}

          {/* Title / meta */}
          <div className="min-w-0 flex flex-col gap-1">
            <p className="font-mono text-d11 tracking-widest text-panel-text/70">
              {block.artist}
            </p>
            <h3 className="font-syne text-lg font-black leading-[1.05] text-panel-text [overflow-wrap:anywhere] md:text-xl">
              {block.title}
            </h3>
            {meta.length > 0 && (
              <p className="font-mono text-d11 text-panel-text/60">
                {meta.join(' · ')}
              </p>
            )}
          </div>
        </div>

        {/* Transport + source link-outs. Playable sources get the in-player
            button (never a link-out); only uncontrollable sources link out. */}
        {(source || externalEmbeds.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-panel-text/25 pt-3">
            {source && (
              <button
                type="button"
                onClick={handlePlay}
                aria-label={
                  isPlaying ? `Pausar ${block.title}` : `Reproducir ${block.title}`
                }
                className={`inline-flex min-h-11 items-center gap-1.5 border px-3 font-mono text-[10px] tracking-widest transition-colors ${
                  isPlaying
                    ? 'border-acid bg-acid text-ink'
                    : 'border-panel-text/50 text-panel-text hover:border-panel-text hover:bg-panel-text hover:text-panel'
                } ${PANEL_FOCUS_RING}`}
              >
                {isPlaying ? (
                  <Pause size={10} fill="currentColor" />
                ) : (
                  <Play size={10} fill="currentColor" />
                )}
                {isPlaying
                  ? 'SONANDO'
                  : isActive
                    ? 'REANUDAR'
                    : 'REPRODUCIR'}
                <span className="opacity-70">
                  · {PLATFORM_LABELS[source.platform]}
                </span>
              </button>
            )}
            {/* Always offer the source as an OUTBOUND link too — some people
                would rather open the track on YouTube/SoundCloud itself than
                play it inline. */}
            {source && (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir ${block.title} en ${PLATFORM_LABELS[source.platform]}`}
                className={`inline-flex min-h-11 items-center gap-1.5 border border-panel-text/30 px-3 font-mono text-[10px] tracking-widest text-panel-text/70 transition-colors hover:border-panel-text hover:text-panel-text ${PANEL_FOCUS_RING}`}
              >
                ABRIR EN {PLATFORM_LABELS[source.platform]}
                <ExternalLink size={10} />
              </a>
            )}
            {externalEmbeds.map((e) => (
              <a
                key={e.platform}
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-h-11 items-center gap-1.5 border border-panel-text/30 px-3 font-mono text-[10px] tracking-widest text-panel-text/70 transition-colors hover:border-panel-text hover:text-panel-text ${PANEL_FOCUS_RING}`}
              >
                {PLATFORM_LABELS[e.platform]}
                <ExternalLink size={10} />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Commentary — printed liner note under the faceplate. Split on
          newlines so multi-paragraph commentaries render as separate
          paragraphs instead of one collapsed block. */}
      {block.commentary && (
        <div className="flex flex-col gap-3 bg-paper-raised p-4 font-grotesk text-[14px] leading-[1.6] text-ink-soft md:p-5 md:text-[15px]">
          {splitParagraphs(block.commentary).map((p, j) => (
            <p key={j}>{p}</p>
          ))}
        </div>
      )}
    </section>
  )
}

// Split a multi-paragraph block string on any run of newlines, trimming
// each piece. A user who pastes prose into a single PÁRRAFO block expects
// each Enter to render as a paragraph break.
function splitParagraphs(text: string): string[] {
  return text.split(/\n+/).map((p) => p.trim()).filter(Boolean)
}

// Render inline with support for footnote refs like [^1] and bold **text**.
function renderInline(text: string): React.ReactNode {
  // Unified tokenizer for inline markers, in order of priority:
  //   [^id]         → footnote reference (numbered, anchors to #fn-<id>)
  //   [text](url)   → external link
  //   **bold**      → strong
  const parts: React.ReactNode[] = []
  const regex = /\[\^([a-zA-Z0-9_-]+)\]|\[([^\]]+)\]\((https?:[^)]+)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let refCount = 0
  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index)
    if (before) parts.push(renderBold(before, `${parts.length}-t`))
    if (match[1]) {
      // Footnote ref — superscript number, no brackets, editorial red.
      refCount += 1
      const id = match[1]
      parts.push(
        <sup key={`${parts.length}-fn`}>
          <a
            href={`#fn-${id}`}
            className="px-0.5 font-mono text-[10px] text-sys-red-paper hover:underline"
          >
            {refCount}
          </a>
        </sup>,
      )
    } else if (match[3]) {
      // Link — music links the player can control play IN Gradiente;
      // everything else stays an external anchor.
      parts.push(
        <ProseLink key={`${parts.length}-lk`} url={match[3]} label={match[2]} />,
      )
    }
    lastIndex = match.index + match[0].length
  }
  const tail = text.slice(lastIndex)
  if (tail) parts.push(renderBold(tail, `${parts.length}-t`))
  return parts
}

// Inline prose link. When the URL points at a source the global player can
// control (SoundCloud / YouTube / Mixcloud / Spotify with an extractable id),
// clicking plays it in the Gradiente player — no tab hop. Anything else is a
// normal external anchor. The synthetic ref's slug is empty on purpose: the
// HUD only re-opens overlays for real content slugs.
function ProseLink({ url, label }: { url: string; label: string }) {
  const audio = useAudioPlayer()
  const platform = detectPlatform(url)
  const playable =
    platform !== null &&
    isPlayablePlatform(platform) &&
    canExtractSource(platform, url)

  if (!playable) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sys-red-paper underline decoration-dotted underline-offset-2 transition-colors hover:text-ink"
      >
        {label}
      </a>
    )
  }

  const ref: PlayableRef = {
    id: `inline::${url}`,
    slug: '',
    title: label,
    embeds: [{ platform, url }],
  }
  const isActive = audio.isItemActive(ref.id)
  const isPlaying = isActive && audio.isPlaying
  return (
    <span className="inline-flex items-baseline gap-1 align-baseline">
      <button
        type="button"
        onClick={() => {
          if (isActive) audio.toggle()
          else void audio.loadAndPlay(ref)
        }}
        title={`${isPlaying ? 'Pausar' : 'Reproducir'} en Gradiente · ${PLATFORM_LABELS[platform]}`}
        className="inline-flex items-baseline gap-1 align-baseline text-sys-red-paper underline decoration-dotted underline-offset-2 transition-colors hover:text-ink"
      >
        {isPlaying ? (
          <Pause size={10} fill="currentColor" className="self-center" />
        ) : (
          <Play size={10} fill="currentColor" className="self-center" />
        )}
        {label}
      </button>
      {/* Outbound twin — playable links must stay openable on the platform
          itself, not only playable inline. */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Abrir en ${PLATFORM_LABELS[platform]}`}
        title={`Abrir en ${PLATFORM_LABELS[platform]}`}
        className="self-center text-ink-faint transition-colors hover:text-ink"
      >
        <ExternalLink size={10} />
      </a>
    </span>
  )
}

function renderBold(text: string, keyPrefix: string): React.ReactNode {
  const nodes: React.ReactNode[] = []
  const regex = /\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = regex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index)
    if (before) nodes.push(<span key={`${keyPrefix}-${i++}`}>{before}</span>)
    nodes.push(<strong key={`${keyPrefix}-${i++}`}>{match[1]}</strong>)
    lastIndex = match.index + match[0].length
  }
  const tail = text.slice(lastIndex)
  if (tail) nodes.push(<span key={`${keyPrefix}-${i++}`}>{tail}</span>)
  return nodes
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
  // Fallback: paragraph-split bodyPreview / excerpt, with first paragraph
  // promoted to a lede.
  const raw = item.bodyPreview ?? item.excerpt ?? ''
  const paras = splitParagraphs(raw)
  if (paras.length === 0) {
    return [
      {
        kind: 'p',
        text: 'CUERPO DEL ARTÍCULO NO DISPONIBLE · CONTENIDO PENDIENTE DE INGESTA',
      },
    ]
  }
  return [
    { kind: 'lede', text: paras[0] },
    ...paras.slice(1).map<ArticleBlock>((p) => ({ kind: 'p', text: p })),
  ]
}

// Curated related picks — same type first, then editorial-family sharing genre.
// REAL items from the client cache, ranked by vibe closeness exclusively and
// tie-broken by grid neighborhood (next item directly below in the mosaic).
// Replaced the old MOCK_ITEMS source.
function getRelated(item: ContentItem): ContentItem[] {
  return getRelatedByVibe(item, {
    types: ['articulo', 'editorial', 'review', 'opinion', 'noticia'],
    limit: 3,
  })
}
