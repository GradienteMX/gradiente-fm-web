'use client'

import { useEffect, useRef, useState } from 'react'
import type {
  ContentItem,
  EntityKind,
  EntityLink,
  EntityRef,
  ItemFormat,
} from '@/lib/types'
import { fmtDateFull, isEditableTarget } from '@/lib/utils'
import { getGenreById, getTagNames } from '@/lib/genres'
import { OverlaySources } from './OverlaySources'
import { ExternalLink } from 'lucide-react'
import { GenreChipButton } from '@/components/genre/GenreChipButton'
import { EntityChipButton } from '@/components/entity/EntityChipButton'
import { PollSection } from '@/components/poll/PollSection'
import { VibeFader } from '@/components/VibeFader'
import { VibeMeter } from '@/components/VibeMeter'
import { useOverlayShell } from './OverlayShell'
import {
  categoryColorOnLight,
  TYPE_CODES,
  TYPE_DISPLAY_LABELS,
  DASH_INK,
} from '@/lib/dashboard/palette'

const FORMAT_LABEL: Record<ItemFormat, string> = {
  vinyl: 'Vinyl',
  cassette: 'Cassette',
  cd: 'CD',
  digital: 'Digital',
  mix: 'Mix',
  other: 'Otro',
  hardcover: 'Tapa dura',
  paperback: 'Rústica',
  ebook: 'E-book',
  zine: 'Zine',
}

// Shared print-grammar focus ring — 2px ink outline offset 2 on paper grounds.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// One CONTEXTO row of clickable entity chips. Renders nothing when empty so
// callers can list all kinds unconditionally. Emits a <dt>/<dd> pair to slot
// into the parent key/value <dl> grid.
function EntityRow({
  label,
  entities,
}: {
  label: string
  entities: EntityRef[]
}) {
  if (entities.length === 0) return null
  return (
    <>
      <dt className="text-ink-faint">{label}</dt>
      <dd className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="text-ink-faint">:</span>
        {entities.map((e) => (
          <EntityChipButton
            key={e.id}
            entity={e}
            className="text-ink underline decoration-ink-faint underline-offset-2 transition-colors hover:text-sys-red-paper"
          >
            {e.name}
          </EntityChipButton>
        ))}
      </dd>
    </>
  )
}

// One CONTEXTO row of outbound links — "where to buy / listen / read more".
// Renders nothing when empty (callers list it unconditionally). Links open in a
// new tab; a blank/relative href is skipped so a half-filled draft never emits a
// dead anchor. Emits a <dt>/<dd> pair to slot into the parent key/value <dl>.
function LinkRow({ label, links }: { label: string; links: EntityLink[] }) {
  const valid = links.filter((l) => l.url.trim() && l.label.trim())
  if (valid.length === 0) return null
  return (
    <>
      <dt className="text-ink-faint">{label}</dt>
      <dd className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="text-ink-faint">:</span>
        {valid.map((l, i) => (
          <a
            key={`${l.url}-${i}`}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-ink underline decoration-ink-faint underline-offset-2 transition-colors hover:text-sys-red-paper"
          >
            {l.label}
            <ExternalLink size={10} aria-hidden />
          </a>
        ))}
      </dd>
    </>
  )
}

interface ReaderOverlayProps {
  item: ContentItem
}

