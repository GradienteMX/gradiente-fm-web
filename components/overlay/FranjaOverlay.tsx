'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import {
  ExternalLink,
  MapPin,
  ArrowUpRight,
  Calendar,
  Users,
  X,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ContentItem, ContentType, FranjaKind } from '@/lib/types'
import { fmtDateFull } from '@/lib/utils'
import {
  categoryColorOnLight,
  TYPE_CODES,
  TYPE_DISPLAY_LABELS,
} from '@/lib/dashboard/palette'
import { getAllItemsSync, subscribeItems } from '@/lib/itemsCache'
import { useOverlay } from './useOverlay'
import { SmartImage } from '@/components/SmartImage'
import Link from 'next/link'
import { ShareButton } from './ShareButton'
import { MarketplaceListingCard } from '@/components/marketplace/MarketplaceListingCard'
import { MarketplaceListingDetail } from '@/components/marketplace/MarketplaceListingDetail'

// ── FranjaOverlay — the wide dossier sheet (fase F, «EL PLIEGO») ───────────
//
// Franja profile shown when a card in [[FranjasRail]] is clicked. Same
// overlay grammar as every other ContentItem — opens via useOverlay().open()
// on `?item=<slug>`.
//
// CHASSIS NOTE — OverlayRouter special-cases `type === 'franja'` and returns
// this component BARE, deliberately bypassing OverlayShell so the dossier can
// be a WIDE two-pane sheet instead of the shell's 1024px single panel. That
// bypass is intentional and stays; fase F re-chromes the sheet IN PLACE so it
// reads as a sibling of an OverlayShell sheet — paper sheet on an ink scrim,
// raised header band, ink hairlines, Syne title, CERRAR·ESC chip, mobile
// dismiss bar — without inheriting the shell's width or comments column.
//
// Three zones:
//   1. Identity pane (left) — logo plate (object-contain so logo franjas
//      aren't cropped), kind chip, title, catalog facts, bio, CTAs.
//   2. Content pane (right) — //HISTORIA DESTACADA, the kind slot's linked
//      work as FranjaLinkedPeek cards that expand in place, //ARCHIVO,
//      //MERCADO.
//   3. Listing sub-overlay — z-[60] over the dossier, driven by LOCAL state
//      (never a URL param, so it can't collide with useOverlay's ?item=).

interface Props {
  item: ContentItem
  /** Router-driven exit-animation flag (mirrors OverlayShell's contract). */
  exiting: boolean
  /** Called once the close animation finishes so the router can unmount. */
  onExited: () => void
}

// House focus ring on paper grounds (fase C/F) — one grammar everywhere.
const FOCUS_RING =
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'

// The mono label register — the paper replacement for the old dark
// terminal label class (removed here in fase F).
const LABEL = 'font-mono text-d11 font-bold uppercase tracking-widest'

export const KIND_LABEL: Record<FranjaKind, string> = {
  label: 'SELLO',
  promoter: 'PROMOTORA',
  venue: 'VENUE',
  plataforma: 'PLATAFORMA',
  dealer: 'DEALER',
  colectivo: 'COLECTIVO',
  festival: 'FESTIVAL',
  club: 'CLUB',
  medios: 'MEDIO',
  'mix-series': 'MIX SERIES',
}

export const TYPE_LABEL: Record<ContentType, string> = {
  evento: 'EVENTO',
  mix: 'MIX',
  noticia: 'NOTICIA',
  review: 'REVIEW',
  editorial: 'EDITORIAL',
  opinion: 'OPINIÓN',
  articulo: 'ARTÍCULO',
  listicle: 'LISTA',
  franja: 'FRANJA',
}

export interface KindSlot {
  header: string
  types: ContentType[]
  upcomingOnly: boolean
  emptyHint: string
}

