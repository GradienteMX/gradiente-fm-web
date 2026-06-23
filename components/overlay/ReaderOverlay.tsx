'use client'

import { useEffect, useRef, useState } from 'react'
import type {
  ContentItem,
  EntityKind,
  EntityRef,
  ItemFormat,
} from '@/lib/types'
import {
  fmtDateFull,
  vibeToColor,
  vibeMid,
  categoryColor,
  isEditableTarget,
} from '@/lib/utils'
import { getGenreById, getTagNames } from '@/lib/genres'
import {
  Expand,
  FileImage,
  User,
  Calendar,
  Clock,
  Activity,
  MessageSquare,
} from 'lucide-react'
import { GenreChipButton } from '@/components/genre/GenreChipButton'
import { EntityChipButton } from '@/components/entity/EntityChipButton'
import { PollSection } from '@/components/poll/PollSection'
import { VibeFader } from '@/components/VibeFader'
import { VibeMeter } from '@/components/VibeMeter'
import { useOverlayShell } from './OverlayShell'

const TYPE_LABEL: Record<ContentItem['type'], string> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTICIA',
  review: 'REVIEW',
  editorial: 'EDITORIAL',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULO',
  listicle: 'LISTA',
  partner: 'PARTNER',
}

const FORMAT_LABEL: Record<ItemFormat, string> = {
  vinyl: 'Vinyl',
  cassette: 'Cassette',
  cd: 'CD',
  digital: 'Digital',
  mix: 'Mix',
  other: 'Otro',
}

// One CONTEXTO row of clickable entity chips. Renders nothing when empty so
// callers can list all kinds unconditionally. Emits a <dt>/<dd> pair to slot
// into the parent key/value <dl> grid.
function EntityRow({
  label,
  entities,
  color,
}: {
  label: string
  entities: EntityRef[]
  color: string
}) {
  if (entities.length === 0) return null
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="text-muted">:</span>
        {entities.map((e) => (
          <EntityChipButton key={e.id} entity={e} style={{ color }}>
            {e.name}
          </EntityChipButton>
        ))}
      </dd>
    </>
  )
}

interface ReaderOverlayProps {
  item: ContentItem
}

