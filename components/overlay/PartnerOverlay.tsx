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
import type { ContentItem, ContentType, PartnerKind } from '@/lib/types'
import { categoryColor, fmtDateFull } from '@/lib/utils'
import { getAllItemsSync, subscribeItems } from '@/lib/itemsCache'
import { useOverlay } from './useOverlay'
import { SmartImage } from '@/components/SmartImage'
import Link from 'next/link'
import { ShareButton } from './ShareButton'
import { MarketplaceListingCard } from '@/components/marketplace/MarketplaceListingCard'
import { MarketplaceListingDetail } from '@/components/marketplace/MarketplaceListingDetail'

// ── PartnerOverlay ─────────────────────────────────────────────────────────
//
// Partner profile shown when a card in [[PartnersRail]] is clicked. Same
// overlay grammar as every other ContentItem — opens via useOverlay().open()
// on `?item=<slug>`. Three sections stack vertically:
//
//   1. Dossier — cover (object-contain so logo partners aren't cropped),
//      kind badge, title, subtitle, excerpt (bio).
//   2. Body slot — kind-specific. Surfaces items where `partnerId === item.id`
//      (the //PRESENTA self-FK) as PartnerLinkedPeek cards that expand in
//      place to show a preview. Only the CTA inside the preview opens the
//      full item overlay — clicks on the card chrome stay on the partner.
//   3. CTA row — VISITAR SITIO (partnerUrl) + VER MARKETPLACE (only when
//      marketplaceEnabled).

interface Props {
  item: ContentItem
  /** Router-driven exit-animation flag (mirrors OverlayShell's contract). */
  exiting: boolean
  /** Called once the close animation finishes so the router can unmount. */
  onExited: () => void
}

export const KIND_LABEL: Record<PartnerKind, string> = {
  promo: 'PROMO',
  label: 'SELLO',
  promoter: 'PROMOTORA',
  venue: 'VENUE',
  sponsored: 'PATROCINIO',
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
  partner: 'PARTNER',
}

export interface KindSlot {
  header: string
  types: ContentType[]
  upcomingOnly: boolean
  emptyHint: string
}

export const KIND_SLOT: Record<PartnerKind, KindSlot | null> = {
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
  promo: {
    header: 'CAMPAÑAS ACTIVAS',
    types: ['evento', 'mix', 'noticia', 'listicle'],
    upcomingOnly: false,
    emptyHint: 'Sin contenido vinculado por ahora.',
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
  sponsored: null,
}

// Split a partner's attributed items into live (upcoming / current) and
// archive (past). The archive bucket only fills for slots that have a
// chronological notion of "past" — eventos for venue/promoter kinds. Other
// slots (label releases, promo campaigns) put everything in `live`.
interface PartnerSplit {
  live: ContentItem[]
  archive: ContentItem[]
}

export function usePartnerItems(
  partnerId: string,
  slot: KindSlot | null,
): PartnerSplit {
  const [tick, setTick] = useState(0)
  useEffect(() => subscribeItems(() => setTick((n) => n + 1)), [])

  return useMemo<PartnerSplit>(() => {
    if (!slot || slot.types.length === 0) return { live: [], archive: [] }
    const now = Date.now()
    const all = getAllItemsSync().filter(
      (i) => i.partnerId === partnerId && slot.types.includes(i.type),
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
  }, [partnerId, slot, tick])
}

// Catalog facts — real counts of a partner's //PRESENTA-attributed work,
// recomputed on cache updates. These REPLACE vanity metrics (followers /
// sales / ratings): they describe the body of work, not popularity. See
// wiki/90-Decisions/Size and Position as Only Signals.
export function usePartnerCounts(partnerId: string) {
  const [tick, setTick] = useState(0)
  useEffect(() => subscribeItems(() => setTick((n) => n + 1)), [])
  return useMemo(() => {
    const all = getAllItemsSync().filter((i) => i.partnerId === partnerId)
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
  }, [partnerId, tick])
}

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="sys-label">{label}</span>
      <span className="tabular-nums text-secondary">{value}</span>
    </div>
  )
}

// Resolve the partner-chosen //HISTORIA DESTACADA item from its id against the
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