// Editorial / review / opinion / noticia — the printed dossier: the article
// body takes primacy on a paper sheet, the flyer demotes to an archival rail
// on paper-raised. Fase C of «EL PLIEGO» — ink on paper, hairlines, fill
// inversion on hover; the dark surface survives only where it is an
// instrument (VibeFader faceplate) or artwork frame (flyer plate).
export function ReaderOverlay({ item }: ReaderOverlayProps) {
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
    !!item.country ||
    !!item.year ||
    !!item.author ||
    (item.links?.some((l) => l.url?.trim() && l.label?.trim()) ?? false)

  // Comments state from the surrounding shell — drives the in-body
  // DISCUSIÓN entry + the C footer legend.
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
    <div ref={rootRef} className="relative bg-paper text-ink">
      {/* Reading area — article + archival rail */}
      <div className="grid gap-6 px-5 py-8 md:grid-cols-12 md:gap-8 md:px-10 md:py-10">
        {/* Article — 8 cols on desktop */}
        <article className="min-w-0 md:col-span-8">
          {/* Type register — minimal in-body eyebrow (the shell chrome carries
              the full chip): 9px category swatch + 2-letter code + label, hue
              never the sole signal. */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-d11 font-bold uppercase tracking-widest text-ink">
              <span
                aria-hidden
                className="h-[9px] w-[9px] shrink-0"
                style={{ backgroundColor: categoryColorOnLight(item.type) }}
              />
              {TYPE_CODES[item.type]} · {TYPE_DISPLAY_LABELS[item.type]}
            </span>
            {item.editorial && (
              <span
                className="bg-sys-red-paper px-1.5 py-0.5 font-mono text-[10px] leading-none text-paper-raised"
                title="Selección editorial"
              >
                ★
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="mb-5 font-syne text-3xl font-black leading-[1.05] text-ink md:text-5xl">
            {item.title}
          </h1>

          {/* Dek / lede — the red editorial voice; uses subtitle or excerpt */}
          {(item.subtitle || item.excerpt) && (
            <p className="mb-6 max-w-[62ch] font-grotesk text-d15 leading-relaxed text-sys-red-paper md:text-d18">
              {item.subtitle || item.excerpt}
            </p>
          )}

          {/* Metadata inline row — printed dl on hairlines */}
          <dl className="mb-8 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-ink py-4">
            {item.author && (
              <div className="flex items-center gap-3">
                <dt className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                  AUTOR
                </dt>
                <dd className="font-grotesk text-d13 text-ink">
                  {item.author}
                </dd>
              </div>
            )}
            {item.publishedAt && (
              <div className="flex items-center gap-3">
                <dt className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                  PUBLICADO
                </dt>
                <dd className="font-grotesk text-d13 text-ink-soft">
                  {fmtDateFull(item.publishedAt)}
                </dd>
              </div>
            )}
            {item.readTime && (
              <div className="flex items-center gap-3">
                <dt className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                  LECTURA
                </dt>
                <dd className="font-mono text-d13 text-ink-soft">
                  {item.readTime} min
                </dd>
              </div>
            )}
            {/* VIBE — the fader is a dark-calibrated instrument, so it keeps a
                bg-panel faceplate band (instrument doctrine, like the
                dashboard ReproductorWidget). Component untouched. */}
            <div className="flex items-center gap-3">
              <dt className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                VIBE
              </dt>
              <dd>
                <div className="flex items-center border border-ink bg-panel px-3 py-2">
                  <VibeFader item={item} />
                </div>
              </dd>
            </div>
            {/* DISCUSIÓN — surfaces the comments module inside the reading
                flow so users encounter it before they reach the right rail.
                Click opens the comments column via the shell context. Count
                renders only when > 0. */}
            <div className="flex items-center gap-3">
              <dt className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
                DISCUSIÓN
              </dt>
              <dd>
                <button
                  type="button"
                  onClick={() => setCommentsOpen((o) => !o)}
                  aria-expanded={commentsOpen}
                  className={`group -mx-1.5 inline-flex min-h-[44px] items-center gap-1.5 px-1.5 font-mono text-d11 font-bold tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper-raised ${FOCUS_RING}`}
                >
                  {commentsTotal > 0 && !commentsLoading && (
                    <span className="tabular-nums">{commentsTotal}</span>
                  )}
                  <span
                    aria-hidden
                    className="motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                  <span>ABRIR</span>
                </button>
              </dd>
            </div>
          </dl>

          {/* Body paragraphs — calm reading column, ~65ch measure */}
          <div className="flex max-w-[65ch] flex-col gap-5 font-grotesk text-d15 leading-[1.75] md:leading-[1.8]">
            {paragraphs.length > 0 ? (
              paragraphs.map((p, i) => (
                <p key={i} className="text-ink">
                  {p}
                </p>
              ))
            ) : (
              <p className="font-mono text-d13 text-ink-faint">
                Cuerpo del artículo no disponible · contenido pendiente de
                ingesta.
              </p>
            )}
          </div>

          {/* Bottom taxonomy */}
          {(genres.length > 0 || tags.length > 0) && (
            <div className="mt-10 flex flex-wrap gap-1.5 border-t border-ink pt-5">
              {genres.map(({ id, name }) => (
                <GenreChipButton
                  key={id}
                  genreId={id}
                  ground="paper"
                  className="px-2 py-0.5 font-mono text-[10px] tracking-wide"
                >
                  {name}
                </GenreChipButton>
              ))}
              {tags.map((t) => (
                <span
                  key={t}
                  className="border border-ink-faint px-2 py-0.5 font-mono text-[10px] text-ink-faint"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </article>

        {/* Archival rail — 4 cols on desktop, stacked below article on mobile.
            One raised paper plate; blocks separated by ink hairlines. */}
        <aside className="flex flex-col divide-y divide-ink border border-ink bg-paper-raised md:col-span-4 md:sticky md:top-4 md:self-start">
          {/* ESCUCHAR — media links attached to the piece. Sits first in the
              rail: if an author bothered to attach audio/video, it's the most
              actionable thing on the page. Renders nothing when there are no
              embeds, so text-only pieces are unchanged. Consumes the existing
              OverlaySources API; ink accent for the paper ground. */}
          {((item.embeds?.length ?? 0) > 0 || !!item.mixUrl) && (
            <ArchivalBlock label="ESCUCHAR">
              <OverlaySources item={item} accent={DASH_INK} />
            </ArchivalBlock>
          )}

          {/* Flyer — image as evidence, not hero: dark plate in an ink frame.
              The dark 11-seg VibeMeter sits ON the artwork, so it stays. */}
          {item.imageUrl && (
            <ArchivalBlock label="ARCHIVO VISUAL">
              <div className="relative overflow-hidden border border-ink bg-panel">
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
              <div className="mt-1 flex items-center justify-end">
                <button
                  onClick={() => setFlyerOpen(true)}
                  className={`flex min-h-[44px] items-center gap-1 px-2 font-mono text-d11 font-bold tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper-raised ${FOCUS_RING}`}
                >
                  VER AMPLIADO ↗
                </button>
              </div>
            </ArchivalBlock>
          )}

          {/* CONTEXTO — real scene metadata. Entity rows are clickable chips
              that lead to the entity's page; legacy free-text venue/city/firma
              fall through for items predating the entity registry. */}
          <ArchivalBlock label="CONTEXTO">
            {hasContext ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-mono text-d13">
                <EntityRow
                  label={artists.length > 1 ? 'ARTISTAS' : 'ARTISTA'}
                  entities={artists}
                />
                <EntityRow label="LABEL" entities={labels} />
                {item.format && (
                  <>
                    <dt className="text-ink-faint">FORMATO</dt>
                    <dd className="text-ink-soft">
                      : {FORMAT_LABEL[item.format]}
                    </dd>
                  </>
                )}
                {venues.length > 0 ? (
                  <EntityRow label="VENUE" entities={venues} />
                ) : (
                  item.venue && (
                    <>
                      <dt className="text-ink-faint">VENUE</dt>
                      <dd className="text-ink">: {item.venue}</dd>
                    </>
                  )
                )}
                {item.venueCity && (
                  <>
                    <dt className="text-ink-faint">CIUDAD</dt>
                    <dd className="text-ink-soft">: {item.venueCity}</dd>
                  </>
                )}
                {item.country && (
                  <>
                    <dt className="text-ink-faint">PAÍS</dt>
                    <dd className="text-ink-soft">: {item.country}</dd>
                  </>
                )}
                {item.year && (
                  <>
                    <dt className="text-ink-faint">AÑO</dt>
                    <dd className="text-ink-soft">: {item.year}</dd>
                  </>
                )}
                <EntityRow label="PROMOTORA" entities={promoters} />
                {item.author && (
                  <>
                    <dt className="text-ink-faint">FIRMA</dt>
                    <dd className="text-ink">: {item.author}</dd>
                  </>
                )}
                <LinkRow label="ENLACES" links={item.links ?? []} />
              </dl>
            ) : (
              <p className="font-mono text-d11 text-ink-faint">
                Sin metadata de contexto.
              </p>
            )}
          </ArchivalBlock>

          {/* ETIQUETAS */}
          {(genres.length > 0 || tags.length > 0) && (
            <ArchivalBlock label="ETIQUETAS">
              <ul className="flex flex-wrap gap-1.5">
                {genres.map(({ id, name }) => (
                  <li key={id}>
                    <GenreChipButton
                      genreId={id}
                      ground="paper"
                      className="inline-flex px-2 py-0.5 font-mono text-[10px] tracking-wide"
                    >
                      {name}
                    </GenreChipButton>
                  </li>
                ))}
                {tags.map((t) => (
                  <li
                    key={t}
                    className="border border-ink-faint px-2 py-0.5 font-mono text-[10px] text-ink-faint"
                  >
                    {t}
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
        <div className="border-t border-ink px-4 py-6 md:px-6">
          <PollSection item={item} className="max-w-2xl" />
        </div>
      )}

      {/* Sticky reader footer — the scroll readout is a real instrument:
          percentage + block bar, mono ink on paper-raised. */}
      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t border-ink bg-paper-raised px-4 py-1 md:px-6">
        <div className="flex items-center gap-3">
          <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink-soft">
            SCROLL
          </span>
          <span className="font-mono text-d11 tabular-nums text-ink">
            {String(scrollPct).padStart(2, '0')}%
          </span>
          <span
            className="ml-1 font-mono text-[10px] tracking-[0.3em] text-ink"
            aria-hidden
          >
            {'█'.repeat(filledBlocks)}
            <span className="text-ink-faint">
              {'·'.repeat(scrollBlocks - filledBlocks)}
            </span>
          </span>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          {item.imageUrl && (
            <button
              onClick={() => setFlyerOpen(true)}
              className={`group flex min-h-[44px] items-center gap-1.5 px-2 font-mono text-d11 font-bold tracking-widest text-ink transition-colors hover:bg-ink hover:text-paper-raised ${FOCUS_RING}`}
            >
              <kbd className="bg-ink px-1 py-px font-mono text-[10px] leading-none text-paper-raised transition-colors group-hover:bg-paper-raised group-hover:text-ink">
                F
              </kbd>
              VER FLYER
            </button>
          )}
          <button
            onClick={() => setCommentsOpen((o) => !o)}
            aria-expanded={commentsOpen}
            className={`group flex min-h-[44px] items-center gap-1.5 px-2 font-mono text-d11 font-bold tracking-widest transition-colors ${
              commentsOpen
                ? 'bg-ink text-paper-raised'
                : 'text-ink hover:bg-ink hover:text-paper-raised'
            } ${FOCUS_RING}`}
          >
            <kbd
              className={`px-1 py-px font-mono text-[10px] leading-none transition-colors ${
                commentsOpen
                  ? 'bg-paper-raised text-ink'
                  : 'bg-ink text-paper-raised group-hover:bg-paper-raised group-hover:text-ink'
              }`}
            >
              C
            </kbd>
            COMENTARIOS
            {commentsTotal > 0 && !commentsLoading && (
              <span className="tabular-nums">· {commentsTotal}</span>
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
// One labeled section of the raised rail plate. The parent <aside> draws the
// outer frame + the hairlines between blocks (divide-y), so the block itself
// only rules off its own label.
function ArchivalBlock({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section>
      <header className="border-b border-ink px-3 py-2">
        <span className="font-mono text-d11 font-bold uppercase tracking-widest text-ink">
          {label}
        </span>
      </header>
      <div className="p-3">{children}</div>
    </section>
  )
}

// ── Flyer lightbox — inspect-mode for the archival asset ─────────────────────
// Ink scrim + paper CERRAR chip. Capture-phase key handling stays: ESC (and F)
// close the lightbox and stopPropagation so the overlay beneath doesn't also
// close (ESC layering law: lightbox > comments column > overlay close).
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/95 p-6"
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
        className="group absolute right-4 top-4 flex min-h-[44px] items-center gap-2 border border-ink bg-paper-raised px-4 font-mono text-d11 font-bold tracking-widest text-ink transition-colors hover:border-panel-text hover:bg-panel hover:text-panel-text focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-text"
      >
        <kbd className="bg-ink px-1 py-px font-mono text-[10px] leading-none text-paper-raised transition-colors group-hover:bg-paper-raised group-hover:text-ink">
          ESC
        </kbd>
        CERRAR
      </button>
    </div>
  )
}