// Editorial / review / opinion / noticia — a "terminal reader" layout:
// article body takes primacy, flyer demotes to an archival rail.
export function ReaderOverlay({ item }: ReaderOverlayProps) {
  const vibeColor = vibeToColor(vibeMid(item))
  const genres = item.genres.map((id) => ({
    id,
    name: getGenreById(id)?.name ?? id,
  }))
  const tags = getTagNames(item.tags)

  // Scene entities attached as `subject` (the CONTEXTO rail). Grouped by kind
  // so each gets its own labeled row of clickable chips.
  const subjectEntities = (item.entities ?? []).filter(
    (e) => (e.relation ?? 'subject') === 'subject',
  )
  const entitiesOf = (kind: EntityKind) =>
    subjectEntities.filter((e) => e.kind === kind)
  const artists = entitiesOf('artist')
  const labels = entitiesOf('label')
  const venues = entitiesOf('venue')
  const promoters = entitiesOf('promoter')

  // Whether the CONTEXTO block has anything real to show — drives the empty
  // fallback instead of a box with only a label.
  const hasContext =
    artists.length > 0 ||
    labels.length > 0 ||
    venues.length > 0 ||
    promoters.length > 0 ||
    !!item.format ||
    !!item.venue ||
    !!item.venueCity ||
    !!item.author

  // Comments state from the surrounding shell — drives the in-body
  // DISCUSIÓN entry + the [C] footer legend.
  const { commentsTotal, commentsLoading, setCommentsOpen, commentsOpen } =
    useOverlayShell()

  const rootRef = useRef<HTMLDivElement>(null)
  const [scrollPct, setScrollPct] = useState(0)
  const [flyerOpen, setFlyerOpen] = useState(false)

  // Track scroll progress on the ancestor scroll container so the footer can
  // show a SCROLL XX% indicator.
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

  // F hotkey opens the flyer lightbox. Skip when focus is inside an
  // editable element — ReaderOverlay also renders inside the dashboard's
  // LivePreview while the editor types in the composer; without this
  // guard, typing 'f' anywhere in the form would toggle the lightbox.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      if ((e.key === 'f' || e.key === 'F') && item.imageUrl) {
        e.preventDefault()
        setFlyerOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item.imageUrl])

  // Split on any run of newlines so an Enter-once paragraph break in the
  // composer renders as a paragraph break here too. Without this, a writer
  // who didn't use blank lines between paragraphs would see one wall of text.
  const paragraphs = item.bodyPreview
    ? item.bodyPreview.split(/\n+/).map((p) => p.trim()).filter(Boolean)
    : item.excerpt
      ? [item.excerpt]
      : []

  // Block rendering: fill scroll progress bar with discrete blocks.
  const scrollBlocks = 12
  const filledBlocks = Math.round((scrollPct / 100) * scrollBlocks)

  return (
    <div ref={rootRef} className="relative">
      {/* Reading area — article + archival rail */}
      <div className="grid gap-6 px-5 py-8 md:grid-cols-12 md:gap-8 md:px-10 md:py-10">
        {/* Article — 8 cols on desktop */}
        <article className="min-w-0 md:col-span-8">
          {/* Type badge */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] tracking-widest"
              style={{
                borderColor: `${categoryColor(item.type)}66`,
                color: categoryColor(item.type),
                backgroundColor: `${categoryColor(item.type)}10`,
              }}
            >
              {item.editorial && <span>★</span>}
              {TYPE_LABEL[item.type]}
            </span>
          </div>

          {/* Title */}
          <h1 className="mb-5 font-syne text-3xl font-black leading-[1.05] text-primary md:text-5xl">
            {item.title}
          </h1>

          {/* Dek / lede — uses subtitle or excerpt */}
          {(item.subtitle || item.excerpt) && (
            <p
              className="mb-6 max-w-[62ch] font-mono text-sm leading-relaxed text-secondary md:text-base"
              style={{ color: vibeColor }}
            >
              {item.subtitle || item.excerpt}
            </p>
          )}

          {/* Metadata inline row */}
          <dl className="mb-8 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-border py-4">
            {item.author && (
              <div className="flex items-center gap-3">
                <User size={11} className="text-muted" />
                <dt className="sys-label">AUTOR</dt>
                <dd className="font-grotesk text-sm text-primary">
                  {item.author}
                </dd>
              </div>
            )}
            {item.publishedAt && (
              <div className="flex items-center gap-3">
                <Calendar size={11} className="text-muted" />
                <dt className="sys-label">PUBLICADO</dt>
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
            <div className="flex items-center gap-3">
              <Activity size={11} className="text-muted" />
              <dt className="sys-label">VIBE</dt>
              <dd>
                <VibeFader item={item} />
              </dd>
            </div>
            {/* DISCUSIÓN — surfaces the comments module inside the reading
                flow so users encounter it before they reach the right rail.
                Click opens the comments column via the shell context. */}
            <div className="flex items-center gap-3">
              <MessageSquare size={11} className="text-muted" />
              <dt className="sys-label">DISCUSIÓN</dt>
              <dd>
                <button
                  type="button"
                  onClick={() => setCommentsOpen((o) => !o)}
                  aria-expanded={commentsOpen}
                  className="group inline-flex items-center gap-2 font-mono text-[11px] tracking-widest transition-colors"
                  style={{ color: '#F97316' }}
                >
                  <span className="tabular-nums">
                    {commentsLoading
                      ? '··'
                      : String(Math.min(commentsTotal, 99)).padStart(2, '0')}
                  </span>
                  <span>
                    {commentsTotal === 1 ? 'COMENTARIO' : 'COMENTARIOS'}
                  </span>
                  <span
                    aria-hidden
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    → ABRIR
                  </span>
                </button>
              </dd>
            </div>
          </dl>

          {/* Body paragraphs — calm reading column */}
          <div className="flex flex-col gap-5 font-grotesk text-[15px] leading-[1.75] md:text-base md:leading-[1.8]">
            {paragraphs.length > 0 ? (
              paragraphs.map((p, i) => (
                <p key={i} className="text-primary">
                  {p}
                </p>
              ))
            ) : (
              <p className="text-muted">
                [CUERPO DE ARTÍCULO NO DISPONIBLE · CONTENIDO PENDIENTE DE INGESTA]
              </p>
            )}
          </div>

          {/* Bottom taxonomy */}
          {(genres.length > 0 || tags.length > 0) && (
            <div className="mt-10 flex flex-wrap gap-1.5 border-t border-border pt-5">
              {genres.map(({ id, name }) => (
                <GenreChipButton
                  key={id}
                  genreId={id}
                  className="border px-2 py-0.5 font-mono text-[10px] tracking-wide"
                  style={{
                    borderColor: `${vibeColor}55`,
                    color: vibeColor,
                  }}
                >
                  {name}
                </GenreChipButton>
              ))}
              {tags.map((t) => (
                <span
                  key={t}
                  className="border border-white/10 px-2 py-0.5 font-mono text-[10px] text-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </article>

        {/* Archival rail — 4 cols on desktop, stacked above article on mobile */}
        <aside className="flex flex-col gap-4 md:col-span-4 md:sticky md:top-4 md:self-start">
          {/* Flyer — image as evidence, not hero */}
          {item.imageUrl && (
            <ArchivalBlock index="01" label="FLYER">
              <div className="relative overflow-hidden border border-border bg-elevated">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="h-full w-full object-cover object-top"
                />
                <VibeMeter
                  item={item}
                  size="xs"
                  className="absolute bottom-0 left-0"
                />
              </div>
              <div className="mt-2 flex items-center justify-end font-mono text-[10px]">
                <button
                  onClick={() => setFlyerOpen(true)}
                  className="flex items-center gap-1 text-sys-red transition-colors hover:text-primary"
                >
                  <Expand size={10} />
                  VER AMPLIADO
                </button>
              </div>
            </ArchivalBlock>
          )}

          {/* CONTEXTO — real scene metadata. Entity rows are clickable chips
              that lead to the entity's page; legacy free-text venue/city/firma
              fall through for items predating the entity registry. */}
          <ArchivalBlock index="02" label="CONTEXTO">
            {hasContext ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-mono text-xs">
                <EntityRow
                  label={artists.length > 1 ? 'ARTISTAS' : 'ARTISTA'}
                  entities={artists}
                  color={vibeColor}
                />
                <EntityRow label="LABEL" entities={labels} color={vibeColor} />
                {item.format && (
                  <>
                    <dt className="text-muted">FORMATO</dt>
                    <dd className="text-secondary">
                      : {FORMAT_LABEL[item.format]}
                    </dd>
                  </>
                )}
                {venues.length > 0 ? (
                  <EntityRow label="VENUE" entities={venues} color={vibeColor} />
                ) : (
                  item.venue && (
                    <>
                      <dt className="text-muted">VENUE</dt>
                      <dd className="text-primary">: {item.venue}</dd>
                    </>
                  )
                )}
                {item.venueCity && (
                  <>
                    <dt className="text-muted">CIUDAD</dt>
                    <dd className="text-secondary">: {item.venueCity}</dd>
                  </>
                )}
                <EntityRow
                  label="PROMOTORA"
                  entities={promoters}
                  color={vibeColor}
                />
                {item.author && (
                  <>
                    <dt className="text-muted">FIRMA</dt>
                    <dd className="text-primary">: {item.author}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="font-mono text-[11px] text-muted">
                Sin metadata de contexto.
              </p>
            )}
          </ArchivalBlock>

          {/* ETIQUETAS */}
          {(genres.length > 0 || tags.length > 0) && (
            <ArchivalBlock index="03" label="ETIQUETAS">
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
            </ArchivalBlock>
          )}
        </aside>
      </div>

      {/* Poll — freeform on noticia / review / editorial / opinion. Sits
          between the article body and the sticky footer. */}
      {item.poll && (
        <div className="border-t border-border bg-surface/40 px-4 py-6 md:px-6">
          <PollSection item={item} className="max-w-2xl" />
        </div>
      )}

      {/* Sticky reader footer — system status strip */}
      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t border-border bg-base/95 px-4 py-2 backdrop-blur-sm md:px-6">
        <div className="flex items-center gap-3">
          <span className="sys-label text-muted">SCROLL</span>
          <span className="font-mono text-[11px] tabular-nums text-primary">
            {String(scrollPct).padStart(2, '0')}%
          </span>
          <span
            className="ml-1 font-mono tracking-[0.3em]"
            aria-hidden
            style={{ color: vibeColor, fontSize: 10 }}
          >
            {'█'.repeat(filledBlocks)}
            <span className="text-muted">
              {'·'.repeat(scrollBlocks - filledBlocks)}
            </span>
          </span>
        </div>
        <div className="hidden items-center gap-4 font-mono text-[10px] tracking-widest sm:flex">
          <span className="text-sys-green">· MODO LECTURA · ACTIVO</span>
          {item.imageUrl && (
            <button
              onClick={() => setFlyerOpen(true)}
              className="flex items-center gap-1.5 text-muted transition-colors hover:text-primary"
            >
              <FileImage size={11} />
              [F] VER FLYER
            </button>
          )}
          <button
            onClick={() => setCommentsOpen((o) => !o)}
            aria-expanded={commentsOpen}
            className="flex items-center gap-1.5 transition-colors hover:opacity-80"
            style={{ color: commentsOpen ? '#F97316' : '#FF9A33' }}
          >
            <MessageSquare size={11} />
            [C] COMENTARIOS
            {commentsTotal > 0 && !commentsLoading && (
              <span className="tabular-nums" style={{ opacity: 0.85 }}>
                · {commentsTotal}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Flyer lightbox — inspect mode */}
      {flyerOpen && item.imageUrl && (
        <FlyerLightbox
          src={item.imageUrl}
          alt={item.title}
          onClose={() => setFlyerOpen(false)}
        />
      )}
    </div>
  )
}

// ── Archival block module ────────────────────────────────────────────────────
function ArchivalBlock({
  index,
  label,
  sublabel,
  children,
}: {
  index: string
  label: string
  sublabel?: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="sys-label text-muted">{index}</span>
          <span className="sys-label text-primary">{label}</span>
          {sublabel && (
            <>
              <span className="font-mono text-[10px] text-sys-red">//</span>
              <span className="sys-label text-muted">{sublabel}</span>
            </>
          )}
        </div>
        <span
          className="h-1.5 w-1.5 rounded-full bg-sys-green"
          aria-hidden
        />
      </header>
      <div className="p-3">{children}</div>
    </section>
  )
}

// ── Flyer lightbox — inspect-mode for the archival asset ─────────────────────
function FlyerLightbox({
  src,
  alt,
  onClose,
}: {
  src: string
  alt: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape always closes; f/F closes only when not typing in a field.
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if ((e.key === 'f' || e.key === 'F') && !isEditableTarget(e.target)) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-6 backdrop-blur-md"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute right-4 top-4 flex items-center gap-2 font-mono text-[10px] tracking-widest text-muted transition-colors hover:text-primary"
      >
        [ESC] CERRAR
      </button>
    </div>
  )
}
