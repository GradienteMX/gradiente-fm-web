'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
  Mail,
  MapPin,
} from 'lucide-react'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ContentItem } from '@/lib/types'
import { categoryColor, fmtDateFull } from '@/lib/utils'
import { useOverlay } from '@/components/overlay/useOverlay'
import { KIND_LABEL, TYPE_LABEL } from '@/components/overlay/PartnerOverlay'
import { MarketplaceListingCard } from '@/components/marketplace/MarketplaceListingCard'
import { MarketplaceListingDetail } from '@/components/marketplace/MarketplaceListingDetail'

// ── PartnerProfile ──────────────────────────────────────────────────────────
//
// The full /p/[slug] partner page (Concept-1 editorial dossier). Recreates the
// reference mockup: header dossier + résumé (catalog facts only — NO vanity
// metrics per [[Size and Position as Only Signals]]) + última actividad,
// //PRÓXIMOS rail, //ARCHIVO with type tabs, //MERCADO (real listings), a
// //SEÑALES mockup (digital cosmetics — no product class exists yet; rides the
// unbuilt payments spine), and a //COMUNIDAD strip.
//
// `attributedItems` is fetched SERVER-SIDE (getItemsByPartner) so a direct
// visit works — the client itemsCache is only warm on grid pages. Opening a
// linked item uses useOverlay().open() so it stacks over the page (OverlayRouter
// lives in the layout).

// SEÑALES — MOCKUP DATA. Gradiente-native digital cosmetics that alter a user's
// presence (emoji / profile / shader / collectible). No product class exists
// yet — these ride the separate, unbuilt payments + order_items spine and MUST
// stay disjoint from EARNED trophies/frames/emoji. Display-only until then.
const MOCK_SENALES = [
  {
    id: 'se-emoji',
    tag: 'EXCLUSIVO',
    name: 'Emojis exclusivos',
    sub: 'Pack de reacciones',
    price: 40,
  },
  {
    id: 'se-perfil',
    tag: 'PERFIL',
    name: 'Sticker de perfil',
    sub: 'Marco / firma',
    price: 25,
  },
  {
    id: 'se-shader',
    tag: 'SHADER',
    name: 'Shader pack',
    sub: 'Para visuales',
    price: 90,
  },
  {
    id: 'se-visual',
    tag: 'COLECCIONABLE',
    name: 'Pack visual',
    sub: 'Fondos exclusivos',
    price: 120,
  },
]

const ARCHIVE_TABS: {
  key: string
  label: string
  types: ContentItem['type'][]
}[] = [
  { key: 'todo', label: 'TODO', types: [] },
  { key: 'eventos', label: 'EVENTOS', types: ['evento'] },
  { key: 'lanzamientos', label: 'LANZAMIENTOS', types: ['mix', 'review'] },
  { key: 'articulos', label: 'ARTÍCULOS', types: ['articulo', 'listicle'] },
  {
    key: 'noticias',
    label: 'NOTICIAS',
    types: ['noticia', 'editorial', 'opinion'],
  },
]

