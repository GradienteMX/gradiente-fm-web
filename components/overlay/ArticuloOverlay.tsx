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
import { getGenreNames, getTagNames } from '@/lib/genres'
import { Calendar, Clock, Quote, User } from 'lucide-react'
import { ContentCard } from '@/components/cards/ContentCard'

interface ArticuloOverlayProps {
  item: ContentItem
}

// Long-form feature layout — hero image up top, two-column reading area
// (sticky TOC + author/share rail flanking a generous article column),
// footnotes, and curated "SIGUIENTES LECTURAS" that stay in-overlay.
export function ArticuloOverlay({ item }: ArticuloOverlayProps) {
  const color = categoryColor('articulo')
  const vibeColor = vibeToColor(item.vibe)
  const genres = getGenreNames(item.genres)
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
        behavior: 'smooth',
      })
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {/* ── Eyebrow + title block ──────────────────────────────────────── */}
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
            //ARTÍCULO
          </span>
          <span className="font-mono text-[10px] tracking-widest text-muted">
            GRADIENTE·FM // DISPATCH·LONGFORM
          </span>
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

        {/* Byline strip — horizontal rules top & bottom */}
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
          {item.readTime && (
            <div className="flex items-center gap-3">
              <Clock size={11} className="text-muted" />
              <dt className="sys-label">LECTURA</dt>
              <dd className="font-mono text-sm text-secondary">
                {item.readTime} min
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

      {/* ── Hero image — full-width, primary (not archival) ──────────────── */}
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
          <figcaption className="mt-2 flex items-center justify-between font-mono text-[10px] tracking-widest text-muted">
            <span>
              IMG·01 //{' '}
              <span className="text-secondary">
                {item.heroCaption ?? 'MATERIAL DE ARCHIVO'}
              </span>
            </span>
            <span style={{ color }}>//ARTÍCULO</span>
          </figcaption>
        </figure>
      )}

      {/* ── Two-column reading area ──────────────────────────────────────── */}
      <div className="grid gap-6 px-5 py-10 md:grid-cols-12 md:gap-10 md:px-12 md:py-14">
        {/* Left rail — sticky TOC + section progress */}
        <aside className="hidden md:col-span-2 md:block">
          <div className="sticky top-4 flex flex-col gap-3">
            <span className="sys-label text-muted">ÍNDICE</span>
            {sections.length > 0 ? (
              <ol className="flex flex-col gap-1.5">
                {sections.map((s, i) => {
                  const active = s.id === activeSection
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => scrollToSection(s.id)}
                        className="group flex w-full items-baseline gap-2 text-left font-mono text-[10px] leading-snug transition-colors"
                      >
                        <span
                          className="shrink-0 tabular-nums"
                          style={{ color: active ? color : 'var(--color-muted)' }}
                        >
                          §{String(i + 1).padStart(2, '0')}
                        </span>
                        <span
                          className={
                            active
                              ? 'text-primary'
                              : 'text-muted group-hover:text-secondary'
                          }
                        >
                          {s.label}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className="font-mono text-[10px] text-muted">
                [SIN SECCIONES]
              </p>
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

        {/* Article — main reading column */}
        <article
          ref={articleRef}
          className="min-w-0 md:col-span-7"
        >
          <BodyBlocks blocks={blocks} color={color} vibeColor={vibeColor} />

          {/* Footnotes */}
          {footnotes.length > 0 && (
            <section className="mt-14 border-t border-border pt-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="sys-label text-muted">NOTAS</span>
                <span
                  className="font-mono text-[10px]"
                  style={{ color }}
                >
                  // {footnotes.length}
                </span>
              </div>
              <ol className="flex flex-col gap-3">
                {footnotes.map((fn, i) => (
                  <li
                    key={fn.id}
                    id={`fn-${fn.id}`}
                    className="flex gap-3 font-grotesk text-[13px] leading-relaxed text-secondary"
                  >
                    <span
                      className="shrink-0 font-mono text-[11px] tabular-nums"
                      style={{ color }}
                    >
                      [{i + 1}]
                    </span>
                    <p>{fn.text}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* End-of-article marker */}
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
              FIN·DEL·ARTÍCULO //{' '}
              <span style={{ color }}>GRADIENTE·FM·#{item.id}</span>
            </p>
          </div>
        </article>

        {/* Right rail — author / vibe / tags */}
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
                      DISPATCH · LONGFORM
                    </p>
                  </div>
                </div>
              </RailBlock>
            )}

            <RailBlock index="02" label="CONTEXTO">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-mono text-xs">
                <dt className="text-muted">TIPO</dt>
                <dd style={{ color }}>: //ARTÍCULO</dd>
                {item.readTime && (
                  <>
                    <dt className="text-muted">LECTURA</dt>
                    <dd className="text-secondary">: {item.readTime} min</dd>
                  </>
                )}
                <dt className="text-muted">ESTADO</dt>
                <dd className="text-sys-green">: PUBLICADO</dd>
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
                  {genres.map((g) => (
                    <li key={g} className="flex items-center gap-2">
                      <span className="text-muted">#</span>
                      <span style={{ color: vibeColor }}>{g}</span>
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

      {/* ── Related reading — stays in overlay via OverlayRouter swap ───── */}
      {related.length > 0 && (
        <section className="border-t border-border bg-surface/40 px-5 py-10 md:px-12">
          <div className="mb-5 flex items-center gap-3">
            <span
              className="font-mono text-[11px] tracking-widest"
              style={{ color }}
            >
              //SIGUIENTES·LECTURAS
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

      {/* Sticky reader footer — SCROLL status strip */}
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
          <span className="text-sys-green">· MODO LECTURA · LONGFORM</span>
        </div>
      </div>
    </div>
  )
}

// ── Body renderer ───────────────────────────────────────────────────────────
function BodyBlocks({
  blocks,
  color,
  vibeColor,
}: {
  blocks: ArticleBlock[]
  color: string
  vibeColor: string
}) {
  return (
    <div className="flex flex-col gap-5 font-grotesk text-[16px] leading-[1.78] text-primary md:text-[17px] md:leading-[1.82]">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'lede':
            return (
              <p
                key={i}
                className="font-grotesk text-[19px] leading-[1.6] text-primary first-letter:float-left first-letter:mr-2 first-letter:mt-[0.15em] first-letter:font-syne first-letter:text-[64px] first-letter:font-black first-letter:leading-[0.85]"
              >
                {renderInline(b.text)}
              </p>
            )
          case 'p':
            return (
              <p key={i} className="text-primary">
                {renderInline(b.text)}
              </p>
            )
          case 'h2': {
            const id = b.id ?? `sec-${i}`
            return (
              <h2
                key={i}
                id={id}
                data-section-id={id}
                className="mt-6 font-syne text-2xl font-black leading-tight text-primary md:text-3xl"
              >
                <span className="mr-2 font-mono text-sm" style={{ color }}>
                  //
                </span>
                {b.text}
              </h2>
            )
          }
          case 'h3':
            return (
              <h3
                key={i}
                className="mt-4 font-syne text-xl font-bold leading-tight text-primary"
              >
                {b.text}
              </h3>
            )
          case 'quote':
            return (
              <blockquote
                key={i}
                className="my-4 border-l-2 py-2 pl-5"
                style={{ borderColor: vibeColor }}
              >
                <Quote
                  size={16}
                  style={{ color: vibeColor }}
                  className="mb-2 opacity-60"
                />
                <p
                  className="font-syne text-xl font-bold italic leading-snug md:text-2xl"
                  style={{ color: vibeColor }}
                >
                  "{b.text}"
                </p>
                {b.cite && (
                  <footer className="mt-2 font-mono text-[11px] tracking-widest text-muted">
                    — {b.cite}
                  </footer>
                )}
              </blockquote>
            )
          case 'blockquote':
            return (
              <blockquote
                key={i}
                className="border-l border-border py-1 pl-4 font-grotesk text-[15px] italic text-secondary"
              >
                {b.text}
                {b.cite && (
                  <footer className="mt-1 font-mono text-[10px] tracking-widest text-muted">
                    — {b.cite}
                  </footer>
                )}
              </blockquote>
            )
          case 'image':
            return (
              <figure key={i} className="my-2">
                <div className="overflow-hidden border border-border bg-elevated">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.src}
                    alt={b.alt ?? ''}
                    className="h-full w-full object-cover"
                  />
                </div>
                {b.caption && (
                  <figcaption className="mt-1.5 font-mono text-[10px] tracking-widest text-muted">
                    IMG // <span className="text-secondary">{b.caption}</span>
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
                <span className="font-mono text-xs" style={{ color }}>
                  ⋯
                </span>
                <div className="h-px flex-1 bg-border" />
                <span className="font-mono text-xs" style={{ color }}>
                  ⋯
                </span>
              </div>
            )
          case 'qa':
            return (
              <div
                key={i}
                className={
                  b.isQuestion
                    ? 'mt-3 border-l-2 border-border pl-4'
                    : 'pl-4'
                }
              >
                <p className="mb-1">
                  <span
                    className="font-syne text-[15px] font-black tracking-wide"
                    style={{ color: b.isQuestion ? color : 'var(--color-primary)' }}
                  >
                    {b.speaker}:
                  </span>
                </p>
                <p
                  className={
                    b.isQuestion
                      ? 'font-grotesk italic text-secondary'
                      : 'text-primary'
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
                      className="mt-[0.45em] inline-block h-1 w-1 shrink-0"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <span>{renderInline(it)}</span>
                  </li>
                ))}
              </ul>
            )
        }
      })}
    </div>
  )
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
      // Footnote ref
      refCount += 1
      const id = match[1]
      parts.push(
        <sup key={`${parts.length}-fn`}>
          <a
            href={`#fn-${id}`}
            className="px-0.5 font-mono text-[10px] text-sys-red hover:underline"
          >
            [{refCount}]
          </a>
        </sup>,
      )
    } else if (match[3]) {
      // External link
      parts.push(
        <a
          key={`${parts.length}-lk`}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sys-red underline decoration-dotted underline-offset-2 transition-colors hover:text-primary"
        >
          {match[2]}
        </a>,
      )
    }
    lastIndex = match.index + match[0].length
  }
  const tail = text.slice(lastIndex)
  if (tail) parts.push(renderBold(tail, `${parts.length}-t`))
  return parts
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

// ── Rail block (mirrors ReaderOverlay's ArchivalBlock idiom) ────────────────
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
  // Fallback: paragraph-split bodyPreview / excerpt, with first paragraph
  // promoted to a lede.
  const raw = item.bodyPreview ?? item.excerpt ?? ''
  const paras = raw.split('\n\n').map((p) => p.trim()).filter(Boolean)
  if (paras.length === 0) {
    return [
      {
        kind: 'p',
        text: '[CUERPO DE ARTÍCULO NO DISPONIBLE · CONTENIDO PENDIENTE DE INGESTA]',
      },
    ]
  }
  return [
    { kind: 'lede', text: paras[0] },
    ...paras.slice(1).map<ArticleBlock>((p) => ({ kind: 'p', text: p })),
  ]
}

// Curated related picks — same type first, then editorial-family sharing genre.
function getRelated(item: ContentItem): ContentItem[] {
  const picks: ContentItem[] = []
  const seen = new Set<string>([item.id])
  const editorialFamily: ContentItem['type'][] = [
    'articulo',
    'editorial',
    'review',
    'opinion',
    'noticia',
  ]

  // 1) Other articulos
  for (const c of MOCK_ITEMS) {
    if (picks.length >= 3) break
    if (seen.has(c.id)) continue
    if (c.type === 'articulo') {
      picks.push(c)
      seen.add(c.id)
    }
  }

  // 2) Editorial-family items sharing at least one genre
  if (picks.length < 3) {
    const genreSet = new Set(item.genres)
    for (const c of MOCK_ITEMS) {
      if (picks.length >= 3) break
      if (seen.has(c.id)) continue
      if (!editorialFamily.includes(c.type)) continue
      if (c.genres.some((g) => genreSet.has(g))) {
        picks.push(c)
        seen.add(c.id)
      }
    }
  }

  return picks
}