export const KIND_SLOT: Record<FranjaKind, KindSlot | null> = {
  venue: {
    header: 'PRÓXIMOS EVENTOS EN ESTE VENUE',
    types: ['evento'],
    upcomingOnly: true,
    emptyHint: 'Sin eventos vinculados a este venue por ahora.',
  },
  promoter: {
    header: 'PRÓXIMAS FIESTAS',
    types: ['evento'],
    upcomingOnly: true,
    emptyHint: 'Sin fiestas vinculadas por ahora.',
  },
  label: {
    header: 'RELEASES Y MIXES',
    types: ['mix', 'review', 'articulo'],
    upcomingOnly: false,
    emptyHint: 'Sin releases ni mixes vinculados por ahora.',
  },
  dealer: {
    header: 'INVENTARIO',
    types: [],
    upcomingOnly: false,
    emptyHint: 'Revisa el marketplace de este dealer para ver disponibilidad.',
  },
  colectivo: {
    header: 'PRÓXIMAS FIESTAS',
    types: ['evento'],
    upcomingOnly: true,
    emptyHint: 'Sin fiestas vinculadas por ahora.',
  },
  festival: {
    header: 'PRÓXIMAS EDICIONES',
    types: ['evento'],
    upcomingOnly: true,
    emptyHint: 'Sin ediciones anunciadas por ahora.',
  },
  club: {
    header: 'PRÓXIMOS EVENTOS EN ESTE CLUB',
    types: ['evento'],
    upcomingOnly: true,
    emptyHint: 'Sin eventos vinculados a este club por ahora.',
  },
  'mix-series': {
    header: 'EPISODIOS / MIXES',
    types: ['mix'],
    upcomingOnly: false,
    emptyHint: 'Sin episodios vinculados por ahora.',
  },
  medios: null,
  // A plataforma (ticketing / service) has no catalogue of its own here.
  plataforma: null,
}

// Split a franja's attributed items into live (upcoming / current) and
// archive (past). The archive bucket only fills for slots that have a
// chronological notion of "past" — eventos for venue/promoter kinds. Other
// slots (label releases, promo campaigns) put everything in `live`.
interface FranjaSplit {
  live: ContentItem[]
  archive: ContentItem[]
}