export function PartnerProfile({
  partner,
  attributedItems,
}: {
  partner: ContentItem
  attributedItems: ContentItem[]
}) {
  const item = partner
  const kind = item.partnerKind ?? 'promo'
  const { open } = useOverlay()
  const [activeListingId, setActiveListingId] = useState<string | null>(null)

  // Attributed content (//PRESENTA self-FK), server-fetched + sorted newest
  // first. Drives PRÓXIMOS / ARCHIVO / catalog facts / actividad / featured.
  const allItems = useMemo(
    () =>
      [...attributedItems].sort(
        (a, b) =>
          new Date(b.date ?? b.publishedAt).getTime() -
          new Date(a.date ?? a.publishedAt).getTime(),
      ),
    [attributedItems],
  )

  const counts = useMemo(
    () => ({
      eventos: allItems.filter((i) => i.type === 'evento').length,
      lanzamientos: allItems.filter(
        (i) => i.type === 'mix' || i.type === 'review',
      ).length,
      articulos: allItems.filter(
        (i) => i.type === 'articulo' || i.type === 'listicle',
      ).length,
      total: allItems.length,
    }),
    [allItems],
  )

  const featured = useMemo(
    () =>
      item.featuredItemId
        ? (allItems.find((i) => i.id === item.featuredItemId) ?? null)
        : null,
    [item.featuredItemId, allItems],
  )

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

  const proximos = useMemo(() => {
    const now = Date.now()
    return allItems
      .filter(
        (i) =>
          i.type === 'evento' &&
          new Date(i.endDate ?? i.date ?? i.publishedAt).getTime() >= now,
      )
      .sort(
        (a, b) =>
          new Date(a.date ?? a.publishedAt).getTime() -
          new Date(b.date ?? b.publishedAt).getTime(),
      )
  }, [allItems])

  const recent = allItems.slice(0, 3)

  return (
    <div className="flex flex-col gap-6">
      {/* ── HEADER DOSSIER ─────────────────────────────────────────────── */}
      <header className="grid grid-cols-1 gap-5 border border-border bg-surface p-4 md:grid-cols-[260px_1fr] md:p-6 lg:grid-cols-[260px_1fr_300px]">
        {/* Logo */}
        <div className="relative aspect-square w-full overflow-hidden border border-border bg-black">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.title}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-mono text-xs text-muted">SIN IMAGEN</span>
            </div>
          )}
          <span
            className="absolute left-3 top-3 border bg-black/70 px-2 py-1 font-mono text-[10px] tracking-widest backdrop-blur-sm"
            style={{ color: '#6B7280', borderColor: '#6B7280' }}
          >
            //{KIND_LABEL[kind]}
          </span>
        </div>

        {/* Identity */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-syne text-4xl font-black uppercase leading-[0.95] text-white md:text-5xl">
              {item.title}
            </h1>
            <span
              className="border px-2 py-0.5 font-mono text-[10px] tracking-widest"
              style={{ borderColor: '#F97316', color: '#F97316' }}
            >
              PARTNER
            </span>
            {item.verified && (
              <span
                className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest"
                style={{ color: '#4ADE80' }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-sys-green"
                  aria-hidden
                />
                VERIFICADO
              </span>
            )}
          </div>

          {(item.year || item.marketplaceLocation) && (
            <p className="font-mono text-[11px] tracking-widest text-muted">
              {item.year ? `DESDE ${item.year}` : ''}
              {item.year && item.marketplaceLocation ? ' · ' : ''}
              {item.marketplaceLocation?.toUpperCase() ?? ''}
            </p>
          )}

          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((t) => (
                <span
                  key={t}
                  className="border border-border bg-elevated/50 px-2 py-0.5 font-mono text-[10px] tracking-widest text-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {item.excerpt && (
            <p className="max-w-prose font-grotesk text-sm leading-relaxed text-secondary">
              {item.excerpt}
            </p>
          )}

          {item.partnerUrl && (
            <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-muted">
              <a
                href={item.partnerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-sys-orange"
              >
                <ExternalLink size={12} />
                {item.partnerUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
              <a
                href={item.partnerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-sys-orange"
              >
                <Mail size={12} />
                CONTACTO
              </a>
            </div>
          )}
        </div>

        {/* Résumé — catalog facts (NO vanity) + última actividad */}
        <aside className="flex flex-col gap-4 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div className="grid grid-cols-3 gap-x-4 gap-y-3">
            <StatCell label="EVENTOS" value={counts.eventos} />
            <StatCell label="LANZAMIENTOS" value={counts.lanzamientos} />
            <StatCell label="ARTÍCULOS" value={counts.articulos} />
            <StatCell label="PUBLICACIONES" value={counts.total} />
            <StatCell label="PRODUCTOS" value={listings.length} />
            {item.year ? <StatCell label="DESDE" value={item.year} /> : null}
          </div>

          {recent.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <span className="sys-label text-muted">ÚLTIMA ACTIVIDAD</span>
              {recent.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => open(r.slug)}
                  className="group flex flex-col items-start gap-0.5 text-left"
                >
                  <span className="font-mono text-[10px] tracking-widest text-muted">
                    NUEVO {TYPE_LABEL[r.type]}
                  </span>
                  <span className="line-clamp-1 font-grotesk text-xs text-secondary transition-colors group-hover:text-primary">
                    {r.title}
                  </span>
                  <span className="font-mono text-[9px] text-muted/70">
                    {ago(r.date ?? r.publishedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>
      </header>

      {/* ── BODY: main column + sidebar ────────────────────────────────── */}
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          {/* HISTORIA DESTACADA */}
          {featured && (
            <section className="flex flex-col gap-3">
              <SectionHeader>// HISTORIA DESTACADA</SectionHeader>
              <button
                type="button"
                onClick={() => open(featured.slug)}
                aria-label={`Abrir ${featured.title}`}
                className="group relative block w-full overflow-hidden border border-border text-left transition-colors hover:border-white/30"
              >
                <div className="relative aspect-[21/9] w-full overflow-hidden bg-base">
                  {featured.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={featured.imageUrl}
                      alt=""
                      className="h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-mono text-[10px] tracking-widest text-muted">
                      SIN IMAGEN
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <span
                    className="absolute left-4 top-4 bg-black/70 px-1.5 py-0.5 font-mono text-[9px] tracking-widest backdrop-blur-sm"
                    style={{ color: categoryColor(featured.type) }}
                  >
                    //{TYPE_LABEL[featured.type]}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                    <h3 className="font-syne text-2xl font-black leading-tight text-white md:text-3xl">
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

          {/* PRÓXIMOS — horizontal rail of upcoming events */}
          <section className="flex flex-col gap-3">
            <SectionHeader
              action={proximos.length > 0 ? 'VER AGENDA COMPLETA' : undefined}
            >
              // PRÓXIMOS
            </SectionHeader>
            {proximos.length === 0 ? (
              <EmptyZone hint="Sin eventos próximos vinculados por ahora." />
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {proximos.map((ev) => (
                  <MiniCard
                    key={ev.id}
                    item={ev}
                    onOpen={() => open(ev.slug)}
                    className="w-[200px] shrink-0"
                  />
                ))}
              </div>
            )}
          </section>

          {/* ARCHIVO — type-tabbed grid */}
          <ArchivoSection items={allItems} onOpen={(slug) => open(slug)} />
        </div>

        {/* Sidebar — MERCADO + SEÑALES */}
        <aside className="flex shrink-0 flex-col gap-8 lg:w-[340px]">
          {listings.length > 0 && (
            <section id="mercado" className="flex scroll-mt-24 flex-col gap-3">
              <SectionHeader
                action={item.partnerUrl ? 'VER TIENDA' : undefined}
              >
                // MERCADO
              </SectionHeader>
              <div className="grid grid-cols-2 gap-3">
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

          <SenalesSection />
        </aside>
      </div>

      {/* ── COMUNIDAD strip ────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <SectionHeader>// COMUNIDAD {item.title.toUpperCase()}</SectionHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <StatCell label="EVENTOS REALIZADOS" value={counts.eventos} />
            <StatCell label="PUBLICACIONES" value={counts.total} />
            {item.marketplaceLocation && (
              <div className="flex flex-col gap-0.5">
                <span className="sys-label text-muted">UBICACIÓN</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-sm text-secondary">
                  <MapPin size={12} />
                  {item.marketplaceLocation}
                </span>
              </div>
            )}
          </div>
          {/* Future affordance — club membership (guardados → club-perks
              roadmap). Display-only until that flow exists. */}
          <div className="flex flex-col items-start gap-2 md:items-end">
            <span className="font-mono text-[11px] tracking-widest text-muted">
              ¿ERES PARTE DE {item.title.toUpperCase()}?
            </span>
            <span
              className="inline-flex cursor-default items-center gap-2 border px-4 py-2.5 font-mono text-xs tracking-widest"
              style={{
                borderColor: '#F97316',
                color: '#F97316',
                backgroundColor: 'rgba(249,115,22,0.06)',
              }}
              title="Próximamente — membresía de club"
            >
              UNIRME AL CLUB
              <ArrowRight size={13} />
            </span>
          </div>
        </div>
      </section>

      {/* Listing detail — z-[60] sub-overlay */}
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

// ── Archive section (type tabs + grid) ──────────────────────────────────────

function ArchivoSection({
  items,
  onOpen,
}: {
  items: ContentItem[]
  onOpen: (slug: string) => void
}) {
  const [tab, setTab] = useState('todo')
  const active = ARCHIVE_TABS.find((t) => t.key === tab) ?? ARCHIVE_TABS[0]
  const filtered = useMemo(
    () =>
      active.types.length === 0
        ? items
        : items.filter((i) => active.types.includes(i.type)),
    [items, active],
  )

  if (items.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <SectionHeader>// ARCHIVO</SectionHeader>
        <EmptyZone hint="Sin contenido vinculado a este partner por ahora." />
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader>// ARCHIVO</SectionHeader>
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {ARCHIVE_TABS.map((t) => {
          const isActive = t.key === active.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="border px-2.5 py-1 font-mono text-[10px] tracking-widest transition-colors"
              style={{
                borderColor: isActive ? '#F97316' : 'transparent',
                color: isActive ? '#F97316' : '#888888',
                backgroundColor: isActive
                  ? 'rgba(249,115,22,0.08)'
                  : 'transparent',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      {filtered.length === 0 ? (
        <EmptyZone hint="Nada en esta categoría todavía." />
      ) : (
        <ul
          className="grid gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          }}
        >
          {filtered.map((i) => (
            <li key={i.id}>
              <MiniCard item={i} onOpen={() => onOpen(i.slug)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── Señales (mockup) ────────────────────────────────────────────────────────

function SenalesSection() {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader>// SEÑALES</SectionHeader>
      <p className="font-mono text-[10px] leading-relaxed text-muted">
        Cosméticos digitales que extienden tu presencia en Gradiente.
        <span style={{ color: '#6B7280' }}> // PRÓXIMAMENTE</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        {MOCK_SENALES.map((s) => (
          <article
            key={s.id}
            className="flex flex-col border border-border bg-elevated/20 p-3"
          >
            <span
              className="mb-2 self-start border px-1.5 py-0.5 font-mono text-[8px] tracking-widest"
              style={{ borderColor: '#7F77DD', color: '#9d96e8' }}
            >
              {s.tag}
            </span>
            <h4 className="font-syne text-xs font-bold leading-tight text-primary">
              {s.name}
            </h4>
            <span className="mt-0.5 font-mono text-[9px] tracking-wide text-muted">
              {s.sub}
            </span>
            <span className="mt-2 font-syne text-sm font-bold text-primary">
              ${s.price} MXN
            </span>
          </article>
        ))}
      </div>
      <span className="font-mono text-[9px] leading-relaxed text-muted">
        Los ingresos apoyan al partner. Cosméticos pagados nunca reemplazan
        logros ganados.
      </span>
    </section>
  )
}

// ── Shared bits ─────────────────────────────────────────────────────────────

function SectionHeader({
  children,
  action,
}: {
  children: ReactNode
  action?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-1">
      <span className="font-mono text-xs tracking-widest text-primary">
        {children}
      </span>
      {action && (
        <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-widest text-muted">
          {action} <ArrowUpRight size={11} />
        </span>
      )}
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="sys-label text-muted">{label}</span>
      <span className="font-syne text-lg font-black tabular-nums text-primary">
        {value}
      </span>
    </div>
  )
}

// Compact flyer-forward card for próximos + archivo. Click opens the item
// overlay over the page.
function MiniCard({
  item,
  onOpen,
  className = '',
}: {
  item: ContentItem
  onOpen: () => void
  className?: string
}) {
  const hasDate = !!item.date && !Number.isNaN(parseISO(item.date).getTime())
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir ${item.title}`}
      className={`group block w-full overflow-hidden border border-border bg-elevated/30 text-left transition-colors hover:border-white/30 ${className}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-base">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[9px] tracking-widest text-muted">
            SIN IMAGEN
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <span
          className="absolute left-2 top-2 bg-black/70 px-1.5 py-0.5 font-mono text-[8px] tracking-widest backdrop-blur-sm"
          style={{ color: categoryColor(item.type) }}
        >
          //{TYPE_LABEL[item.type]}
        </span>
      </div>
      <div className="p-2.5">
        <h3 className="line-clamp-2 font-syne text-xs font-bold leading-tight text-white">
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-1 font-mono text-[9px] tracking-wide text-muted">
          {item.venue ??
            (hasDate ? fmtDateFull(item.date!) : TYPE_LABEL[item.type])}
        </p>
      </div>
    </button>
  )
}

function ago(iso: string): string {
  try {
    return `HACE ${formatDistanceToNowStrict(parseISO(iso), {
      locale: es,
    }).toUpperCase()}`
  } catch {
    return ''
  }
}

function EmptyZone({ hint }: { hint: string }) {
  return (
    <div className="flex flex-col items-start gap-2 border border-dashed border-border bg-elevated/30 p-4 font-mono text-[11px] text-muted">
      <span className="tracking-widest" style={{ color: '#3a3a3a' }}>
        //SIN·VÍNCULOS·VISIBLES
      </span>
      <p>{hint}</p>
    </div>
  )
}