export function PartnerOverlay({ item, exiting, onExited }: Props) {
  const kind = item.partnerKind ?? 'promo'
  const slot = KIND_SLOT[kind]
  const partnerItems = usePartnerItems(item.id, slot)
  const counts = usePartnerCounts(item.id)
  const featured = useFeaturedItem(item.featuredItemId)
  const lastUpdated = item.partnerLastUpdated ?? item.publishedAt
  const { open, close } = useOverlay()

  // Only one peek expanded at a time — the rest of the list stays compact
  // so the user always has a clear scan of what else this partner has.
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Marketplace listing sub-overlay — LOCAL state (not a URL param) so it
  // never fights useOverlay's ?item= management. Stacks z-[60] over the
  // dossier; the dossier's ESC + backdrop close are gated on `!activeListingId`
  // so a listing closes first.
  const [activeListingId, setActiveListingId] = useState<string | null>(null)

  // Marketplace listings the //MERCADO zone surfaces, newest first. Empty
  // unless the partner is marketplace-enabled.
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
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        aria-hidden
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className={
          'eva-box eva-scanlines relative z-10 flex w-full max-w-6xl flex-col overflow-hidden bg-base ' +
          (exiting ? 'overlay-panel-out' : 'overlay-panel-in')
        }
        style={{ maxHeight: 'min(94vh, 1000px)' }}
      >
        {/* Chrome */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-base/95 px-4 py-2.5 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-3 font-mono text-[10px] tracking-widest">
            <span style={{ color: categoryColor('partner') }}>//PARTNER</span>
            <span className="hidden truncate text-muted sm:inline">
              {item.slug}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3 font-mono text-[10px] tracking-widest text-muted">
            <ShareButton item={item} />
            <span className="hidden items-center gap-1.5 text-sys-green sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-green" />
              ONLINE
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className="flex items-center gap-1.5 border border-border/70 bg-black px-3 py-2 text-secondary transition-colors hover:border-white/60 hover:text-primary sm:gap-2 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-muted"
            >
              <span className="hidden sm:inline">[ESC]</span>
              <X size={14} className="sm:hidden" />
              <span>CERRAR</span>
            </button>
          </div>
        </header>

        {/* Scrollable dossier body — two-pane: identity left, content right */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row">
          {/* IDENTITY PANEL — left */}
          <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-border bg-elevated/20 p-4 md:w-[340px] md:border-b-0 md:border-r md:p-5">
            {/* Logo — object-contain so logo partners (Club Japan, labels)
                aren't cropped. */}
            <div className="relative aspect-[4/3] w-full overflow-hidden border border-border bg-black">
              {item.imageUrl ? (
                <SmartImage
                  src={item.imageUrl}
                  alt={item.title}
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-mono text-xs text-muted">
                    SIN IMAGEN
                  </span>
                </div>
              )}
              <span
                className="absolute left-3 top-3 border bg-black/70 px-2 py-1 font-mono text-[10px] tracking-widest backdrop-blur-sm"
                style={{ color: '#6B7280', borderColor: '#6B7280' }}
              >
                //{KIND_LABEL[kind]}
              </span>
            </div>
            {/* Header */}
            <header className="flex flex-col gap-2">
              <h1 className="font-syne text-3xl font-black leading-[1.05] text-white md:text-4xl">
                {item.title}
              </h1>
              {item.verified && (
                <span
                  className="inline-flex w-fit items-center gap-1.5 border px-2 py-0.5 font-mono text-[9px] tracking-widest"
                  style={{ borderColor: '#4ADE80', color: '#4ADE80' }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-sys-green"
                    aria-hidden
                  />
                  VERIFICADO
                </span>
              )}
              {item.subtitle && (
                <p className="font-grotesk text-sm text-secondary md:text-base">
                  {item.subtitle}
                </p>
              )}
            </header>

            {/* Meta — actualizado / ubicación / web */}
            <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-3 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="sys-label">ACTUALIZADO</span>
                <span className="text-secondary">
                  {fmtDateFull(lastUpdated)}
                </span>
              </div>
              {item.marketplaceLocation && (
                <div className="flex items-center gap-2">
                  <span className="sys-label flex items-center gap-1.5">
                    <MapPin size={11} />
                    UBICACIÓN
                  </span>
                  <span className="text-secondary">
                    {item.marketplaceLocation}
                  </span>
                </div>
              )}
              {item.partnerUrl && (
                <div className="flex items-center gap-2">
                  <span className="sys-label">WEB</span>
                  <span className="text-secondary">
                    {item.partnerUrl.replace(/^https?:\/\//, '')}
                  </span>
                </div>
              )}
            </dl>

            {/* Catalog facts — real counts of the partner's //PRESENTA-attributed
            work. These REPLACE vanity metrics (followers / sales / ratings):
            they describe the body of work, not popularity. */}
            {(counts.total > 0 || item.year) && (
              <dl className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-border pb-3 font-mono text-xs">
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
              <p className="font-grotesk text-base leading-relaxed text-secondary">
                {item.excerpt}
              </p>
            )}

            {/* CTA — ENTRAR is the primary action: the full /p/[slug] profile
                page. VISITAR SITIO (the partner's external site) is secondary. */}
            <Link
              href={`/p/${item.slug}`}
              onClick={close}
              className="inline-flex items-center justify-center gap-2 border px-4 py-3 font-mono text-xs font-bold tracking-widest transition-colors"
              style={{
                borderColor: '#F97316',
                color: '#F97316',
                backgroundColor: 'rgba(249,115,22,0.14)',
              }}
            >
              ENTRAR AL PERFIL DE PARTNER
              <ArrowUpRight size={14} />
            </Link>
            {item.partnerUrl && (
              <a
                href={item.partnerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 border border-border bg-elevated/40 px-4 py-3 font-mono text-xs tracking-widest text-primary transition-colors hover:border-white/60 hover:bg-elevated"
              >
                <ExternalLink size={13} />
                VISITAR SITIO
              </a>
            )}
          </aside>

          {/* CONTENT — right */}
          <section className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
            {/* //HISTORIA DESTACADA — the partner-chosen flagship item; the
                front page of the dossier. Opens the full item overlay on click.
                Hidden when no pick is set (no auto-selection — editorial intent
                only, keeps it No-Algorithm-safe). */}
            {featured && (
              <section className="flex flex-col gap-3">
                <h2 className="sys-label flex items-center gap-2 text-muted">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: '#F97316' }}
                    aria-hidden
                  />
                  //HISTORIA DESTACADA
                </h2>
                <button
                  type="button"
                  onClick={() => open(featured.slug)}
                  aria-label={`Abrir ${featured.title}`}
                  className="group relative block w-full overflow-hidden border border-border text-left transition-colors hover:border-white/30"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-base">
                    {featured.imageUrl ? (
                      <SmartImage
                        src={featured.imageUrl}
                        alt=""
                        sizes="(max-width: 768px) 100vw, 480px"
                        className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-mono text-[10px] tracking-widest text-muted">
                        SIN IMAGEN
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    <span
                      className="absolute left-3 top-3 bg-black/70 px-1.5 py-0.5 font-mono text-[9px] tracking-widest backdrop-blur-sm"
                      style={{ color: categoryColor(featured.type) }}
                    >
                      //{TYPE_LABEL[featured.type]}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                      <h3 className="font-syne text-lg font-black leading-tight text-white md:text-2xl">
                        {featured.title}
                      </h3>
                      <span className="shrink-0 font-mono text-[10px] tracking-widest text-sys-orange">
                        VER →
                      </span>
                    </div>
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
                  <h2 className="sys-label flex items-center gap-2 text-muted">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: '#6B7280' }}
                      aria-hidden
                    />
                    {slot.header}
                  </h2>

                  {kind === 'dealer' ? (
                    <p className="font-mono text-[11px] leading-relaxed text-muted">
                      {slot.emptyHint}
                    </p>
                  ) : partnerItems.live.length === 0 ? (
                    <div className="flex flex-col items-start gap-2 border border-dashed border-border bg-elevated/30 p-4 font-mono text-[11px] text-muted">
                      <span
                        className="tracking-widest"
                        style={{ color: '#3a3a3a' }}
                      >
                        //SIN·VÍNCULOS·VISIBLES
                      </span>
                      <p>{slot.emptyHint}</p>
                    </div>
                  ) : (
                    <ul
                      className="grid gap-3"
                      style={{
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(160px, 1fr))',
                      }}
                    >
                      {partnerItems.live.map((linked) => (
                        <PartnerLinkedPeek
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
                with a //PASADO ribbon to mark them as historical. */}
                {partnerItems.archive.length > 0 && (
                  <section className="flex flex-col gap-3">
                    <h2 className="sys-label flex items-center gap-2 text-muted">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full bg-muted/40"
                        aria-hidden
                      />
                      ARCHIVO · EVENTOS PASADOS
                      <span className="font-mono text-[10px] text-muted/70">
                        ({partnerItems.archive.length})
                      </span>
                    </h2>
                    <ul
                      className="grid gap-3"
                      style={{
                        gridTemplateColumns:
                          'repeat(auto-fill, minmax(160px, 1fr))',
                      }}
                    >
                      {partnerItems.archive.map((linked) => (
                        <PartnerLinkedPeek
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
                <h2 className="sys-label flex items-center gap-2 text-muted">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: '#F97316' }}
                    aria-hidden
                  />
                  //MERCADO
                  <span className="font-mono text-[10px] text-muted/70">
                    ({listings.length})
                  </span>
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {listings.map((l, i) => (
                    <MarketplaceListingCard
                      key={l.id}
                      listing={l}
                      partner={item}
                      index={i + 1}
                      onClick={() => setActiveListingId(l.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {!slot && listings.length === 0 && (
              <p className="font-mono text-[11px] leading-relaxed text-muted">
                Este partner aún no tiene contenido vinculado ni listados.
              </p>
            )}
          </section>
        </div>

        {/* Mobile dismiss bar */}
        <button
          type="button"
          onClick={close}
          aria-label="Cerrar"
          className="flex shrink-0 items-center justify-center gap-2 border-t border-border bg-base/95 px-4 py-3 font-mono text-[11px] tracking-widest text-primary backdrop-blur-sm transition-colors active:bg-elevated sm:hidden"
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
          partner={item}
          index={activeListing.index}
          onClose={() => setActiveListingId(null)}
        />
      )}
    </div>
  )
}

// ── PartnerLinkedPeek ──────────────────────────────────────────────────────
//
// Vertical flyer-forward card (same vocabulary as EventoRailCard). Two
// modes:
//
//   • Compact — single grid column, aspect-[4/5] flyer at top with type +
//     date badges, title + venue below.
//   • Expanded — col-span-2 with internal flex-row split: flyer stays its
//     full aspect on the left, meta + CTA fill the right column.
//
// Click on the flyer or the compact title toggles. Inside expanded, the X
// button at the top-right of the right column also collapses. The only
// path to the full overlay is the explicit `VER FICHA COMPLETA →` CTA,
// keeping users in the partner context until they commit.

export function PartnerLinkedPeek({
  item,
  isExpanded,
  onToggle,
  isPast = false,
}: {
  item: ContentItem
  isExpanded: boolean
  onToggle: () => void
  /** When true, the card is part of the archive — adds a //PASADO ribbon
   *  and dims the flyer slightly so it reads as historical. */
  isPast?: boolean
}) {
  const { open } = useOverlay()
  const typeColor = categoryColor(item.type)
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
      className="border bg-elevated/40"
      style={{
        borderColor: isExpanded ? typeColor : '#2a2a2a',
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
          className={`group relative shrink-0 overflow-hidden text-left ${
            isExpanded ? 'w-full sm:w-[200px]' : 'w-full'
          }`}
        >
          <div className="relative aspect-[4/5] overflow-hidden bg-base">
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
                <span className="font-mono text-[9px] tracking-widest text-muted">
                  SIN IMAGEN
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

            <span
              className="absolute left-2 top-2 bg-black/70 px-1.5 py-0.5 font-mono text-[9px] tracking-widest backdrop-blur-sm"
              style={{ color: isPast ? '#6B7280' : typeColor }}
            >
              //{TYPE_LABEL[item.type]}
            </span>

            {d && (
              <div
                className="absolute right-2 top-2 border bg-black/70 px-1.5 py-1 text-center font-mono backdrop-blur-sm"
                style={{
                  borderColor: isPast ? '#6B7280' : 'rgba(255,255,255,0.2)',
                  color: isPast ? '#6B7280' : '#fff',
                }}
              >
                <div className="text-[8px] font-bold tracking-widest">
                  {format(d, 'MMM', { locale: es }).toUpperCase()}
                </div>
                <div className="text-base font-bold leading-none tabular-nums">
                  {format(d, 'd')}
                </div>
                <div className="text-[7px] font-bold tracking-widest">
                  {format(d, 'EEE', { locale: es }).toUpperCase()}
                </div>
              </div>
            )}

            {/* //PASADO ribbon — only on archive cards. Sits at the bottom-
                left so it doesn't fight the type badge or date stamp. */}
            {isPast && (
              <span
                className="absolute bottom-2 left-2 border bg-black/85 px-1.5 py-0.5 font-mono text-[9px] tracking-widest backdrop-blur-sm"
                style={{ color: '#9CA3AF', borderColor: '#6B7280' }}
              >
                //PASADO
              </span>
            )}
          </div>
        </motion.button>

        {/* Meta column. Expanded: title pinned top, meta in middle, CTA pinned
            bottom — `justify-between` removes the awkward gap above the title
            we hit with `mt-auto`-only. Compact: minimal title + venue strip. */}
        <motion.div
          layout
          transition={layoutTransition}
          className={
            isExpanded
              ? 'relative flex min-w-0 flex-1 flex-col justify-between gap-4 p-4 sm:p-5'
              : 'p-2.5'
          }
        >
          {isExpanded ? (
            <>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={onToggle}
                  aria-label="Cerrar preview"
                  className="absolute right-2 top-2 flex items-center gap-1 border border-border bg-base/60 px-1.5 py-1 font-mono text-[9px] tracking-widest text-muted transition-colors hover:border-white/60 hover:text-primary"
                >
                  <X size={10} />
                  CERRAR
                </button>

                <h3 className="pr-20 font-syne text-xl font-black leading-tight text-white md:text-2xl">
                  {item.title}
                </h3>

                <PeekBody item={item} />
              </div>

              <button
                type="button"
                onClick={handleOpenFull}
                className="inline-flex items-center justify-center gap-2 self-start border px-3 py-2 font-mono text-[10px] tracking-widest transition-colors"
                style={{
                  borderColor: typeColor,
                  color: typeColor,
                  backgroundColor: `${typeColor}14`,
                }}
              >
                VER FICHA COMPLETA
                <ArrowUpRight size={12} />
              </button>
            </>
          ) : (
            <>
              <h3 className="line-clamp-2 font-syne text-xs font-bold leading-tight text-white">
                {item.title}
              </h3>
              {item.venue && (
                <p className="mt-1 line-clamp-1 font-mono text-[9px] tracking-wide text-muted">
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
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 font-mono text-[11px]">
        {item.venue && (
          <>
            <dt className="sys-label flex items-center gap-1.5">
              <MapPin size={11} />
              LUGAR
            </dt>
            <dd className="text-secondary">
              {item.venue}
              {item.venueCity && (
                <span className="text-muted"> · {item.venueCity}</span>
              )}
            </dd>
          </>
        )}
        {item.date && (
          <>
            <dt className="sys-label flex items-center gap-1.5">
              <Calendar size={11} />
              FECHA
            </dt>
            <dd className="text-secondary">{fmtDateFull(item.date)}</dd>
          </>
        )}
        {item.artists && item.artists.length > 0 && (
          <>
            <dt className="sys-label flex items-center gap-1.5">
              <Users size={11} />
              LINE-UP
            </dt>
            <dd className="text-secondary">{item.artists.join(' · ')}</dd>
          </>
        )}
      </dl>
    )
  }

  if (item.type === 'mix') {
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 font-mono text-[11px]">
        {item.duration && (
          <>
            <dt className="sys-label">DURACIÓN</dt>
            <dd className="text-secondary">{item.duration}</dd>
          </>
        )}
        {item.bpmRange && (
          <>
            <dt className="sys-label">BPM</dt>
            <dd className="text-secondary">{item.bpmRange}</dd>
          </>
        )}
        {item.tracklist && item.tracklist.length > 0 && (
          <>
            <dt className="sys-label">TRACKS</dt>
            <dd className="text-secondary">{item.tracklist.length}</dd>
          </>
        )}
      </dl>
    )
  }

  // Article / review / noticia / listicle — show date + author when available.
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 font-mono text-[11px]">
      {item.publishedAt && (
        <>
          <dt className="sys-label flex items-center gap-1.5">
            <Calendar size={11} />
            PUBLICADO
          </dt>
          <dd className="text-secondary">{fmtDateFull(item.publishedAt)}</dd>
        </>
      )}
      {item.author && (
        <>
          <dt className="sys-label">AUTOR</dt>
          <dd className="text-secondary">{item.author}</dd>
        </>
      )}
    </dl>
  )
}