export function useFranjaItems(
  franjaId: string,
  slot: KindSlot | null,
): FranjaSplit {
  const [tick, setTick] = useState(0)
  useEffect(() => subscribeItems(() => setTick((n) => n + 1)), [])

  return useMemo<FranjaSplit>(() => {
    if (!slot || slot.types.length === 0) return { live: [], archive: [] }
    const now = Date.now()
    const all = getAllItemsSync().filter(
      (i) => i.franjaId === franjaId && slot.types.includes(i.type),
    )

    // For slots without a chronological "past" (label/promo), everything is
    // live; sort newest-first.
    if (!slot.upcomingOnly) {
      return {
        live: all
          .sort(
            (a, b) =>
              new Date(b.date ?? b.publishedAt).getTime() -
              new Date(a.date ?? a.publishedAt).getTime(),
          )
          .slice(0, 8),
        archive: [],
      }
    }

    // For venue/promoter eventos: split by end-of-event time, sort live
    // ascending (next-up first), archive descending (most recent past first).
    const live: ContentItem[] = []
    const archive: ContentItem[] = []
    for (const i of all) {
      const end = i.endDate ?? i.date ?? i.publishedAt
      ;(new Date(end).getTime() >= now ? live : archive).push(i)
    }
    live.sort(
      (a, b) =>
        new Date(a.date ?? a.publishedAt).getTime() -
        new Date(b.date ?? b.publishedAt).getTime(),
    )
    archive.sort(
      (a, b) =>
        new Date(b.date ?? b.publishedAt).getTime() -
        new Date(a.date ?? a.publishedAt).getTime(),
    )
    return { live: live.slice(0, 8), archive: archive.slice(0, 12) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [franjaId, slot, tick])
}

// Catalog facts — real counts of a franja's //PRESENTA-attributed work,
// recomputed on cache updates. These REPLACE vanity metrics (followers /
// sales / ratings): they describe the body of work, not popularity. See
// wiki/90-Decisions/Size and Position as Only Signals.
export function useFranjaCounts(franjaId: string) {
  const [tick, setTick] = useState(0)
  useEffect(() => subscribeItems(() => setTick((n) => n + 1)), [])
  return useMemo(() => {
    const all = getAllItemsSync().filter((i) => i.franjaId === franjaId)
    return {
      eventos: all.filter((i) => i.type === 'evento').length,
      lanzamientos: all.filter((i) => i.type === 'mix' || i.type === 'review')
        .length,
      articulos: all.filter(
        (i) => i.type === 'articulo' || i.type === 'listicle',
      ).length,
      total: all.length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [franjaId, tick])
}

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`${LABEL} text-ink-soft`}>{label}</span>
      <span className="font-mono text-d13 font-bold tabular-nums text-ink">
        {value}
      </span>
    </div>
  )
}

// Resolve the franja-chosen //HISTORIA DESTACADA item from its id against the
// live item cache. Null when unset or not (yet) in the cache.
export function useFeaturedItem(
  featuredItemId: string | undefined,
): ContentItem | null {
  const [tick, setTick] = useState(0)
  useEffect(() => subscribeItems(() => setTick((n) => n + 1)), [])
  return useMemo(() => {
    if (!featuredItemId) return null
    return getAllItemsSync().find((i) => i.id === featuredItemId) ?? null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredItemId, tick])
}

// Section head — mono kicker on an ink hairline. `accent` puts the kicker in
// sys-red-paper (the editorial/public register: //HISTORIA DESTACADA,
// //MERCADO); everything else stays ink.
function ZoneHead({
  label,
  count,
  accent = false,
}: {
  label: string
  count?: number
  accent?: boolean
}) {
  return (
    <h2
      className={`flex items-baseline gap-2 border-b border-ink pb-1.5 ${LABEL} ${
        accent ? 'text-sys-red-paper' : 'text-ink'
      }`}
    >
      <span>{label}</span>
      {typeof count === 'number' && (
        <span className="font-mono text-d11 font-normal tracking-widest text-ink-faint">
          ({count})
        </span>
      )}
    </h2>
  )
}

// Type chip — 2-letter code + display label beside the category swatch. Hue
// is never the sole signal (same anatomy as OverlayShell's header chip).
function TypeChip({ type }: { type: ContentType }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 border border-ink bg-paper-raised px-1.5 py-0.5 ${LABEL} text-ink`}
    >
      <span
        aria-hidden
        className="h-[9px] w-[9px] shrink-0"
        style={{ backgroundColor: categoryColorOnLight(type) }}
      />
      {TYPE_LABEL[type]}
    </span>
  )
}

export function FranjaOverlay({ item, exiting, onExited }: Props) {
  const kind = item.franjaKind ?? 'colectivo'
  const slot = KIND_SLOT[kind]
  const franjaItems = useFranjaItems(item.id, slot)
  const counts = useFranjaCounts(item.id)
  const featured = useFeaturedItem(item.featuredItemId)
  const lastUpdated = item.franjaLastUpdated ?? item.publishedAt
  const { open, close } = useOverlay()

  // Only one peek expanded at a time — the rest of the list stays compact
  // so the user always has a clear scan of what else this franja has.
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Marketplace listing sub-overlay — LOCAL state (not a URL param) so it
  // never fights useOverlay's ?item= management. Stacks z-[60] over the
  // dossier; the dossier's ESC + backdrop close are gated on `!activeListingId`
  // so a listing closes first.
  const [activeListingId, setActiveListingId] = useState<string | null>(null)

  // Marketplace listings the //MERCADO zone surfaces, newest first. Empty
  // unless the franja is marketplace-enabled.
  const listings = useMemo(
    () =>
      item.marketplaceEnabled
        ? [...(item.marketplaceListings ?? [])].sort(
            (a, b) =>
              new Date(b.publishedAt).getTime() -
              new Date(a.publishedAt).getTime(),
          )
        : [],
    [item.marketplaceEnabled, item.marketplaceListings],
  )
  const activeListing = useMemo(() => {
    if (!activeListingId) return null
    const idx = listings.findIndex((l) => l.id === activeListingId)
    return idx < 0 ? null : { listing: listings[idx], index: idx + 1 }
  }, [activeListingId, listings])

  // Lock body scroll while the dossier is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ESC closes via the overlay router (clears ?item=, which flips `exiting`).
  // Gated on `!activeListingId` so when a listing sub-overlay is open, its own
  // ESC handler closes THAT first rather than the whole dossier.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !activeListingId) close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close, activeListingId])

  // When the router flags `exiting`, play the out animation, then unmount.
  // Timeout matches overlay-panel-out (0.24s) + buffer.
  useEffect(() => {
    if (!exiting) return
    const t = setTimeout(onExited, 320)
    return () => clearTimeout(t)
  }, [exiting, onExited])

  return (
    <div
      className={
        'fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 ' +
        (exiting ? 'overlay-backdrop-out' : 'overlay-backdrop-in')
      }
      onClick={() => {
        if (!activeListingId) close()
      }}
    >
      {/* Ink scrim — flat, no blur (fase C law). */}
      <div className="absolute inset-0 bg-ink/60" aria-hidden />

      <div
        onClick={(e) => e.stopPropagation()}
        className={
          'relative z-10 flex w-full max-w-6xl flex-col overflow-hidden border border-ink bg-paper text-ink ' +
          (exiting ? 'overlay-panel-out' : 'overlay-panel-in')
        }
        style={{ maxHeight: 'min(94dvh, 1000px)' }}
      >
        {/* Chrome / header — raised paper band, same anatomy as OverlayShell */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-ink bg-paper-raised px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`flex shrink-0 items-center gap-1.5 ${LABEL} text-ink`}>
              <span
                aria-hidden
                className="h-[9px] w-[9px] shrink-0"
                style={{ backgroundColor: categoryColorOnLight('franja') }}
              />
              {TYPE_CODES.franja} · {TYPE_DISPLAY_LABELS.franja}
            </span>
            <span className="hidden truncate font-mono text-d11 uppercase tracking-widest text-ink-faint sm:inline">
              {item.slug}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShareButton item={item} />
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className={`flex min-h-11 shrink-0 items-center gap-2 border border-ink bg-ink px-3 ${LABEL} text-paper transition-colors hover:bg-paper hover:text-ink ${FOCUS_RING}`}
            >
              <X size={12} className="sm:hidden" />
              <span>CERRAR</span>
              <span className="hidden sm:inline">ESC</span>
            </button>
          </div>
        </header>

        {/* Scrollable dossier body — two-pane: identity left, content right */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain md:flex-row">
          {/* IDENTITY PANEL — left */}
          <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-ink bg-paper-raised p-4 md:w-[340px] md:border-b-0 md:border-r md:p-5">
            {/* Logo plate — object-contain so logo franjas (Club Japan,
                labels) aren't cropped. */}
            <div className="relative aspect-[4/3] w-full overflow-hidden border border-ink bg-paper">
              {item.imageUrl ? (
                <SmartImage
                  src={item.imageUrl}
                  alt={item.title}
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-mono text-d11 uppercase tracking-widest text-ink-faint">
                    SIN IMAGEN
                  </span>
                </div>
              )}
              <span
                className={`absolute left-2 top-2 border border-ink bg-paper-raised px-1.5 py-0.5 ${LABEL} text-ink`}
              >
                {KIND_LABEL[kind]}
              </span>
            </div>

            {/* Head */}
            <header className="flex flex-col gap-2">
              <h1 className="font-syne text-d28 font-extrabold leading-none text-ink">
                {item.title}
              </h1>
              {item.verified && (
                <span
                  className={`inline-flex w-fit items-center gap-1.5 border border-ink bg-ink px-2 py-0.5 ${LABEL} text-paper`}
                  title="Franja verificada"
                >
                  ✓ VERIFICADA
                </span>
              )}
              {item.subtitle && (
                <p className="font-grotesk text-d15 leading-relaxed text-ink-soft">
                  {item.subtitle}
                </p>
              )}
            </header>

            {/* Ficha — actualizado / ubicación / web, on hairline rules */}
            <dl className="flex flex-col border-t border-ink">
              <div className="flex items-baseline justify-between gap-3 border-b border-ink py-2">
                <dt className={`${LABEL} text-ink-faint`}>ACTUALIZADO</dt>
                <dd className="font-mono text-d13 font-bold text-ink">
                  {fmtDateFull(lastUpdated)}
                </dd>
              </div>
              {item.marketplaceLocation && (
                <div className="flex items-baseline justify-between gap-3 border-b border-ink py-2">
                  <dt className={`flex items-center gap-1.5 ${LABEL} text-ink-faint`}>
                    <MapPin size={11} />
                    UBICACIÓN
                  </dt>
                  <dd className="min-w-0 truncate font-mono text-d13 font-bold text-ink">
                    {item.marketplaceLocation}
                  </dd>
                </div>
              )}
              {item.franjaUrl && (
                <div className="flex items-baseline justify-between gap-3 border-b border-ink py-2">
                  <dt className={`${LABEL} text-ink-faint`}>WEB</dt>
                  <dd className="min-w-0 truncate font-mono text-d13 font-bold text-ink">
                    {item.franjaUrl.replace(/^https?:\/\//, '')}
                  </dd>
                </div>
              )}
            </dl>

            {/* Catalog facts — real counts of the franja's //PRESENTA-attributed
            work. These REPLACE vanity metrics (followers / sales / ratings):
            they describe the body of work, not popularity. */}
            {(counts.total > 0 || item.year) && (
              <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-ink pb-3">
                {item.year ? (
                  <Fact label="DESDE" value={String(item.year)} />
                ) : null}
                {counts.eventos > 0 ? (
                  <Fact label="EVENTOS" value={String(counts.eventos)} />
                ) : null}
                {counts.lanzamientos > 0 ? (
                  <Fact
                    label="LANZAMIENTOS"
                    value={String(counts.lanzamientos)}
                  />
                ) : null}
                {counts.articulos > 0 ? (
                  <Fact label="ARTÍCULOS" value={String(counts.articulos)} />
                ) : null}
              </dl>
            )}

            {item.excerpt && (
              <p className="font-grotesk text-d15 leading-relaxed text-ink-soft">
                {item.excerpt}
              </p>
            )}

            {/* CTA — ENTRAR is the primary action: the full /f/[slug] profile
                page, so it takes the ink fill block. VISITAR SITIO (the
                franja's external site) is the bordered secondary. */}
            <Link
              href={`/f/${item.slug}`}
              onClick={close}
              className={`inline-flex min-h-11 items-center justify-center gap-2 border border-ink bg-ink px-4 ${LABEL} text-paper transition-colors hover:bg-paper hover:text-ink ${FOCUS_RING}`}
            >
              ENTRAR AL PERFIL DE FRANJA
              <ArrowUpRight size={14} />
            </Link>
            {item.franjaUrl && (
              <a
                href={item.franjaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-h-11 items-center justify-center gap-2 border border-ink px-4 ${LABEL} text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
              >
                <ExternalLink size={13} />
                VISITAR SITIO
              </a>
            )}
          </aside>

          {/* CONTENT — right */}
          <section className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
            {/* //HISTORIA DESTACADA — the franja-chosen flagship item; the
                front page of the dossier. Opens the full item overlay on click.
                Hidden when no pick is set (no auto-selection — editorial intent
                only, keeps it No-Algorithm-safe). */}
            {featured && (
              <section className="flex flex-col gap-3">
                <ZoneHead label="//HISTORIA DESTACADA" accent />
                <button
                  type="button"
                  onClick={() => open(featured.slug)}
                  aria-label={`Abrir ${featured.title}`}
                  className={`group block w-full overflow-hidden border border-ink bg-paper-raised text-left ${FOCUS_RING}`}
                >
                  {/* Plate — artwork stays clean; the caption zone below
                      carries every piece of chrome (fase B card law). */}
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-ink/10">
                    {featured.imageUrl ? (
                      <SmartImage
                        src={featured.imageUrl}
                        alt=""
                        sizes="(max-width: 768px) 100vw, 480px"
                        className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-mono text-d11 uppercase tracking-widest text-ink-faint">
                        SIN IMAGEN
                      </div>
                    )}
                  </div>
                  <div className="flex items-end justify-between gap-3 border-t border-ink p-3">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <TypeChip type={featured.type} />
                      <h3 className="font-syne text-d18 font-extrabold leading-tight text-ink">
                        {featured.title}
                      </h3>
                    </div>
                    <span
                      className={`shrink-0 ${LABEL} text-ink-soft transition-colors group-hover:text-ink`}
                    >
                      VER →
                    </span>
                  </div>
                </button>
              </section>
            )}

            {slot && (
              // LayoutGroup spans both grids so an expansion in archive doesn't
              // conflict with live (and vice-versa). Each section keeps its own
              // header + grid for clear visual separation.
              <LayoutGroup>
                <section className="flex flex-col gap-3">
                  <ZoneHead label={slot.header} />

                  {kind === 'dealer' ? (
                    <p className="font-grotesk text-d13 leading-relaxed text-ink-soft">
                      {slot.emptyHint}
                    </p>
                  ) : franjaItems.live.length === 0 ? (
                    <EmptyZone hint={slot.emptyHint} />
                  ) : (
                    <ul
                      className="grid gap-3"
                      style={{
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(160px, 1fr))',
                      }}
                    >
                      {franjaItems.live.map((linked) => (
                        <FranjaLinkedPeek
                          key={linked.id}
                          item={linked}
                          isExpanded={expandedId === linked.id}
                          onToggle={() =>
                            setExpandedId(
                              expandedId === linked.id ? null : linked.id,
                            )
                          }
                        />
                      ))}
                    </ul>
                  )}
                </section>

                {/* Archive — past events for venue/promoter slots. Renders only
                when there's anything to show; shares the peek-card layout
                with a //PASADO stamp to mark them as historical. */}
                {franjaItems.archive.length > 0 && (
                  <section className="flex flex-col gap-3">
                    <ZoneHead
                      label="ARCHIVO · EVENTOS PASADOS"
                      count={franjaItems.archive.length}
                    />
                    <ul
                      className="grid gap-3"
                      style={{
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(160px, 1fr))',
                      }}
                    >
                      {franjaItems.archive.map((linked) => (
                        <FranjaLinkedPeek
                          key={linked.id}
                          item={linked}
                          isExpanded={expandedId === linked.id}
                          isPast
                          onToggle={() =>
                            setExpandedId(
                              expandedId === linked.id ? null : linked.id,
                            )
                          }
                        />
                      ))}
                    </ul>
                  </section>
                )}
              </LayoutGroup>
            )}

            {/* //MERCADO — folded-in marketplace listings. Clicking a card
                opens the listing detail as a z-[60] sub-overlay (local state),
                so the user stays in the dossier instead of routing away. */}
            {listings.length > 0 && (
              <section className="flex flex-col gap-3">
                <ZoneHead label="//MERCADO" count={listings.length} accent />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {listings.map((l, i) => (
                    <MarketplaceListingCard
                      key={l.id}
                      listing={l}
                      franja={item}
                      index={i + 1}
                      onClick={() => setActiveListingId(l.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {!slot && listings.length === 0 && (
              <p className="font-grotesk text-d13 leading-relaxed text-ink-soft">
                Este franja aún no tiene contenido vinculado ni listados.
              </p>
            )}
          </section>
        </div>

        {/* Mobile dismiss bar */}
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className={`flex min-h-[44px] shrink-0 items-center justify-center gap-2 border-t border-ink bg-paper-raised px-4 ${LABEL} text-ink transition-colors active:bg-ink active:text-paper sm:hidden ${FOCUS_RING}`}
        >
          <X size={14} />
          <span>CERRAR</span>
        </button>
      </div>

      {/* Listing detail — stacks z-[60] above the dossier. Local-state driven
          so it never touches useOverlay's ?item= URL management. */}
      {activeListing && (
        <MarketplaceListingDetail
          listing={activeListing.listing}
          franja={item}
          index={activeListing.index}
          onClose={() => setActiveListingId(null)}
        />
      )}
    </div>
  )
}

// Empty zone — a ruled, dashed placeholder in the paper register. No fake
// rows, no fake status: it says what's missing and stops.
function EmptyZone({ hint }: { hint: string }) {
  return (
    <div className="flex flex-col items-start gap-1.5 border border-dashed border-ink-faint bg-paper-raised p-4">
      <span className={`${LABEL} text-ink-faint`}>//SIN·VÍNCULOS·VISIBLES</span>
      <p className="font-grotesk text-d13 leading-relaxed text-ink-soft">
        {hint}
      </p>
    </div>
  )
}

// ── FranjaLinkedPeek ──────────────────────────────────────────────────────
//
// Vertical flyer-forward card (same vocabulary as EventoRailCard). Two
// modes:
//
//   • Compact — single grid column, aspect-[4/5] flyer plate at top, type
//     chip + title + venue in the caption band below.
//   • Expanded — col-span-3 with internal flex-row split: flyer stays its
//     full aspect on the left, meta + CTA fill the right column, and the
//     card lifts onto paper-raised.
//
// Click on the flyer or the compact title toggles. Inside expanded, the X
// button at the top-right of the right column also collapses. The only
// path to the full overlay is the explicit `VER FICHA COMPLETA →` CTA,
// keeping users in the franja context until they commit.

export function FranjaLinkedPeek({
  item,
  isExpanded,
  onToggle,
  isPast = false,
}: {
  item: ContentItem
  isExpanded: boolean
  onToggle: () => void
  /** When true, the card is part of the archive — adds a //PASADO stamp
   *  and dims the flyer slightly so it reads as historical. */
  isPast?: boolean
}) {
  const { open } = useOverlay()
  const d = item.date ? parseISO(item.date) : null

  const handleOpenFull = (e: React.MouseEvent) => {
    e.stopPropagation()
    open(item.slug)
  }

  // FLIP transition tuned to match the rest of the site's overlay easing
  // (matches OverlayShell motion). Slightly longer so the simultaneous
  // grid-cell + flex-direction change reads as deliberate rather than
  // bouncy.
  const layoutTransition = {
    duration: 0.45,
    ease: [0.22, 0.8, 0.32, 1] as const,
  }

  return (
    <motion.li
      layout
      transition={layoutTransition}
      className={`border border-ink ${isExpanded ? 'bg-paper-raised' : 'bg-paper'}`}
      style={{
        gridColumn: isExpanded ? 'span 3 / span 3' : 'span 1 / span 1',
      }}
    >
      <motion.article
        layout
        transition={layoutTransition}
        className={`flex ${isExpanded ? 'flex-col items-stretch sm:flex-row sm:items-start' : 'flex-col'}`}
      >
        {/* Flyer — always a toggle button. `self-start` in row mode keeps it
            anchored at the top-left at its natural aspect height; the meta
            column can grow taller without leaving blank space around the
            flyer. */}
        <motion.button
          layout
          transition={layoutTransition}
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={
            isExpanded ? `Cerrar ${item.title}` : `Abrir ${item.title}`
          }
          className={`group relative shrink-0 overflow-hidden text-left ${FOCUS_RING} ${
            isExpanded ? 'w-full sm:w-[200px]' : 'w-full'
          }`}
        >
          <div className="relative aspect-[4/5] overflow-hidden bg-ink/10">
            {item.imageUrl ? (
              <SmartImage
                src={item.imageUrl}
                alt=""
                sizes="(max-width: 768px) 45vw, 240px"
                className={`object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105 ${
                  isPast ? 'opacity-60 grayscale-[40%]' : ''
                }`}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                  SIN IMAGEN
                </span>
              </div>
            )}

            {/* Printed date sticker — paper plate on an ink hairline, the
                one piece of chrome allowed to sit on the flyer (matches the
                EventoOverlay gig-poster sticker). */}
            {d && (
              <div className="absolute right-2 top-2 flex flex-col items-center border border-ink bg-paper-raised px-1.5 py-1 text-center">
                <span className="font-mono text-[8px] font-bold tracking-widest text-ink">
                  {format(d, 'MMM', { locale: es }).toUpperCase()}
                </span>
                <span className="font-syne text-base font-black leading-none tabular-nums text-ink">
                  {format(d, 'd')}
                </span>
                <span className="font-mono text-[7px] font-bold tracking-widest text-ink">
                  {format(d, 'EEE', { locale: es }).toUpperCase()}
                </span>
              </div>
            )}

            {/* //PASADO stamp — only on archive cards. Sits bottom-left so it
                never fights the date sticker. */}
            {isPast && (
              <span className="absolute bottom-2 left-2 border border-ink bg-paper-raised px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-ink-faint">
                //PASADO
              </span>
            )}
          </div>
        </motion.button>

        {/* Meta column. Expanded: title pinned top, meta in middle, CTA pinned
            bottom — `justify-between` removes the awkward gap above the title
            we hit with `mt-auto`-only. Compact: type chip + title + venue. */}
        <motion.div
          layout
          transition={layoutTransition}
          className={
            isExpanded
              ? 'relative flex min-w-0 flex-1 flex-col justify-between gap-4 border-t border-ink p-4 sm:border-l sm:border-t-0 sm:p-5'
              : 'flex flex-col gap-1.5 border-t border-ink p-2.5'
          }
        >
          {isExpanded ? (
            <>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={onToggle}
                  aria-label="Cerrar preview"
                  className={`absolute right-2 top-2 flex min-h-11 items-center gap-1 border border-ink bg-paper px-2 ${LABEL} text-ink transition-colors hover:bg-ink hover:text-paper ${FOCUS_RING}`}
                >
                  <X size={10} />
                  CERRAR
                </button>

                <div className="flex flex-col gap-2 pr-24">
                  <TypeChip type={item.type} />
                  <h3 className="font-syne text-d18 font-extrabold leading-tight text-ink md:text-d28">
                    {item.title}
                  </h3>
                </div>

                <PeekBody item={item} />
              </div>

              <button
                type="button"
                onClick={handleOpenFull}
                className={`inline-flex min-h-11 items-center justify-center gap-2 self-start border border-ink bg-ink px-3 ${LABEL} text-paper transition-colors hover:bg-paper hover:text-ink ${FOCUS_RING}`}
              >
                VER FICHA COMPLETA
                <ArrowUpRight size={12} />
              </button>
            </>
          ) : (
            <>
              <TypeChip type={item.type} />
              <h3 className="line-clamp-2 font-syne text-d13 font-extrabold leading-tight text-ink">
                {item.title}
              </h3>
              {item.venue && (
                <p className="line-clamp-1 font-mono text-[9px] uppercase tracking-widest text-ink-faint">
                  {item.venue}
                </p>
              )}
            </>
          )}
        </motion.div>
      </motion.article>
    </motion.li>
  )
}

// Kind-aware preview body — just the essential meta rows. No excerpt; the
// user commits to the full overlay (via VER FICHA COMPLETA) if they want
// the description / body / tracklist.

function PeekBody({ item }: { item: ContentItem }) {
  if (item.type === 'evento') {
    return (
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2">
        {item.venue && (
          <>
            <dt className={`flex items-center gap-1.5 ${LABEL} text-ink-faint`}>
              <MapPin size={11} />
              LUGAR
            </dt>
            <dd className="font-mono text-d13 text-ink">
              {item.venue}
              {item.venueCity && (
                <span className="text-ink-faint"> · {item.venueCity}</span>
              )}
            </dd>
          </>
        )}
        {item.date && (
          <>
            <dt className={`flex items-center gap-1.5 ${LABEL} text-ink-faint`}>
              <Calendar size={11} />
              FECHA
            </dt>
            <dd className="font-mono text-d13 text-ink">
              {fmtDateFull(item.date)}
            </dd>
          </>
        )}
        {item.artists && item.artists.length > 0 && (
          <>
            <dt className={`flex items-center gap-1.5 ${LABEL} text-ink-faint`}>
              <Users size={11} />
              LINE-UP
            </dt>
            <dd className="font-mono text-d13 text-ink">
              {item.artists.join(' · ')}
            </dd>
          </>
        )}
      </dl>
    )
  }

  if (item.type === 'mix') {
    return (
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2">
        {item.duration && (
          <>
            <dt className={`${LABEL} text-ink-faint`}>DURACIÓN</dt>
            <dd className="font-mono text-d13 text-ink">{item.duration}</dd>
          </>
        )}
        {item.bpmRange && (
          <>
            <dt className={`${LABEL} text-ink-faint`}>BPM</dt>
            <dd className="font-mono text-d13 text-ink">{item.bpmRange}</dd>
          </>
        )}
        {item.tracklist && item.tracklist.length > 0 && (
          <>
            <dt className={`${LABEL} text-ink-faint`}>TRACKS</dt>
            <dd className="font-mono text-d13 tabular-nums text-ink">
              {item.tracklist.length}
            </dd>
          </>
        )}
      </dl>
    )
  }

  // Article / review / noticia / listicle — show date + author when available.
  return (
    <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2">
      {item.publishedAt && (
        <>
          <dt className={`flex items-center gap-1.5 ${LABEL} text-ink-faint`}>
            <Calendar size={11} />
            PUBLICADO
          </dt>
          <dd className="font-mono text-d13 text-ink">
            {fmtDateFull(item.publishedAt)}
          </dd>
        </>
      )}
      {item.author && (
        <>
          <dt className={`${LABEL} text-ink-faint`}>AUTOR</dt>
          <dd className="font-mono text-d13 text-ink">{item.author}</dd>
        </>
      )}
    </dl>
  )
}
